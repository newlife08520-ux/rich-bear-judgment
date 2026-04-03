import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, writeFile } from "fs/promises";
import { execSync } from "child_process";
import path from "path";

async function buildAll() {
  console.log("running prisma generate...");
  execSync("npx prisma generate", { stdio: "inherit" });

  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allPackages = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  // 全部 node 套件 external，避免漏包（尤其 @prisma/client、prisma）導致 resolve 失敗
  const external = allPackages;

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external,
    logLevel: "info",
  });

  let commit = process.env.RAILWAY_GIT_COMMIT_SHA ?? "";
  let branch = process.env.RAILWAY_GIT_BRANCH ?? "";
  try {
    if (!commit) commit = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
    if (!branch) branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
  } catch {
    if (!commit) commit = "unknown";
    if (!branch) branch = "unknown";
  }
  const version = { commit, branch, timestamp: new Date().toISOString() };
  await writeFile(path.join("dist", "version.json"), JSON.stringify(version, null, 0));
  console.log("[build-version] written dist/version.json:", version);
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
