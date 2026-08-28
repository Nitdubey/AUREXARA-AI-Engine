export default function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#e0e0e0',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '680px',
        width: '100%',
        textAlign: 'center'
      }}>
        {/* Logo & Title */}
        <div style={{ marginBottom: '16px' }}>
          <span style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: '999px',
            border: '1px solid rgba(138, 43, 226, 0.3)',
            background: 'rgba(138, 43, 226, 0.1)',
            fontSize: '12px',
            fontWeight: 600,
            letterSpacing: '0.05em',
            color: '#a78bfa',
            marginBottom: '24px'
          }}>
            v1.0 • LIVE
          </span>
        </div>
        
        <h1 style={{
          fontSize: '48px',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          margin: '0 0 12px 0',
          background: 'linear-gradient(135deg, #ffffff 0%, #a0a0a0 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          AUREXARA AI Engine
        </h1>
        
        <p style={{
          fontSize: '18px',
          color: '#888',
          margin: '0 0 48px 0',
          lineHeight: 1.6
        }}>
          Unified Intelligence API powering autonomous software systems.
        </p>

        {/* Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '48px'
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#22c55e',
            boxShadow: '0 0 8px #22c55e',
            display: 'inline-block'
          }} />
          <span style={{ fontSize: '14px', color: '#22c55e', fontWeight: 500 }}>
            All systems operational
          </span>
        </div>

        {/* API Endpoints */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px',
          padding: '32px',
          textAlign: 'left',
          marginBottom: '32px'
        }}>
          <h3 style={{
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#666',
            margin: '0 0 20px 0'
          }}>
            Available Endpoints
          </h3>

          {[
            { method: 'POST', path: '/api/resume/parse', desc: 'Parse & ingest candidate resumes' },
            { method: 'POST', path: '/api/jobs/match', desc: 'Semantic job-candidate matching' },
            { method: 'POST', path: '/api/chat', desc: 'AI recruiter assistant (RAG)' },
          ].map((endpoint) => (
            <div key={endpoint.path} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 0',
              borderBottom: '1px solid rgba(255,255,255,0.05)'
            }}>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '4px',
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#22c55e',
                fontFamily: 'monospace'
              }}>
                {endpoint.method}
              </span>
              <code style={{
                fontSize: '14px',
                color: '#e0e0e0',
                fontFamily: 'monospace'
              }}>
                {endpoint.path}
              </code>
              <span style={{
                fontSize: '13px',
                color: '#666',
                marginLeft: 'auto'
              }}>
                {endpoint.desc}
              </span>
            </div>
          ))}
        </div>

        {/* Security Badge */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '24px',
          fontSize: '12px',
          color: '#555'
        }}>
          <span>🔐 API Key Auth</span>
          <span>⚡ Rate Limited</span>
          <span>🌐 CORS Protected</span>
        </div>

        {/* Footer */}
        <p style={{
          marginTop: '48px',
          fontSize: '13px',
          color: '#444'
        }}>
          © 2026 AUREXARA AI •{' '}
          <a href="https://aurexara.ai" style={{ color: '#a78bfa', textDecoration: 'none' }}>
            aurexara.ai
          </a>
        </p>
      </div>
    </div>
  );
}
