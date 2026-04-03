"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Role = "user" | "model";

type Msg = { role: Role; text: string };

type AgsRole = "admin" | "member" | "guest";

const LS_TOKEN = "agentsee_token";
const LS_ROLE = "agentsee_role";
const LS_MEMBER = "agentsee_member_msg_count";
const LS_IP = "agentsee_user_ip";
const LS_UID = "uid";

const TRACK_URL = "https://trangden.vn/agentsee/api/track";

const VALID_AGS: readonly AgsRole[] = ["admin", "member", "guest"];

const TOK_ADMIN = "YWRtaW46YWdlbnRzZWU=";
const TOK_MEMBER = "bWVtYmVyOmFnZW50c2Vl";
const TOK_GUEST = "Z3Vlc3Q6YWdlbnRzZWU=";

function parseClientRoleToken(raw: string): { ok: true; role: AgsRole } | { ok: false } {
  const t = raw.trim();
  if (!t) return { ok: false };
  try {
    const decoded = atob(t);
    const idx = decoded.indexOf(":");
    if (idx < 0) return { ok: false };
    const role = decoded.slice(0, idx).trim().toLowerCase();
    const secret = decoded.slice(idx + 1).trim();
    if (!VALID_AGS.includes(role as AgsRole)) return { ok: false };
    if (secret !== "agentsee") return { ok: false };
    return { ok: true, role: role as AgsRole };
  } catch {
    return { ok: false };
  }
}

