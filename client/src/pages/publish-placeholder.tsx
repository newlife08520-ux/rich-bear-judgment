import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Plus, Pencil, Loader2, Send, Copy, Film, ChevronDown, ChevronRight, Check, AlertTriangle } from "lucide-react";
import type { PublishDraft, AssetPackage, AssetVersion, AssetGroup, SyncedAccount, PublishTemplate } from "@shared/schema";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { AssetThumbnailImg, toAbsoluteUploadUrl } from "@/components/AssetThumbnailImg";
import { generateSOPNames } from "@shared/auto-naming";
import { appendUtmToLandingUrl } from "@shared/utm-inject";
import type { AssetAspectRatio } from "@shared/schema";

/** Meta 常用 CTA，預設「來去逛逛」；送出時未填則自動帶入來去逛逛 */
const META_CTA_OPTIONS = [
  "來去逛逛",
  "了解更多",
  "立即購買",
  "註冊",
  "聯絡我們",
  "下載",
  "申請 now",
  "訂閱",
  "領取優惠",
  "立即預約",
];

/** 命名範本替換：{product} {variant} {date} {ratio} {seq} {prefix}；variant 優先用主素材組代號 */
function applyNamingTemplate(
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

/** 單一版本的主素材分組 key / label；isFallback 表示為檔名推測、versionNote 或比例 fallback */
function getVersionGroupInfo(v: AssetVersion): { key: string; label: string; isFallback: boolean } {
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
    /* 同一主素材不同尺寸要在一組，故 key 只用主素材名，不用變體 */
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

type BatchGroupByAsset = {
  groupKey: string;
  label: string;
  versionIds: string[];
  count: number;
  ratios: string[];
  isFallback: boolean;
  versions: AssetVersion[];
};

import {
  audienceStrategies,
  audienceStrategyLabels,
  placementStrategies,
  placementStrategyLabels,
  publishStatuses,
  publishStatusLabels,
  assetTypeLabels,
  assetAspectRatioLabels,
  type AudienceStrategy,
  type PlacementStrategy,
  type PublishStatus,
} from "@shared/schema";

type SyncedResponse = { accounts: SyncedAccount[] };

async function publishFetch(
  method: string,
  url: string,
  body?: object
): Promise<
  | { ok: true; data: PublishDraft }
  | { ok: true; data: PublishDraft[] }
  | { ok: false; status: number; message: string; errors?: unknown }
> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: (data as { message?: string }).message ?? res.statusText,
      errors: (data as { errors?: unknown }).errors,
    };
  }
  return { ok: true, data };
}

type FormState = {
  accountId: string;
  pageId: string;
  igAccountId: string;
  campaignObjective: string;
  campaignName: string;
  adSetName: string;
  adName: string;
  budgetDaily: string;
  budgetTotal: string;
  scheduleStart: string;
  scheduleEnd: string;
  audienceStrategy: AudienceStrategy;
  placementStrategy: PlacementStrategy;
  assetPackageId: string;
  selectedVersionIds: string[];
  primaryCopy: string;
  headline: string;
  note: string;
  cta: string;
  landingPageUrl: string;
  status: PublishStatus;
  /** SOP 動態命名（矩陣建稿用） */
  objectivePrefix: string;
  productName: string;
  materialStrategy: string;
  headlineSnippet: string;
  audienceCodesComma: string;
};

const emptyForm: FormState = {
  accountId: "",
  pageId: "",
  igAccountId: "",
  campaignObjective: "轉換",
  campaignName: "",
  adSetName: "",
  adName: "",
  budgetDaily: "",
  budgetTotal: "",
  scheduleStart: "",
  scheduleEnd: "",
  audienceStrategy: "broad",
  placementStrategy: "auto",
  assetPackageId: "",
  selectedVersionIds: [],
  primaryCopy: "",
  headline: "",
  note: "",
  cta: "來去逛逛",
  landingPageUrl: "",
  status: "draft",
  objectivePrefix: "轉換次數(原始)",
  productName: "",
  materialStrategy: "",
  headlineSnippet: "",
  audienceCodesComma: "",
};

