import { NextRequest, NextResponse } from "next/server";
import { COOKIE, parseSession } from "@/lib/session";

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
    role: s.role,
    display_name: s.displayName || "",
    is_admin: s.role === "admin",
  });
}
