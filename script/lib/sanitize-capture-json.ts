/**
 * 將 route JSON 去識別化供 docs/RUNTIME-QUERY-CAPTURES 存檔。
 */
const ID_KEYS = new Set([
  "userId",
  "accountId",
  "campaignId",
  "draftId",
  "id",
  "creativeId",
  "assetVersionId",
  "reviewSessionId",
  "dryRunId",
]);

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}_redacted_${seq}`;
}

export function sanitizeCaptureJson<T>(input: T): T {
  seq = 0;
  const seen = new WeakMap<object, unknown>();

  function walk(v: unknown): unknown {
    if (v === null || v === undefined) return v;
    if (typeof v === "string") {
      if (/^act_\d+$/i.test(v)) return "act_redacted";
      if (/^\d{15,}$/.test(v)) return "id_redacted";
      if (v.includes("@") && v.length < 80) return "user@redacted.local";
      return v;
    }
    if (typeof v !== "object") return v;
    if (seen.has(v as object)) return seen.get(v as object);
    if (Array.isArray(v)) {
      const out: unknown[] = [];
      seen.set(v, out);
      for (const x of v) out.push(walk(x));
      return out;
    }
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    seen.set(v, out);
    for (const [k, val] of Object.entries(o)) {
      if (ID_KEYS.has(k) && typeof val === "string" && val.length > 0) {
        out[k] = k === "accountId" ? "act_redacted" : nextId(k.replace(/Id$/i, "").toLowerCase() || "id");
        continue;
      }
      if (k === "accountName" && typeof val === "string") {
        out[k] = "Account Redacted";
        continue;
      }
      if (k === "campaignName" && typeof val === "string") {
        out[k] = "Campaign Redacted";
        continue;
      }
      if (k === "productName" && typeof val === "string" && val !== "未分類") {
        out[k] = "Product Redacted";
        continue;
      }
      out[k] = walk(val);
    }
    return out;
  }

  return walk(input) as T;
}
