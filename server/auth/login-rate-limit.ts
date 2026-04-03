/** 登入 API 簡易速率限制（記憶體，單機） */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;
const map = new Map<string, { count: number; resetAt: number }>();

function key(ip: string, username: string): string {
  return `${ip}\0${username.toLowerCase()}`;
}

export function checkLoginRateLimit(ip: string, username: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const k = key(ip, username);
  const now = Date.now();
  let e = map.get(k);
  if (!e || now >= e.resetAt) {
    e = { count: 0, resetAt: now + WINDOW_MS };
    map.set(k, e);
  }
  if (e.count >= MAX_ATTEMPTS) {
    return { ok: false, retryAfterSec: Math.ceil((e.resetAt - now) / 1000) };
  }
  e.count += 1;
  return { ok: true };
}

export function resetLoginRateLimit(ip: string, username: string): void {
  map.delete(key(ip, username));
}
