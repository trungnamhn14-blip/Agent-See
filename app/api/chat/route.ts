import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { COOKIE, verifySession } from "@/lib/session";

const SYSTEM = `Bạn là trợ lý chat đơn giản, thân thiện, trả lời bằng tiếng Việt (trừ khi người dùng hỏi tiếng khác).
Chủ đề: trí tuệ nhân tạo (AI), AI Agent, workflow agent, công cụ, bảo mật API key, RAG, LLM, prompt, v.v.
Nếu câu hỏi ngoài chủ đề, trả lời ngắn gọn hoặc nhắc lại phạm vi bạn hỗ trợ.
Không đưa ra hướng dẫn gây hại, vi phạm pháp luật, hay lộ thông tin nhạy cảm.`;

type Msg = { role: "user" | "model"; text: string };

export async function POST(req: Request) {
  const authSecret = process.env.AUTH_SECRET;
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!authSecret || !apiKey) {
    return NextResponse.json(
      { error: "Thiếu AUTH_SECRET hoặc GOOGLE_API_KEY trên server." },
      { status: 500 }
    );
  }

  const cookie = req.cookies.get(COOKIE)?.value;
  if (!cookie || !verifySession(cookie, authSecret)) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body không hợp lệ." }, { status: 400 });
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

  const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM,
  });

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.text }],
  }));

  try {
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(last.text.trim());
    const text = result.response.text();
    return NextResponse.json({ reply: text });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Lỗi model.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
