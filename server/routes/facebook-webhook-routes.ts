import type { Express, Request, Response } from "express";

/**
 * Facebook／Meta Webhook（訂閱驗證與事件紀錄）。自 routes.ts 抽出以降低巨型檔案面積。
 */
export function registerFacebookWebhookRoutes(app: Express): void {
  const FB_WEBHOOK_VERIFY_TOKEN = process.env.FB_WEBHOOK_VERIFY_TOKEN || "rich-bear-verify-token";

  app.get("/api/webhook/facebook", (req: Request, res: Response) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === FB_WEBHOOK_VERIFY_TOKEN) {
      res.status(200).send(challenge);
      return;
    }
    res.status(403).send("Forbidden");
  });

  app.post("/api/webhook/facebook", (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown> | undefined;
    console.log("????????? [FB RAW WEBHOOK]:", JSON.stringify(body ?? {}, null, 2));

    res.status(200).send("OK");

    if (!body || typeof body !== "object") return;
    if (body.object !== "page") return;

    const entries = Array.isArray(body.entry) ? body.entry : [];
    for (const entry of entries) {
      const entryObj = entry as { id?: string; time?: number; messaging?: unknown[]; changes?: unknown[] };
      const pageId = entryObj.id;
      const messaging = Array.isArray(entryObj.messaging) ? entryObj.messaging : [];
      const changes = Array.isArray(entryObj.changes) ? entryObj.changes : [];

      for (const event of messaging) {
        try {
          console.log("[FB WEBHOOK] messaging event", pageId, JSON.stringify(event));
        } catch (e) {
          console.error("[FB WEBHOOK] messaging handler error", e);
        }
      }
      for (const change of changes) {
        try {
          console.log("[FB WEBHOOK] changes event (feed/comments etc.)", pageId, JSON.stringify(change));
        } catch (e) {
          console.error("[FB WEBHOOK] changes handler error", e);
        }
      }
    }
  });
}
