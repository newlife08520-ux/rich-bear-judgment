import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // SPA fallback：僅對「非 /health、非 /api」的 GET 回傳 index.html（不用 app.get("*")，Express 5 path-to-regexp 不支援裸 *）
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    if (req.path === "/health" || req.path.startsWith("/api/")) return next();
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
