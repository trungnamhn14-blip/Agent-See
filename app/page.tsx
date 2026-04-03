"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Role = "user" | "model";

type Msg = { role: Role; text: string };

const LS_GUEST_SENT = "bai66_guest_user_sends";
const LS_LOGIN_COUNT = "bai66_login_count";

export default function Page() {
  const [hydrating, setHydrating] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [inputToken, setInputToken] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [guestSent, setGuestSent] = useState(() => {
    if (typeof window === "undefined") return 0;
    const g = parseInt(localStorage.getItem(LS_GUEST_SENT) || "0", 10);
    return Number.isFinite(g) ? Math.min(3, Math.max(0, g)) : 0;
  });
  const [loginCount, setLoginCount] = useState(() => {
    if (typeof window === "undefined") return 0;
    const lc = parseInt(localStorage.getItem(LS_LOGIN_COUNT) || "0", 10);
    return Number.isFinite(lc) ? lc : 0;
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  const loginPanelRef = useRef<HTMLDivElement>(null);

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/session");
        const d = await r.json().catch(() => ({}));
        if (!alive) return;
        if (d.loggedIn === true && typeof d.display_name === "string") {
          setLoggedIn(true);
          setDisplayName(d.display_name);
          setIsAdmin(!!d.is_admin);
        }
      } finally {
        if (alive) setHydrating(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginErr("");
    const tok = inputToken.trim();
    if (!tok) {
      setLoginErr("Vui lòng nhập token.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input_token: tok }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.success) {
        setLoginErr(typeof data.error === "string" ? data.error : "Đăng nhập thất bại.");
        return;
      }
      const name = typeof data.display_name === "string" ? data.display_name : "Thành viên";
      const admin = !!data.is_admin;
      setDisplayName(name);
      setIsAdmin(admin);
      setLoggedIn(true);
      setInputToken("");
      setLoginCount((prev) => {
        const nextLc = prev + 1;
        localStorage.setItem(LS_LOGIN_COUNT, String(nextLc));
        return nextLc;
      });
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
      setDisplayName("");
      setIsAdmin(false);
      setMessages([]);
      setInput("");
    }
  }

  function scrollToLogin() {
    loginPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const t = input.trim();
    if (!t || busy) return;
    if (!loggedIn && guestSent >= 3) return;

    const next: Msg[] = [...messages, { role: "user", text: t }];
    setMessages(next);
    setInput("");
    setBusy(true);
    scrollDown();

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          guest_messages_sent_before: loggedIn ? undefined : guestSent,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const err = typeof data.error === "string" ? data.error : "Lỗi chat.";
        alert(err);
        setMessages(messages);
        return;
      }
      const reply =
        typeof data.reply === "string" && data.reply.length > 0
          ? data.reply
          : "Bot đang hoạt động bình thường 🤖";
      setMessages([...next, { role: "model", text: reply }]);
      if (!loggedIn) {
        const ns = guestSent + 1;
        localStorage.setItem(LS_GUEST_SENT, String(ns));
        setGuestSent(ns);
      }
      scrollDown();
    } catch {
      setMessages([
        ...next,
        { role: "model", text: "Bot đang hoạt động bình thường 🤖" },
      ]);
      if (!loggedIn) {
        const ns = guestSent + 1;
        localStorage.setItem(LS_GUEST_SENT, String(ns));
        setGuestSent(ns);
      }
      scrollDown();
    } finally {
      setBusy(false);
    }
  }

  const trialExhausted = !loggedIn && guestSent >= 3;
  const canSendGuest = loggedIn || guestSent < 3;
  const canCompose = canSendGuest && !trialExhausted;

  if (hydrating) {
    return (
      <main>
        <p className="sub">Đang tải…</p>
      </main>
    );
  }

  return (
    <main>
      <header className="app-header">
        <div className="app-header-left">
          <h1>Chat AI / AI Agent</h1>
          <p className="sub" style={{ marginBottom: 0 }}>
            Giải đáp ngắn gọn — API key chỉ nằm trên server.
          </p>
        </div>
        {loggedIn ? (
          <div className="app-header-right">
            <span className="user-name">{displayName}</span>
            {isAdmin ? (
              <span className="badge-admin" title="Quản trị viên">
                ADMIN
              </span>
            ) : null}
            <button type="button" className="secondary btn-header" onClick={handleLogout} disabled={busy}>
              Đăng xuất
            </button>
          </div>
        ) : null}
      </header>

      <div ref={loginPanelRef} className="panel">
        <form onSubmit={handleLogin}>
          <label htmlFor="classToken">Login bằng token lớp Agent SEE</label>
          <input
            id="classToken"
            type="text"
            autoComplete="off"
            value={inputToken}
            onChange={(e) => setInputToken(e.target.value)}
            placeholder="Dán token lớp học"
          />
          {loginErr ? <p className="err">{loginErr}</p> : null}
          <button type="submit" disabled={busy}>
            {busy ? "Đang kiểm tra…" : "Đăng nhập"}
          </button>
        </form>
      </div>

      {!loggedIn && guestSent > 0 && guestSent < 3 ? (
        <p className="sub" style={{ marginTop: "-0.5rem", marginBottom: "0.75rem" }}>
          Dùng thử: đã gửi {guestSent}/3 tin (khách).
        </p>
      ) : null}

      {trialExhausted ? (
        <div className="trial-banner">
          <p className="trial-text">Hết lượt dùng thử. Đăng nhập để tiếp tục.</p>
          <button type="button" className="secondary" onClick={scrollToLogin}>
            Đăng nhập
          </button>
        </div>
      ) : null}

      {isAdmin && loggedIn ? (
        <div className="panel admin-tools">
          <p className="sub" style={{ margin: "0 0 0.5rem" }}>
            <strong style={{ color: "#e8ecf1" }}>Thống kê:</strong> tổng tin nhắn (phiên): {messages.length}{" "}
            · số lượt đăng nhập: {loginCount}
          </p>
          <button
            type="button"
            className="secondary"
            style={{ marginTop: 0 }}
            onClick={() => setMessages([])}
            disabled={busy}
          >
            Xoá lịch sử
          </button>
        </div>
      ) : null}

      <div className="panel chat-panel">
        <div className="messages">
          {messages.length === 0 ? (
            <div className="bubble bot">
              {loggedIn
                ? "Xin chào! Hỏi bất cứ điều gì về AI hay AI Agent — gửi tin nhắn bên dưới."
                : "Bạn đang xem giao diện với tư cách khách — có thể gửi tối đa 3 tin dùng thử."}
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
            placeholder={
              trialExhausted
                ? "Hết lượt dùng thử — đăng nhập phía trên."
                : "Ví dụ: AI Agent khác gì với chatbot thường?"
            }
            disabled={busy || !canCompose}
          />
          <button type="submit" disabled={busy || !input.trim() || !canCompose}>
            {busy ? "Đang trả lời…" : "Gửi"}
          </button>
        </form>
      </div>
    </main>
  );
}
