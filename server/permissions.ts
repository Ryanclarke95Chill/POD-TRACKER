import type { User, UserRole } from "@shared/schema";

export interface Permissions {
  canViewAllConsignments: boolean;
  canViewDepartmentConsignments: boolean;
  canViewOwnConsignments: boolean;
  canManageUsers: boolean;
  canManageDrivers: boolean;
  canAccessAnalytics: boolean;
  canAccessFullAnalytics: boolean;
  canCreateCustomDashboards: boolean;
  canEditConsignments: boolean;
  canDeleteConsignments: boolean;
  canSyncAxylog: boolean;
}

export function getUserPermissions(user: User): Permissions {
  const role = user.role as UserRole;
  
  switch (role) {
    case "admin":
      return {
        canViewAllConsignments: true,
        canViewDepartmentConsignments: true,
        canViewOwnConsignments: true,
        canManageUsers: true,
        canManageDrivers: true,
        canAccessAnalytics: true,
        canAccessFullAnalytics: true,
        canCreateCustomDashboards: true,
        canEditConsignments: true,
        canDeleteConsignments: true,
        canSyncAxylog: true,
      };
      
    case "manager":
      return {
        canViewAllConsignments: true,
        canViewDepartmentConsignments: true,
        canViewOwnConsignments: true,
        canManageUsers: false,
        canManageDrivers: true,
        canAccessAnalytics: true,
        canAccessFullAnalytics: true,
        canCreateCustomDashboards: true,
        canEditConsignments: true,
        canDeleteConsignments: false,
        canSyncAxylog: true,
      };
      
    case "supervisor":
      return {
        canViewAllConsignments: false,
        canViewDepartmentConsignments: true,
        canViewOwnConsignments: true,
        canManageUsers: false,
        canManageDrivers: false,
        canAccessAnalytics: true,
        canAccessFullAnalytics: false, // Limited analytics only
        canCreateCustomDashboards: true,
        canEditConsignments: false,
        canDeleteConsignments: false,
        canSyncAxylog: false,
      };
      
    case "driver":
      return {
        canViewAllConsignments: false,
        canViewDepartmentConsignments: false,
        canViewOwnConsignments: true,
        canManageUsers: false,
        canManageDrivers: false,
        canAccessAnalytics: false,
        canAccessFullAnalytics: false,
        canCreateCustomDashboards: false,
        canEditConsignments: false,
        canDeleteConsignments: false,
        canSyncAxylog: false,
      };
      
    case "viewer":
    default:
      return {
        canViewAllConsignments: false,
        canViewDepartmentConsignments: false,
        canViewOwnConsignments: true,
        canManageUsers: false,
        canManageDrivers: false,
        canAccessAnalytics: true,
        canAccessFullAnalytics: false,
        canCreateCustomDashboards: false,
        canEditConsignments: false,
        canDeleteConsignments: false,
        canSyncAxylog: false,
      };
  }
}

export function hasPermission(user: User, permission: keyof Permissions): boolean {
  const permissions = getUserPermissions(user);
  return permissions[permission];
}

export function requirePermission(user: User, permission: keyof Permissions): void {
  if (!hasPermission(user, permission)) {
    throw new Error(`Access denied: User role '${user.role}' does not have permission '${permission}'`);
  }
}

export function getAccessibleConsignmentFilter(user: User): 'all' | 'department' | 'own' {
  const permissions = getUserPermissions(user);
  
  if (permissions.canViewAllConsignments) {
    return 'all';
  } else if (permissions.canViewDepartmentConsignments) {
    return 'department';
  } else {
    return 'own';
  }
}