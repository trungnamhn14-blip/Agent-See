"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { roleFromTrangDenHexToken } from "@/lib/agentseeTokens";

type Role = "user" | "model";

type Msg = { role: Role; text: string };

type AgsRole = "admin" | "member" | "guest";

const LS_TOKEN = "agentsee_token";
const LS_ROLE = "agentsee_role";
const LS_MEMBER = "agentsee_member_msg_count";
/** Chỉ khôi phục UI đăng nhập trong cùng tab sau F5; mở link/tab mới luôn thấy form login. */
const SS_TAB_LOGIN = "agentsee_tab_login";

const VALID_AGS: readonly AgsRole[] = ["admin", "member", "guest"];

function tabLoginMarked(): boolean {
  try {
    return sessionStorage.getItem(SS_TAB_LOGIN) === "1";
  } catch {
    return false;
  }
}

function markTabLoggedIn(): void {
  try {
    sessionStorage.setItem(SS_TAB_LOGIN, "1");
  } catch {
    /* private mode */
  }
}

function clearTabLoginMark(): void {
  try {
    sessionStorage.removeItem(SS_TAB_LOGIN);
  } catch {
    /* ignore */
  }
}

function parseClientRoleToken(raw: string): { ok: true; role: AgsRole } | { ok: false } {
  const t = raw.trim();
  if (!t) return { ok: false };
  const hexRole = roleFromTrangDenHexToken(t);
  if (hexRole) return { ok: true, role: hexRole };
  return { ok: false };
}

async function establishSession(roleToken: string): Promise<{ ok: true; role: AgsRole } | { ok: false }> {
  const r = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roleToken: roleToken.trim() }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.ok) return { ok: false };
  const role = data.role as AgsRole;
  if (!VALID_AGS.includes(role)) return { ok: false };
  return { ok: true, role };
}

export default function Page() {
  const [hydrating, setHydrating] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [agsRole, setAgsRole] = useState<AgsRole | null>(null);
  const [roleTokenInput, setRoleTokenInput] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [memberSent, setMemberSent] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  }, []);

  const syncMemberFromLS = useCallback((role: AgsRole) => {
    if (role === "member") {
      const c = parseInt(localStorage.getItem(LS_MEMBER) || "0", 10);
      setMemberSent(Number.isFinite(c) ? Math.min(5, Math.max(0, c)) : 0);
    } else {
      localStorage.removeItem(LS_MEMBER);
      setMemberSent(0);
    }
  }, []);

  const finishLogin = useCallback(
    (role: AgsRole, tokenStr: string) => {
      localStorage.setItem(LS_TOKEN, tokenStr.trim());
      localStorage.setItem(LS_ROLE, role);
      setAgsRole(role);
      syncMemberFromLS(role);
      setLoggedIn(true);
      setMessages([]);
      markTabLoggedIn();
    },
    [syncMemberFromLS]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!tabLoginMarked()) {
          return;
        }
        const r = await fetch("/api/session");
        const d = await r.json().catch(() => ({}));
        if (alive && d.loggedIn && typeof d.role === "string" && VALID_AGS.includes(d.role as AgsRole)) {
          const role = d.role as AgsRole;
          setAgsRole(role);
          localStorage.setItem(LS_ROLE, role);
          syncMemberFromLS(role);
          setLoggedIn(true);
        } else if (alive) {
          clearTabLoginMark();
        }
      } finally {
        if (alive) setHydrating(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [syncMemberFromLS]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginErr("");
    const tok = roleTokenInput.trim();
    if (!tok) {
      setLoginErr("Vui lòng nhập token.");
      return;
    }
    const p = parseClientRoleToken(tok);
    if (!p.ok) {
      setLoginErr("Token không hợp lệ.");
      return;
    }
    setBusy(true);
    try {
      const est = await establishSession(tok);
      if (!est.ok) {
        setLoginErr("Đăng nhập thất bại.");
        return;
      }
      finishLogin(est.role, tok);
      setRoleTokenInput("");
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
      clearTabLoginMark();
      setLoggedIn(false);
      setAgsRole(null);
      setMemberSent(0);
      setMessages([]);
      setInput("");
      localStorage.removeItem(LS_TOKEN);
      localStorage.removeItem(LS_ROLE);
      localStorage.removeItem(LS_MEMBER);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const t = input.trim();
    if (!t || busy || !loggedIn || !agsRole) return;
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
      if (agsRole === "member") {
        setMemberSent((n) => {
          const nextN = n + 1;
          localStorage.setItem(LS_MEMBER, String(nextN));
          return nextN;
        });
      }
      scrollDown();
    } finally {
      setBusy(false);
    }
  }

  const guestBlock = agsRole === "guest";
  const memberRemaining = agsRole === "member" ? Math.max(0, 5 - memberSent) : null;
  const memberAtLimit = agsRole === "member" && memberSent >= 5;

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
        </div>
        {loggedIn && agsRole ? (
          <div className="app-header-right">
            <span className="user-name">Vai trò: {agsRole}</span>
            {agsRole === "admin" ? (
              <span className="badge-admin" title="Admin">
                ADMIN
              </span>
            ) : null}
            <button type="button" className="secondary btn-header" onClick={handleLogout} disabled={busy}>
              Đăng xuất
            </button>
          </div>
        ) : null}
      </header>

      {!loggedIn ? (
        <form className="panel" onSubmit={handleLogin}>
          <label htmlFor="tok">Login bằng token lớp Agent SEE</label>
          <input
            id="tok"
            type="text"
            autoComplete="off"
            value={roleTokenInput}
            onChange={(e) => setRoleTokenInput(e.target.value)}
          />
          {loginErr ? <p className="err">{loginErr}</p> : null}
          <button type="submit" disabled={busy}>
            {busy ? "Đang kiểm tra…" : "Đăng nhập"}
          </button>
        </form>
      ) : null}

      {loggedIn && memberRemaining !== null ? (
        <p className="sub" style={{ marginBottom: "0.65rem" }}>
          Còn {memberRemaining}/5 tin nhắn
        </p>
      ) : null}

      {loggedIn && guestBlock ? (
        <p className="err" style={{ marginBottom: "0.65rem" }}>
          Bạn không có quyền gửi tin nhắn
        </p>
      ) : null}

      <div className="panel chat-panel">
        <div className="messages">
          {messages.length === 0 ? (
            <div className="bubble bot">
              {!loggedIn
                ? "Đăng nhập để bắt đầu chat."
                : guestBlock
                  ? "Bạn chỉ có thể xem, không gửi tin nhắn."
                  : "Xin chào! Hỏi bất cứ điều gì về AI hay AI Agent — gửi tin nhắn bên dưới."}
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
              !loggedIn
                ? "Đăng nhập trước khi gửi."
                : guestBlock
                  ? "Không thể gửi tin nhắn."
                  : "Ví dụ: AI Agent khác gì với chatbot thường?"
            }
            disabled={busy || !loggedIn || guestBlock || memberAtLimit}
          />
          <button
            type="submit"
            disabled={busy || !loggedIn || !input.trim() || guestBlock || memberAtLimit}
          >
            {busy ? "Đang trả lời…" : "Gửi"}
          </button>
        </form>
      </div>
    </main>
  );
}
