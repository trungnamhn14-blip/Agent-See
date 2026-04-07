"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getTrangDenBaiTapLoginUrl,
  getTrangDenCau8SubmitUrl,
  getTrangDenOwnerTokenFromLoginUrl,
} from "@/lib/trangdenBaiTap";

type Role = "user" | "model";

type Msg = { role: Role; text: string };

type AgsRole = "admin" | "member" | "guest";

const LS_ROLE = "agentsee_role";
const LS_DISPLAY = "agentsee_display_name";
const LS_MEMBER = "agentsee_member_msg_count";
const SS_TAB_LOGIN = "agentsee_tab_login";
const SS_VISITOR_TOKEN = "agentsee_visitor_token";
const SS_AVATAR_URL = "agentsee_avatar_url";

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

type TrangDenLoginJson = {
  success?: boolean;
  error?: string;
  display_name?: string;
  is_admin?: boolean;
  avatar_url?: string;
};

async function postTrangDenLogin(inputToken: string): Promise<
  | { ok: true; display_name: string; is_admin: boolean; avatar_url?: string }
  | { ok: false; error: string }
> {
  const url = getTrangDenBaiTapLoginUrl();
  // Không dùng credentials: "include" — Trang Đen trả Access-Control-Allow-Origin: * ;
  // trình duyệt sẽ chặn CORS nếu include + wildcard (thành "Lỗi mạng" trong catch).
  const td = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input_token: inputToken }),
  });
  const data = (await td.json().catch(() => ({}))) as TrangDenLoginJson;
  if (!data.success || typeof data.display_name !== "string" || !data.display_name.trim()) {
    const msg =
      typeof data.error === "string" && data.error.trim()
        ? data.error
        : td.ok
          ? "Đăng nhập thất bại."
          : `Trang Đen trả lỗi (${td.status}).`;
    return { ok: false, error: msg };
  }
  const av =
    typeof data.avatar_url === "string" && data.avatar_url.trim().length > 0
      ? data.avatar_url.trim()
      : undefined;
  return { ok: true, display_name: data.display_name.trim(), is_admin: !!data.is_admin, avatar_url: av };
}

async function postAppLogin(role: AgsRole, displayName: string): Promise<boolean> {
  const r = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, displayName }),
  });
  const d = await r.json().catch(() => ({}));
  return r.ok && d.ok === true;
}

