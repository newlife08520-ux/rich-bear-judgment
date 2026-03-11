/**
 * 重現：登入後 PUT /api/settings，抓實際 HTTP status 與 response body
 * 執行前請先 npm run dev，再開另一終端: node script/repro-put-settings.mjs
 */
const BASE = "http://localhost:5000";

const loginBody = JSON.stringify({ username: "admin", password: "admin123" });
const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: loginBody,
  redirect: "manual",
});
const setCookie = loginRes.headers.get("set-cookie");
console.log("[1] POST /api/auth/login");
console.log("    status:", loginRes.status);
console.log("    set-cookie:", setCookie ? "present" : "absent");

const cookieHeader = setCookie || "";

const settingsBody = JSON.stringify({
  ga4PropertyId: "",
  fbAccessToken: "",
  aiApiKey: "",
  systemPrompt: "",
  coreMasterPrompt: "",
  modeAPrompt: "",
  modeBPrompt: "",
  modeCPrompt: "",
  modeDPrompt: "",
  severity: "moderate",
  outputLength: "standard",
  brandTone: "professional",
  analysisBias: "conversion",
});

const putRes = await fetch(`${BASE}/api/settings`, {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    Cookie: cookieHeader,
  },
  body: settingsBody,
});

const text = await putRes.text();
let body;
try {
  body = JSON.parse(text);
} catch {
  body = text;
}

console.log("\n[2] PUT /api/settings");
console.log("    status:", putRes.status);
console.log("    body:", typeof body === "object" ? JSON.stringify(body, null, 2) : body);

if (!putRes.ok) process.exit(1);

const syncRes = await fetch(`${BASE}/api/accounts/sync`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookieHeader },
  body: "{}",
});
const syncText = await syncRes.text();
let syncBody;
try {
  syncBody = JSON.parse(syncText);
} catch {
  syncBody = syncText;
}
console.log("\n[3] POST /api/accounts/sync");
console.log("    status:", syncRes.status);
console.log("    body:", typeof syncBody === "object" ? JSON.stringify(syncBody, null, 2) : syncBody);

process.exit(putRes.ok && syncRes.ok ? 0 : 1);
