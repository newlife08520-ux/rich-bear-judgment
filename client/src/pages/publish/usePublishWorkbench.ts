import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type {
  PublishDraft,
  AssetPackage,
  AssetVersion,
  AssetGroup,
  PublishTemplate,
  AssetAspectRatio,
  AudienceStrategy,
  PlacementStrategy,
} from "@shared/schema";
import {
  audienceStrategyLabels,
  placementStrategies,
  audienceStrategies,
} from "@shared/schema";
import { generateSOPNames } from "@shared/auto-naming";
import { appendUtmToLandingUrl } from "@shared/utm-inject";
import { OBJECTIVE_TO_PREFIX, META_CTA_OPTIONS } from "./publish-constants";
import { publishFetch, type SyncedResponse } from "./publish-api";
import { executionDryRun, executionApply, type ExecGateState } from "@/lib/execution-client";
import { mapMetaOrNetworkErrorToActionability } from "@/lib/meta-error-actionability";
import { useReportMetaApiError } from "@/context/meta-api-error-context";
import {
  draftToForm,
  formToBody,
  getPublishUrlParams,
  getVersionGroupInfo,
} from "./publish-helpers";
import { emptyForm, type FormState, type BatchGroupByAsset } from "./publish-types";

export function usePublishWorkbench() {
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
  const [execGateOpen, setExecGateOpen] = useState(false);
  const [execGate, setExecGate] = useState<ExecGateState | null>(null);
  const [execGateBody, setExecGateBody] = useState<object | null>(null);
  const [execGateEditingId, setExecGateEditingId] = useState<string | null>(null);
  const [execGateBatchPayload, setExecGateBatchPayload] = useState<{
    batchId: string;
    drafts: Record<string, unknown>[];
  } | null>(null);
  /** form：單筆草稿 dry-run；batch：矩陣批次；meta：投放草稿 → Meta foundation（apply 不需 form body） */
  const [execApplyMode, setExecApplyMode] = useState<"form" | "batch" | "meta">("form");
  const [execConfirmError, setExecConfirmError] = useState<string | null>(null);
  const { toast } = useToast();
  const reportMetaApiError = useReportMetaApiError();

  const { data: guardCheck } = useQuery<{
    metaWritesAllowed: boolean;
    message: string | null;
  }>({
    queryKey: ["/api/publish/guard-check"],
    queryFn: async () => {
      const res = await fetch("/api/publish/guard-check", { credentials: "include" });
      if (!res.ok) {
        return { metaWritesAllowed: false, message: "無法取得 Meta 投放權限狀態。" };
      }
      return res.json();
    },
  });

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

  const { data: metaPagesData, isFetched: metaPagesByAccountFetched } = useQuery<{
    pages: { id: string; name: string }[];
    igAccounts: { id: string; username: string; pageId: string }[];
    noFilterByAccount?: boolean;
    message?: string;
  }>({
    queryKey: ["/api/meta/pages-by-account", form.accountId],
    queryFn: async () => {
      if (!form.accountId.trim()) return { pages: [], igAccounts: [] };
      const res = await fetch(`/api/meta/pages-by-account?accountId=${encodeURIComponent(form.accountId)}`, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { pages: [], igAccounts: [], message: (data as { message?: string }).message };
      }
      return res.json();
    },
    enabled: !!form.accountId.trim(),
  });
  const metaPages = metaPagesData?.pages ?? [];
  const metaIgAccounts = metaPagesData?.igAccounts ?? [];
  const metaPagesNoFilter = metaPagesData?.noFilterByAccount ?? false;

  /** 只有一個粉專時自動帶入，不用再選 */
  useEffect(() => {
    if (metaPages.length !== 1 || !form.accountId.trim()) return;
    const onlyPage = metaPages[0];
    if (form.pageId === onlyPage.id) return;
    setForm((prev) => ({ ...prev, pageId: onlyPage.id }));
  }, [metaPages.length, form.accountId, form.pageId, metaPages[0]?.id]);

  /** IG 帳號依所選粉專過濾（僅顯示該粉專綁定的 IG） */
  const igAccountsForSelectedPage = useMemo(() => {
    if (!form.pageId) return metaIgAccounts;
    return metaIgAccounts.filter((ig) => ig.pageId === form.pageId);
  }, [form.pageId, metaIgAccounts]);
  const placementIncludesIg = form.placementStrategy === "reels_stories" || form.placementStrategy === "auto";
  const selectedPageHasNoIg = placementIncludesIg && !!form.pageId && igAccountsForSelectedPage.length === 0 && metaPages.length > 0;

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
    const hasPage = !!(form.pageId ?? "").trim();
    const placementIncIg = form.placementStrategy === "reels_stories" || form.placementStrategy === "auto";
    const hasIgWhenRequired = !placementIncIg || !!(form.igAccountId ?? "").trim();
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
      hasPage,
      hasIgWhenRequired,
      ctaValid: ctaValid && (effectiveCtaForCheck ? true : true),
      hasVersions,
      allHaveTypeAndRatio,
      anyVersionDetectFailed,
      hasFallbackInSelection,
      singleSizeWarning,
      landingPageExists,
      canSubmit: hasAccount && hasPage && hasIgWhenRequired && hasVersions && allHaveTypeAndRatio,
    };
  }, [form.accountId, form.pageId, form.igAccountId, form.placementStrategy, form.selectedVersionIds, form.landingPageUrl, selectedPackage?.landingPageUrl, effectiveCtaForCheck, versions, batchGroups]);

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

  /** 選好素材組後自動帶入 Campaign / Ad Set / Ad 名稱（SOP 公式） */
  useEffect(() => {
    if (form.selectedVersionIds.length === 0 || batchGroups.length === 0) return;
    const selectedGroup = batchGroups.find(
      (g) => g.versionIds.length === form.selectedVersionIds.length && g.versionIds.every((id) => form.selectedVersionIds.includes(id))
    );
    if (!selectedGroup) return;
    const productName = (form.productName ?? "").trim() || selectedPackage?.brandProductName?.trim() || selectedPackage?.name?.trim() || "素材";
    const materialStrategy = (form.materialStrategy ?? "").trim() || "素材";
    const headlineSnippet = (form.headlineSnippet ?? "").trim() || (form.headline ?? "").trim().slice(0, 20) || "文案";
    const objectivePrefix = OBJECTIVE_TO_PREFIX[form.campaignObjective] || form.objectivePrefix || "轉換次數(原始)";
    const audienceCode = audienceStrategyLabels[form.audienceStrategy] || "廣泛";
    const now = new Date();
    const dateMMDD = `${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const validRatios: ReadonlyArray<"9:16" | "4:5" | "1:1" | "16:9"> = ["9:16", "4:5", "1:1", "16:9"];
    const aspectRatiosInGroup = selectedGroup.ratios.filter((r): r is "9:16" | "4:5" | "1:1" | "16:9" => validRatios.includes(r as "9:16" | "4:5" | "1:1" | "16:9"));
    const names = generateSOPNames({
      objectivePrefix,
      productName,
      materialStrategy,
      headlineSnippet,
      dateMMDD,
      audienceCode,
      groupDisplayName: selectedGroup.label,
      aspectRatiosInGroup: aspectRatiosInGroup.length ? aspectRatiosInGroup : ["1:1"],
    });
    setForm((prev) => ({
      ...prev,
      campaignName: names.campaignName,
      adSetName: names.adSetName,
      adName: names.adName,
    }));
  }, [form.selectedVersionIds, form.campaignObjective, form.productName, form.materialStrategy, form.headlineSnippet, form.audienceStrategy, form.headline, batchGroups, selectedPackage?.brandProductName, selectedPackage?.name]);

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
    if (!(form.pageId ?? "").trim()) {
      setSubmitError("請選擇 Facebook 粉專");
      return;
    }
    if (placementIncludesIg && !(form.igAccountId ?? "").trim()) {
      setSubmitError("Placement 含 Instagram 時請選擇 IG 帳號");
      return;
    }
    if (selectedPageHasNoIg) {
      setSubmitError("此粉專未綁定 IG，無法投放 Reels/Stories；請改選「僅動態牆」或先綁定 IG");
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
      const payload =
        editingId
          ? { draftId: editingId, ...(body as Record<string, unknown>) }
          : (body as Record<string, unknown>);
      const dr = await executionDryRun(
        editingId ? "publish_draft_update" : "publish_draft_create",
        payload
      );
      setExecApplyMode("form");
      setExecGate({
        dryRunId: dr.dryRunId,
        summary: dr.plan.summary,
        steps: dr.plan.steps,
      });
      setExecGateBody(body as object);
      setExecGateEditingId(editingId);
      setExecConfirmError(null);
      setExecGateOpen(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "執行預覽失敗");
    } finally {
      setIsSubmitting(false);
    }
  };
  const execConfirmLock = useRef(false);
  const requestMetaPublishPreview = async (draftId: string) => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const dr = await executionDryRun("meta_publish_draft_execute", { draftId });
      setExecApplyMode("meta");
      setExecGate({
        dryRunId: dr.dryRunId,
        summary: dr.plan.summary,
        steps: dr.plan.steps,
      });
      setExecGateBody(null);
      setExecGateEditingId(null);
      setExecGateBatchPayload(null);
      setExecConfirmError(null);
      setExecGateOpen(true);
    } catch (e) {
      const raw = e instanceof Error ? e.message : "執行預覽失敗";
      const ax = mapMetaOrNetworkErrorToActionability({ message: raw });
      reportMetaApiError(ax);
      toast({
        title: ax.title,
        description: `${ax.description}${ax.secondaryNote ? ` · ${ax.secondaryNote}` : ""}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmPublishExecution = async () => {
    if (!execGate || execConfirmLock.current) return;
    const mode = execApplyMode;
    const isBatch = mode === "batch";
    const isMeta = mode === "meta";
    if (isBatch && !execGateBatchPayload) return;
    if (!isBatch && !isMeta && !execGateBody) return;
    execConfirmLock.current = true;
    setExecConfirmError(null);
    setIsSubmitting(true);
    try {
      const result = await executionApply(execGate.dryRunId);
      if (!result.ok) {
        const ax = mapMetaOrNetworkErrorToActionability({ status: 400, message: result.message });
        if (isMeta) reportMetaApiError(ax);
        setExecConfirmError(
          [ax.title, ax.description, ax.secondaryNote].filter(Boolean).join(" ")
        );
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/publish/drafts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publish/logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/execution/logs"] });
      setExecGateOpen(false);
      setExecGate(null);
      setExecGateBody(null);
      setExecGateEditingId(null);
      setExecGateBatchPayload(null);
      setExecApplyMode("form");
      if (mode === "form" || mode === "batch") {
        setFormOpen(false);
      }
      if (result.alreadyApplied) {
        toast({ title: "已套用過", description: result.message });
      } else {
        const desc =
          result.resultSummary ??
          (result.affectedCount != null ? `已處理 ${result.affectedCount} 筆` : result.message);
        toast({ title: "執行完成", description: desc });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "核准或送出失敗";
      if (isMeta) {
        const ax = mapMetaOrNetworkErrorToActionability({ status: 400, message: msg });
        reportMetaApiError(ax);
        setExecConfirmError([ax.title, ax.description, ax.secondaryNote].filter(Boolean).join(" "));
      } else {
        setExecConfirmError(msg);
      }
    } finally {
      execConfirmLock.current = false;
      setIsSubmitting(false);
    }
  };

  const onExecGateOpenChange = (open: boolean) => {
    if (!open && !isSubmitting) {
      setExecGate(null);
      setExecGateBody(null);
      setExecGateEditingId(null);
      setExecGateBatchPayload(null);
      setExecConfirmError(null);
      setExecApplyMode("form");
    }
    setExecGateOpen(open);
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
    if (!(form.pageId ?? "").trim()) {
      setSubmitError("請選擇 Facebook 粉專");
      return;
    }
    if (placementIncludesIg && !(form.igAccountId ?? "").trim()) {
      setSubmitError("Placement 含 Instagram 時請選擇 IG 帳號");
      return;
    }
    if (selectedPageHasNoIg) {
      setSubmitError("此粉專未綁定 IG，無法投放 Reels/Stories；請改選「僅動態牆」或先綁定 IG");
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
    setIsSubmitting(true);
    try {
      const dr = await executionDryRun("publish_draft_batch_create", { batchId, drafts });
      setExecApplyMode("batch");
      setExecGate({
        dryRunId: dr.dryRunId,
        summary: dr.plan.summary,
        steps: dr.plan.steps,
      });
      setExecGateBatchPayload({ batchId, drafts });
      setExecGateBody(null);
      setExecGateEditingId(null);
      setExecConfirmError(null);
      setExecGateOpen(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "執行預覽失敗");
    } finally {
      setBatchCreating(false);
      setIsSubmitting(false);
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

  return {
    formOpen,
    setFormOpen,
    wizardStep,
    setWizardStep,
    accountPopoverOpen,
    setAccountPopoverOpen,
    pagePopoverOpen,
    setPagePopoverOpen,
    igPopoverOpen,
    setIgPopoverOpen,
    advancedOpen,
    setAdvancedOpen,
    editingId,
    form,
    setForm,
    submitError,
    submitErrors,
    isSubmitting,
    packages,
    packagesLoading,
    drafts,
    draftsLoading,
    draftsError,
    accounts,
    metaPages,
    metaIgAccounts,
    metaPagesByAccountFetched,
    metaPagesData,
    metaPagesNoFilter,
    igAccountsForSelectedPage,
    placementIncludesIg,
    selectedPageHasNoIg,
    templates,
    selectedTemplateId,
    setSelectedTemplateId,
    loadTemplate,
    selectedPackage,
    effectivePrimaryCopy,
    effectiveHeadline,
    effectiveCta,
    effectiveNote,
    effectiveLandingPageUrl,
    versions,
    assetGroups,
    batchGroups,
    selectedBatchGroupKeys,
    setSelectedBatchGroupKeys,
    batchCreating,
    preflight,
    openCreate,
    openEdit,
    openCopy,
    openCopyAsVariant,
    onSelectPackage,
    toggleVersion,
    handleSubmit,
    confirmPublishExecution,
    requestMetaPublishPreview,
    execGateOpen,
    onExecGateOpenChange,
    execGate,
    execConfirmError,
    execApplyMode,
    handleBatchCreate,
    formatDate,
    isLoading,
    hasDraftsError,
    toast,
    guardCheck,
  };
}

export type PublishWorkbench = ReturnType<typeof usePublishWorkbench>;
