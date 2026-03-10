import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { getBuildVersion } from "./version";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "200mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "200mb" }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // 必須早於 registerRoutes 與 serveStatic，確保 staging/production 一定由 server 回 JSON，不被 SPA 接走
  app.get(["/health", "/health/"], (_req, res) => res.status(200).json({ ok: true }));
  app.get("/api/version", (_req, res) => res.status(200).json(getBuildVersion()));
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  const host = process.env.HOST || "0.0.0.0";

  const buildVersion = getBuildVersion();
  console.log(`[build-version] commit=${buildVersion.commit} branch=${buildVersion.branch} timestamp=${buildVersion.timestamp}`);

  httpServer.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`\n[錯誤] 埠 ${port} 已被佔用，無法啟動。`);
      console.error(`解法一：關閉其他使用埠 ${port} 的程式（例如之前未關的 Node 視窗）。`);
      console.error(`解法二：改用其他埠，例如：`);
      console.error(`  PowerShell: $env:PORT=3000; npm run dev`);
      console.error(`  然後用瀏覽器開啟 http://localhost:3000\n`);
    } else {
      console.error(err);
    }
    process.exit(1);
  });

  httpServer.listen(port, host, () => {
    log(`serving on http://${host === "0.0.0" ? "localhost" : host}:${port}`);
  });
})();