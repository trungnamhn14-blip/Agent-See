import { createHmac, timingSafeEqual } from "crypto";

const COOKIE = "ai_chat_sess";

export { COOKIE };

/** Session sau đăng nhập Trang Đen (6.6). */
export type SessionPayload = { v: 1; t: number; display_name: string; is_admin: boolean };

export function signSession(secret: string, display_name: string, is_admin: boolean): string {
  const payload = JSON.stringify({
    v: 1 as const,
    t: Date.now(),
    display_name,
    is_admin,
  });
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(payload, "utf8").toString("base64url") + "." + sig;
}

export function parseSession(token: string, secret: string): SessionPayload | null {
  const i = token.indexOf(".");
  if (i <= 0) return null;
  const payloadB64 = token.slice(0, i);
  const sig = token.slice(i + 1);
  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  let obj: unknown;
  try {
    obj = JSON.parse(payload);
  } catch {
    return null;
  }
  if (typeof obj !== "object" || obj === null) return null;
  const o = obj as Record<string, unknown>;
  if (o.v !== 1 || typeof o.t !== "number") return null;
  if (typeof o.display_name !== "string" || !o.display_name.trim()) return null;
  if (typeof o.is_admin !== "boolean") return null;
  return { v: 1, t: o.t, display_name: o.display_name.trim(), is_admin: o.is_admin };
}

export function verifySession(token: string, secret: string): boolean {
  return parseSession(token, secret) !== null;
}
