export default function Home() {
  const services = [
    {
      category: 'AI Core',
      endpoints: [
        { method: 'POST', path: '/api/ai/complete', desc: 'Multi-provider LLM completion' },
        { method: 'POST', path: '/api/ai/embed', desc: 'Vector embeddings generation' },
        { method: 'POST', path: '/api/ai/stream', desc: 'Streaming AI responses' },
      ]
    },
    {
      category: 'Knowledge & RAG',
      endpoints: [
        { method: 'POST', path: '/api/knowledge/ingest', desc: 'Ingest documents into vector DB' },
        { method: 'POST', path: '/api/knowledge/search', desc: 'Semantic similarity search' },
        { method: 'POST', path: '/api/knowledge/chat', desc: 'RAG-powered conversational AI' },
      ]
    },
    {
      category: 'Agent Runtime',
      endpoints: [
        { method: 'POST', path: '/api/agents/run', desc: 'Execute autonomous AI agents' },
        { method: 'POST', path: '/api/agents/workflow', desc: 'Multi-step agent orchestration' },
        { method: 'GET', path: '/api/agents/status', desc: 'Agent execution status' },
      ]
    },
    {
      category: 'Products',
      endpoints: [
        { method: 'POST', path: '/api/resume/parse', desc: 'JobMatchAI — Resume parsing', live: true },
        { method: 'POST', path: '/api/jobs/match', desc: 'JobMatchAI — Candidate matching', live: true },
        { method: 'POST', path: '/api/chat', desc: 'JobMatchAI — AI recruiter chat', live: true },
      ]
    },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#e0e0e0',
      padding: '40px 20px'
    }}>
      <div style={{ maxWidth: '780px', width: '100%', textAlign: 'center' }}>
        {/* Badge */}
        <span style={{
          display: 'inline-block',
          padding: '4px 14px',
          borderRadius: '999px',
          border: '1px solid rgba(138, 43, 226, 0.3)',
          background: 'rgba(138, 43, 226, 0.1)',
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.05em',
          color: '#a78bfa',
          marginBottom: '24px'
        }}>
          Engine v1.0 • LIVE
        </span>

        <h1 style={{
          fontSize: '44px',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          margin: '12px 0',
          background: 'linear-gradient(135deg, #ffffff 0%, #a0a0a0 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          AUREXARA AI Engine
        </h1>

        <p style={{ fontSize: '17px', color: '#888', margin: '0 0 16px 0', lineHeight: 1.6 }}>
          Unified Intelligence API — AI Core, RAG Pipelines, Agent Runtime, and Knowledge Platform.
        </p>
        <p style={{ fontSize: '14px', color: '#555', margin: '0 0 40px 0' }}>
          One engine. Every product. Infinite intelligence.
        </p>

        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '40px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', display: 'inline-block' }} />
          <span style={{ fontSize: '14px', color: '#22c55e', fontWeight: 500 }}>All systems operational</span>
        </div>

        {/* Endpoint Groups */}
        {services.map((group) => (
          <div key={group.category} style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '14px',
            padding: '24px 28px',
            textAlign: 'left',
            marginBottom: '16px'
          }}>
            <h3 style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#666',
              margin: '0 0 16px 0'
            }}>
              {group.category}
            </h3>

            {group.endpoints.map((ep, i) => (
              <div key={ep.path} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 0',
                borderBottom: i < group.endpoints.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                flexWrap: 'wrap'
              }}>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: '4px',
                  background: ep.method === 'GET' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(34, 197, 94, 0.12)',
                  color: ep.method === 'GET' ? '#60a5fa' : '#4ade80',
                  fontFamily: 'monospace'
                }}>
                  {ep.method}
                </span>
                <code style={{ fontSize: '13px', color: '#d4d4d4', fontFamily: 'monospace' }}>
                  {ep.path}
                </code>
                {'live' in ep && (
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'rgba(34, 197, 94, 0.15)',
                    color: '#4ade80',
                    letterSpacing: '0.05em'
                  }}>
                    LIVE
                  </span>
                )}
                <span style={{ fontSize: '12px', color: '#555', marginLeft: 'auto' }}>
                  {ep.desc}
                </span>
              </div>
            ))}
          </div>
        ))}

        {/* Powered By */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '20px',
          flexWrap: 'wrap',
          marginTop: '32px',
          fontSize: '12px',
          color: '#444'
        }}>
          <span>☁️ AWS Bedrock</span>
          <span>🗄️ Supabase pgvector</span>
          <span>🔐 API Key Auth</span>
          <span>⚡ Rate Limited</span>
          <span>🌐 CORS Protected</span>
        </div>

        {/* Footer */}
        <p style={{ marginTop: '32px', fontSize: '13px', color: '#444' }}>
          © 2026 AUREXARA AI •{' '}
          <a href="https://aurexara.ai" style={{ color: '#a78bfa', textDecoration: 'none' }}>aurexara.ai</a>
          {' • '}
          <a href="https://jobmatchai.in" style={{ color: '#a78bfa', textDecoration: 'none' }}>jobmatchai.in</a>
        </p>
      </div>
    </div>
  );
}
