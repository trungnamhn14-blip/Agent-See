import { NextResponse } from "next/server";
import { getTrangDenCau8StatusUrl } from "@/lib/trangdenBaiTap";

export const dynamic = "force-dynamic";

/**
 * Proxy GET cau-8/status — trả visitor_avatar_url (mẫu 300×300 so khớp) và visitor_name.
 */
export async function GET() {
  const url = getTrangDenCau8StatusUrl();
  const r = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });
  const text = await r.text();
  if (!r.ok) {
    return NextResponse.json(
      { error: text || `Trang Đen ${r.status}`, success: false },
      { status: r.status >= 400 && r.status < 600 ? r.status : 502 }
    );
  }
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Phản hồi không phải JSON", success: false }, { status: 502 });
  }
}
