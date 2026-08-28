import type { SecurityLayer, TenantContext, AuditEvent, Permission } from './types.js';
import { randomUUID } from 'node:crypto';

export class AUREXARASecurity implements SecurityLayer {
  public async authorize(context: TenantContext, action: Permission['action'], resource: string): Promise<boolean> {
    // 1. Check if the user is an admin for this product
    if (context.permissions.some(p => p.resource === '*' && p.action === 'admin')) {
      return true;
    }

    // 2. Check specific resource permissions
    // E.g. resource: 'agent:code-reviewer', action: 'execute'
    const hasPermission = context.permissions.some(p => {
      // Allow exact match or wildcard resource match
      const resourceMatch = p.resource === resource || p.resource.startsWith(resource.split(':')[0] + ':*');
      const actionMatch = p.action === action || p.action === 'admin';
      return resourceMatch && actionMatch;
    });

    return hasPermission;
  }

  public async audit(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: AuditEvent = {
      ...event,
      id: randomUUID(),
      timestamp: new Date()
    };

    // For MVP, we log to stdout. In production, this would go to a secure audit log table/service.
    console.log(`[AUDIT] ${fullEvent.timestamp.toISOString()} | ${fullEvent.tenant.userId} | ${fullEvent.action} ${fullEvent.resource} | ${fullEvent.status}`);
  }
}
