-- Migration: 00002_memory_and_knowledge.sql
-- Description: Memory system tables and enhanced knowledge functions

-- 1. Memory Entries Table (Long-term persistent memory)
CREATE TABLE public.memory_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    embedding vector(1536),  -- OpenAI text-embedding-3-small dimension
    scope_user_id TEXT,
    scope_product_id TEXT,
    scope_organization_id TEXT,
    scope_agent_id TEXT,
    scope_project_id TEXT,
    metadata JSONB DEFAULT '{}',
    ttl_seconds INTEGER,  -- NULL means no expiry
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE  -- computed from created_at + ttl
);

-- Indexes for memory queries
CREATE INDEX idx_memory_scope ON public.memory_entries(
    scope_product_id, scope_user_id, scope_agent_id
);
CREATE INDEX idx_memory_expiry ON public.memory_entries(expires_at) 
    WHERE expires_at IS NOT NULL;
CREATE INDEX idx_memory_embedding ON public.memory_entries 
    USING hnsw (embedding vector_cosine_ops);

-- 2. Sessions Table (Agent session state)
CREATE TABLE public.sessions (
    id TEXT PRIMARY KEY,
    agent_id TEXT,
    product_id TEXT,
    user_id TEXT,
    data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sessions_agent ON public.sessions(agent_id);
CREATE INDEX idx_sessions_user ON public.sessions(user_id);

-- 3. Conversation History Table (Persistent conversation storage)
CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL,  -- 'system', 'user', 'assistant', 'tool'
    content TEXT NOT NULL,
    tool_call_id TEXT,
    tool_calls JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_conversations_session ON public.conversations(session_id, created_at);

-- 4. RPC function for vector similarity search on memory_entries
CREATE OR REPLACE FUNCTION match_memory_entries(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10,
    filter_user_id TEXT DEFAULT NULL,
    filter_product_id TEXT DEFAULT NULL,
    filter_agent_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        me.id,
        me.content,
        me.metadata,
        1 - (me.embedding <=> query_embedding) AS similarity
    FROM public.memory_entries me
    WHERE
        (filter_user_id IS NULL OR me.scope_user_id = filter_user_id)
        AND (filter_product_id IS NULL OR me.scope_product_id = filter_product_id)
        AND (filter_agent_id IS NULL OR me.scope_agent_id = filter_agent_id)
        AND (me.expires_at IS NULL OR me.expires_at > NOW())
        AND 1 - (me.embedding <=> query_embedding) > match_threshold
    ORDER BY me.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 5. RPC function for vector similarity search on knowledge_vectors
CREATE OR REPLACE FUNCTION match_vectors(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10,
    filter_product_id TEXT DEFAULT NULL,
    filter_user_id TEXT DEFAULT NULL,
    filter_org_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    document_id UUID,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        kv.id,
        kv.document_id,
        kv.content,
        kv.metadata,
        1 - (kv.embedding <=> query_embedding) AS similarity
    FROM public.knowledge_vectors kv
    WHERE
        (filter_product_id IS NULL OR kv.product_id = filter_product_id)
        AND (filter_user_id IS NULL OR kv.user_id = filter_user_id)
        AND (filter_org_id IS NULL OR kv.organization_id = filter_org_id)
        AND 1 - (kv.embedding <=> query_embedding) > match_threshold
    ORDER BY kv.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 6. Function to clean up expired memory entries
CREATE OR REPLACE FUNCTION cleanup_expired_memories()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.memory_entries
    WHERE expires_at IS NOT NULL AND expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- 7. Row Level Security policies
ALTER TABLE public.memory_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only see their own memory entries
CREATE POLICY memory_user_isolation ON public.memory_entries
    FOR ALL USING (
        scope_user_id = current_setting('app.current_user_id', true)
        OR scope_user_id IS NULL
    );

-- RLS: Users can only see their own sessions
CREATE POLICY session_user_isolation ON public.sessions
    FOR ALL USING (
        user_id = current_setting('app.current_user_id', true)
        OR user_id IS NULL
    );
