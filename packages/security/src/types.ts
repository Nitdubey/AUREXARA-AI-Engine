export interface Permission {
  readonly resource: string;
  readonly action: 'read' | 'write' | 'execute' | 'admin';
}

export interface TenantContext {
  readonly platformId: string;
  readonly productId: string;
  readonly organizationId?: string;
  readonly userId: string;
  readonly projectId?: string;
  readonly permissions: readonly Permission[];
}

export interface AuditEvent {
  readonly id: string;
  readonly timestamp: Date;
  readonly tenant: TenantContext;
  readonly action: string;
  readonly resource: string;
  readonly status: 'success' | 'denied' | 'failure';
  readonly details?: Record<string, unknown>;
}

export interface SecurityLayer {
  authorize(context: TenantContext, action: Permission['action'], resource: string): Promise<boolean>;
  audit(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void>;
}
