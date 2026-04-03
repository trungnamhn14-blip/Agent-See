/**
 * URL POST login của đề Trang Đen (browser gọi trực tiếp → hệ thống chấm thấy IP học viên).
 * Tuỳ chỉnh trên Vercel: NEXT_PUBLIC_TRANGDEN_BAI_TAP_LOGIN_URL
 */
export function getTrangDenBaiTapLoginUrl(): string {
  const u = process.env.NEXT_PUBLIC_TRANGDEN_BAI_TAP_LOGIN_URL;
  if (typeof u === "string" && u.trim().length > 0) return u.trim();
  return "https://trangden.vn/agentsee/api/bai-tap/3147/ee1e8daa7069730fa9a25606f607f9cb/tuan-1/bai-6/cau-6/login";
}
