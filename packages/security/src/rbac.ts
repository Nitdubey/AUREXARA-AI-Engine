import type { Permission } from './types.js';

/** Role definition */
export interface Role {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly permissions: readonly Permission[];
  readonly inherits?: readonly string[];
}

/** User-role assignment */
export interface RoleAssignment {
  readonly userId: string;
  readonly roleId: string;
  readonly tenantId: string;
  readonly assignedAt: Date;
  readonly assignedBy: string;
}

/**
 * RBAC manager — manages roles, assignments, and permission resolution.
 */
export class RBACManager {
  private readonly roles = new Map<string, Role>();
  private readonly assignments: RoleAssignment[] = [];

  /**
   * Register a role.
   * @param role The role to register
   */
  addRole(role: Role): void {
    this.roles.set(role.id, role);
  }

  /**
   * Remove a role by ID.
   * @param roleId The ID of the role to remove
   */
  removeRole(roleId: string): void {
    this.roles.delete(roleId);
  }

  /**
   * Get a role by ID.
   * @param roleId The ID of the role
   * @returns The role if found, otherwise undefined
   */
  getRole(roleId: string): Role | undefined {
    return this.roles.get(roleId);
  }

  /**
   * Assign a role to a user within a tenant.
   * @param userId The ID of the user
   * @param roleId The ID of the role
   * @param tenantId The ID of the tenant
   * @param assignedBy The ID of the user performing the assignment
   * @returns The role assignment object
   */
  assignRole(userId: string, roleId: string, tenantId: string, assignedBy: string): RoleAssignment {
    if (!this.roles.has(roleId)) {
      throw new Error(`Role ${roleId} does not exist`);
    }
    const assignment: RoleAssignment = {
      userId,
      roleId,
      tenantId,
      assignedAt: new Date(),
      assignedBy,
    };
    this.assignments.push(assignment);
    return assignment;
  }

  /**
   * Remove a role assignment.
   * @param userId The ID of the user
   * @param roleId The ID of the role
   * @param tenantId The ID of the tenant
   */
  unassignRole(userId: string, roleId: string, tenantId: string): void {
    const index = this.assignments.findIndex(a => 
      a.userId === userId && a.roleId === roleId && a.tenantId === tenantId
    );
    if (index !== -1) {
      this.assignments.splice(index, 1);
    }
  }

  /**
   * Get all roles assigned to a user within a tenant.
   * @param userId The ID of the user
   * @param tenantId The ID of the tenant
   * @returns A list of assigned roles
   */
  getUserRoles(userId: string, tenantId: string): readonly Role[] {
    const userRoleIds = this.assignments
      .filter(a => a.userId === userId && a.tenantId === tenantId)
      .map(a => a.roleId);
    
    return userRoleIds
      .map(id => this.roles.get(id))
      .filter((role): role is Role => role !== undefined);
  }

  /**
   * Resolve all permissions for a user within a tenant.
   * Resolves role inheritance recursively.
   * @param userId The ID of the user
   * @param tenantId The ID of the tenant
   * @returns A deduped list of resolved permissions
   */
  resolvePermissions(userId: string, tenantId: string): readonly Permission[] {
    const userRoles = this.getUserRoles(userId, tenantId);
    const resolvedPermissions: Permission[] = [];
    const visitedRoles = new Set<string>();

    for (const role of userRoles) {
      const perms = this.resolveRolePermissions(role.id, visitedRoles);
      resolvedPermissions.push(...perms);
    }

    const unique = new Map<string, Permission>();
    for (const p of resolvedPermissions) {
      unique.set(`${p.resource}:${p.action}`, p);
    }

    return Array.from(unique.values());
  }

  /**
   * Check if a user has a specific permission within a tenant.
   * @param userId The ID of the user
   * @param tenantId The ID of the tenant
   * @param action The required action
   * @param resource The required resource
   * @returns true if the user has the permission, otherwise false
   */
  hasPermission(userId: string, tenantId: string, action: Permission['action'], resource: string): boolean {
    const permissions = this.resolvePermissions(userId, tenantId);
    for (const p of permissions) {
      if ((p.action === action || p.action === 'admin') && (p.resource === resource || p.resource === '*')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Helper: resolve role permissions including inheritance
   * @param roleId The starting role ID
   * @param visited A set of visited role IDs to detect cycles
   * @returns List of inherited permissions
   */
  private resolveRolePermissions(roleId: string, visited: Set<string>): readonly Permission[] {
    if (visited.has(roleId)) {
      return [];
    }
    visited.add(roleId);

    const role = this.roles.get(roleId);
    if (!role) {
      return [];
    }

    const permissions = [...role.permissions];

    if (role.inherits) {
      for (const inheritedRoleId of role.inherits) {
        const inheritedPerms = this.resolveRolePermissions(inheritedRoleId, visited);
        permissions.push(...inheritedPerms);
      }
    }

    return permissions;
  }
}
