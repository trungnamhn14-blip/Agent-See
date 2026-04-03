import { NextResponse } from "next/server";
import { COOKIE, signSession } from "@/lib/session";
import { parseRoleToken, type AgsRole } from "@/lib/roleToken";
import { isTrangDenPathStyleToken } from "@/lib/agentseeTokens";
import { resolveAdminHex, verifyTrangDenStudentToken } from "@/lib/trangdenVerify";

function jsonSession(role: AgsRole, authSecret: string) {
  const token = signSession(authSecret, role);
  const res = NextResponse.json({ ok: true, role });
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return res;
}

/**
 * Hex: đúng AGENTSEE_ADMIN_HEX (mặc định token trong URL bài của chủ) → admin.
 * Hex khác → POST Trang Đen (TRANG_DEN_LOGIN_URL + input_token) → member nếu success.
 * Base64 role:agentsee → giữ như đề bài (không gọi Trang Đen).
 */
export async function POST(req: Request) {
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) {
    return NextResponse.json({ error: "Thiếu AUTH_SECRET trên server." }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body không hợp lệ." }, { status: 400 });
  }

  const roleToken =
    typeof body === "object" &&
    body !== null &&
    "roleToken" in body &&
    typeof (body as { roleToken: unknown }).roleToken === "string"
      ? (body as { roleToken: string }).roleToken.trim()
      : "";

  if (!roleToken) {
    return NextResponse.json({ error: "Thiếu roleToken." }, { status: 400 });
  }

  if (isTrangDenPathStyleToken(roleToken)) {
    const h = roleToken.toLowerCase();
    if (h === resolveAdminHex()) {
      return jsonSession("admin", authSecret);
    }
    const loginUrl = process.env.TRANG_DEN_LOGIN_URL?.trim();
    if (!loginUrl) {
      return NextResponse.json(
        { error: "Server thiếu TRANG_DEN_LOGIN_URL để xác thực token học viên Trang Đen." },
        { status: 500 }
      );
    }
    const v = await verifyTrangDenStudentToken(loginUrl, roleToken);
    if (!v.ok) {
      return NextResponse.json({ error: v.error }, { status: 401 });
    }
    return jsonSession("member", authSecret);
  }

  const parsed = parseRoleToken(roleToken);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Token không hợp lệ (Base64 role:agentsee hoặc hex 32 ký tự)." }, { status: 401 });
  }

  return jsonSession(parsed.role, authSecret);
}
