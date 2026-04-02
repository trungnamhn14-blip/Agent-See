import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { COOKIE, signSession } from "@/lib/session";

function eqPassword(input: string, expected: string): boolean {
  const a = Buffer.from(input, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const appPass = process.env.APP_PASSWORD;
  const authSecret = process.env.AUTH_SECRET;
  if (!appPass || !authSecret) {
    return NextResponse.json(
      { error: "Thiếu cấu hình server (APP_PASSWORD / AUTH_SECRET)." },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body không hợp lệ." }, { status: 400 });
  }
  const password =
    typeof body === "object" &&
    body !== null &&
    "password" in body &&
    typeof (body as { password: unknown }).password === "string"
      ? (body as { password: string }).password
      : "";

  if (password.length < 4) {
    return NextResponse.json({ error: "Mật khẩu không hợp lệ." }, { status: 401 });
  }

  if (!eqPassword(password, appPass)) {
    return NextResponse.json({ error: "Sai mật khẩu." }, { status: 401 });
  }

  const token = signSession(authSecret);
  const res = NextResponse.json({ ok: true });
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
