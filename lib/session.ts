import { createHmac, timingSafeEqual } from "crypto";
import type { AgsRole } from "@/lib/roleToken";

const COOKIE = "ai_chat_sess";

export { COOKIE };

export type SessionPayload = { v: 1 | 2; t: number; role: AgsRole; displayName: string };

export function signSession(secret: string, role: AgsRole, displayName: string): string {
  const payload = JSON.stringify({ v: 2 as const, t: Date.now(), role, displayName });
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
  if (typeof o.t !== "number") return null;
  const role = o.role;
  if (role !== "admin" && role !== "member" && role !== "guest") return null;
  const t = o.t;
  if (o.v === 1) {
    return { v: 1, t, role, displayName: "" };
  }
  if (o.v === 2) {
    const displayName = typeof o.displayName === "string" ? o.displayName : "";
    return { v: 2, t, role, displayName };
  }
  return null;
}

export function verifySession(token: string, secret: string): boolean {
  return parseSession(token, secret) !== null;
}