function trackPing(body: Record<string, unknown>) {
  fetch(TRACK_URL, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

function humanDelay() {
  const ms = 500 + Math.random() * 1000;
  return new Promise<void>((r) => setTimeout(r, ms));
}

export default function Page() {
  const [booting, setBooting] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [roleToken, setRoleToken] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [agsRole, setAgsRole] = useState<AgsRole | null>(null);
  const [memberSent, setMemberSent] = useState(0);
  const [userId, setUserId] = useState("");
  const [userIP, setUserIP] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  }, []);

  const applySession = useCallback(
    async (role: AgsRole, tokenStr: string, sendLoginTrack: boolean) => {
      localStorage.setItem(LS_TOKEN, tokenStr);
      localStorage.setItem(LS_ROLE, role);
      setAgsRole(role);
      if (role === "member") {
        const c = parseInt(localStorage.getItem(LS_MEMBER) || "0", 10);
        setMemberSent(Number.isFinite(c) ? Math.min(5, Math.max(0, c)) : 0);
      } else {
        localStorage.removeItem(LS_MEMBER);
        setMemberSent(0);
      }

      let uid = localStorage.getItem(LS_UID);
      if (!uid) {
        uid = crypto.randomUUID();
        localStorage.setItem(LS_UID, uid);
      }
      setUserId(uid);

      let ip = localStorage.getItem(LS_IP);
      if (!ip) {
        try {
          const ipRes = await fetch("https://api.ipify.org?format=json");
          const ipData = (await ipRes.json()) as { ip?: string };
          ip = typeof ipData.ip === "string" ? ipData.ip : "unknown";
          localStorage.setItem(LS_IP, ip);
        } catch {
          ip = "unknown";
        }
      }
      setUserIP(ip || "unknown");

      if (sendLoginTrack) {
        trackPing({
          role,
          userId: uid,
          ip: ip || "unknown",
          action: "login",
          time: Date.now(),
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        });
      }

      setLoggedIn(true);
    },
    []
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const qToken = params.get("token");
        if (qToken) {
          const p = parseClientRoleToken(qToken);
          if (p.ok) {
            const r = await fetch("/api/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ roleToken: qToken.trim() }),
            });
            if (alive && r.ok) {
              await applySession(p.role, qToken.trim(), true);
              window.history.replaceState({}, "", window.location.pathname);
            }
          }
        } else {
          const stored = localStorage.getItem(LS_TOKEN);
          if (stored) {
            const p = parseClientRoleToken(stored);
            if (p.ok) {
              const r = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ roleToken: stored.trim() }),
              });
              if (alive && r.ok) {
                await applySession(p.role, stored.trim(), false);
              }
            }
          }
        }
      } finally {
        if (alive) setBooting(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [applySession]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginErr("");
    const clientParsed = parseClientRoleToken(roleToken);
    if (!clientParsed.ok) {
      setLoginErr("Token không hợp lệ (Base64 role:agentsee).");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: password || undefined,
          roleToken: roleToken.trim(),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setLoginErr(typeof data.error === "string" ? data.error : "Đăng nhập thất bại.");
        return;
      }
      await applySession(clientParsed.role, roleToken.trim(), true);
      setPassword("");
      setRoleToken("");
      setMessages([]);
    } catch {
      setLoginErr("Lỗi mạng.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    try {
      await fetch("/api/logout", { method: "POST" });
    } finally {
      setBusy(false);
      setLoggedIn(false);
      setMessages([]);
      setInput("");
      setAgsRole(null);
      setMemberSent(0);
      setUserId("");
      setUserIP("");
      localStorage.removeItem(LS_TOKEN);
      localStorage.removeItem(LS_ROLE);
      localStorage.removeItem(LS_MEMBER);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const t = input.trim();
    if (!t || busy) return;
    if (agsRole === "guest") return;
    if (agsRole === "member" && memberSent >= 5) return;

    const next: Msg[] = [...messages, { role: "user", text: t }];
    setMessages(next);
    setInput("");
    setBusy(true);
    scrollDown();

    await humanDelay();

    const uid = localStorage.getItem(LS_UID) || userId || "";
    const ip = localStorage.getItem(LS_IP) || userIP || "unknown";
    if (agsRole) {
      trackPing({
        role: agsRole,
        userId: uid,
        ip,
        action: "chat",
        time: Date.now(),
      });
    }

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          member_sent_before: agsRole === "member" ? memberSent : 0,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert(typeof data.error === "string" ? data.error : "Lỗi chat.");
        setMessages(messages);
        return;
      }
      const reply =
        typeof data.reply === "string" && data.reply.length > 0
          ? data.reply
          : "Bot đang hoạt động bình thường 🤖";
      setMessages([...next, { role: "model", text: reply }]);
      if (agsRole === "member") {
        setMemberSent((n) => {
          const nextN = n + 1;
          localStorage.setItem(LS_MEMBER, String(nextN));
          return nextN;
        });
      }
      scrollDown();
    } catch {
      setMessages([
        ...next,
        { role: "model", text: "Bot đang hoạt động bình thường 🤖" },
      ]);
      scrollDown();
    } finally {
      setBusy(false);
    }
  }

  const guestBlock = agsRole === "guest";
  const memberRemaining = agsRole === "member" ? Math.max(0, 5 - memberSent) : null;
  const memberAtLimit = agsRole === "member" && memberSent >= 5;

  const goToken = (tok: string) => {
    const path = typeof window !== "undefined" ? window.location.pathname || "/" : "/";
    window.location.href = `${path}?token=${encodeURIComponent(tok)}`;
  };

  if (booting) {
    return (
      <main>
        <h1>Chat AI / AI Agent</h1>
        <p className="sub">Đang chuẩn bị…</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Chat AI / AI Agent</h1>
      <p className="sub">Giải đáp ngắn gọn — API key chỉ nằm trên server.</p>

      {!loggedIn ? (
        <>
          <div className="row-actions" style={{ marginBottom: "0.65rem" }}>
            <span className="sub" style={{ width: "100%", marginBottom: "0.25rem" }}>
              Vào nhanh (token URL):
            </span>
            <button type="button" className="secondary" onClick={() => goToken(TOK_ADMIN)}>
              Admin
            </button>
            <button type="button" className="secondary" onClick={() => goToken(TOK_MEMBER)}>
              Member
            </button>
            <button type="button" className="secondary" onClick={() => goToken(TOK_GUEST)}>
              Guest
            </button>
          </div>
          <form className="panel" onSubmit={handleLogin}>
            <label htmlFor="roleTok">Token vai trò</label>
            <input
              id="roleTok"
              type="text"
              autoComplete="off"
              value={roleToken}
              onChange={(e) => setRoleToken(e.target.value)}
              placeholder="Dán token (admin / member / guest)"
            />
            <label htmlFor="pw">Mật khẩu (tuỳ chọn nếu server yêu cầu)</label>
            <input
              id="pw"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Để trống nếu đăng nhập chỉ bằng token"
            />
            {loginErr ? <p className="err">{loginErr}</p> : null}
            <button type="submit" disabled={busy}>
              {busy ? "Đang kiểm tra…" : "Vào chat"}
            </button>
          </form>
        </>
      ) : (
        <>
          <div className="panel" style={{ marginBottom: "0.75rem", padding: "0.75rem 1rem" }}>
            <p className="sub" style={{ margin: 0, lineHeight: 1.5 }}>
              <strong style={{ color: "#e8ecf1" }}>Vai trò:</strong> {agsRole ?? "—"}
              {" · "}
              <strong style={{ color: "#e8ecf1" }}>IP:</strong> {userIP || "—"}
              {" · "}
              <strong style={{ color: "#e8ecf1" }}>User ID:</strong> {userId || "—"}
            </p>
          </div>
          <div className="row-actions" style={{ marginBottom: "0.75rem" }}>
            <button type="button" className="secondary" onClick={handleLogout} disabled={busy}>
              Đăng xuất
            </button>
          </div>
          {memberRemaining !== null ? (
            <p className="sub" style={{ marginTop: "-0.35rem", marginBottom: "0.65rem" }}>
              Còn {memberRemaining}/5 tin nhắn
            </p>
          ) : null}
          {guestBlock ? (
            <p className="err" style={{ marginTop: "-0.35rem", marginBottom: "0.65rem" }}>
              Bạn không có quyền gửi tin nhắn
            </p>
          ) : null}
          <div className="panel" style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div className="messages">
              {messages.length === 0 ? (
                <div className="bubble bot">
                  Xin chào! Hỏi bất cứ điều gì về AI hay AI Agent — gửi tin nhắn bên dưới.
                </div>
              ) : null}
              {messages.map((m, i) => (
                <div key={i} className={`bubble ${m.role === "user" ? "user" : "bot"}`}>
                  {m.text}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <form onSubmit={handleSend}>
              <label htmlFor="msg">Câu hỏi</label>
              <textarea
                id="msg"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ví dụ: AI Agent khác gì với chatbot thường?"
                disabled={busy || guestBlock || memberAtLimit}
              />
              <button type="submit" disabled={busy || !input.trim() || guestBlock || memberAtLimit}>
                {busy ? "Đang trả lời…" : "Gửi"}
              </button>
            </form>
          </div>
        </>
      )}
    </main>
  );
}
