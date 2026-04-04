/**
 * Auth：bcrypt、rate limit、登入 session regenerate、logout clearCookie。
 */
import type { Express, Request } from "express";
import { z } from "zod";
import { loginSchema } from "@shared/schema";
import { storage } from "../storage";
import { verifyPasswordAgainstUser, hashPassword } from "../auth/passwords";
import { checkLoginRateLimit, resetLoginRateLimit } from "../auth/login-rate-limit";

function clientIp(req: Request): string {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0]!.trim();
  return req.socket.remoteAddress || req.ip || "unknown";
}

export function registerAuthRoutes(
  app: Express,
  opts: { sessionCookieName: string; isProd: boolean }
): void {
  const { sessionCookieName, isProd } = opts;

  app.post("/api/auth/login", async (req, res) => {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "請輸入帳號與密碼" });
    }
    const { username, password } = result.data;
    const ip = clientIp(req);
    const limit = checkLoginRateLimit(ip, username);
    if (!limit.ok) {
      return res.status(429).json({
        message: "登入嘗試過多，請稍後再試",
        retryAfterSec: limit.retryAfterSec,
      });
    }

    const user = await storage.getUserByUsername(username);
    if (!user || !verifyPasswordAgainstUser(password, user)) {
      return res.status(401).json({ message: "帳號或密碼錯誤" });
    }

    resetLoginRateLimit(ip, username);

    if (user.password && user.password.length > 0) {
      const h = await hashPassword(password);
      await storage.updateUserPasswordHash(user.id, h);
    }

    const fresh = await storage.getUser(user.id);
    const u = fresh ?? user;

    req.session.regenerate((err) => {
      if (err) {
        return res.status(500).json({ message: "登入建立 Session 失敗" });
      }
      req.session.userId = u.id;
      const { password: _p, passwordHash: _h, ...safeUser } = u;
      res.json({ user: safeUser });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "未登入" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "使用者不存在" });
    }
    const { password: _p, passwordHash: _h, ...safeUser } = user;
    res.json(safeUser);
  });

  const patchMeSchema = z.object({
    defaultProductScope: z.union([z.array(z.string().min(1)).max(200), z.null()]).optional(),
  });

  app.patch("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "未登入" });
    }
    const parsed = patchMeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "請求格式錯誤", errors: parsed.error.flatten() });
    }
    if (parsed.data.defaultProductScope === undefined) {
      return res.status(400).json({ message: "無可更新欄位" });
    }
    const updated = await storage.updateUserDefaultProductScope(
      req.session.userId,
      parsed.data.defaultProductScope
    );
    if (!updated) {
      return res.status(404).json({ message: "使用者不存在" });
    }
    const { password: _p, passwordHash: _h, ...safeUser } = updated;
    res.json(safeUser);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie(sessionCookieName, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: isProd,
      });
      res.json({ message: "已登出" });
    });
  });
}
