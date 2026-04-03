import { NextResponse } from "next/server";
import { COOKIE, signSession } from "@/lib/session";
import { parseRoleToken } from "@/lib/roleToken";

/** Xác thực giả: chỉ kiểm tra token Base64 role:agentsee — không gọi API ngoài. */
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

  const parsed = parseRoleToken(roleToken);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Token không hợp lệ." }, { status: 401 });
  }

  const token = signSession(authSecret, parsed.role);
  const res = NextResponse.json({ ok: true, role: parsed.role });
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
