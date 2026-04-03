import { TRANG_DEN_AGENTSEE_CLASS_TOKEN } from "./agentseeTokens";

type TrangDenLoginJson = {
  success?: boolean;
  error?: string;
  display_name?: string;
  is_admin?: boolean;
};

/** Hex admin (chủ bài / giáo viên). Có thể ghi đè bằng AGENTSEE_ADMIN_HEX. */
export function resolveAdminHex(): string {
  const e = process.env.AGENTSEE_ADMIN_HEX?.trim().toLowerCase();
  if (e && /^[a-f0-9]{32}$/i.test(e)) return e;
  return TRANG_DEN_AGENTSEE_CLASS_TOKEN.toLowerCase();
}

/**
 * Khớp token hex học viên với endpoint login bài tập Trang Đen (cùng URL trong đề).
 * Chỉ dùng trên server.
 */
export async function verifyTrangDenStudentToken(
  loginUrl: string,
  inputToken: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15_000);
    const r = await fetch(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input_token: inputToken }),
      cache: "no-store",
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const data = (await r.json().catch(() => ({}))) as TrangDenLoginJson;
    if (data.success === true) return { ok: true };
    const msg =
      typeof data.error === "string" && data.error.trim()
        ? data.error.trim()
        : "Token không khớp bài tập trên Trang Đen.";
    return { ok: false, error: msg };
  } catch {
    return {
      ok: false,
      error: "Không kiểm tra được với Trang Đen (mạng hoặc TRANG_DEN_LOGIN_URL).",
    };
  }
}
