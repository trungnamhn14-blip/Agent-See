"use client";

import { useCallback, useRef, useState } from "react";

type Role = "user" | "model";

type Msg = { role: Role; text: string };

export default function Page() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginErr("");
    setBusy(true);
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setLoginErr(typeof data.error === "string" ? data.error : "Đăng nhập thất bại.");
        return;
      }
      setLoggedIn(true);
      setPassword("");
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
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const t = input.trim();
    if (!t || busy) return;
    const next: Msg[] = [...messages, { role: "user", text: t }];
    setMessages(next);
    setInput("");
    setBusy(true);
    scrollDown();
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert(typeof data.error === "string" ? data.error : "Lỗi chat.");
        setMessages(messages);
        return;
      }
      const reply = typeof data.reply === "string" ? data.reply : "";
      setMessages([...next, { role: "model", text: reply || "(Không có nội dung)" }]);
      scrollDown();
    } catch {
      alert("Lỗi mạng.");
      setMessages(messages);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>Chat AI / AI Agent</h1>
      <p className="sub">Giải đáp ngắn gọn — API key chỉ nằm trên server.</p>

      {!loggedIn ? (
        <form className="panel" onSubmit={handleLogin}>
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
                disabled={busy}
              />
              <button type="submit" disabled={busy || !input.trim()}>
                {busy ? "Đang trả lời…" : "Gửi"}
              </button>
            </form>
          </div>
        </>
      )}
    </main>
  );
}
