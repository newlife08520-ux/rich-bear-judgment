/**
 * 以 supertest 打真實 Express route，將回應去敏感後寫入 docs/RUNTIME-QUERY-CAPTURES/。
 * 使用記憶體內 batchStore 注入（不呼叫 saveBatch），避免汙染 .data/latest-batch.json。
 *
 * npm run capture:runtime-query-captures
 */
import express from "express";
import http from "http";
import fs from "fs";
import path from "path";
import request from "supertest";
import { registerRoutes } from "../server/routes";
import { storage } from "../server/storage";
import type { AnalysisBatch, SyncedAccount } from "@shared/schema";
import { sanitizeCaptureJson } from "./lib/sanitize-capture-json";
import { prisma } from "../server/db";

type StoreHack = {
  batchStore: Map<string, AnalysisBatch>;
  syncedAccountsStore: Map<string, SyncedAccount[]>;
};

const CAPTURE_META = {
  source: "supertest-route-response",
  generatedAt: new Date().toISOString(),
  note: "Captured via script/capture-runtime-query-captures.ts; sanitized",
};

function wrap(body: unknown) {
  return sanitizeCaptureJson({ captureMeta: CAPTURE_META, body });
}

function write(name: string, obj: unknown) {
  const dir = path.join(process.cwd(), "docs", "RUNTIME-QUERY-CAPTURES");
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, name);
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf-8");
  console.log("[capture] wrote", p);
}

function findDonorBatch(hack: StoreHack): AnalysisBatch | null {
  const tryIds = ["1", "2", "3", "admin", "manager"];
  for (const id of tryIds) {
    const b = storage.getLatestBatch(id);
    if (b && b.campaignMetrics?.length) return JSON.parse(JSON.stringify(b)) as AnalysisBatch;
  }
  for (const [, b] of hack.batchStore) {
    if (b?.campaignMetrics?.length) return JSON.parse(JSON.stringify(b)) as AnalysisBatch;
  }
  return null;
}

