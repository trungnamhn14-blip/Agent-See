import { roleFromTrangDenHexToken } from "./agentseeTokens";

export type AgsRole = "admin" | "member" | "guest";

/** Server: chỉ token hex 32 ký tự (admin = hex chủ lớp, hex khác = member). */
export function parseRoleToken(raw: string): { ok: true; role: AgsRole } | { ok: false } {
  const t = raw.trim();
  if (!t) return { ok: false };
  const hexRole = roleFromTrangDenHexToken(t);
  if (hexRole) return { ok: true, role: hexRole };
  return { ok: false };
}
