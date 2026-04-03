/** express-session cookie 名稱（與 clearCookie 一致） */
export function getSessionCookieName(): string {
  return process.env.SESSION_COOKIE_NAME?.trim() || "judge.sid";
}
