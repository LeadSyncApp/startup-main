// ==========================================
// LeadSync Permission System (Frontend)
// Mirrors the backend permission definitions
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

/**
 * Check if a user role has a specific permission
 */
export function hasPermission(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  const allowedRoles = PERMISSION_MAP[permission];
  if (!allowedRoles) return false;
  return allowedRoles.includes(role);
}

/**
 * React Hook friendly version - use to conditionally render UI elements
 */
export function can(role: Role | undefined | null, permission: Permission): boolean {
  return hasPermission(role, permission);
}

/**
 * Get human-readable role label
 */
export function getRoleLabel(role: Role): string {
  switch (role) {
    case "OWNER":   return "Owner / Malik";
    case "MANAGER": return "Shop Manager";
    case "STAFF":   return "Standard Staff";
  }
}

/**
 * Get role icon emoji
 */
export function getRoleIcon(role: Role): string {
  switch (role) {
    case "OWNER":   return "👑";
    case "MANAGER": return "⚙️";
    case "STAFF":   return "🛠️";
  }
}

/**
 * Get role badge color class
 */
export function getRoleColor(role: Role): string {
  switch (role) {
    case "OWNER":   return "var(--brand-saffron)";
    case "MANAGER": return "#3b82f6";
    case "STAFF":   return "#8b5cf6";
  }
}