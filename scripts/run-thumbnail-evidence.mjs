#!/usr/bin/env node
/**
 * 縮圖驗收證據：登入 → 上傳圖片 + 影片 → 各建立一版本 → 輸出 versionId / fileUrl 供回報。
 * 前置：npm run dev、scripts/sample-image.png、scripts/sample-video.mp4。
 * 用法：node scripts/run-thumbnail-evidence.mjs [BASE_URL]
 */
import fs from "fs";
import path from "path";

const BASE = process.env.BASE_URL || process.argv[2] || "http://127.0.0.1:5000";

async function login(cookieRef) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" }),
    redirect: "manual",
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookieRef.current = setCookie.split(";")[0];
  return res.ok && cookieRef.current;
}

async function getOrCreatePackageId(cookie) {
  const listRes = await fetch(`${BASE}/api/asset-packages`, { headers: { cookie } });
  const packages = await listRes.json();
  if (Array.isArray(packages) && packages.length > 0) return packages[0].id;
  const createRes = await fetch(`${BASE}/api/asset-packages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ name: "縮圖驗收用素材包" }),
  });
  const pkg = await createRes.json();
  return pkg && pkg.id ? pkg.id : null;
}

async function uploadAndCreateVersion(cookie, packageId, filePath, assetType, mimeType, fileName) {
  const buffer = fs.readFileSync(filePath);
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimeType }), fileName);
  const uploadRes = await fetch(`${BASE}/api/asset-packages/${packageId}/versions/upload`, {
    method: "POST",
    headers: { cookie },
    body: form,
  });
  const uploadData = await uploadRes.json().catch(() => ({}));
  if (!uploadRes.ok || !uploadData.fileUrl) return { ok: false, error: uploadData.message || "上傳失敗" };

  const d = uploadData.detection || {};
  const createBody = {
    assetType,
    aspectRatio: d.detectedAspectRatio || (assetType === "video" ? "16:9" : "1:1"),
    fileName: uploadData.fileName || fileName,
    fileUrl: uploadData.fileUrl,
    fileType: uploadData.fileType || mimeType,
    storageProvider: uploadData.storageProvider,
    detectedWidth: d.detectedWidth,
    detectedHeight: d.detectedHeight,
    detectedAspectRatio: d.detectedAspectRatio,
    detectedDurationSeconds: d.detectedDurationSeconds,
    detectStatus: d.detectStatus,
    detectSource: d.detectSource,
  };

  const createRes = await fetch(`${BASE}/api/asset-packages/${packageId}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify(createBody),
  });
  const created = await createRes.json().catch(() => ({}));
  if (!createRes.ok) return { ok: false, error: created.message || "建立版本失敗" };
  return {
    ok: true,
    versionId: created.id,
    fileUrl: created.fileUrl,
    fileName: created.fileName,
    assetType: created.assetType,
  };
}

async function main() {
  const out = { baseUrl: BASE, packageId: null, image: null, video: null, error: null };
  const cookieRef = { current: "" };

  try {
    if (!(await login(cookieRef))) {
      out.error = "登入失敗";
      console.log(JSON.stringify(out, null, 2));
      process.exit(1);
    }
    const cookie = cookieRef.current;

    const packageId = await getOrCreatePackageId(cookie);
    if (!packageId) {
      out.error = "無素材包且建立失敗";
      console.log(JSON.stringify(out, null, 2));
      process.exit(1);
    }
    out.packageId = packageId;

    const imagePath = path.join(process.cwd(), "scripts", "sample-image.png");
    const videoPath = path.join(process.cwd(), "scripts", "sample-video.mp4");
    if (!fs.existsSync(imagePath)) {
      out.error = "找不到 scripts/sample-image.png";
      console.log(JSON.stringify(out, null, 2));
      process.exit(1);
    }
    if (!fs.existsSync(videoPath)) {
      out.error = "找不到 scripts/sample-video.mp4";
      console.log(JSON.stringify(out, null, 2));
      process.exit(1);
    }

    const imageResult = await uploadAndCreateVersion(cookie, packageId, imagePath, "image", "image/png", "sample-image.png");
    if (!imageResult.ok) {
      out.error = "圖片版本失敗: " + imageResult.error;
      console.log(JSON.stringify(out, null, 2));
      process.exit(1);
    }
    out.image = { versionId: imageResult.versionId, fileUrl: imageResult.fileUrl, fileName: imageResult.fileName };

    const videoResult = await uploadAndCreateVersion(cookie, packageId, videoPath, "video", "video/mp4", "sample-video.mp4");
    if (!videoResult.ok) {
      out.error = "影片版本失敗: " + videoResult.error;
      console.log(JSON.stringify(out, null, 2));
      process.exit(1);
    }
    out.video = { versionId: videoResult.versionId, fileUrl: videoResult.fileUrl, fileName: videoResult.fileName };

    console.log(JSON.stringify(out, null, 2));
    process.exit(0);
  } catch (e) {
    out.error = (e && e.message) || String(e);
    console.log(JSON.stringify(out, null, 2));
    process.exit(1);
  }
}
main();
