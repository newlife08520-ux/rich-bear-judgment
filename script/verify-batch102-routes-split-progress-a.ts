import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const truth = fs.readFileSync(path.join(root, "server", "routes", "dashboard-truth-routes.ts"), "utf-8");
for (const route of [
  "/api/dashboard/cross-account-summary",
  "/api/dashboard/today-verdict",
  "/api/dashboard/today-priorities",
  "/api/dashboard/high-risk",
  "/api/dashboard/business-overview",
]) {
  if (!truth.includes(route)) {
    console.error("[FAIL] dashboard-truth-routes should register", route);
    process.exit(1);
  }
}
const routes = fs.readFileSync(path.join(root, "server", "routes.ts"), "utf-8");
if (routes.includes("/api/dashboard/today-verdict")) {
  console.error("[FAIL] routes.ts should not duplicate today-verdict (moved to dashboard-truth-routes)");
  process.exit(1);
}
if (routes.includes('app.get("/api/fb-ads/overview"')) {
  console.error("[FAIL] routes.ts should not inline fb-ads/overview (use registerFbAdsApiRoutes)");
  process.exit(1);
}
const fbAds = path.join(root, "server", "routes", "fb-ads-api-routes.ts");
if (!fs.existsSync(fbAds)) {
  console.error("[FAIL] missing server/routes/fb-ads-api-routes.ts");
  process.exit(1);
}
const fbText = fs.readFileSync(fbAds, "utf-8");
for (const p of ["/api/fb-ads/overview", "/api/fb-ads/opportunities", "/api/fb-ads/campaigns-scored"]) {
  if (!fbText.includes(p)) {
    console.error("[FAIL] fb-ads-api-routes should register", p);
    process.exit(1);
  }
}
if (!routes.includes("registerFbAdsApiRoutes")) {
  console.error("[FAIL] routes.ts should call registerFbAdsApiRoutes");
  process.exit(1);
}
const doc = path.join(root, "docs", "active", "ROUTES-SPLIT-PROGRESS-A.md");
if (!fs.existsSync(doc)) {
  console.error("[FAIL] missing ROUTES-SPLIT-PROGRESS-A.md");
  process.exit(1);
}
console.log("[PASS] verify-batch102 routes-split-progress-a");
