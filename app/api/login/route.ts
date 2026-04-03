import { NextResponse } from "next/server";
import { COOKIE, signSession } from "@/lib/session";
import type { AgsRole } from "@/lib/roleToken";

/**
 * Sau khi browser đã POST Trang Đen .../login và nhận success,
 * client gửi role + displayName để ký cookie chat (cùng logic bài mẫu static HTML).
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

  const o = body as { role?: unknown; displayName?: unknown };
  const role = o.role === "admin" || o.role === "member" ? (o.role as AgsRole) : null;
  const displayName = typeof o.displayName === "string" ? o.displayName.trim() : "";

  if (!role) {
    return NextResponse.json({ error: "Thiếu hoặc sai role (admin | member)." }, { status: 400 });
  }
  if (!displayName) {
    return NextResponse.json({ error: "Thiếu displayName." }, { status: 400 });
  }

  const token = signSession(authSecret, role, displayName);
  const res = NextResponse.json({
    ok: true,
    role,
    display_name: displayName,
    is_admin: role === "admin",
  });
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
