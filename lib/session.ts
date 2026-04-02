import { createHmac, timingSafeEqual } from "crypto";

const COOKIE = "ai_chat_sess";

export { COOKIE };

export function signSession(secret: string): string {
  const payload = JSON.stringify({ v: 1, t: Date.now() });
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(payload, "utf8").toString("base64url") + "." + sig;
}

export function verifySession(token: string, secret: string): boolean {
  const i = token.indexOf(".");
  if (i <= 0) return false;
  const payloadB64 = token.slice(0, i);
  const sig = token.slice(i + 1);
  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return false;
  }
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
