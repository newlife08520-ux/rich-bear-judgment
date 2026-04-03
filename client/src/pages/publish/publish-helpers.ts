import type { PublishDraft, AssetVersion } from "@shared/schema";
import { appendUtmToLandingUrl } from "@shared/utm-inject";
import { META_CTA_OPTIONS } from "./publish-constants";
import { emptyForm, type FormState } from "./publish-types";

export function applyNamingTemplate(
  template: string | undefined,
  ctx: { product: string; date: string; ratio: string; seq: number; prefix?: string; variant?: string }
): string {
  const t = (template || "{product}_{variant}_{date}_{seq}").trim();
  return t
    .replace(/\{product\}/g, ctx.product)
    .replace(/\{variant\}/g, ctx.variant ?? ctx.ratio)
    .replace(/\{date\}/g, ctx.date)
    .replace(/\{ratio\}/g, ctx.ratio)
    .replace(/\{seq\}/g, String(ctx.seq))
    .replace(/\{prefix\}/g, ctx.prefix ?? "");
}

export function getVersionGroupInfo(v: AssetVersion): {
  key: string;
  label: string;
  isFallback: boolean;
} {
  const name = (v.parsedAssetName ?? "").trim();
  const code = (v.parsedVariantCode ?? "").trim();
  if (name !== "" && code !== "") {
    return { key: `p:${name}\t${code}`, label: `${name}（${code}）`, isFallback: false };
  }
  if (name !== "") {
    return { key: `p:${name}\t`, label: name, isFallback: false };
  }
  const baseName = v.fileName.replace(/\.[^.]+$/, "").trim();
  if (baseName) {
    const parts = baseName.split(/[_\-.]+/).filter(Boolean);
    const assetName = parts[0] ?? baseName;
    const key = `f:${assetName}`;
    const label = assetName;
    return { key, label, isFallback: true };
  }
  if ((v.versionNote ?? "").trim()) {
    const note = (v.versionNote ?? "").trim().slice(0, 50);
    const label =
      (v.versionNote ?? "").trim().length > 20
        ? (v.versionNote ?? "").trim().slice(0, 20) + "…"
        : (v.versionNote ?? "").trim();
    return { key: `n:${note}`, label, isFallback: true };
  }
  return { key: `r:${v.aspectRatio}`, label: `${v.aspectRatio} 比例組`, isFallback: true };
}

export function draftToForm(d: PublishDraft): FormState {
  return {
    accountId: d.accountId,
    pageId: d.pageId ?? "",
    igAccountId: d.igAccountId ?? "",
    campaignObjective: d.campaignObjective,
    campaignName: d.campaignName,
    adSetName: d.adSetName,
    adName: d.adName,
    budgetDaily: d.budgetDaily != null ? String(d.budgetDaily) : "",
    budgetTotal: d.budgetTotal != null ? String(d.budgetTotal) : "",
    scheduleType: (d.scheduleStart ?? d.scheduleEnd) ? "custom" : "immediate",
    scheduleStart: d.scheduleStart ?? "",
    scheduleEnd: d.scheduleEnd ?? "",
    audienceStrategy: d.audienceStrategy,
    placementStrategy: d.placementStrategy,
    assetPackageId: d.assetPackageId ?? "",
    selectedVersionIds: d.selectedVersionIds ?? [],
    primaryCopy: d.primaryCopy ?? "",
    headline: d.headline ?? "",
    note: d.note ?? "",
    cta: d.cta ?? "",
    landingPageUrl: d.landingPageUrl ?? "",
    status: d.status,
    objectivePrefix: emptyForm.objectivePrefix,
    productName: emptyForm.productName,
    materialStrategy: emptyForm.materialStrategy,
    headlineSnippet: emptyForm.headlineSnippet,
    audienceCodesComma: emptyForm.audienceCodesComma,
  };
}

export function formToBody(f: FormState): object {
  const budgetDaily =
    (f.budgetDaily ?? "").trim() && f.budgetDaily !== "0" ? Number(f.budgetDaily) : undefined;
  const budgetTotal =
    (f.budgetTotal ?? "").trim() && f.budgetTotal !== "0" ? Number(f.budgetTotal) : undefined;
  let ctaValue = (f.cta ?? "").trim() || "來去逛逛";
  if (ctaValue && !META_CTA_OPTIONS.includes(ctaValue)) ctaValue = "來去逛逛";
  const landingRaw = f.landingPageUrl.trim() || undefined;
  const landingPageUrl = landingRaw
    ? appendUtmToLandingUrl(landingRaw, {
        productName: (f.productName ?? "").trim() || "product",
        materialStrategy: (f.materialStrategy ?? "").trim() || "content",
        headlineSnippet:
          (f.headlineSnippet ?? "").trim() ||
          (f.headline ?? "").trim().slice(0, 20) ||
          "copy",
      })
    : undefined;
  return {
    accountId: f.accountId.trim(),
    pageId: f.pageId.trim() || undefined,
    igAccountId: f.igAccountId.trim() || undefined,
    campaignObjective: f.campaignObjective.trim(),
    campaignName: f.campaignName.trim(),
    adSetName: f.adSetName.trim(),
    adName: f.adName.trim(),
    budgetDaily,
    budgetTotal,
    scheduleStart: f.scheduleType === "custom" ? f.scheduleStart.trim() || undefined : undefined,
    scheduleEnd: f.scheduleType === "custom" ? f.scheduleEnd.trim() || undefined : undefined,
    audienceStrategy: f.audienceStrategy,
    placementStrategy: f.placementStrategy,
    assetPackageId: f.assetPackageId.trim() || undefined,
    selectedVersionIds: f.selectedVersionIds.length > 0 ? f.selectedVersionIds : undefined,
    primaryCopy: f.primaryCopy.trim() || undefined,
    headline: f.headline.trim() || undefined,
    note: f.note.trim() || undefined,
    cta: ctaValue,
    landingPageUrl,
    status: f.status,
  };
}

export function getPublishUrlParams(loc: string): {
  productName: string | null;
  creativeId: string | null;
  draftId: string | null;
} {
  const q = loc.includes("?") ? loc.slice(loc.indexOf("?") + 1) : "";
  const params = new URLSearchParams(q);
  return {
    productName: params.get("productName")?.trim() || null,
    creativeId: params.get("creativeId")?.trim() || null,
    draftId: params.get("draftId")?.trim() || null,
  };
}
