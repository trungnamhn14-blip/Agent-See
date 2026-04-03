import { isTrangDenPathStyleToken } from "./agentseeTokens";

export type AgsRole = "admin" | "member" | "guest";

const VALID: readonly AgsRole[] = ["admin", "member", "guest"];

/** Server: token lớp Trang Đen (hex) hoặc Base64 role:agentsee như client. */
export function parseRoleToken(raw: string): { ok: true; role: AgsRole } | { ok: false } {
  const t = raw.trim();
  if (!t) return { ok: false };
  if (isTrangDenPathStyleToken(t)) return { ok: true, role: "admin" };
  try {
    const decoded = Buffer.from(t, "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx < 0) return { ok: false };
    const role = decoded.slice(0, idx).trim().toLowerCase();
    const secret = decoded.slice(idx + 1).trim();
    if (!VALID.includes(role as AgsRole)) return { ok: false };
    if (secret !== "agentsee") return { ok: false };
    return { ok: true, role: role as AgsRole };
  } catch {
    return { ok: false };
  }
}
