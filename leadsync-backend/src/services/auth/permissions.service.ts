// ==========================================
// LeadSync Permission System
// Centralized, declarative permissions
// ==========================================

export type Role = "OWNER" | "MANAGER" | "STAFF";

export type Permission = 
  | "settings.shop.edit"
  | "settings.shop.upgradeTier"
  | "settings.shop.gstin"
  | "settings.connections.telegram"
  | "settings.connections.widget"
  | "settings.connections.whatsapp"
  | "settings.connections.instagram"
  | "settings.connections.messenger"
  | "team.invite"
  | "team.invite.revoke"
  | "team.remove"
  | "team.changeRole"
  | "team.view"
  | "team.viewOwn"
  | "orders.claim"
  | "orders.confirm"
  | "orders.fulfill"
  | "orders.cancel"
  | "orders.viewAll"
  | "conversations.assign"
  | "conversations.reply"
  | "broadcast.send"
  | "inventory.manage"
  | "dashboard.view"
  | "dashboard.financial"
  | "automation.manage"
  | "company.delete";

/**
 * Permission Map
 * Each key is a permission string.
 * Each value is an array of roles that have that permission.
 */
const PERMISSION_MAP: Record<Permission, Role[]> = {
  "settings.shop.edit":             ["OWNER", "MANAGER"],
  "settings.shop.upgradeTier":      ["OWNER"],
  "settings.shop.gstin":            ["OWNER", "MANAGER"],
  "settings.connections.telegram":  ["OWNER", "MANAGER"],
  "settings.connections.widget":    ["OWNER", "MANAGER"],
  "settings.connections.whatsapp":  ["OWNER", "MANAGER"],
  "settings.connections.instagram": ["OWNER", "MANAGER"],
  "settings.connections.messenger": ["OWNER", "MANAGER"],
  "team.invite":                    ["OWNER", "MANAGER"],
  "team.invite.revoke":             ["OWNER", "MANAGER"],
  "team.remove":                    ["OWNER"],
  "team.changeRole":                ["OWNER"],
  "team.view":                      ["OWNER", "MANAGER"],
  "team.viewOwn":                   ["OWNER", "MANAGER", "STAFF"],
  "orders.claim":                   ["OWNER", "MANAGER", "STAFF"],
  "orders.confirm":                 ["OWNER", "MANAGER"],
  "orders.fulfill":                 ["OWNER", "MANAGER", "STAFF"],
  "orders.cancel":                  ["OWNER", "MANAGER"],
  "orders.viewAll":                 ["OWNER", "MANAGER"],
  "conversations.assign":           ["OWNER", "MANAGER"],
  "conversations.reply":            ["OWNER", "MANAGER", "STAFF"],
  "broadcast.send":                 ["OWNER", "MANAGER"],
  "inventory.manage":               ["OWNER", "MANAGER", "STAFF"],
  "dashboard.view":                 ["OWNER", "MANAGER", "STAFF"],
  "dashboard.financial":            ["OWNER", "MANAGER"],
  "automation.manage":              ["OWNER", "MANAGER"],
  "company.delete":                 ["OWNER"],
};

export const PERMISSIONS = PERMISSION_MAP;

/**
 * Check if a user role (or user object with personal overrides) has a specific permission.
 * Personal overrides additively extend access beyond role defaults.
 */
export function hasPermission(
  role: Role | undefined | null,
  permission: Permission,
  overrides?: string[] | Record<string, boolean> | null | any
): boolean {
  if (!role) return false;

  // 1. Check role-based permission
  const allowedRoles = PERMISSION_MAP[permission];
  if (allowedRoles && allowedRoles.includes(role)) {
    return true;
  }

  // 2. Check personal permission overrides (extends beyond role)
  if (overrides) {
    if (Array.isArray(overrides)) {
      return overrides.includes(permission);
    }
    if (typeof overrides === "object" && overrides !== null) {
      return Boolean(overrides[permission]);
    }
  }

  return false;
}

/**
 * Get all permissions for a given role (plus optional overrides)
 */
export function getPermissionsForRole(
  role: Role,
  overrides?: string[] | Record<string, boolean> | null | any
): Permission[] {
  const rolePerms = (Object.keys(PERMISSION_MAP) as Permission[]).filter((perm) =>
    PERMISSION_MAP[perm].includes(role)
  );

  if (!overrides) return rolePerms;

  const extraPerms: Permission[] = [];
  if (Array.isArray(overrides)) {
    overrides.forEach((p) => {
      if ((Object.keys(PERMISSION_MAP) as Permission[]).includes(p as Permission) && !rolePerms.includes(p as Permission)) {
        extraPerms.push(p as Permission);
      }
    });
  }

  return [...rolePerms, ...extraPerms];
}

/**
 * Middleware & component compatible permission check.
 * Accepts either a user object ({ role, permissionOverrides }), a role string, or role + overrides.
 */
export function can(
  userOrRole: { role?: Role; permissionOverrides?: any } | Role | string | undefined | null,
  permission: Permission,
  overrides?: string[] | Record<string, boolean> | null | any
): boolean {
  if (!userOrRole) return false;

  if (typeof userOrRole === "object" && userOrRole !== null) {
    return hasPermission(userOrRole.role, permission, userOrRole.permissionOverrides || overrides);
  }

  return hasPermission(userOrRole as Role, permission, overrides);
}

