import * as cheerio from "cheerio";

const URL_RE = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
const MAX_BODY_LENGTH = 100_000;
const FETCH_TIMEOUT_MS = 15_000;

/**
 * 從文字中找出所有 http(s) 網址。
 */
export function extractUrls(text: string): string[] {
  const matches = text.match(URL_RE) || [];
  const seen = new Set<string>();
  return matches.filter((u) => {
    const n = u.replace(/[.,;:!?)]+$/, "");
    if (seen.has(n)) return false;
    seen.add(n);
    return true;
  });
}

/**
 * 抓取單一網頁的 <body> 純文字，供 AI 判讀。
 */
export async function scrapePageText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RichBearBot/1.0)" },
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (!res.ok) return `[無法讀取: HTTP ${res.status}]`;
    const html = await res.text();
    const $ = cheerio.load(html);
    $("script, style, nav, footer, iframe, noscript").remove();
    const body = $("body").text().replace(/\s+/g, " ").trim();
    return body.length > MAX_BODY_LENGTH ? body.slice(0, MAX_BODY_LENGTH) + "…" : body;
  } catch (e) {
    clearTimeout(timeout);
    const msg = e instanceof Error ? e.message : String(e);
    return `[抓取失敗: ${msg}]`;
  }
}

/**
 * 若輸入含網址，抓取並回傳「網頁內容摘要」字串，可拼進 prompt。
 */
function isUrlFetchFailure(scraped: string): boolean {
  const t = scraped.trim();
  return t.startsWith("[無法讀取:") || t.startsWith("[抓取失敗:");
}

export async function enrichContentWithUrls(content: string): Promise<string> {
  const urls = extractUrls(content);
  if (urls.length === 0) return content;
  const parts: string[] = [content];
  let anyFailed = false;
  for (const url of urls.slice(0, 3)) {
    const text = await scrapePageText(url);
    if (isUrlFetchFailure(text)) anyFailed = true;
    parts.push(`\n\n--- 以下為網址 ${url} 的頁面文字摘要 ---\n${text}\n--- 以上 ---`);
  }
  let out = parts.join("\n");
  if (anyFailed) {
    out +=
      "\n\n[系統提示] 無法讀取此網址內容（可能被阻擋、逾時或不存在）。以下判斷僅基於 URL 和你提供的描述。";
  }
  return out;
}
