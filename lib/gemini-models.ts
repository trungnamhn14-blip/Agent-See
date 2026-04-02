/**
 * Lấy danh sách model thật từ Google (ListModels) — tránh hardcode tên gây 404.
 * Cache ngắn trên global để giảm gọi API (Vercel warm instance).
 */

const CACHE_MS = 45 * 60 * 1000;

type GGlobal = typeof globalThis & {
  __geminiModelListCache?: { key: string; ids: string[]; at: number };
};

type ListModelsResponse = {
  models?: Array<{
    name?: string;
    supportedGenerationMethods?: string[];
  }>;
  nextPageToken?: string;
};

/** Chỉ lấy model gemini* hỗ trợ generateContent. */
export async function fetchGeminiModelIds(apiKey: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  for (;;) {
    const u = new URL("https://generativelanguage.googleapis.com/v1beta/models");
    u.searchParams.set("key", apiKey);
    if (pageToken) u.searchParams.set("pageToken", pageToken);

    const res = await fetch(u.toString());
    const data = (await res.json()) as ListModelsResponse & { error?: { message?: string } };

    if (!res.ok) {
      const msg = data.error?.message || `ListModels HTTP ${res.status}`;
      throw new Error(msg);
    }

    for (const m of data.models ?? []) {
      const methods = m.supportedGenerationMethods ?? [];
      if (!methods.includes("generateContent")) continue;
      const name = m.name ?? "";
      if (!name.startsWith("models/")) continue;
      const id = name.slice("models/".length);
      if (!/^gemini/i.test(id)) continue;
      ids.push(id);
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return ids;
}

/** Ưu tiên Flash / Lite (rẻ, thường còn quota free) trước Pro. */
function preferenceScore(id: string): number {
  const s = id.toLowerCase();
  if (s.includes("embedding")) return 900;
  if (s.includes("imagen") || s.includes("tts") || s.includes("robotics")) return 900;
  if (/flash.*lite|flash-lite|lite.*flash/.test(s)) return 0;
  if (/gemini-2\.\d+.*flash/.test(s) && !/lite/.test(s)) return 2;
  if (/gemini-1\.5.*flash/.test(s)) return 3;
  if (/gemini-2\.5.*flash/.test(s)) return 4;
  if (/flash/.test(s)) return 5;
  if (/pro/.test(s)) return 20;
  return 40;
}

function sortIds(ids: string[]): string[] {
  return [...new Set(ids)].sort(
    (a, b) => preferenceScore(a) - preferenceScore(b) || a.localeCompare(b)
  );
}

function getCachedIds(apiKey: string): string[] | null {
  const g = globalThis as GGlobal;
  const c = g.__geminiModelListCache;
  if (!c || c.key !== apiKey) return null;
  if (Date.now() - c.at > CACHE_MS) return null;
  return c.ids;
}

function setCachedIds(apiKey: string, ids: string[]) {
  const g = globalThis as GGlobal;
  g.__geminiModelListCache = { key: apiKey, ids, at: Date.now() };
}

/**
 * Thứ tự thử model: GEMINI_MODEL (nếu có) trước, sau đó toàn bộ model từ API đã sắp xếp.
 */
export async function buildModelTrialOrder(apiKey: string): Promise<string[]> {
  const envFirst = process.env.GEMINI_MODEL?.trim();

  let listed: string[] = getCachedIds(apiKey) ?? [];
  if (listed.length === 0) {
    try {
      listed = sortIds(await fetchGeminiModelIds(apiKey));
      setCachedIds(apiKey, listed);
    } catch {
      listed = [];
    }
  } else {
    listed = sortIds(listed);
  }

  const seen = new Set<string>();
  const out: string[] = [];
  const push = (m: string) => {
    const t = m.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };

  if (envFirst) push(envFirst);
  for (const id of listed) push(id);

  if (out.length === 0) {
    throw new Error(
      "Không lấy được danh sách model từ Google (ListModels). Kiểm tra GOOGLE_API_KEY và quyền truy cập API."
    );
  }

  return out;
}