async function main(): Promise<void> {
  process.env.NODE_ENV = "development";
  const prevSecret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = process.env.SESSION_SECRET || "capture-runtime-query-secret-32chars!!";

  const app = express();
  app.use(express.json());
  const server = http.createServer(app);
  await registerRoutes(server, app);

  const username = `capture_rt_${Date.now()}`;
  const password = "CaptureRt!12345";
  const user = await storage.createUser({
    username,
    password,
    role: "user",
    displayName: "Runtime Capture",
  });
  const uid = user.id;

  const hack = storage as unknown as StoreHack;

  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ username, password }).expect(200);

  const donor = findDonorBatch(hack);

  const metaAcct: SyncedAccount = {
    id: "sa_capture",
    userId: uid,
    platform: "meta",
    accountId: "act_capture_placeholder",
    accountName: "Capture Account",
    status: "active",
    lastSyncedAt: new Date().toISOString(),
    isDefault: true,
  };

  if (donor) {
    donor.userId = uid;
    hack.batchStore.set(uid, donor);
    hack.syncedAccountsStore.set(uid, [metaAcct]);

    const hasDataRes = await agent.get("/api/dashboard/cross-account-summary").expect(200);
    write("dashboard-cross-account-summary.has-data.json", wrap(hasDataRes.body));

    const partialBatch = { ...donor, summary: undefined } as AnalysisBatch;
    delete (partialBatch as { summary?: unknown }).summary;
    hack.batchStore.set(uid, partialBatch);
    const partialRes = await agent.get("/api/dashboard/cross-account-summary").expect(200);
    write("dashboard-cross-account-summary.partial-data.json", wrap(partialRes.body));

    hack.batchStore.delete(uid);
    hack.syncedAccountsStore.set(uid, []);
    const noDataRes = await agent.get("/api/dashboard/cross-account-summary").expect(200);
    write("dashboard-cross-account-summary.no-data.json", wrap(noDataRes.body));

    hack.batchStore.set(uid, donor);
    hack.syncedAccountsStore.set(uid, [metaAcct]);

    const acRes = await agent.get("/api/dashboard/action-center").expect(200);
    const acBody = acRes.body as Record<string, unknown>;
    const core = {
      visibilityPolicyVersion: acBody.visibilityPolicyVersion,
      batchValidity: acBody.batchValidity,
      sourceMeta: acBody.sourceMeta,
      todayActions: acBody.todayActions,
      tableRescue: acBody.tableRescue,
      tableScaleUp: acBody.tableScaleUp,
      productLevelMain: acBody.productLevelMain,
      dormantGemCandidates: acBody.dormantGemCandidates,
    };
    const diagnostics = {
      budgetActionNoDelivery: acBody.budgetActionNoDelivery,
      budgetActionUnderSample: acBody.budgetActionUnderSample,
      productLevelNoDelivery: acBody.productLevelNoDelivery,
      productLevelUnmapped: acBody.productLevelUnmapped,
    };
    write("dashboard-action-center.core.json", wrap(core));
    write("dashboard-action-center.diagnostics.json", wrap(diagnostics));

    const zeroSpendSplit = {
      purpose:
        "Core decision paths (todayActions, productLevelMain, scale/rescue) vs diagnostics (no_delivery, under_sample, unmapped); dormant gems in core.dormantGemCandidates only.",
      coreRef: "dashboard-action-center.core.json",
      diagnosticsRef: "dashboard-action-center.diagnostics.json",
      core,
      diagnostics,
    };
    write("zero-spend-core-vs-diagnostics.sample.json", wrap(zeroSpendSplit));

    const dcRes = await agent.get("/api/dashboard/data-confidence").expect(200);
    write("dashboard-data-confidence.with-products.json", wrap(dcRes.body));

    const gpRes = await agent.get("/api/workbench/goal-pacing").expect(200);
    write("workbench-goal-pacing.sample.json", wrap(gpRes.body));

    const cardsRes = await agent.get("/api/workbench/decision-cards").expect(200);
    write("workbench-decision-cards.sample.json", wrap(cardsRes.body));

    const paretoRes = await agent.get("/api/pareto/command-layer").expect(200);
    write("pareto-command-layer.sample.json", wrap(paretoRes.body));

    try {
      const patRes = await agent.get("/api/creative-intelligence/patterns?syncSnapshots=1");
      if (patRes.status === 200) {
        write("creative-intelligence-patterns.sample.json", wrap(patRes.body));
      } else {
        write(
          "creative-intelligence-patterns.sample.json",
          wrap({
            error: "patterns_endpoint_non_200",
            status: patRes.status,
            body: patRes.body,
          })
        );
      }

      const plMain = acBody.productLevelMain as Array<{ productName?: string }> | undefined;
      const pl = acBody.productLevel as Array<{ productName?: string }> | undefined;
      const pn = plMain?.[0]?.productName || pl?.[0]?.productName || "SanitizedProduct";
      const prodRes = await agent.get(`/api/creative-intelligence/product/${encodeURIComponent(pn)}`);
      write(
        "creative-intelligence-product.sample.json",
        wrap(
          prodRes.status === 200
            ? prodRes.body
            : { httpStatus: prodRes.status, note: "product_route_non_200", body: prodRes.body }
        )
      );

      let vid = "00000000-0000-0000-0000-000000000001";
      try {
        const snap = await prisma.creativeOutcomeSnapshot.findFirst({
          where: { userId: uid },
          orderBy: { snapshotDate: "desc" },
          select: { assetVersionId: true },
        });
        if (snap?.assetVersionId) vid = snap.assetVersionId;
      } catch {
        /* ignore */
      }
      const verRes = await agent.get(`/api/creative-intelligence/version/${encodeURIComponent(vid)}`);
      write("creative-intelligence-version.sample.json", wrap(verRes.body));
    } catch (e) {
      write(
        "creative-intelligence-patterns.sample.json",
        wrap({ error: String(e), note: "Prisma or DB may be unavailable in this environment" })
      );
      write(
        "creative-intelligence-product.sample.json",
        wrap({ error: String(e), note: "skipped_after_patterns_failure" })
      );
      write(
        "creative-intelligence-version.sample.json",
        wrap({ error: String(e), note: "skipped_after_patterns_failure" })
      );
    }
  } else {
    console.warn("[capture] No donor batch with campaignMetrics; writing minimal placeholders.");
    hack.syncedAccountsStore.set(uid, []);
    const noDataRes = await agent.get("/api/dashboard/cross-account-summary").expect(200);
    write("dashboard-cross-account-summary.no-data.json", wrap(noDataRes.body));
    write(
      "dashboard-cross-account-summary.has-data.json",
      wrap({ note: "skipped_no_batch", body: null })
    );
    write(
      "dashboard-cross-account-summary.partial-data.json",
      wrap({ note: "skipped_no_batch", body: null })
    );
    write("dashboard-action-center.core.json", wrap({ note: "skipped_no_batch" }));
    write("dashboard-action-center.diagnostics.json", wrap({ note: "skipped_no_batch" }));
    write(
      "zero-spend-core-vs-diagnostics.sample.json",
      wrap({
        purpose:
          "Core vs diagnostics split placeholder (no donor batch in capture run); re-run capture with seeded batch for full shapes.",
        coreRef: "dashboard-action-center.core.json",
        diagnosticsRef: "dashboard-action-center.diagnostics.json",
        core: {},
        diagnostics: {},
        note: "skipped_no_batch",
      })
    );
    write("dashboard-data-confidence.with-products.json", wrap({ note: "skipped_no_batch" }));
    write("workbench-goal-pacing.sample.json", wrap({ goalPacingByProduct: {} }));
    write("workbench-decision-cards.sample.json", wrap({ cards: [] }));
    write("pareto-command-layer.sample.json", wrap({ note: "skipped_no_batch" }));
    write("creative-intelligence-patterns.sample.json", wrap({ note: "skipped_no_batch" }));
    write("creative-intelligence-product.sample.json", wrap({ note: "skipped_no_batch" }));
    write("creative-intelligence-version.sample.json", wrap({ note: "skipped_no_batch" }));
  }

  hack.batchStore.delete(uid);
  hack.syncedAccountsStore.delete(uid);

  if (prevSecret !== undefined) process.env.SESSION_SECRET = prevSecret;
  else delete process.env.SESSION_SECRET;

  console.log("[capture-runtime-query-captures] done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
