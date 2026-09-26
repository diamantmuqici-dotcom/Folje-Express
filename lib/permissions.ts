/**
 * Role-based permission matrix.
 *
 *  Staff    — order inbox only: accept / decline requests. Nothing else.
 *  Admin    — everything except viewing audit logs and managing accounts.
 *  Co Owner — everything Admin can + view logs + hire/fire Staff & Admin,
 *             update/replace content but NOT delete products or the site.
 *  Owner    — absolute control: logs, all accounts, deletions, site reset.
 */

export type Role = "staff" | "admin" | "coowner" | "owner";

export const ROLES: Role[] = ["staff", "admin", "coowner", "owner"];

export const ROLE_LABELS: Record<Role, string> = {
  staff: "Staff",
  admin: "Admin",
  coowner: "Co Owner",
  owner: "Owner",
};

const ALL: Role[] = ["staff", "admin", "coowner", "owner"];
const CONTENT: Role[] = ["admin", "coowner", "owner"];

const MATRIX: Record<string, Role[]> = {
  /* orders / messages */
  "messages.view": ALL,
  "messages.decide": ALL,
  "messages.delete": ["admin", "owner"],

  /* product catalogue */
  "designs.view": CONTENT,
  "designs.create": CONTENT,
  "designs.update": CONTENT, // includes price edits + image replace
  "designs.delete": ["admin", "owner"],

  /* site identity */
  "settings.view": CONTENT,
  "settings.update": CONTENT,
  "stats.view": CONTENT,

  /* team */
  "accounts.view": ["coowner", "owner"],
  "accounts.manage": ["coowner", "owner"],

  /* oversight */
  "logs.view": ["coowner", "owner"],

  /* nuclear */
  "site.reset": ["owner"],
};

export function can(role: Role, action: string): boolean {
  return (MATRIX[action] || []).includes(role);
}

/** Which roles may `op` (create/update/delete) an account with `target` role. */
export function canManageAccount(role: Role, target: Role, op: "create" | "update" | "delete"): boolean {
  if (role === "owner") return true;
  if (role === "coowner") return target === "staff" || target === "admin";
  return false;
}

/** Roles the given role is allowed to create. */
export function creatableRoles(role: Role): Role[] {
  if (role === "owner") return ROLES;
  if (role === "coowner") return ["staff", "admin"];
  return [];
}
