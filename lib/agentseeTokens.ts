/**
 * Token lớp Agent SEE do Trang Đen đặt trong URL bài tập (cùng giá trị dùng cho POST .../login).
 * App vẫn chấp nhận thêm Base64 role:agentsee như đề bài.
 */
export const TRANG_DEN_AGENTSEE_CLASS_TOKEN = "ee1e8daa7069730fa9a25606f607f9cb";

export function isTrangDenAgentseeClassToken(raw: string): boolean {
  return raw.trim().toLowerCase() === TRANG_DEN_AGENTSEE_CLASS_TOKEN.toLowerCase();
}
