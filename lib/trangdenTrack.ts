/**
 * Trang Đen Agent SEE — client phải POST tới đây để hệ thống chấm (visit / login / chat).
 * credentials: "include" để gửi cookie phiên Trang Đen nếu có.
 */
const AGENTSEE_TRACK_URL = "https://trangden.vn/agentsee/api/track";

const jsonHeaders = { "Content-Type": "application/json" };

export function trackAgentseeVisit(): void {
  if (typeof window === "undefined") return;
  fetch(AGENTSEE_TRACK_URL, {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({ action: "visit", timestamp: Date.now() }),
  }).catch(() => {});
}

export function trackAgentseeLogin(role: string): void {
  if (typeof window === "undefined") return;
  fetch(AGENTSEE_TRACK_URL, {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({
      role,
      action: "login",
      timestamp: Date.now(),
      userAgent: navigator.userAgent || "",
    }),
  }).catch(() => {});
}

export function trackAgentseeChat(role: string): void {
  if (typeof window === "undefined") return;
  fetch(AGENTSEE_TRACK_URL, {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({
      role,
      action: "chat",
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}
