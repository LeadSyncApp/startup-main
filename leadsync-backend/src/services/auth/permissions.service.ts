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
  "inventory.manage":               ["OWNER", "MANAGER"],
  "dashboard.view":                 ["OWNER", "MANAGER", "STAFF"],
  "dashboard.financial":            ["OWNER", "MANAGER"],
  "automation.manage":              ["OWNER", "MANAGER"],
  "company.delete":                 ["OWNER"],
};

export const PERMISSIONS = PERMISSION_MAP;

/**
 * Check if a user role has a specific permission
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  const allowedRoles = PERMISSION_MAP[permission];
  if (!allowedRoles) return false;
  return allowedRoles.includes(role);
}

/**
 * Get all permissions for a given role
 */
export function getPermissionsForRole(role: Role): Permission[] {
  return (Object.keys(PERMISSION_MAP) as Permission[]).filter((perm) =>
    PERMISSION_MAP[perm].includes(role)
  );
}

/**
 * Middleware-compatible permission check
 */
export function can(role: string | undefined, permission: Permission): boolean {
  if (!role) return false;
  return hasPermission(role as Role, permission);
}
