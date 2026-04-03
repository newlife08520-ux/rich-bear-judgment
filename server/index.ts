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
  if (
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_PROJECT_ID ||
    process.env.TRUST_PROXY === "1"
  ) {
    app.set("trust proxy", 1);
  }
  // 必須早於 registerRoutes 與 serveStatic，確保 staging/production 一定由 server 回 JSON，不被 SPA 接走
  app.get(["/health", "/health/"], (_req, res) => res.status(200).json({ ok: true }));
  app.get("/api/version", (_req, res) => res.status(200).json(getBuildVersion()));
  await registerRoutes(httpServer, app);

  const { startCreativeReviewJobProcessor } = await import(
    "./modules/creative-intelligence/creative-review-job-worker"
  );
  startCreativeReviewJobProcessor();

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

  const host = process.env.HOST || "0.0.0.0";
  const envPortRaw = process.env.PORT?.trim();
  const envPortParsed = envPortRaw ? parseInt(envPortRaw, 10) : NaN;
  const explicitPort =
    envPortRaw !== undefined && envPortRaw !== "" && Number.isFinite(envPortParsed) && envPortParsed > 0
      ? envPortParsed
      : null;
  const portsToTry = explicitPort !== null
    ? [explicitPort]
    : [5000, 5001, 5002, 5010, 3000, 3001, 8080];

  const buildVersion = getBuildVersion();
  console.log(`[build-version] commit=${buildVersion.commit} branch=${buildVersion.branch} timestamp=${buildVersion.timestamp}`);

  let portIndex = 0;
  function tryListen(): void {
    if (portIndex >= portsToTry.length) {
      console.error(`\n[錯誤] 無法綁定埠：${portsToTry.join(", ")} 皆被佔用。`);
      console.error("請關閉佔用埠的 Node／其他程式，或指定：$env:PORT=3456; npm run dev\n");
      process.exit(1);
    }
    const port = portsToTry[portIndex]!;
    portIndex += 1;

    httpServer.removeAllListeners("error");
    httpServer.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        if (explicitPort !== null) {
          console.error(`\n[錯誤] PORT=${port} 已被佔用。請換埠或關閉佔用該埠的程式。\n`);
          process.exit(1);
        }
        console.log(`[提示] 埠 ${port} 已被佔用，改試下一個…`);
        tryListen();
      } else {
        console.error(err);
        process.exit(1);
      }
    });

    httpServer.listen(port, host, () => {
      httpServer.removeAllListeners("error");
      if (port !== 5000 && portsToTry.length > 1) {
        console.log(`[提示] 5000 被佔用，已改用埠 ${port}。請開啟 http://localhost:${port}`);
      }
      log(`serving on http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
    });
  }
  tryListen();
})();