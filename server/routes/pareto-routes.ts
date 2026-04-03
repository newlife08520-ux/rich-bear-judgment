import type { Express, RequestHandler } from "express";
import { buildParetoWorkbenchPayload, computePareto } from "@shared/pareto-engine";
import { buildParetoEngineV2ForUser } from "../modules/pareto/pareto-unified-builder";
import { buildParetoCommandLayer } from "../modules/pareto/pareto-command-layer";

export function registerParetoRoutes(app: Express, requireAuth: RequestHandler) {
  app.get("/api/pareto/engine-v2", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const scopeKey = typeof req.query.scope === "string" ? req.query.scope : undefined;
    const scopeProductsRaw = typeof req.query.scopeProducts === "string" ? req.query.scopeProducts : "";
    const scopeProducts = scopeProductsRaw
      ? scopeProductsRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    const engineV2 = await buildParetoEngineV2ForUser({ userId, scopeKey, scopeProducts });
    res.json(engineV2);
  });

  app.get("/api/pareto/by-product", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const scopeKey = typeof req.query.scope === "string" ? req.query.scope : undefined;
    const scopeProductsRaw = typeof req.query.scopeProducts === "string" ? req.query.scopeProducts : "";
    const scopeProducts = scopeProductsRaw
      ? scopeProductsRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

    const engineV2 = await buildParetoEngineV2ForUser({ userId, scopeKey, scopeProducts });
    const productScope = engineV2.scopes.find((s) => s.level === "product");
    const items = productScope?.items ?? [];
    const pareto = productScope?.pareto ?? computePareto([]);
    const workbench = productScope?.workbench ?? buildParetoWorkbenchPayload(items, pareto);

    res.json({
      scopeKey: scopeKey ?? null,
      productCount: items.length,
      items,
      pareto,
      workbench,
      engineV2,
    });
  });

  /** 7.6：單一 command layer（Dashboard／商品／FB／CI 共用） */
  app.get("/api/pareto/command-layer", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const scopeKey = typeof req.query.scope === "string" ? req.query.scope : undefined;
    const scopeProductsRaw = typeof req.query.scopeProducts === "string" ? req.query.scopeProducts : "";
    const scopeProducts = scopeProductsRaw
      ? scopeProductsRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    const engineV2 = await buildParetoEngineV2ForUser({ userId, scopeKey, scopeProducts });
    res.json(buildParetoCommandLayer(engineV2));
  });
}
