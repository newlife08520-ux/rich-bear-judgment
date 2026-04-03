#!/usr/bin/env node
/**
 * UI 閉環證據腳本：登入 → 上傳影片 → 建立版本 → GET versions，輸出關鍵資料供證據回報。
 * 前置：npm run dev 已啟動、ffprobe 可用；影片：scripts/sample-video.mp4。
 * 用法：node scripts/run-ui-closure-evidence.mjs [BASE_URL]
 */
import fs from "fs";
import path from "path";

const BASE = process.env.BASE_URL || process.argv[2] || "http://127.0.0.1:5000";

async function main() {
  const evidence = { baseUrl: BASE, login: null, packages: null, upload: null, createVersion: null, versions: null, error: null };
  let cookie = "";

  try {
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin123" }),
      redirect: "manual",
    });
    const loginBody = await loginRes.json().catch(() => ({}));
    evidence.login = { status: loginRes.status, ok: loginRes.ok, body: loginBody };
    const setCookie = loginRes.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    if (!cookie || !loginRes.ok) {
      evidence.error = "登入失敗或無 cookie";
      console.log(JSON.stringify(evidence, null, 2));
      process.exit(1);
    }

    let packages = [];
    const pkgListRes = await fetch(`${BASE}/api/asset-packages`, { headers: { cookie } });
    packages = await pkgListRes.json();
    evidence.packages = { status: pkgListRes.status, count: Array.isArray(packages) ? packages.length : 0 };
    let packageId = Array.isArray(packages) && packages.length > 0 ? packages[0].id : null;
    if (!packageId) {
      const createPkgRes = await fetch(`${BASE}/api/asset-packages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ name: "閉環驗證用素材包" }),
      });
      const newPkg = await createPkgRes.json();
      packageId = newPkg && newPkg.id ? newPkg.id : null;
      evidence.packages.created = !!packageId;
    }
    if (!packageId) {
      evidence.error = "無素材包且建立失敗";
      console.log(JSON.stringify(evidence, null, 2));
      process.exit(1);
    }

    const videoPath = path.join(process.cwd(), "scripts", "sample-video.mp4");
    if (!fs.existsSync(videoPath)) {
      evidence.error = "找不到 scripts/sample-video.mp4";
      console.log(JSON.stringify(evidence, null, 2));
      process.exit(1);
    }
    const buffer = fs.readFileSync(videoPath);
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: "video/mp4" }), "sample-video.mp4");

    const uploadRes = await fetch(`${BASE}/api/asset-packages/${packageId}/versions/upload`, {
      method: "POST",
      headers: { cookie },
      body: form,
    });
    const uploadData = await uploadRes.json().catch(() => ({}));
    evidence.upload = {
      status: uploadRes.status,
      ok: uploadRes.ok,
      fileUrl: uploadData.fileUrl,
      fileName: uploadData.fileName,
      fileType: uploadData.fileType,
      detection: uploadData.detection,
      _rawKeys: Object.keys(uploadData),
    };
    if (!uploadRes.ok) {
      evidence.error = "上傳失敗";
      console.log(JSON.stringify(evidence, null, 2));
      process.exit(1);
    }
    if (!uploadData.detection) {
      evidence.error = "上傳成功但無 detection（API 未回傳）";
      console.log(JSON.stringify(evidence, null, 2));
      process.exit(1);
    }

    const d = uploadData.detection;
    const createBody = {
      assetType: "video",
      aspectRatio: d.detectedAspectRatio || "16:9",
      fileName: uploadData.fileName || "sample-video.mp4",
      fileUrl: uploadData.fileUrl,
      fileType: uploadData.fileType || "video/mp4",
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
    evidence.createVersion = {
      status: createRes.status,
      ok: createRes.ok,
      versionId: created.id,
      detectStatus: created.detectStatus,
      detectSource: created.detectSource,
      aspectRatio: created.aspectRatio,
      detectedWidth: created.detectedWidth,
      detectedHeight: created.detectedHeight,
      detectedDurationSeconds: created.detectedDurationSeconds,
    };
    if (!createRes.ok) {
      evidence.error = "建立版本失敗: " + (created.message || createRes.status);
      console.log(JSON.stringify(evidence, null, 2));
      process.exit(1);
    }

    const listRes = await fetch(`${BASE}/api/asset-packages/${packageId}/versions`, { headers: { cookie } });
    const versions = await listRes.json();
    const found = Array.isArray(versions) ? versions.find((v) => v.id === created.id) : null;
    evidence.versions = {
      status: listRes.status,
      count: Array.isArray(versions) ? versions.length : 0,
      targetVersion: found
        ? {
            id: found.id,
            detectStatus: found.detectStatus,
            detectSource: found.detectSource,
            aspectRatio: found.aspectRatio,
            detectedWidth: found.detectedWidth,
            detectedHeight: found.detectedHeight,
            detectedDurationSeconds: found.detectedDurationSeconds,
          }
        : null,
    };

    console.log(JSON.stringify(evidence, null, 2));
    process.exit(0);
  } catch (e) {
    evidence.error = (e && e.message) || String(e);
    console.log(JSON.stringify(evidence, null, 2));
    process.exit(1);
  }
}
main();
