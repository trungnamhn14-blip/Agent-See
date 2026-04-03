import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildModelTrialOrder } from "@/lib/gemini-models";
import { COOKIE, parseSession } from "@/lib/session";

const SYSTEM = `Bạn là trợ lý chat đơn giản, thân thiện, trả lời bằng tiếng Việt (trừ khi người dùng hỏi tiếng khác).
Chủ đề: trí tuệ nhân tạo (AI), AI Agent, workflow agent, công cụ, bảo mật API key, RAG, LLM, prompt, v.v.
Nếu câu hỏi ngoài chủ đề, trả lời ngắn gọn hoặc nhắc lại phạm vi bạn hỗ trợ.
Không đưa ra hướng dẫn gây hại, vi phạm pháp luật, hay lộ thông tin nhạy cảm.`;

type Msg = { role: "user" | "model"; text: string };

function shouldTryNextModel(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (/429|Too Many Requests|quota|RESOURCE_EXHAUSTED|limit is 0/i.test(msg)) return true;
  if (/404|not found|NOT_FOUND|invalid model|is not supported/i.test(msg)) return true;
  return false;
}

export async function POST(req: NextRequest) {
  const authSecret = process.env.AUTH_SECRET;
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!authSecret || !apiKey) {
    return NextResponse.json(
      { error: "Thiếu AUTH_SECRET hoặc GOOGLE_API_KEY trên server." },
      { status: 500 }
    );
  }

  const cookie = req.cookies.get(COOKIE)?.value;
  const sess = cookie ? parseSession(cookie, authSecret) : null;
  if (!sess) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  const agsRole = sess.role ?? "admin";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body không hợp lệ." }, { status: 400 });
  }

  if (agsRole === "guest") {
    return NextResponse.json({ error: "Bạn không có quyền gửi tin nhắn" }, { status: 403 });
  }

  if (agsRole === "member") {
    let n = 0;
    if (
      typeof body === "object" &&
      body !== null &&
      "member_sent_before" in body &&
      typeof (body as { member_sent_before: unknown }).member_sent_before === "number" &&
      Number.isFinite((body as { member_sent_before: number }).member_sent_before)
    ) {
      n = Math.max(0, Math.floor((body as { member_sent_before: number }).member_sent_before));
    }
    if (n >= 5) {
      return NextResponse.json(
        { error: "Member chỉ được gửi tối đa 5 tin nhắn mỗi phiên." },
        { status: 429 }
      );
    }
  }

  const messages =
    typeof body === "object" &&
    body !== null &&
    "messages" in body &&
    Array.isArray((body as { messages: unknown }).messages)
      ? (body as { messages: Msg[] }).messages
      : null;

  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: "Thiếu messages." }, { status: 400 });
  }

  const last = messages[messages.length - 1];
  if (!last || last.role !== "user" || typeof last.text !== "string" || !last.text.trim()) {
    return NextResponse.json({ error: "Tin nhắn không hợp lệ." }, { status: 400 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.text }],
  }));

  let candidates: string[];
  try {
    candidates = await buildModelTrialOrder(apiKey);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Không lấy được danh sách model.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  let lastError: unknown;

  for (let i = 0; i < candidates.length; i++) {
    const modelName = candidates[i];
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM,
      });
      const chat = model.startChat({ history });
      const result = await chat.sendMessage(last.text.trim());
      const text = result.response.text();
      return NextResponse.json({ reply: text });
    } catch (e: unknown) {
      lastError = e;
      const retry = shouldTryNextModel(e) && i < candidates.length - 1;
      if (retry) continue;
      const msg = e instanceof Error ? e.message : "Lỗi model.";
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  const msg =
    lastError instanceof Error ? lastError.message : "Lỗi model (đã thử mọi model dự phòng).";
  return NextResponse.json({ error: msg }, { status: 502 });
}
