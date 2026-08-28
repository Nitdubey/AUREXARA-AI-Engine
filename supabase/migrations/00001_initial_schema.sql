-- Migration: 00001_initial_schema.sql
-- Description: Core schema for AUREXARA AI Engine
-- Includes tables for Traces, API Keys, and pgvector extension for Knowledge Core

-- Enable pgvector extension for RAG/Knowledge Core
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. API Keys Table
CREATE TABLE public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT NOT NULL,
    organization_id TEXT,
    key_hash TEXT NOT NULL,
    provider TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_api_keys_product ON public.api_keys(product_id);

-- 2. Traces Table (Observability)
CREATE TABLE public.traces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES public.traces(id),
    product_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    agent_id TEXT,
    type TEXT NOT NULL, -- 'agent_run', 'model_call', 'tool_call'
    input JSONB,
    output JSONB,
    model_id TEXT,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    cost_usd NUMERIC(10, 6) DEFAULT 0,
    duration_ms INTEGER,
    status TEXT NOT NULL, -- 'success', 'failure'
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_traces_product_user ON public.traces(product_id, user_id);
CREATE INDEX idx_traces_agent ON public.traces(agent_id);

-- 3. Memory/Vectors Table (Knowledge Core)
CREATE TABLE public.knowledge_vectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536) NOT NULL, -- Assuming OpenAI embeddings dimension
    product_id TEXT,
    organization_id TEXT,
    user_id TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create a HNSW index for fast vector search
CREATE INDEX idx_knowledge_vectors_embedding ON public.knowledge_vectors USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_knowledge_vectors_scope ON public.knowledge_vectors(product_id, organization_id, user_id);

-- 4. Audit Logs (Security)
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    platform_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    organization_id TEXT,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    status TEXT NOT NULL, -- 'success', 'denied', 'failure'
    details JSONB
);

CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON public.audit_logs(resource);

-- Row Level Security (RLS) policies would be applied here based on TenantContext