export default function Page() {
  const [hydrating, setHydrating] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [agsRole, setAgsRole] = useState<AgsRole | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [roleTokenInput, setRoleTokenInput] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [memberSent, setMemberSent] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [visitorToken, setVisitorToken] = useState<string | null>(null);
  const [submitHomeworkBusy, setSubmitHomeworkBusy] = useState(false);
  const [submitHomeworkMsg, setSubmitHomeworkMsg] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const captureRootRef = useRef<HTMLDivElement>(null);

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
    (role: AgsRole, name: string, vTok: string, av?: string | null) => {
      localStorage.setItem(LS_ROLE, role);
      localStorage.setItem(LS_DISPLAY, name);
      try {
        sessionStorage.setItem(SS_VISITOR_TOKEN, vTok);
        if (av) sessionStorage.setItem(SS_AVATAR_URL, av);
        else sessionStorage.removeItem(SS_AVATAR_URL);
      } catch {
        /* private mode */
      }
      setAgsRole(role);
      setDisplayName(name);
      setVisitorToken(vTok);
      setAvatarUrl(av ?? null);
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
          const dn = typeof d.display_name === "string" ? d.display_name : "";
          setAgsRole(role);
          setDisplayName(dn || null);
          localStorage.setItem(LS_ROLE, role);
          if (dn) localStorage.setItem(LS_DISPLAY, dn);
          try {
            const vt = sessionStorage.getItem(SS_VISITOR_TOKEN);
            const au = sessionStorage.getItem(SS_AVATAR_URL);
            if (vt) setVisitorToken(vt);
            setAvatarUrl(au || null);
          } catch {
            /* ignore */
          }
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
    setBusy(true);
    try {
      const td = await postTrangDenLogin(tok);
      if (!td.ok) {
        setLoginErr(td.error);
        return;
      }
      const role: AgsRole = td.is_admin ? "admin" : "member";
      const ok = await postAppLogin(role, td.display_name);
      if (!ok) {
        setLoginErr("Không tạo được phiên chat.");
        return;
      }
      finishLogin(role, td.display_name, tok, td.avatar_url ?? null);
      setRoleTokenInput("");
    } catch (e) {
      const msg = e instanceof TypeError ? "Không gọi được Trang Đen (mạng hoặc chặn CORS)." : "Lỗi mạng.";
      setLoginErr(msg);
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
      setDisplayName(null);
      setMemberSent(0);
      setMessages([]);
      setInput("");
      localStorage.removeItem(LS_ROLE);
      localStorage.removeItem(LS_DISPLAY);
      localStorage.removeItem(LS_MEMBER);
      try {
        sessionStorage.removeItem(SS_VISITOR_TOKEN);
        sessionStorage.removeItem(SS_AVATAR_URL);
      } catch {
        /* ignore */
      }
      setVisitorToken(null);
      setAvatarUrl(null);
      setSubmitHomeworkMsg(null);
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

  async function handleSubmitHomeworkForFriend() {
    setSubmitHomeworkMsg(null);
    const root = captureRootRef.current;
    const vt = visitorToken?.trim();
    const owner = getTrangDenOwnerTokenFromLoginUrl();
    if (!root) {
      setSubmitHomeworkMsg("Không tìm thấy vùng chụp.");
      return;
    }
    if (!vt) {
      setSubmitHomeworkMsg("Thiếu visitor_token — đăng nhập lại.");
      return;
    }
    if (!owner) {
      setSubmitHomeworkMsg("Chưa suy ra được owner_token từ NEXT_PUBLIC_TRANGDEN_BAI_TAP_LOGIN_URL.");
      return;
    }
    /** Trang Đen chấm OpenCV trên ảnh đúng 800×1002; avatar trong khung 300×300. */
    const CAPTURE_W = 800;
    const CAPTURE_H = 1002;

    setSubmitHomeworkBusy(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(root, {
        scale: 1,
        width: CAPTURE_W,
        height: CAPTURE_H,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: "#0b0f14",
        scrollX: 0,
        scrollY: 0,
      });
      let out = canvas;
      if (canvas.width !== CAPTURE_W || canvas.height !== CAPTURE_H) {
        const c2 = document.createElement("canvas");
        c2.width = CAPTURE_W;
        c2.height = CAPTURE_H;
        const ctx = c2.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(canvas, 0, 0, CAPTURE_W, CAPTURE_H);
          out = c2;
        }
      }
      const blob = await new Promise<Blob | null>((resolve) => {
        out.toBlob((b) => resolve(b), "image/png");
      });
      if (!blob) {
        setSubmitHomeworkMsg("Không tạo được ảnh PNG.");
        return;
      }
      const fd = new FormData();
      fd.append("screenshot", blob, "screenshot.png");
      fd.append("owner_token", owner);
      fd.append("visitor_token", vt);
      const r = await fetch(getTrangDenCau8SubmitUrl(), { method: "POST", body: fd });
      const data = (await r.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        error?: string;
      };
      if (r.ok && data.success !== false) {
        setSubmitHomeworkMsg(
          typeof data.message === "string" && data.message.trim()
            ? data.message.trim()
            : "Đã gửi bài."
        );
      } else {
        const err =
          typeof data.error === "string" && data.error.trim()
            ? data.error.trim()
            : `Trang Đen trả lỗi (${r.status}).`;
        setSubmitHomeworkMsg(err);
      }
    } catch (e) {
      setSubmitHomeworkMsg(
        e instanceof Error ? e.message : "Lỗi khi chụp hoặc gửi (CORS ảnh đại diện có thể chặn canvas)."
      );
    } finally {
      setSubmitHomeworkBusy(false);
    }
  }

  const guestBlock = agsRole === "guest";
  const memberRemaining = agsRole === "member" ? Math.max(0, 5 - memberSent) : null;
  const memberAtLimit = agsRole === "member" && memberSent >= 5;
  const homeworkLayout = !!(loggedIn && agsRole && agsRole !== "admin");
  const roleLabel = agsRole === "guest" ? "Guest" : agsRole === "member" ? "Member" : "";
  const avatarInitial = (displayName || "?").trim().slice(0, 1).toUpperCase() || "?";

  if (hydrating) {
    return (
      <main>
        <p className="sub">Đang tải…</p>
      </main>
    );
  }

  const chatPanel = (
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
  );

  return (
    <main className={homeworkLayout ? "layout-homework" : undefined}>
      <header className="app-header">
        <div className="app-header-left">
          <h1>Chat AI / AI Agent</h1>
        </div>
        {loggedIn && agsRole ? (
          <div className="app-header-right">
            <span className="user-name">{displayName || agsRole}</span>
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

      {homeworkLayout ? (
        <>
          {!avatarUrl ? (
            <p className="sub homework-avatar-hint">
              Để so khớp avatar với server, cần ảnh đại diện từ Trang Đen (API login trả{" "}
              <code>avatar_url</code>). Nếu chỉ thấy chữ cái, bạn bè hãy đổi ảnh rõ hơn trên hệ thống rồi đăng nhập
              lại.
            </p>
          ) : null}
          <div className="homework-capture-viewport">
            <div ref={captureRootRef} className="homework-capture-root">
              <div className="homework-split">
                <aside className="homework-sidebar" aria-label="Hồ sơ và nộp bài">
                  <div className="homework-avatar-wrap">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt=""
                        width={300}
                        height={300}
                        crossOrigin="anonymous"
                        style={{ objectFit: "cover", objectPosition: "center center" }}
                      />
                    ) : (
                      <div className="homework-avatar-fallback" aria-hidden>
                        {avatarInitial}
                      </div>
                    )}
                  </div>
                  <p className="homework-name">{displayName || "—"}</p>
                  <p className="homework-role">{roleLabel}</p>
                  <button
                    type="button"
                    className="btn-submit-friend"
                    onClick={() => void handleSubmitHomeworkForFriend()}
                    disabled={submitHomeworkBusy || busy}
                  >
                    {submitHomeworkBusy ? "Đang gửi…" : "「Nộp bài hộ bạn」"}
                  </button>
                </aside>
                <div className="homework-main-col">
                  {memberRemaining !== null ? (
                    <p className="sub homework-meta-line">
                      Còn {memberRemaining}/5 tin nhắn
                    </p>
                  ) : null}
                  {guestBlock ? (
                    <p className="err homework-meta-line">Bạn không có quyền gửi tin nhắn</p>
                  ) : null}
                  {chatPanel}
                </div>
              </div>
            </div>
          </div>
          {submitHomeworkMsg ? (
            <p className="sub homework-submit-msg-outside">{submitHomeworkMsg}</p>
          ) : null}
        </>
      ) : (
        <>
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
          {chatPanel}
        </>
      )}
    </main>
  );
}
