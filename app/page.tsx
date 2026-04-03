"use client";

import { useCallback, useRef, useState } from "react";

type Role = "user" | "model";

type Msg = { role: Role; text: string };

type AgsRole = "admin" | "member" | "guest";

const LS_TOKEN = "agentsee_token";
const LS_ROLE = "agentsee_role";

const VALID_AGS: readonly AgsRole[] = ["admin", "member", "guest"];

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

export default function Page() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [roleToken, setRoleToken] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [agsRole, setAgsRole] = useState<AgsRole | null>(null);
  const [memberSent, setMemberSent] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  }, []);

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
        body: JSON.stringify({ password, roleToken: roleToken.trim() }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setLoginErr(typeof data.error === "string" ? data.error : "Đăng nhập thất bại.");
        return;
      }
      localStorage.setItem(LS_TOKEN, roleToken.trim());
      localStorage.setItem(LS_ROLE, clientParsed.role);
      setAgsRole(clientParsed.role);
      setMemberSent(0);
      setLoggedIn(true);
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
      localStorage.removeItem(LS_TOKEN);
      localStorage.removeItem(LS_ROLE);
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
      const reply = typeof data.reply === "string" ? data.reply : "";
      setMessages([...next, { role: "model", text: reply || "(Không có nội dung)" }]);
      if (agsRole === "member") {
        setMemberSent((n) => n + 1);
      }
      scrollDown();
    } catch {
      alert("Lỗi mạng.");
      setMessages(messages);
    } finally {
      setBusy(false);
    }
  }

  const guestBlock = agsRole === "guest";
  const memberRemaining = agsRole === "member" ? Math.max(0, 5 - memberSent) : null;
  const memberAtLimit = agsRole === "member" && memberSent >= 5;

  return (
    <main>
      <h1>Chat AI / AI Agent</h1>
      <p className="sub">Giải đáp ngắn gọn — API key chỉ nằm trên server.</p>

      {!loggedIn ? (
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
          <label htmlFor="pw">Mật khẩu</label>
          <input
            id="pw"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nhập mật khẩu"
          />
          {loginErr ? <p className="err">{loginErr}</p> : null}
          <button type="submit" disabled={busy}>
            {busy ? "Đang kiểm tra…" : "Vào chat"}
          </button>
        </form>
      ) : (
        <>
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
