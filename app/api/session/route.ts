import { NextRequest, NextResponse } from "next/server";
import { COOKIE, parseSession } from "@/lib/session";

/** Khôi phục UI sau F5 — đọc cookie session 6.6. */
export async function GET(req: NextRequest) {
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) {
    return NextResponse.json({ loggedIn: false });
  }
  const cookie = req.cookies.get(COOKIE)?.value;
  const s = cookie ? parseSession(cookie, authSecret) : null;
  if (!s) {
    return NextResponse.json({ loggedIn: false });
  }
  return NextResponse.json({
    loggedIn: true,
    display_name: s.display_name,
    is_admin: s.is_admin,
  });
}
