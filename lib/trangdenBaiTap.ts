/**
 * URL POST login của đề Trang Đen (browser gọi trực tiếp → hệ thống chấm thấy IP học viên).
 * Tuỳ chỉnh trên Vercel:
 * - NEXT_PUBLIC_TRANGDEN_BAI_TAP_LOGIN_URL
 * - NEXT_PUBLIC_TRANGDEN_CAU8_STATUS_URL | SUBMIT_URL (nếu không suy ra từ login)
 * - NEXT_PUBLIC_TRANGDEN_LOP_HOC_ORIGIN (mặc định https://trangden.vn/agentsee/lop-hoc — ảnh *_compare_300.jpg)
 */
export function getTrangDenBaiTapLoginUrl(): string {
  const u = process.env.NEXT_PUBLIC_TRANGDEN_BAI_TAP_LOGIN_URL;
  if (typeof u === "string" && u.trim().length > 0) return u.trim();
  return "https://trangden.vn/agentsee/api/bai-tap/3147/ee1e8daa7069730fa9a25606f607f9cb/tuan-1/bai-6/cau-6/login";
}

/** Token chủ bài (segment sau /bai-tap/{id}/) — dùng field owner_token khi POST câu 8. */
export function getTrangDenOwnerTokenFromLoginUrl(): string {
  const login = getTrangDenBaiTapLoginUrl();
  const m = login.match(/\/bai-tap\/\d+\/([^/]+)\//);
  return m?.[1]?.trim() ?? "";
}

/**
 * POST multipart câu 8 (screenshot + owner_token + visitor_token).
 * Mặc định suy ra từ URL login; tuỳ chỉnh: NEXT_PUBLIC_TRANGDEN_CAU8_SUBMIT_URL
 */
export function getTrangDenCau8SubmitUrl(): string {
  const u = process.env.NEXT_PUBLIC_TRANGDEN_CAU8_SUBMIT_URL;
  if (typeof u === "string" && u.trim().length > 0) return u.trim();
  const login = getTrangDenBaiTapLoginUrl();
  const next = login.replace(/\/bai-6\/cau-6\/login\/?$/i, "/bai-6/cau-8/submit");
  if (next !== login) return next;
  return login.replace(/cau-6\/login\/?$/i, "cau-8/submit");
}

/** GET JSON có `visitor_avatar_url` = đúng file 300×300 server dùng so OpenCV (web lớp / lop-hoc). */
export function getTrangDenCau8StatusUrl(): string {
  const u = process.env.NEXT_PUBLIC_TRANGDEN_CAU8_STATUS_URL;
  if (typeof u === "string" && u.trim().length > 0) return u.trim();
  const login = getTrangDenBaiTapLoginUrl();
  const next = login.replace(/\/bai-6\/cau-6\/login\/?$/i, "/bai-6/cau-8/status");
  if (next !== login) return next;
  return login.replace(/cau-6\/login\/?$/i, "cau-8/status");
}

/**
 * Gốc web lớp học — path tương đối như `/api/avatars/..._compare_300.jpg` ghép vào đây.
 * Mặc định giống app Flutter Agent SEE.
 */
export function getTrangDenLopHocOrigin(): string {
  const u = process.env.NEXT_PUBLIC_TRANGDEN_LOP_HOC_ORIGIN;
  if (typeof u === "string" && u.trim().length > 0) return u.replace(/\/$/, "");
  return "https://trangden.vn/agentsee/lop-hoc";
}
