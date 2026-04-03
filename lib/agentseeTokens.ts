/**
 * Token lớp Agent SEE: đoạn 32 ký tự hex trong URL bài tập Trang Đen (mỗi học viên/bài có thể khác).
 * Thêm Base64 role:agentsee như đề bài.
 */
export const TRANG_DEN_AGENTSEE_CLASS_TOKEN = "ee1e8daa7069730fa9a25606f607f9cb";

/** Hex 32 ký tự — cùng dạng mã trong path .../bai-tap/<id>/<hex>/tuan-... */
export function isTrangDenPathStyleToken(raw: string): boolean {
  return /^[a-f0-9]{32}$/i.test(raw.trim());
}

/** Hex admin (chủ lớp) → admin; mọi hex 32 ký tự khác → member. */
export function roleFromTrangDenHexToken(raw: string): "admin" | "member" | null {
  const t = raw.trim();
  if (!isTrangDenPathStyleToken(t)) return null;
  return t.toLowerCase() === TRANG_DEN_AGENTSEE_CLASS_TOKEN.toLowerCase() ? "admin" : "member";
}
