import { NextResponse } from "next/server";
import { COOKIE, signSession } from "@/lib/session";

/** Endpoint đăng nhập lớp học (6.6) — KHÔNG tự chấm token; proxy tới Trang Đen. */
const CLASS_LOGIN_URL =
  "https://trangden.vn/agentsee/api/bai-tap/3147/ee1e8daa7069730fa9a25606f607f9cb/tuan-1/bai-6/cau-6/login";

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

  const input_token =
    typeof body === "object" &&
    body !== null &&
    "input_token" in body &&
    typeof (body as { input_token: unknown }).input_token === "string"
      ? (body as { input_token: string }).input_token.trim()
      : "";

  if (!input_token) {
    return NextResponse.json({ error: "Thiếu input_token." }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(CLASS_LOGIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ input_token }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "Không kết nối được máy chủ lớp học." }, { status: 502 });
  }

  const data = (await upstream.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
    display_name?: string;
    is_admin?: boolean;
  };

  if (!data.success) {
    const err = typeof data.error === "string" && data.error.trim() ? data.error : "Đăng nhập thất bại.";
    return NextResponse.json({ success: false, error: err }, { status: 401 });
  }

  const display_name =
    typeof data.display_name === "string" && data.display_name.trim()
      ? data.display_name.trim()
      : "Thành viên";
  const is_admin = !!data.is_admin;

  const token = signSession(authSecret, display_name, is_admin);
  const res = NextResponse.json({
    success: true,
    display_name,
    is_admin,
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