function draftToForm(d: PublishDraft): FormState {
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

function formToBody(f: FormState): object {
  const budgetDaily = f.budgetDaily.trim() ? Number(f.budgetDaily) : undefined;
  const budgetTotal = f.budgetTotal.trim() ? Number(f.budgetTotal) : undefined;
  let ctaValue = (f.cta ?? "").trim() || "來去逛逛";
  if (ctaValue && !META_CTA_OPTIONS.includes(ctaValue)) ctaValue = "來去逛逛";
  const landingRaw = f.landingPageUrl.trim() || undefined;
  const landingPageUrl = landingRaw
    ? appendUtmToLandingUrl(landingRaw, {
        productName: (f.productName ?? "").trim() || "product",
        materialStrategy: (f.materialStrategy ?? "").trim() || "content",
        headlineSnippet: (f.headlineSnippet ?? "").trim() || (f.headline ?? "").trim().slice(0, 20) || "copy",
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
    scheduleStart: f.scheduleStart.trim() || undefined,
    scheduleEnd: f.scheduleEnd.trim() || undefined,
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

const WIZARD_STEPS = [
  { step: 1 as const, label: "基本設定", short: "帳號／目標／Campaign／預算" },
  { step: 2 as const, label: "素材與版本", short: "選素材包、版本、尺寸類型" },
  { step: 3 as const, label: "投放前檢查", short: "CTA、粉專／IG、落地頁、檢查結果" },
];

/** 從 location 解析 ?productName=、?creativeId=、?draftId=（投放深連結，見 creative-identity.md） */
function getPublishUrlParams(loc: string): { productName: string | null; creativeId: string | null; draftId: string | null } {
  const q = loc.includes("?") ? loc.slice(loc.indexOf("?") + 1) : "";
  const params = new URLSearchParams(q);
  return {
    productName: params.get("productName")?.trim() || null,
    creativeId: params.get("creativeId")?.trim() || null,
    draftId: params.get("draftId")?.trim() || null,
  };
}

export default function PublishPlaceholderPage() {
  const [location] = useLocation();
  const { productName: productNameFromUrl, creativeId: creativeIdFromUrl, draftId: draftIdFromUrl } = getPublishUrlParams(location);
  const [formOpen, setFormOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [accountPopoverOpen, setAccountPopoverOpen] = useState(false);
  const [pagePopoverOpen, setPagePopoverOpen] = useState(false);
  const [igPopoverOpen, setIgPopoverOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitErrors, setSubmitErrors] = useState<unknown>(undefined);
  const openedDraftIdFromUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (productNameFromUrl) setForm((prev) => ({ ...prev, productName: productNameFromUrl }));
  }, [productNameFromUrl]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const { data: packages = [], isLoading: packagesLoading } = useQuery<AssetPackage[]>({
    queryKey: ["/api/asset-packages"],
  });
  const { data: drafts = [], isLoading: draftsLoading, isError: draftsError } = useQuery<PublishDraft[]>({
    queryKey: ["/api/publish/drafts"],
  });
  const { data: syncedData } = useQuery<SyncedResponse>({
    queryKey: ["/api/accounts/synced"],
  });
  const accounts = syncedData?.accounts ?? [];

  const { data: metaPagesData } = useQuery<{ pages: { id: string; name: string }[]; igAccounts: { id: string; username: string; pageId: string }[] }>({
    queryKey: ["/api/meta/pages"],
    queryFn: async () => {
      const res = await fetch("/api/meta/pages", { credentials: "include" });
      if (!res.ok) return { pages: [], igAccounts: [] };
      return res.json();
    },
  });
  const metaPages = metaPagesData?.pages ?? [];
  const metaIgAccounts = metaPagesData?.igAccounts ?? [];

  const { data: templates = [] } = useQuery<PublishTemplate[]>({
    queryKey: ["/api/publish/templates"],
    queryFn: async () => {
      const res = await fetch("/api/publish/templates", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const selectedPackage = form.assetPackageId ? packages.find((p) => p.id === form.assetPackageId) ?? null : null;
  const effectivePrimaryCopy = (form.primaryCopy ?? "").trim() || (selectedPackage?.primaryCopy ?? "");
  const effectiveHeadline = (form.headline ?? "").trim() || (selectedPackage?.headline ?? "");
  const effectiveCta = (form.cta ?? "").trim() || (selectedPackage?.cta ?? "");
  const effectiveNote = (form.note ?? "").trim() || (selectedPackage?.note ?? "");
  const effectiveLandingPageUrl = (form.landingPageUrl ?? "").trim() || (selectedPackage?.landingPageUrl ?? "");

  const { data: versions = [] } = useQuery<AssetVersion[]>({
    queryKey: form.assetPackageId ? ["/api/asset-packages", form.assetPackageId, "versions"] : ["/api/asset-packages", "__none__", "versions"],
    queryFn: async () => {
      if (!form.assetPackageId) return [];
      const res = await fetch(`/api/asset-packages/${form.assetPackageId}/versions`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!form.assetPackageId,
  });

  const { data: assetGroups = [] } = useQuery<AssetGroup[]>({
    queryKey: form.assetPackageId ? ["/api/asset-packages", form.assetPackageId, "groups"] : ["/api/asset-packages", "__none__", "groups"],
    queryFn: async () => {
      if (!form.assetPackageId) return [];
      const res = await fetch(`/api/asset-packages/${form.assetPackageId}/groups`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!form.assetPackageId,
  });

  /** 主素材組優先：先以 API 主素材組分組，未歸組的版本再依推測/比例 fallback */
  const batchGroups = useMemo((): BatchGroupByAsset[] => {
    const result: BatchGroupByAsset[] = [];
    const versionById = new Map(versions.map((v) => [v.id, v]));
    const assignedVersionIds = new Set<string>();

    for (const g of assetGroups) {
      const groupVersions = versions.filter((v) => v.groupId === g.id);
      groupVersions.forEach((v) => assignedVersionIds.add(v.id));
      const ratios = Array.from(new Set(groupVersions.map((x: { aspectRatio: string }) => x.aspectRatio)));
      result.push({
        groupKey: g.id,
        label: g.name,
        versionIds: groupVersions.map((v) => v.id),
        count: groupVersions.length,
        ratios,
        isFallback: false,
        versions: groupVersions,
      });
    }

    const unassigned = versions.filter((v) => !assignedVersionIds.has(v.id));
    if (unassigned.length > 0) {
      const byKey = new Map<
        string,
        { label: string; isFallback: boolean; versionIds: string[]; versions: AssetVersion[] }
      >();
      for (const v of unassigned) {
        const { key, label, isFallback } = getVersionGroupInfo(v);
        if (!byKey.has(key)) {
          byKey.set(key, { label, isFallback, versionIds: [], versions: [] });
        }
        const entry = byKey.get(key)!;
        entry.versionIds.push(v.id);
        entry.versions.push(v);
        entry.isFallback = entry.isFallback || isFallback;
      }
      for (const [groupKey, { label, isFallback, versionIds, versions: vs }] of Array.from(byKey.entries())) {
        const ratios = Array.from(new Set(vs.map((x: { aspectRatio: string }) => x.aspectRatio)));
        result.push({
          groupKey,
          label,
          versionIds,
          count: versionIds.length,
          ratios,
          isFallback,
          versions: vs,
        });
      }
    }
    return result;
  }, [versions, assetGroups]);

  const [selectedBatchGroupKeys, setSelectedBatchGroupKeys] = useState<Set<string>>(new Set());
  const [batchCreating, setBatchCreating] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const effectiveCtaForCheck = (form.cta ?? "").trim() || (selectedPackage?.cta ?? "").trim() || "來去逛逛";
  const preflight = useMemo(() => {
    const hasAccount = !!(form.accountId ?? "").trim();
    const ctaValid = !effectiveCtaForCheck || META_CTA_OPTIONS.includes(effectiveCtaForCheck) || effectiveCtaForCheck === "來去逛逛";
    const hasVersions = form.selectedVersionIds.length > 0;
    const selectedVersions = form.selectedVersionIds
      .map((id) => versions.find((v) => v.id === id))
      .filter((v): v is AssetVersion => !!v);
    const allHaveTypeAndRatio = selectedVersions.length === 0 || selectedVersions.every((v) => v.aspectRatio);
    const anyVersionDetectFailed = selectedVersions.some((v) => v.detectStatus === "failed");
    const selectedVersionIdsSet = new Set(form.selectedVersionIds);
    const hasFallbackInSelection = batchGroups.some(
      (g) => g.isFallback && g.versionIds.some((id) => selectedVersionIdsSet.has(id))
    );
    const ratios = Array.from(new Set(selectedVersions.map((v) => v.aspectRatio)));
    const singleSizeWarning = selectedVersions.length >= 1 && ratios.length <= 1;
    const landingPageExists = !!((form.landingPageUrl ?? "").trim() || (selectedPackage?.landingPageUrl ?? "").trim());
    return {
      hasAccount,
      ctaValid: ctaValid && (effectiveCtaForCheck ? true : true),
      hasVersions,
      allHaveTypeAndRatio,
      anyVersionDetectFailed,
      hasFallbackInSelection,
      singleSizeWarning,
      landingPageExists,
      canSubmit: hasAccount && hasVersions && allHaveTypeAndRatio,
    };
  }, [form.accountId, form.selectedVersionIds, form.landingPageUrl, selectedPackage?.landingPageUrl, effectiveCtaForCheck, versions, batchGroups]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setSelectedBatchGroupKeys(new Set());
    setSelectedTemplateId(null);
    setSubmitError(null);
    setSubmitErrors(undefined);
    setWizardStep(1);
    setFormOpen(true);
  };

  const openEdit = (d: PublishDraft) => {
    setEditingId(d.id);
    setForm(draftToForm(d));
    setSubmitError(null);
    setSubmitErrors(undefined);
    setWizardStep(1);
    setFormOpen(true);
  };

  useEffect(() => {
    if (!draftIdFromUrl || !drafts.length || openedDraftIdFromUrlRef.current === draftIdFromUrl) return;
    const draft = drafts.find((d) => d.id === draftIdFromUrl);
    if (draft) {
      openedDraftIdFromUrlRef.current = draftIdFromUrl;
      openEdit(draft);
      setFormOpen(true);
    }
  }, [draftIdFromUrl, drafts]);

  const openCopy = (d: PublishDraft) => {
    setEditingId(null);
    setForm(draftToForm(d));
    setSubmitError(null);
    setSubmitErrors(undefined);
    setWizardStep(1);
    setFormOpen(true);
  };

  const onSelectPackage = (packageId: string) => {
    const pkg = packages.find((p) => p.id === packageId);
    setSelectedBatchGroupKeys(new Set());
    const defaultProductName = pkg ? (pkg.brandProductName?.trim() || pkg.name?.trim() || "") : "";
    setForm((prev) => ({
      ...prev,
      assetPackageId: packageId,
      selectedVersionIds: [],
      productName: defaultProductName || prev.productName,
      primaryCopy: pkg ? pkg.primaryCopy ?? "" : prev.primaryCopy,
      headline: pkg ? pkg.headline ?? "" : prev.headline,
      note: pkg ? pkg.note ?? "" : prev.note,
      cta: pkg ? (() => { const pcta = (pkg.cta ?? "").trim(); return pcta && META_CTA_OPTIONS.includes(pcta) ? pcta : "來去逛逛"; })() : prev.cta,
      landingPageUrl: pkg ? pkg.landingPageUrl ?? "" : prev.landingPageUrl,
    }));
  };

  const toggleVersion = (id: string) => {
    setForm((prev) =>
      prev.selectedVersionIds.includes(id)
        ? { ...prev, selectedVersionIds: prev.selectedVersionIds.filter((x) => x !== id) }
        : { ...prev, selectedVersionIds: [...prev.selectedVersionIds, id] }
    );
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    setSubmitErrors(undefined);
    if (!form.assetPackageId || form.selectedVersionIds.length === 0) {
      setSubmitError("請先選擇素材包並至少勾選一筆素材版本");
      return;
    }
    const body = formToBody(form);
    const b = body as { budgetDaily?: number; budgetTotal?: number; selectedVersionIds?: string[] };
    if (b.budgetDaily == null && b.budgetTotal == null) {
      setSubmitError("請填寫每日預算或總預算");
      return;
    }
    if (!b.selectedVersionIds || b.selectedVersionIds.length === 0) {
      setSubmitError("請至少選擇一筆素材版本");
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingId) {
        const result = await publishFetch("PUT", `/api/publish/drafts/${editingId}`, body as object);
        if (!result.ok) {
          setSubmitError(result.message);
          setSubmitErrors(result.errors);
          return;
        }
        toast({ title: "已更新", description: "投放草稿已更新" });
      } else {
        const result = await publishFetch("POST", "/api/publish/drafts", body as object);
        if (!result.ok) {
          setSubmitError(result.message);
          setSubmitErrors(result.errors);
          return;
        }
        // 建立成功後的提示僅使用 server 回傳的 warnings，不在此處自算（單一尺寸等皆由後端附上）
        const draftData = result.data as PublishDraft & { warnings?: string[] };
        const desc = draftData.warnings?.length
          ? `投放草稿已建立。${draftData.warnings.join("；")}`
          : "投放草稿已建立";
        toast({ title: "已建立", description: desc });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/publish/drafts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publish/logs"] });
      setFormOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTemplate = selectedTemplateId ? (templates.find((t) => t.id === selectedTemplateId) || null) : null;

  const loadTemplate = (t: PublishTemplate) => {
    setSelectedTemplateId(t.id);
    setForm((prev) => ({
      ...prev,
      accountId: t.accountId ?? prev.accountId,
      pageId: t.pageId ?? prev.pageId,
      igAccountId: t.igAccountId ?? prev.igAccountId,
      budgetDaily: t.budgetDaily != null ? String(t.budgetDaily) : prev.budgetDaily,
      budgetTotal: t.budgetTotal != null ? String(t.budgetTotal) : prev.budgetTotal,
      audienceStrategy: (t.audienceStrategy as AudienceStrategy) ?? prev.audienceStrategy,
      placementStrategy: (t.placementStrategy as PlacementStrategy) ?? prev.placementStrategy,
      cta: (t.cta ?? "").trim() || prev.cta,
      landingPageUrl: (t.landingPageUrl ?? "").trim() || prev.landingPageUrl,
    }));
  };

  const handleBatchCreate = async () => {
    const toCreate = batchGroups.filter((g) => selectedBatchGroupKeys.has(g.groupKey));
    if (toCreate.length === 0) {
      setSubmitError("請至少勾選一組素材版（如 A版、B版）");
      return;
    }
    if (!form.assetPackageId || !form.accountId) {
      setSubmitError("請先選擇素材包與廣告帳號");
      return;
    }
    const bodyBase = formToBody(form) as Record<string, unknown>;
    const budgetDaily = bodyBase.budgetDaily as number | undefined;
    const budgetTotal = bodyBase.budgetTotal as number | undefined;
    if (budgetDaily == null && budgetTotal == null) {
      setSubmitError("請填寫每日預算或總預算");
      return;
    }
    const audienceCodes = (form.audienceCodesComma ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (audienceCodes.length === 0) {
      setSubmitError("請填寫受眾代碼（逗號分隔，如 T, BUNA, 廣泛）；有幾組就產生幾組 Ad Set");
      return;
    }
    const productName = (form.productName ?? "").trim() || selectedPackage?.brandProductName?.trim() || selectedPackage?.name?.trim() || "素材";
    const materialStrategy = (form.materialStrategy ?? "").trim() || "素材";
    const headlineSnippet = (form.headlineSnippet ?? "").trim() || (form.headline ?? "").trim().slice(0, 20) || "文案";
    const objectivePrefix = (form.objectivePrefix ?? "").trim() || "轉換次數(原始)";
    const dateMMDD = new Date().toISOString().slice(5, 10).replace("-", "");

    const drafts: Record<string, unknown>[] = [];
    const batchId = crypto.randomUUID();
    for (const audienceCode of audienceCodes) {
      for (const group of toCreate) {
        const aspectRatiosInGroup = group.ratios as AssetAspectRatio[];
        const names = generateSOPNames({
          objectivePrefix,
          productName,
          materialStrategy,
          headlineSnippet,
          dateMMDD,
          audienceCode,
          groupDisplayName: group.label,
          aspectRatiosInGroup,
        });
        const baseUrl = (bodyBase.landingPageUrl as string) || "";
        drafts.push({
          ...bodyBase,
          campaignName: names.campaignName,
          adSetName: names.adSetName,
          adName: names.adName,
          selectedVersionIds: group.versionIds,
          assetPackageId: form.assetPackageId,
          landingPageUrl: baseUrl
            ? appendUtmToLandingUrl(baseUrl, {
                productName,
                materialStrategy,
                headlineSnippet,
              })
            : undefined,
        });
      }
    }
    setBatchCreating(true);
    setSubmitError(null);
    try {
      const result = await publishFetch("POST", "/api/publish/drafts/batch", { batchId, drafts });
      if (!result.ok) {
        setSubmitError((result as { message?: string }).message ?? "批次建立失敗");
        return;
      }
      const raw = result.data;
      const data: { batchId: string; drafts: PublishDraft[] } = Array.isArray(raw)
        ? { batchId, drafts: raw as PublishDraft[] }
        : (raw as unknown) as { batchId: string; drafts: PublishDraft[] };
      queryClient.invalidateQueries({ queryKey: ["/api/publish/drafts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publish/logs"] });
      setFormOpen(false);
      toast({
        title: "批次建立完成",
        description: `已建立 ${data.drafts?.length ?? drafts.length} 筆草稿（batchId: ${data.batchId?.slice(0, 8) ?? batchId.slice(0, 8)}…）`,
      });
    } finally {
      setBatchCreating(false);
    }
  };

  const openCopyAsVariant = (d: PublishDraft) => {
    setEditingId(null);
    const f = draftToForm(d);
    setForm({ ...f, selectedVersionIds: [], campaignName: "", adSetName: "", adName: "" });
    setSubmitError(null);
    setSubmitErrors(undefined);
    setWizardStep(1);
    setFormOpen(true);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("zh-TW", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const isLoading = packagesLoading || draftsLoading;
  const hasDraftsError = draftsError;

  return (
    <div className="flex flex-col min-h-full">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger />
        <h1 className="font-semibold">投放中心</h1>
      </header>
      <div className="min-h-full p-4 page-container-fluid">
        <div className="max-w-5xl mx-auto flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              建立投放草稿
            </Button>
          </div>

          {isLoading && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">載入中...</CardContent>
            </Card>
          )}
          {!isLoading && hasDraftsError && (
            <Card>
              <CardContent className="py-8 text-center text-destructive">載入失敗，請重新整理或重新登入</CardContent>
            </Card>
          )}
          {!isLoading && !hasDraftsError && drafts.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Send className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">尚無投放草稿</p>
                <p className="text-sm text-muted-foreground mt-1">點「建立投放草稿」開始</p>
              </CardContent>
            </Card>
          )}
          {!isLoading && !hasDraftsError && drafts.length > 0 && (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign 名稱</TableHead>
                    <TableHead>廣告帳號</TableHead>
                    <TableHead>受眾</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>更新時間</TableHead>
                    <TableHead className="w-[140px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drafts.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.campaignName}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{d.accountId}</TableCell>
                      <TableCell>{audienceStrategyLabels[d.audienceStrategy]}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{publishStatusLabels[d.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatDate(d.updatedAt)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(d)} title="編輯">
                            <Pencil className="w-4 h-4 mr-1" />
                            編輯
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openCopy(d)} title="複製草稿">
                            <Copy className="w-4 h-4 mr-1" />
                            複製
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openCopyAsVariant(d)} title="複製為變體（只換素材）">
                            變體
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "編輯投放草稿" : "建立投放草稿"}</DialogTitle>
          </DialogHeader>
          {/* 步驟列：明確知道目前第幾步、下一步要做什麼 */}
          <div className="flex items-center gap-2 py-2 border-b text-sm">
            {WIZARD_STEPS.map((s, i) => (
              <div key={s.step} className="flex items-center gap-2">
                <span className={cn("font-medium", wizardStep === s.step ? "text-primary" : "text-muted-foreground")}>
                  {s.step}. {s.label}
                </span>
                {i < WIZARD_STEPS.length - 1 && <span className="text-muted-foreground">→</span>}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{WIZARD_STEPS[wizardStep - 1]?.short}</p>

          <div className="grid gap-6 py-4">
            {submitError && (
              <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                {submitError}
                {submitErrors != null && typeof submitErrors === "object" && "fieldErrors" in (submitErrors as object) && (
                  <pre className="mt-2 text-xs overflow-auto max-h-24">{JSON.stringify((submitErrors as { fieldErrors?: unknown }).fieldErrors, null, 2)}</pre>
                )}
              </div>
            )}

            {/* Step 1: 基本設定 */}
            {wizardStep === 1 && (
            <>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">投放設定</h3>
                  {templates.length > 0 && (
                    <Select value={selectedTemplateId || "_none"} onValueChange={(v) => v === "_none" ? setSelectedTemplateId(null) : loadTemplate(templates.find((t) => t.id === v)!)}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="從範本載入" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">— 不套用範本 —</SelectItem>
                        {templates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label>廣告帳號 *</Label>
                    {accounts.length > 0 ? (
                      <Popover open={accountPopoverOpen} onOpenChange={setAccountPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between font-normal"
                          >
                            {form.accountId
                              ? (() => {
                                  const a = accounts.find((x) => x.accountId === form.accountId);
                                  return a ? `${a.accountName} (${a.accountId})` : form.accountId;
                                })()
                              : "請選擇廣告帳號"}
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="搜尋帳號名稱或 ID..." />
                            <CommandList>
                              <CommandEmpty>找不到符合的帳號</CommandEmpty>
                              <CommandGroup>
                                {accounts.map((a) => (
                                  <CommandItem
                                    key={a.id}
                                    value={`${a.accountName} ${a.accountId}`}
                                    onSelect={() => {
                                      setForm((f) => ({ ...f, accountId: a.accountId }));
                                      setAccountPopoverOpen(false);
                                    }}
                                  >
                                    {a.accountName} ({a.accountId})
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <Input value={form.accountId} onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))} placeholder="請輸入廣告帳號 ID（可先至設定同步帳號）" />
                    )}
                  </div>
                    <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Campaign 目標</Label>
                      <Input value={form.campaignObjective} onChange={(e) => setForm((f) => ({ ...f, campaignObjective: e.target.value }))} placeholder="多數為轉換" />
                      <p className="text-xs text-muted-foreground">預設：轉換</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Campaign 名稱 *</Label>
                      <Input value={form.campaignName} onChange={(e) => setForm((f) => ({ ...f, campaignName: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Ad Set 名稱 *</Label>
                      <Input value={form.adSetName} onChange={(e) => setForm((f) => ({ ...f, adSetName: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Ad 名稱 *</Label>
                      <Input value={form.adName} onChange={(e) => setForm((f) => ({ ...f, adName: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>每日預算</Label>
                      <Input type="number" min={0} step={1} value={form.budgetDaily} onChange={(e) => setForm((f) => ({ ...f, budgetDaily: e.target.value }))} placeholder="與總預算二選一" />
                    </div>
                    <div className="space-y-2">
                      <Label>總預算</Label>
                      <Input type="number" min={0} step={1} value={form.budgetTotal} onChange={(e) => setForm((f) => ({ ...f, budgetTotal: e.target.value }))} placeholder="與每日預算二選一" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>受眾策略</Label>
                      <Select value={form.audienceStrategy} onValueChange={(v) => setForm((f) => ({ ...f, audienceStrategy: v as AudienceStrategy }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {audienceStrategies.map((k) => (
                            <SelectItem key={k} value={k}>{audienceStrategyLabels[k]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Placement 策略</Label>
                      <Select value={form.placementStrategy} onValueChange={(v) => setForm((f) => ({ ...f, placementStrategy: v as PlacementStrategy }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {placementStrategies.map((k) => (
                            <SelectItem key={k} value={k}>{placementStrategyLabels[k]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>排程開始（選填）</Label>
                      <Input value={form.scheduleStart} onChange={(e) => setForm((f) => ({ ...f, scheduleStart: e.target.value }))} placeholder="ISO 或日期字串" />
                    </div>
                    <div className="space-y-2">
                      <Label>排程結束（選填）</Label>
                      <Input value={form.scheduleEnd} onChange={(e) => setForm((f) => ({ ...f, scheduleEnd: e.target.value }))} placeholder="ISO 或日期字串" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SOP 命名（矩陣建稿用） */}
            <Card>
              <CardContent className="pt-4">
                <h3 className="font-medium mb-2">SOP 命名（矩陣建稿用）</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  公式：Campaign/Ad Set = [活動目標](原始)[MMDD]-[產品名]-[素材策略]+[文案簡稱]-[受眾代碼]。受眾代碼逗號分隔，有幾組就產生幾組 Ad Set。
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>活動目標前綴</Label>
                    <Input
                      value={form.objectivePrefix}
                      onChange={(e) => setForm((f) => ({ ...f, objectivePrefix: e.target.value }))}
                      placeholder="例：轉換次數(原始)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>產品名</Label>
                    <Input
                      value={form.productName}
                      onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))}
                      placeholder="例：小淨靈（選素材包會自動帶入）"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>素材策略</Label>
                    <Input
                      value={form.materialStrategy}
                      onChange={(e) => setForm((f) => ({ ...f, materialStrategy: e.target.value }))}
                      placeholder="例：3影K、2圖1影"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>文案簡稱</Label>
                    <Input
                      value={form.headlineSnippet}
                      onChange={(e) => setForm((f) => ({ ...f, headlineSnippet: e.target.value }))}
                      placeholder="例：抓住文、痛點文"
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>受眾代碼（逗號分隔 = 幾組 Ad Set）</Label>
                    <Input
                      value={form.audienceCodesComma}
                      onChange={(e) => setForm((f) => ({ ...f, audienceCodesComma: e.target.value }))}
                      placeholder="例：T, BUNA, 廣泛（3 個代碼 = 3 組廣告組合）"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            </>
            )}

            {/* Step 2: 素材與版本 */}
            {wizardStep === 2 && (
            <>
            <Card>
              <CardContent className="pt-4">
                <h3 className="font-medium mb-4">選素材包</h3>
                {packages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">尚無素材包，請先至「素材中心」建立</p>
                ) : (
                  <Select value={form.assetPackageId || "_none"} onValueChange={(v) => v !== "_none" && onSelectPackage(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="請選擇一個素材包（會自動帶入主文案、標題、CTA、網址）" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— 請選擇 —</SelectItem>
                      {packages.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} · {p.brandProductName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </CardContent>
            </Card>

            {/* 3. 選素材版本 */}
            <Card>
              <CardContent className="pt-4">
                <h3 className="font-medium mb-4">選素材版本（可多選，支援同組不同尺寸）</h3>
                {!form.assetPackageId ? (
                  <p className="text-sm text-muted-foreground">請先選擇素材包</p>
                ) : versions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">此素材包尚無版本，請至素材中心新增</p>
                ) : (
                  <>
                  {/* 快速變體：選擇主素材組一次帶入該組所有版本 */}
                  {batchGroups.length > 0 && (
                    <div className="mb-4 p-3 rounded-lg border bg-muted/30">
                      <p className="text-sm font-medium mb-2">快速填入：選擇主素材組</p>
                      <div className="flex flex-wrap gap-2">
                        {batchGroups.map((g) => {
                          const isSelected =
                            g.versionIds.length > 0 &&
                            g.versionIds.every((id) => form.selectedVersionIds.includes(id)) &&
                            form.selectedVersionIds.length === g.versionIds.length;
                          return (
                            <Button
                              key={g.groupKey}
                              type="button"
                              variant={isSelected ? "default" : "outline"}
                              size="sm"
                              onClick={() =>
                                setForm((f) => ({
                                  ...f,
                                  selectedVersionIds: isSelected ? [] : g.versionIds,
                                }))
                              }
                            >
                              {g.label}
                              <span className="text-muted-foreground ml-1 text-xs">
                                （{g.ratios.map((r) => assetAspectRatioLabels[r as keyof typeof assetAspectRatioLabels] ?? r).join("/")}）
                              </span>
                              {g.isFallback ? (
                                <Badge variant="secondary" className="ml-1 text-xs">未歸組</Badge>
                              ) : (
                                <Badge variant="outline" className="ml-1 text-xs font-normal text-muted-foreground">
                                  {g.versions.every((x) => x.groupSource === "suggested") ? "建議" : "人工"}
                                </Badge>
                              )}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="border rounded-md p-3 max-h-64 overflow-y-auto space-y-3">
                    {versions.map((v) => {
                      const isImage = (v.fileType || "").startsWith("image");
                      const isVideo = v.assetType === "video";
                      const isSelected = form.selectedVersionIds.includes(v.id);
                      return (
                        <div
                          key={v.id}
                          className={cn(
                            "flex items-center gap-3 p-2 rounded-lg border transition-colors cursor-pointer",
                            isSelected ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "hover:bg-muted/50"
                          )}
                          onClick={() => toggleVersion(v.id)}
                        >
                          <Checkbox
                            id={`ver-${v.id}`}
                            checked={isSelected}
                            onCheckedChange={() => toggleVersion(v.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="w-16 h-16 shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center border">
                            {isImage && (v.thumbnailUrl || v.fileUrl) ? (
                              <AssetThumbnailImg
                                versionId={v.id}
                                url={toAbsoluteUploadUrl(v.thumbnailUrl || v.fileUrl)}
                                className="w-full h-full object-cover"
                              />
                            ) : isVideo ? (
                              v.thumbnailUrl ? (
                                <AssetThumbnailImg
                                  versionId={v.id}
                                  url={toAbsoluteUploadUrl(v.thumbnailUrl)}
                                  className="w-full h-full object-cover"
                                />
                              ) : v.fileUrl ? (
                                <video
                                  src={toAbsoluteUploadUrl(v.fileUrl)}
                                  muted
                                  playsInline
                                  preload="metadata"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Film className="w-8 h-8 text-muted-foreground" />
                              )
                            ) : (
                              <span className="text-xs text-muted-foreground">檔案</span>
                            )}
                          </div>
                          <label htmlFor={`ver-${v.id}`} className="text-sm cursor-pointer flex-1 min-w-0">
                            <span className="font-medium block truncate">{v.fileName}</span>
                            <span className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge variant="outline" className="text-xs font-medium">{assetAspectRatioLabels[v.aspectRatio]}</Badge>
                              <span className="text-muted-foreground text-xs">{assetTypeLabels[v.assetType]}</span>
                              {v.detectStatus && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-xs font-normal",
                                    v.detectStatus === "success" && "border-green-500/50 text-green-700",
                                    v.detectStatus === "manual_confirmed" && "text-muted-foreground",
                                    v.detectStatus === "fallback" && "border-amber-400/50 text-amber-600",
                                    v.detectStatus === "failed" && "border-amber-500/50 text-amber-700"
                                  )}
                                  title={v.detectSource === "metadata" ? "從檔案偵測" : v.detectSource === "filename" ? "從檔名推測" : "手動／已確認"}
                                >
                                  {v.detectStatus === "success" ? "真偵測" : v.detectStatus === "manual_confirmed" ? "已確認" : v.detectStatus === "fallback" ? "推測" : "待確認"}
                                </Badge>
                              )}
                              {v.isPrimary && (
                                <Badge className="text-xs bg-primary/20 text-primary border-0">主版本</Badge>
                              )}
                            </span>
                          </label>
                        </div>
                      );
                    })}
                  </div>

                  {/* 批次建組：依主素材分組，一組 = 同一主素材的多尺寸版本 */}
                  {batchGroups.length > 0 && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      <h4 className="text-sm font-medium">批次建組（依主素材分組，一組一筆草稿）</h4>
                      <div className="space-y-2">
                        {batchGroups.map((g) => (
                          <div
                            key={g.groupKey}
                            className={cn(
                              "rounded-lg border p-3 space-y-2",
                              g.isFallback && "border-amber-500/50 bg-amber-500/5"
                            )}
                          >
                            <label className="flex items-start gap-2 cursor-pointer">
                              <Checkbox
                                checked={selectedBatchGroupKeys.has(g.groupKey)}
                                onCheckedChange={(checked) => {
                                  setSelectedBatchGroupKeys((prev) => {
                                    const next = new Set(prev);
                                    if (checked) next.add(g.groupKey);
                                    else next.delete(g.groupKey);
                                    return next;
                                  });
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <span className="font-medium">{g.label}</span>
                                <span className="text-muted-foreground text-sm ml-2">
                                  含 {g.ratios.map((r) => assetAspectRatioLabels[r as keyof typeof assetAspectRatioLabels] ?? r).join(" / ")} · {g.count} 個版本
                                </span>
                                {g.isFallback ? (
                                  <Badge variant="outline" className="ml-2 text-amber-600 border-amber-500/50">未歸組</Badge>
                                ) : (
                                  <Badge variant="outline" className="ml-2 text-muted-foreground">
                                    {g.versions.length > 0 && g.versions.every((x) => x.groupSource === "suggested") ? "系統建議" : "人工指定"}
                                  </Badge>
                                )}
                                {g.isFallback && (
                                  <span className="text-xs text-amber-600 ml-1">fallback 分組，不建議直接批次建組</span>
                                )}
                                <div className="text-xs text-muted-foreground mt-1 truncate" title={g.versions.map((x) => x.fileName).join(", ")}>
                                  {g.versions.map((x) => x.fileName).join(" · ")}
                                </div>
                              </div>
                            </label>
                          </div>
                        ))}
                      </div>
                      {selectedBatchGroupKeys.size > 0 && (() => {
                        const audienceCodesCount = (form.audienceCodesComma ?? "")
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean).length;
                        const matrixCount = audienceCodesCount > 0 ? audienceCodesCount * selectedBatchGroupKeys.size : selectedBatchGroupKeys.size;
                        return (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={handleBatchCreate}
                            disabled={
                              batchCreating ||
                              !form.accountId ||
                              (form.budgetDaily?.trim() ? false : !form.budgetTotal?.trim()) ||
                              audienceCodesCount === 0
                            }
                          >
                            {batchCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {audienceCodesCount > 0
                              ? `一鍵建立 ${matrixCount} 筆草稿（${audienceCodesCount} 受眾 × ${selectedBatchGroupKeys.size} 素材組）`
                              : `一次建立 ${selectedBatchGroupKeys.size} 筆草稿（請先填受眾代碼）`}
                          </Button>
                        );
                      })()}
                    </div>
                  )}
                  </>
                )}
              </CardContent>
            </Card>
            </>
            )}

            {/* Step 3: 投放前檢查、CTA、粉專/IG、落地頁、覆寫文案 */}
            {wizardStep === 3 && (
            <>
            <Card>
              <CardContent className="pt-4">
                <h3 className="font-medium mb-2">粉專／IG、CTA、落地頁</h3>
                <div className="grid grid-cols-2 gap-4 mb-3">
              <div className="space-y-2">
                <Label>粉專（選填）</Label>
                {metaPages.length > 0 ? (
                  <Popover open={pagePopoverOpen} onOpenChange={setPagePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                        {form.pageId ? (metaPages.find((p) => p.id === form.pageId)?.name ?? form.pageId) : "請選擇粉專"}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="搜尋粉專..." />
                        <CommandList>
                          <CommandEmpty>找不到粉專</CommandEmpty>
                          <CommandGroup>
                            <CommandItem value="_clear" onSelect={() => { setForm((f) => ({ ...f, pageId: "" })); setPagePopoverOpen(false); }}>— 不選 —</CommandItem>
                            {metaPages.map((p) => (
                              <CommandItem key={p.id} value={`${p.name} ${p.id}`} onSelect={() => { setForm((f) => ({ ...f, pageId: p.id })); setPagePopoverOpen(false); }}>{p.name} ({p.id})</CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Input value={form.pageId} onChange={(e) => setForm((f) => ({ ...f, pageId: e.target.value }))} placeholder="選填；請至設定綁定 Meta 以取得粉專清單" />
                )}
              </div>
              <div className="space-y-2">
                <Label>IG 帳號（選填）</Label>
                {metaIgAccounts.length > 0 ? (
                  <Popover open={igPopoverOpen} onOpenChange={setIgPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                        {form.igAccountId ? (metaIgAccounts.find((i) => i.id === form.igAccountId)?.username ?? form.igAccountId) : "請選擇 IG"}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="搜尋 IG..." />
                        <CommandList>
                          <CommandEmpty>找不到 IG 帳號</CommandEmpty>
                          <CommandGroup>
                            <CommandItem value="_clear" onSelect={() => { setForm((f) => ({ ...f, igAccountId: "" })); setIgPopoverOpen(false); }}>— 不選 —</CommandItem>
                            {metaIgAccounts.map((ig) => (
                              <CommandItem key={ig.id} value={`${ig.username} ${ig.id}`} onSelect={() => { setForm((f) => ({ ...f, igAccountId: ig.id })); setIgPopoverOpen(false); }}>@{ig.username} ({ig.id})</CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Input value={form.igAccountId} onChange={(e) => setForm((f) => ({ ...f, igAccountId: e.target.value }))} placeholder="選填；請至設定綁定 Meta 以取得 IG 清單" />
                )}
              </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">目前粉專／IG 清單為該 Token 下所有可用項目，尚未依所選廣告帳號精準過濾。</p>
                {form.accountId && (
                  <p className="text-xs text-amber-600 mt-1">提醒：目前尚未依所選廣告帳號精準綁定粉專／IG，請自行確認對應關係。</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <h3 className="font-medium mb-2">投放前檢查</h3>
                <p className="text-xs text-muted-foreground mb-3">建立草稿前請確認以下項目</p>
                <ul className="space-y-1.5 text-sm">
                  <li className={cn("flex items-center gap-2", preflight.hasAccount ? "text-foreground" : "text-destructive")}>
                    {preflight.hasAccount ? <Check className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4" />}
                    已選廣告帳號
                  </li>
                  <li className={cn("flex items-center gap-2", preflight.ctaValid ? "text-foreground" : "text-amber-600")}>
                    {preflight.ctaValid ? <Check className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4" />}
                    CTA 有效（未填時預設「來去逛逛」）
                  </li>
                  <li className={cn("flex items-center gap-2", preflight.hasVersions ? "text-foreground" : "text-destructive")}>
                    {preflight.hasVersions ? <Check className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4" />}
                    已選素材版本
                  </li>
                  <li className={cn("flex items-center gap-2", preflight.allHaveTypeAndRatio ? "text-foreground" : "text-destructive")}>
                    {preflight.allHaveTypeAndRatio ? <Check className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4" />}
                    每個版本皆有類型與比例
                  </li>
                  <li className={cn("flex items-center gap-2", preflight.hasFallbackInSelection ? "text-amber-600" : "text-foreground")}>
                    {preflight.hasFallbackInSelection ? <AlertTriangle className="h-4 w-4" /> : <Check className="h-4 w-4 text-green-600" />}
                    {preflight.hasFallbackInSelection ? "選中含 fallback 分組，不建議直接批次建組" : "無 fallback 分組或未選中"}
                  </li>
                  <li className={cn("flex items-center gap-2", preflight.singleSizeWarning ? "text-amber-600" : "text-foreground")}>
                    {preflight.singleSizeWarning ? <AlertTriangle className="h-4 w-4" /> : <Check className="h-4 w-4 text-green-600" />}
                    {preflight.singleSizeWarning ? "僅單一尺寸，建議補齊多比例（不阻擋）" : "多尺寸或未選版本"}
                  </li>
                  <li className="text-foreground flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600 shrink-0" />
                    粉專／IG 已選或可之後綁定（見下方說明）
                  </li>
                  <li className={cn("flex items-center gap-2", preflight.landingPageExists ? "text-foreground" : "text-amber-600")}>
                    {preflight.landingPageExists ? <Check className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4" />}
                    落地頁網址 {preflight.landingPageExists ? "已填" : "未填"}
                  </li>
                </ul>
                {preflight.anyVersionDetectFailed && (
                  <p className="text-xs text-amber-600 mt-2">部分版本偵測失敗，比例為手動或推測，請確認後再送出</p>
                )}
              </CardContent>
            </Card>

            {/* 4. 覆寫區：必要時才改文案 */}
            <Card>
              <CardContent className="pt-4">
                <h3 className="font-medium mb-2">覆寫文案（選填）</h3>
                <p className="text-xs text-muted-foreground mb-4">預設沿用素材包；只有要改時才填</p>

                {/* 送出時將使用：一眼看出實際會送出的內容 */}
                <div className="rounded-lg border bg-muted/40 p-3 mb-4 space-y-2">
                  <p className="text-sm font-medium text-foreground">送出時將使用：</p>
                  <dl className="text-xs space-y-1">
                    <div><dt className="text-muted-foreground inline">主文案：</dt><dd className="inline break-words">{effectivePrimaryCopy || "—"}</dd></div>
                    <div><dt className="text-muted-foreground inline">標題：</dt><dd className="inline break-words">{effectiveHeadline || "—"}</dd></div>
                    <div><dt className="text-muted-foreground inline">CTA：</dt><dd className="inline break-words">{(effectiveCta || "來去逛逛")}</dd></div>
                    <div><dt className="text-muted-foreground inline">說明：</dt><dd className="inline break-words">{effectiveNote || "—"}</dd></div>
                    <div><dt className="text-muted-foreground inline">網址：</dt><dd className="inline break-words">{effectiveLandingPageUrl || "—"}</dd></div>
                  </dl>
                </div>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label>主文案</Label>
                    <Textarea value={form.primaryCopy} onChange={(e) => setForm((f) => ({ ...f, primaryCopy: e.target.value }))} rows={2} placeholder="未填則沿用素材包" />
                    <p className="text-xs text-muted-foreground">
                      {(form.primaryCopy ?? "").trim() ? "已覆寫" : selectedPackage?.primaryCopy ? `沿用素材包：${selectedPackage.primaryCopy.slice(0, 40)}${(selectedPackage.primaryCopy?.length ?? 0) > 40 ? "…" : ""}` : "未填，送出時無此內容"}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>標題</Label>
                      <Input value={form.headline} onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))} placeholder="未填則沿用素材包" />
                      <p className="text-xs text-muted-foreground">
                        {(form.headline ?? "").trim() ? "已覆寫" : selectedPackage?.headline ? `沿用素材包：${selectedPackage.headline}` : "未填"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>CTA</Label>
                      <Select
                        value={(form.cta ?? "").trim() || "來去逛逛"}
                        onValueChange={(v) => setForm((f) => ({ ...f, cta: v }))}
                      >
                        <SelectTrigger><SelectValue placeholder="來去逛逛" /></SelectTrigger>
                        <SelectContent>
                          {(() => {
                            const current = (form.cta ?? "").trim();
                            const opts = current && !META_CTA_OPTIONS.includes(current) ? [current, ...META_CTA_OPTIONS] : META_CTA_OPTIONS;
                            return opts.map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ));
                          })()}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {(form.cta ?? "").trim() ? "已選擇" : selectedPackage?.cta ? `沿用素材包：${selectedPackage.cta}` : "預設：來去逛逛"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>說明 / 備註</Label>
                    <Textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={2} placeholder="選填，多數情況可留空" />
                    <p className="text-xs text-muted-foreground">
                      {(form.note ?? "").trim() ? "已覆寫" : selectedPackage?.note ? `沿用素材包：${(selectedPackage.note?.length ?? 0) > 40 ? selectedPackage.note.slice(0, 40) + "…" : selectedPackage.note}` : "選填，多數可留空"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>落地頁網址</Label>
                    <Input value={form.landingPageUrl} onChange={(e) => setForm((f) => ({ ...f, landingPageUrl: e.target.value }))} placeholder="多數沿用素材包，未填則用素材包網址" />
                    <p className="text-xs text-muted-foreground">
                      {(form.landingPageUrl ?? "").trim() ? "已覆寫" : selectedPackage?.landingPageUrl ? `沿用素材包：${selectedPackage.landingPageUrl}` : "未填"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-1 -ml-2">
                  <ChevronRight className={cn("h-4 w-4 transition-transform", advancedOpen && "rotate-90")} />
                  進階選項
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-2 pt-2 pl-2 border-l-2 border-muted">
                  <Label className="text-muted-foreground">狀態</Label>
                  <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as PublishStatus }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {publishStatuses.map((k) => (
                        <SelectItem key={k} value={k}>{publishStatusLabels[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">新建草稿預設為「草稿」；僅在需要時改為待發佈等</p>
                  <div className="pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const name = window.prompt("範本名稱", `範本_${new Date().toISOString().slice(0, 10)}`);
                        if (!name?.trim()) return;
                        const res = await fetch("/api/publish/templates", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({
                            name: name.trim(),
                            accountId: form.accountId || undefined,
                            pageId: form.pageId || undefined,
                            igAccountId: form.igAccountId || undefined,
                            budgetDaily: form.budgetDaily?.trim() ? Number(form.budgetDaily) : undefined,
                            budgetTotal: form.budgetTotal?.trim() ? Number(form.budgetTotal) : undefined,
                            audienceStrategy: form.audienceStrategy,
                            placementStrategy: form.placementStrategy,
                            cta: (form.cta ?? "").trim() || undefined,
                            landingPageUrl: (form.landingPageUrl ?? "").trim() || undefined,
                            campaignNameTemplate: "{product}_{date}_{ratio}_{seq}",
                            adSetNameTemplate: "{product}_{date}_{ratio}_{seq}",
                            adNameTemplate: "{product}_{ratio}_{seq}",
                          }),
                        });
                        if (res.ok) {
                          queryClient.invalidateQueries({ queryKey: ["/api/publish/templates"] });
                          toast({ title: "已儲存範本", description: name.trim() });
                        } else {
                          const data = await res.json().catch(() => ({}));
                          toast({ title: "儲存失敗", description: (data as { message?: string }).message, variant: "destructive" });
                        }
                      }}
                    >
                      將目前設定儲存為範本
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
            </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={isSubmitting}>取消</Button>
            {wizardStep > 1 && (
              <Button variant="outline" onClick={() => setWizardStep((s) => (s - 1) as 1 | 2 | 3)} disabled={isSubmitting}>上一步</Button>
            )}
            {wizardStep < 3 ? (
              <Button onClick={() => setWizardStep((s) => (s + 1) as 1 | 2 | 3)}>
                下一步
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isSubmitting || packages.length === 0 || !form.assetPackageId || form.selectedVersionIds.length === 0 || !preflight.canSubmit}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingId ? "儲存" : "建立"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
