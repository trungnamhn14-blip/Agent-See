import { NextRequest, NextResponse } from "next/server";
import { getTrangDenLopHocOrigin } from "@/lib/trangdenBaiTap";

export const dynamic = "force-dynamic";

/** Chỉ cho phép ảnh avatar dưới /api/avatars/ — tránh SSRF. */
function allowedAvatarPath(p: string): string | null {
  const decoded = decodeURIComponent(p).trim();
  if (!decoded.startsWith("/api/avatars/")) return null;
  if (decoded.includes("..") || decoded.includes("//")) return null;
  return decoded;
}

/**
 * Proxy ảnh từ web lớp (cùng origin với trình duyệt → html2canvas không bị taint CORS).
 * GET ?p=%2Fapi%2Favatars%2F157_b68_compare_300.jpg
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("p");
  if (!raw) {
    return NextResponse.json({ error: "Thiếu p" }, { status: 400 });
  }
  const path = allowedAvatarPath(raw);
  if (!path) {
    return NextResponse.json({ error: "Path không hợp lệ" }, { status: 400 });
  }
  const origin = getTrangDenLopHocOrigin();
  const target = `${origin}${path}`;
  const r = await fetch(target, {
    headers: { Accept: "image/*,*/*" },
    next: { revalidate: 300 },
  });
  if (!r.ok) {
    return NextResponse.json({ error: `Upstream ${r.status}` }, { status: 502 });
  }
  const buf = await r.arrayBuffer();
  const type = r.headers.get("content-type") || "image/jpeg";
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=300",
    },
  });
}
