#!/usr/bin/env node
/**
 * Stage 0：產出 REPO-FILE-INVENTORY.csv、API/Prisma JSON（供審查者機讀）。
 * 執行：node script/generate-stage0-audit.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const SKIP_DIR = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".git",
  ".data",
  "uploads",
  "attached_assets",
]);
const SCAN_TOP = ["client", "server", "shared", "script", "docs", "prisma", ".agents"];

function walkFiles(dirAbs, relBase, acc) {
  if (!fs.existsSync(dirAbs)) return;
  for (const ent of fs.readdirSync(dirAbs, { withFileTypes: true })) {
    const name = ent.name;
    if (SKIP_DIR.has(name)) continue;
    const abs = path.join(dirAbs, name);
    const rel = relBase ? `${relBase}/${name}` : name;
    if (ent.isDirectory()) {
      walkFiles(abs, rel, acc);
    } else if (ent.isFile()) {
      let lines = 0;
      try {
        const st = fs.statSync(abs);
        const ext = path.extname(name).toLowerCase();
        if ([".ts", ".tsx", ".js", ".mjs", ".css", ".md", ".json", ".prisma", ".sql"].includes(ext)) {
          const raw = fs.readFileSync(abs, "utf-8");
          lines = raw.split(/\r?\n/).length;
        }
        acc.push({
          path: rel.replace(/\\/g, "/"),
          size_bytes: st.size,
          line_count: lines,
          top_level_group: rel.split("/")[0] || "root",
          category: categorize(rel),
        });
      } catch {
        /* skip */
      }
    }
  }
}

function categorize(rel) {
  const r = rel.replace(/\\/g, "/");
  if (r.startsWith("script/verify") || r.includes("/verify-")) return "verify";
  if (r.startsWith("docs/")) return "docs";
  if (r.startsWith("prisma/migrations")) return "migration";
  if (r.startsWith("prisma/")) return "config";
  if (/^tsconfig|vite\.config|tailwind|postcss|drizzle\.config|prisma\.config|components\.json$/i.test(path.basename(r)))
    return "config";
  if (r.startsWith("client/") || r.startsWith("server/") || r.startsWith("shared/")) return "runtime";
  if (r.startsWith("script/")) return "verify";
  return "other";
}

function parsePrismaModels(schemaPath) {
  const text = fs.readFileSync(schemaPath, "utf-8");
  const models = [];
  const re = /^model\s+(\w+)\s*\{/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    models.push({
      name: m[1],
      purpose: "see schema.prisma",
      mainWritersReaders: "server/* prisma callers (grep model name)",
      migrationIntroduced: "see prisma/migrations (search model table name)",
    });
  }
  return models;
}

function extractApiRoutes(routesPath) {
  const text = fs.readFileSync(routesPath, "utf-8");
  const entries = [];
  const re = /app\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const auth = /requireAuth/.test(text.slice(Math.max(0, m.index - 120), m.index + 200));
    entries.push({
      method: m[1].toUpperCase(),
      path: m[2],
      sourceFile: "server/routes.ts",
      authRequired: auth,
      featureArea: guessArea(m[2]),
    });
  }
  return entries;
}

function guessArea(p) {
  if (p.includes("/dashboard")) return "dashboard";
  if (p.includes("/creative") || p.includes("/asset")) return "creative-assets";
  if (p.includes("/execution") || p.includes("/publish")) return "execution-publish";
  if (p.includes("/workbench") || p.includes("/pareto")) return "workbench-pareto";
  if (p.includes("/fb-ads")) return "fb-ads";
  if (p.includes("/ga4")) return "ga4";
  if (p.includes("/judgment")) return "judgment";
  if (p.includes("/settings") || p.includes("/refresh")) return "settings-data";
  return "other";
}

function main() {
  const acc = [];
  for (const top of SCAN_TOP) {
    walkFiles(path.join(root, top), top, acc);
  }
  for (const f of ["package.json", "AGENTS.md", "components.json"]) {
    const p = path.join(root, f);
    if (fs.existsSync(p)) {
      const st = fs.statSync(p);
      acc.push({
        path: f,
        size_bytes: st.size,
        line_count: fs.readFileSync(p, "utf-8").split(/\n/).length,
        top_level_group: "root",
        category: "config",
      });
    }
  }

  acc.sort((a, b) => b.line_count - a.line_count);
  const activeDocs = path.join(root, "docs", "active");
  if (!fs.existsSync(activeDocs)) fs.mkdirSync(activeDocs, { recursive: true });
  const csvPath = path.join(activeDocs, "REPO-FILE-INVENTORY.csv");
  const header = "path,size_bytes,line_count,top_level_group,category\n";
  const body = acc
    .map((r) =>
      [r.path, r.size_bytes, r.line_count, r.top_level_group, r.category]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");
  fs.writeFileSync(csvPath, header + body + "\n", "utf-8");

  const byTop = {};
  for (const r of acc) {
    byTop[r.top_level_group] = (byTop[r.top_level_group] || 0) + 1;
  }
  const largestLines = acc.filter((r) => r.line_count > 0).slice(0, 40);
  const largestSize = [...acc].sort((a, b) => b.size_bytes - a.size_bytes).slice(0, 20);

  const prismaPath = path.join(root, "prisma", "schema.prisma");
  const models = parsePrismaModels(prismaPath);
  fs.writeFileSync(
    path.join(activeDocs, "PRISMA-MODEL-INVENTORY.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), models }, null, 2) + "\n"
  );

  const routesPath = path.join(root, "server", "routes.ts");
  const apiEntries = extractApiRoutes(routesPath);
  fs.writeFileSync(
    path.join(activeDocs, "API-ENDPOINT-INVENTORY.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), routes: apiEntries }, null, 2) + "\n"
  );

  const snap = {
    generatedAt: new Date().toISOString(),
    fileCountScanned: acc.length,
    filesByTopLevel: byTop,
    largest40ByLines: largestLines.map((r) => ({ path: r.path, lines: r.line_count })),
    largest20ByBytes: largestSize.map((r) => ({ path: r.path, bytes: r.size_bytes })),
  };
  fs.writeFileSync(path.join(activeDocs, "STAGE0-GENERATED-SNAPSHOT.json"), JSON.stringify(snap, null, 2) + "\n");

  console.log("[generate-stage0-audit] Wrote docs/active/REPO-FILE-INVENTORY.csv rows:", acc.length);
  console.log("[generate-stage0-audit] Wrote docs/active/API-ENDPOINT-INVENTORY.json routes:", apiEntries.length);
  console.log("[generate-stage0-audit] Wrote docs/active/PRISMA-MODEL-INVENTORY.json models:", models.length);
}

main();
