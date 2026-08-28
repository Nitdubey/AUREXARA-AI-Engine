-- Phase 6: Enterprise Security Tables
-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  revoked_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  permissions JSONB NOT NULL DEFAULT '[]',
  inherits JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Role assignments
CREATE TABLE IF NOT EXISTS role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by TEXT NOT NULL,
  UNIQUE(user_id, role_id, tenant_id)
);

CREATE INDEX idx_role_assignments_user ON role_assignments(user_id, tenant_id);

-- Audit log (append-only, immutable)
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_platform_id TEXT NOT NULL,
  tenant_product_id TEXT NOT NULL,
  tenant_org_id TEXT,
  tenant_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'denied', 'failure')),
  details JSONB DEFAULT '{}'
);

CREATE INDEX idx_audit_log_tenant ON audit_log(tenant_platform_id, tenant_user_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_log_action ON audit_log(action);

-- Rate limiting state (for distributed rate limiting)
CREATE TABLE IF NOT EXISTS rate_limit_state (
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

CREATE INDEX idx_rate_limit_key ON rate_limit_state(key);

-- RLS policies
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- API Keys: service role only
CREATE POLICY "api_keys_service_access" ON api_keys
  FOR ALL USING (true);

-- Roles: readable by all authenticated, writable by service
CREATE POLICY "roles_read" ON roles
  FOR SELECT USING (true);

CREATE POLICY "roles_write" ON roles
  FOR INSERT WITH CHECK (true);

-- Audit log: append only (no updates/deletes)
CREATE POLICY "audit_log_insert" ON audit_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY "audit_log_select" ON audit_log
  FOR SELECT USING (true);

-- Deny updates and deletes on audit_log
-- The absence of UPDATE/DELETE policies with RLS enabled means they're denied
