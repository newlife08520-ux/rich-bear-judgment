import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { AssetPackage, AssetVersion, AssetGroup, AssetType, AssetAspectRatio } from "@shared/schema";
import { apiFetch } from "./asset-api";
import {
  emptyPackageForm,
  emptyVersionForm,
  packageToForm,
  versionToForm,
  type PackageFormState,
  type VersionFormState,
  type UploadDetection,
} from "./asset-types-forms";
import {
  parseAspectRatioFromFilename,
  parseSuggestedGroupNameFromFilename,
  getImageAspectRatio,
} from "./assets-media-helpers";
import { submitCreativeReviewForSavedVersion } from "./assets-workbench-creative-review";

export function useAssetsWorkbench() {
  const [justCreatedPackageId, setJustCreatedPackageId] = useState<string | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [packageForm, setPackageForm] = useState<PackageFormState>(emptyPackageForm);
  const [packageSubmitError, setPackageSubmitError] = useState<string | null>(null);
  const [packageSubmitErrors, setPackageSubmitErrors] = useState<unknown>(undefined);
  const [packageSaving, setPackageSaving] = useState(false);
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [versionForm, setVersionForm] = useState<VersionFormState>(emptyVersionForm);
  const [versionSubmitError, setVersionSubmitError] = useState<string | null>(null);
  const [versionSubmitErrors, setVersionSubmitErrors] = useState<unknown>(undefined);
  const [versionSaving, setVersionSaving] = useState(false);
  const [versionUploading, setVersionUploading] = useState(false);
  const [versionUploadError, setVersionUploadError] = useState<string | null>(null);
  const [deletePackageTarget, setDeletePackageTarget] = useState<AssetPackage | null>(null);
  const [deleteVersionTarget, setDeleteVersionTarget] = useState<AssetVersion | null>(null);
  const [packageDeleting, setPackageDeleting] = useState(false);
  const [versionDeleting, setVersionDeleting] = useState(false);
  const [createPackageMode, setCreatePackageMode] = useState(false);
  const [versionDateFilter, setVersionDateFilter] = useState<string>("all");
  const [versionDateCustomStart, setVersionDateCustomStart] = useState("");
  const [versionDateCustomEnd, setVersionDateCustomEnd] = useState("");
  const [versionTypeFilter, setVersionTypeFilter] = useState<string>("all");
  const [versionRatioFilter, setVersionRatioFilter] = useState<string>("all");
  const [versionKeyword, setVersionKeyword] = useState("");
  const [versionSortBy, setVersionSortBy] = useState<"newest" | "name">("newest");
  const [selectedVersionIdsForBatch, setSelectedVersionIdsForBatch] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [groupCreating, setGroupCreating] = useState(false);
  const [versionGroupFilter, setVersionGroupFilter] = useState<string>("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [groupSaving, setGroupSaving] = useState(false);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<AssetGroup | null>(null);
  const [groupDeleting, setGroupDeleting] = useState(false);
  const [pendingDetection, setPendingDetection] = useState<UploadDetection | null>(null);
  /** 6.1-B：儲存版本後是否立即送審（非強制全站自動） */
  const [submitCreativeReviewAfterSave, setSubmitCreativeReviewAfterSave] = useState(false);
  const [suggestedGroupNameForForm, setSuggestedGroupNameForForm] = useState<string | null>(null);
  const versionSectionRef = useRef<HTMLDivElement>(null);
  const versionGridScrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: packages = [], isLoading: packagesLoading, isError: packagesError } = useQuery<AssetPackage[]>({
    queryKey: ["/api/asset-packages"],
  });

  const { data: selectedPackage = null, isLoading: selectedPackageLoading } = useQuery<AssetPackage | null>({
    queryKey: selectedPackageId ? ["/api/asset-packages", selectedPackageId] : ["/api/asset-packages", "__none__"],
    queryFn: async () => {
      if (!selectedPackageId) return null;
      const res = await fetch(`/api/asset-packages/${selectedPackageId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedPackageId,
  });

  const { data: versions = [], isLoading: versionsLoading } = useQuery<AssetVersion[]>({
    queryKey: selectedPackageId
      ? ["/api/asset-packages", selectedPackageId, "versions"]
      : ["/api/asset-packages", "__none__", "versions"],
    queryFn: async () => {
      if (!selectedPackageId) return [];
      const res = await fetch(`/api/asset-packages/${selectedPackageId}/versions`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedPackageId,
  });

  const { data: assetGroups = [] } = useQuery<AssetGroup[]>({
    queryKey: selectedPackageId
      ? ["/api/asset-packages", selectedPackageId, "groups"]
      : ["/api/asset-packages", "__none__", "groups"],
    queryFn: async () => {
      if (!selectedPackageId) return [];
      const res = await fetch(`/api/asset-packages/${selectedPackageId}/groups`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedPackageId,
  });

  const getDateRange = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const last7Start = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Start = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { todayStart, todayEnd, yesterdayStart, last7Start, last30Start };
  }, []);

  const filteredAndSortedVersions = useMemo(() => {
    let list = [...versions];
    const kw = versionKeyword.trim().toLowerCase();
    if (kw) {
      const pkgName = selectedPackage?.name?.toLowerCase() ?? "";
      const productName = selectedPackage?.brandProductName?.toLowerCase() ?? "";
      list = list.filter(
        (v) =>
          v.fileName.toLowerCase().includes(kw) ||
          pkgName.includes(kw) ||
          productName.includes(kw)
      );
    }
    if (versionTypeFilter !== "all") {
      list = list.filter((v) => v.assetType === versionTypeFilter);
    }
    if (versionRatioFilter !== "all") {
      list = list.filter((v) => v.aspectRatio === versionRatioFilter);
    }
    if (versionDateFilter !== "all") {
      const { todayStart, todayEnd, yesterdayStart, last7Start, last30Start } = getDateRange;
      list = list.filter((v) => {
        const t = new Date(v.createdAt).getTime();
        if (versionDateFilter === "today") return t >= todayStart.getTime() && t <= todayEnd.getTime();
        if (versionDateFilter === "yesterday") return t >= yesterdayStart.getTime() && t < todayStart.getTime();
        if (versionDateFilter === "last7") return t >= last7Start.getTime();
        if (versionDateFilter === "last30") return t >= last30Start.getTime();
        if (versionDateFilter === "custom" && versionDateCustomStart && versionDateCustomEnd) {
          const start = new Date(versionDateCustomStart).getTime();
          const end = new Date(versionDateCustomEnd).getTime() + 24 * 60 * 60 * 1000 - 1;
          return t >= start && t <= end;
        }
        return true;
      });
    }
    if (versionGroupFilter === "_none") list = list.filter((v) => !v.groupId);
    else if (versionGroupFilter) list = list.filter((v) => v.groupId === versionGroupFilter);
    if (versionSortBy === "newest") list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    else list.sort((a, b) => (a.fileName || "").localeCompare(b.fileName || ""));
    return list;
  }, [
    versions,
    versionKeyword,
    versionTypeFilter,
    versionRatioFilter,
    versionDateFilter,
    versionDateCustomStart,
    versionDateCustomEnd,
    versionSortBy,
    versionGroupFilter,
    getDateRange,
    selectedPackage,
  ]);

  useEffect(() => {
    setSelectedVersionIdsForBatch(new Set());
    setVersionGroupFilter("");
  }, [selectedPackageId]);

  useEffect(() => {
    if (!justCreatedPackageId || selectedPackageId !== justCreatedPackageId) return;
    const t = setTimeout(() => {
      versionSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setJustCreatedPackageId(null);
    }, 100);
    return () => clearTimeout(t);
  }, [justCreatedPackageId, selectedPackageId]);

  const selectedPackageForForm = createPackageMode ? null : selectedPackage;

  const openCreatePackage = () => {
    setCreatePackageMode(true);
    setSelectedPackageId(null);
    setPackageForm(emptyPackageForm);
    setPackageSubmitError(null);
    setPackageSubmitErrors(undefined);
  };

  const openPackage = (pkg: AssetPackage) => {
    setCreatePackageMode(false);
    setSelectedPackageId(pkg.id);
    setPackageForm(packageToForm(pkg));
    setPackageSubmitError(null);
    setPackageSubmitErrors(undefined);
  };

  const openAddVersion = () => {
    if (!selectedPackageId) return;
    setEditingVersionId(null);
    setVersionForm(emptyVersionForm);
    setPendingDetection(null);
    setSuggestedGroupNameForForm(null);
    setVersionSubmitError(null);
    setVersionSubmitErrors(undefined);
    setVersionUploadError(null);
    setVersionDialogOpen(true);
  };

  const openEditVersion = (v: AssetVersion) => {
    setEditingVersionId(v.id);
    setVersionForm(versionToForm(v));
    setSuggestedGroupNameForForm(null);
    setVersionSubmitError(null);
    setVersionSubmitErrors(undefined);
    setVersionUploadError(null);
    setVersionDialogOpen(true);
  };

  const handleVersionFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPackageId) return;
    e.target.value = "";
    setVersionUploadError(null);
    setVersionUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/asset-packages/${selectedPackageId}/versions/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setVersionUploadError((data as { message?: string }).message ?? "上傳失敗");
        return;
      }
      const { fileUrl, fileName, fileType, storageProvider, detection, thumbnailUrl: uploadThumbnailUrl } = data as {
        fileUrl: string;
        fileName: string;
        fileType: string;
        storageProvider?: "local" | "nas";
        detection?: UploadDetection;
        thumbnailUrl?: string;
      };
      const mime = fileType ?? file.type ?? "";
      const autoAssetType: AssetType = mime.startsWith("video/") ? "video" : "image";
      const nameForParse = fileName ?? file.name ?? "";
      let suggestedRatio: AssetAspectRatio = "1:1";
      let nextDetection: UploadDetection | null = null;
      if (detection?.detectStatus === "success" && detection?.detectedAspectRatio) {
        suggestedRatio = detection.detectedAspectRatio;
        nextDetection = detection;
      } else {
        const fromFilename = parseAspectRatioFromFilename(nameForParse) ?? parseAspectRatioFromFilename(fileUrl ?? "");
        if (fromFilename) {
          suggestedRatio = fromFilename;
          nextDetection = {
            detectedAspectRatio: fromFilename,
            detectStatus: "fallback",
            detectSource: "filename",
          };
        } else if (autoAssetType === "image") {
          try {
            const ratio = await getImageAspectRatio(file);
            if (ratio) {
              suggestedRatio = ratio;
              nextDetection = { detectedAspectRatio: ratio, detectStatus: "success", detectSource: "metadata" };
            } else {
              nextDetection = { detectStatus: "failed", detectSource: "manual" };
            }
          } catch {
            nextDetection = { detectStatus: "failed", detectSource: "manual" };
          }
        } else {
          nextDetection = { detectStatus: "failed", detectSource: "manual" };
        }
      }
      const suggestedGroupName = parseSuggestedGroupNameFromFilename(nameForParse);
      const suggestedGroupId =
        suggestedGroupName &&
        assetGroups.find(
          (g) =>
            g.name === suggestedGroupName ||
            g.name === suggestedGroupName + "版" ||
            suggestedGroupName === g.name + "版"
        )?.id;
      setPendingDetection(nextDetection);
      setSuggestedGroupNameForForm(suggestedGroupName && !suggestedGroupId ? suggestedGroupName : null);
      setVersionForm((f) => ({
        ...f,
        fileUrl: fileUrl ?? "",
        fileName: fileName ?? file.name,
        fileType: mime,
        assetType: autoAssetType,
        aspectRatio: suggestedRatio,
        storageProvider: storageProvider ?? undefined,
        groupId: suggestedGroupId ?? f.groupId,
        thumbnailUrl: uploadThumbnailUrl ?? (autoAssetType === "image" ? (fileUrl ?? "") : undefined),
      }));
      if (nextDetection?.detectStatus === "success") {
        toast({ title: "上傳成功", description: "已帶入檔名、URL、類型與比例（已從檔案偵測）" });
      } else if (nextDetection?.detectStatus === "fallback") {
        toast({ title: "上傳成功", description: "已帶入檔名、URL；比例依檔名推測，請確認" });
      } else if (nextDetection?.detectStatus === "failed") {
        toast({ title: "上傳成功", description: "已帶入檔名、URL、類型；比例待確認，請手動選擇" });
      } else {
        toast({ title: "上傳成功", description: "已帶入檔名、URL、類型" });
      }
    } finally {
      setVersionUploading(false);
    }
  };

  const savePackage = async () => {
    setPackageSubmitError(null);
    setPackageSubmitErrors(undefined);
    setPackageSaving(true);
    try {
      const body = {
        name: packageForm.name.trim(),
        brandProductName: (packageForm.brandProductName ?? "").trim(),
        adObjective: packageForm.adObjective,
        primaryCopy: packageForm.primaryCopy ?? "",
        headline: packageForm.headline.trim(),
        cta: packageForm.cta.trim(),
        landingPageUrl: packageForm.landingPageUrl.trim() || "",
        status: packageForm.status,
        note: packageForm.note.trim() || undefined,
      };
      if (selectedPackageForForm?.id) {
        const result = await apiFetch<AssetPackage>("PUT", `/api/asset-packages/${selectedPackageForForm.id}`, body);
        if (!result.ok) {
          setPackageSubmitError(result.message);
          setPackageSubmitErrors(result.errors);
          return;
        }
        toast({ title: "已更新", description: "素材包已更新" });
      } else {
        const result = await apiFetch<AssetPackage>("POST", "/api/asset-packages", body);
        if (!result.ok) {
          setPackageSubmitError(result.message);
          setPackageSubmitErrors(result.errors);
          return;
        }
        toast({ title: "已建立", description: "素材包已建立，可立刻上傳版本" });
        setSelectedPackageId(result.data.id);
        setCreatePackageMode(false);
        setPackageForm(packageToForm(result.data));
        setJustCreatedPackageId(result.data.id);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/asset-packages"] });
      if (selectedPackageId) queryClient.invalidateQueries({ queryKey: ["/api/asset-packages", selectedPackageId] });
    } finally {
      setPackageSaving(false);
    }
  };

  const saveVersion = async () => {
    if (!selectedPackageId) return;
    setVersionSubmitError(null);
    setVersionSubmitErrors(undefined);
    setVersionSaving(true);
    try {
      const body: Record<string, unknown> = {
        assetType: versionForm.assetType,
        aspectRatio: versionForm.aspectRatio,
        fileName: versionForm.fileName.trim() || "未命名",
        fileUrl: versionForm.fileUrl.trim() || "",
        fileType: versionForm.fileType.trim() || "application/octet-stream",
        storageProvider: versionForm.storageProvider,
        versionNote: versionForm.versionNote.trim() || undefined,
        isPrimary: versionForm.isPrimary,
        groupId: versionForm.groupId.trim() || undefined,
        thumbnailUrl:
          versionForm.thumbnailUrl?.trim() ||
          (versionForm.assetType === "image" && versionForm.fileUrl?.trim() ? versionForm.fileUrl.trim() : undefined),
      };
      if (pendingDetection && !editingVersionId) {
        if (pendingDetection.detectedWidth != null) body.detectedWidth = pendingDetection.detectedWidth;
        if (pendingDetection.detectedHeight != null) body.detectedHeight = pendingDetection.detectedHeight;
        if (pendingDetection.detectedAspectRatio) body.detectedAspectRatio = pendingDetection.detectedAspectRatio;
        if (pendingDetection.detectedDurationSeconds != null) body.detectedDurationSeconds = pendingDetection.detectedDurationSeconds;
        if (pendingDetection.detectStatus === "failed") {
          body.detectStatus = "manual_confirmed";
          body.detectSource = "manual";
        } else {
          body.detectStatus = pendingDetection.detectStatus;
          body.detectSource = pendingDetection.detectSource;
        }
      }
      if (!editingVersionId && (versionForm.groupId ?? "").trim()) {
        body.groupSource = "suggested";
      }
      if (editingVersionId) {
        const editingVersion = versions.find((x) => x.id === editingVersionId);
        if (editingVersion) {
          if ((body.groupId ?? "") !== (editingVersion.groupId ?? "")) body.groupSource = "manual";
          if (body.aspectRatio !== editingVersion.aspectRatio) {
            body.detectStatus = "manual_confirmed";
            body.detectSource = "manual";
          }
        }
      }
      let savedVersionId = editingVersionId;
      if (editingVersionId) {
        const result = await apiFetch<AssetVersion>("PUT", `/api/asset-versions/${editingVersionId}`, body);
        if (!result.ok) {
          setVersionSubmitError(result.message);
          setVersionSubmitErrors(result.errors);
          return;
        }
        toast({ title: "已更新", description: "素材版本已更新" });
      } else {
        const result = await apiFetch<AssetVersion>("POST", `/api/asset-packages/${selectedPackageId}/versions`, body);
        if (!result.ok) {
          setVersionSubmitError(result.message);
          setVersionSubmitErrors(result.errors);
          return;
        }
        savedVersionId = result.data.id;
        toast({ title: "已建立", description: "素材版本已建立" });
        setPendingDetection(null);
      }
      if (submitCreativeReviewAfterSave && savedVersionId) {
        await submitCreativeReviewForSavedVersion(savedVersionId, toast, queryClient);
      }
      setSubmitCreativeReviewAfterSave(false);
      setVersionDialogOpen(false);
      setSuggestedGroupNameForForm(null);
      queryClient.invalidateQueries({ queryKey: ["/api/asset-packages", selectedPackageId, "versions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/asset-packages", selectedPackageId, "groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/asset-packages"] });
    } finally {
      setVersionSaving(false);
    }
  };

  const setVersionPrimary = async (v: AssetVersion) => {
    const result = await apiFetch<AssetVersion>("PUT", `/api/asset-versions/${v.id}`, { ...versionToForm(v), isPrimary: true });
    if (!result.ok) {
      toast({ title: "設定失敗", description: result.message, variant: "destructive" });
      return;
    }
    toast({ title: "已設為主版本" });
    queryClient.invalidateQueries({ queryKey: ["/api/asset-packages", selectedPackageId!, "versions"] });
  };

  const deletePackage = async () => {
    if (!deletePackageTarget) return;
    setPackageDeleting(true);
    try {
      const result = await apiFetch<unknown>("DELETE", `/api/asset-packages/${deletePackageTarget.id}`);
      if (!result.ok) {
        toast({ title: "刪除失敗", description: result.message, variant: "destructive" });
        return;
      }
      toast({ title: "已刪除", description: "素材包已刪除" });
      if (selectedPackageId === deletePackageTarget.id) {
        setSelectedPackageId(null);
        setCreatePackageMode(false);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/asset-packages"] });
      setDeletePackageTarget(null);
    } finally {
      setPackageDeleting(false);
    }
  };

  const deleteVersion = async () => {
    if (!deleteVersionTarget) return;
    setVersionDeleting(true);
    try {
      const result = await apiFetch<unknown>("DELETE", `/api/asset-versions/${deleteVersionTarget.id}`);
      if (!result.ok) {
        toast({ title: "刪除失敗", description: result.message, variant: "destructive" });
        return;
      }
      toast({ title: "已刪除", description: "素材版本已刪除" });
      queryClient.invalidateQueries({ queryKey: ["/api/asset-packages", selectedPackageId!, "versions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/asset-packages"] });
      setDeleteVersionTarget(null);
    } finally {
      setVersionDeleting(false);
    }
  };

  const batchDeleteVersions = async () => {
    const ids = Array.from(selectedVersionIdsForBatch);
    if (ids.length === 0 || !selectedPackageId) return;
    setBatchDeleting(true);
    try {
      let failed = 0;
      for (const id of ids) {
        const result = await apiFetch<unknown>("DELETE", `/api/asset-versions/${id}`);
        if (!result.ok) failed++;
      }
      setSelectedVersionIdsForBatch(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/asset-packages", selectedPackageId, "versions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/asset-packages"] });
      if (failed > 0) toast({ title: "部分刪除失敗", description: `${failed} 筆刪除失敗`, variant: "destructive" });
      else toast({ title: "已批次刪除", description: `已刪除 ${ids.length} 個版本` });
    } finally {
      setBatchDeleting(false);
    }
  };

  const createAssetGroup = async () => {
    const name = newGroupName.trim();
    if (!name || !selectedPackageId) return;
    setGroupCreating(true);
    try {
      const res = await fetch(`/api/asset-packages/${selectedPackageId}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "建立失敗", description: (data as { message?: string }).message ?? "請稍後再試", variant: "destructive" });
        return;
      }
      setNewGroupName("");
      queryClient.invalidateQueries({ queryKey: ["/api/asset-packages", selectedPackageId, "groups"] });
      toast({ title: "已建立", description: `主素材組「${name}」已建立` });
    } finally {
      setGroupCreating(false);
    }
  };

  const saveGroupEdit = async () => {
    if (!editingGroupId || !selectedPackageId || !editingGroupName.trim()) return;
    setGroupSaving(true);
    try {
      const res = await fetch(`/api/asset-packages/${selectedPackageId}/groups/${editingGroupId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingGroupName.trim() }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "更新失敗", description: (data as { message?: string }).message ?? "請稍後再試", variant: "destructive" });
        return;
      }
      setEditingGroupId(null);
      setEditingGroupName("");
      queryClient.invalidateQueries({ queryKey: ["/api/asset-packages", selectedPackageId, "groups"] });
      toast({ title: "已更新", description: "主素材組名稱已更新" });
    } finally {
      setGroupSaving(false);
    }
  };

  const deleteGroup = async () => {
    if (!deleteGroupTarget || !selectedPackageId) return;
    const stillAttached = versions.filter((v) => v.groupId === deleteGroupTarget.id);
    if (stillAttached.length > 0) {
      setDeleteGroupTarget(null);
      toast({
        title: "無法刪除",
        description: "此主素材組底下仍有版本，請先將版本改為未分組或移到其他組後再刪除",
        variant: "destructive",
      });
      return;
    }
    setGroupDeleting(true);
    try {
      const res = await fetch(`/api/asset-packages/${selectedPackageId}/groups/${deleteGroupTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ title: "刪除失敗", description: (data as { message?: string }).message ?? "請稍後再試", variant: "destructive" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/asset-packages", selectedPackageId, "groups"] });
      toast({ title: "已刪除", description: "主素材組已刪除" });
      if (versionGroupFilter === deleteGroupTarget.id) setVersionGroupFilter("");
    } finally {
      setGroupDeleting(false);
      setDeleteGroupTarget(null);
    }
  };

  return {
    packages,
    packagesLoading,
    packagesError,
    selectedPackageId,
    setSelectedPackageId,
    createPackageMode,
    setCreatePackageMode,
    packageForm,
    setPackageForm,
    packageSubmitError,
    packageSubmitErrors,
    packageSaving,
    selectedPackage,
    selectedPackageLoading,
    selectedPackageForForm,
    versions,
    versionsLoading,
    assetGroups,
    filteredAndSortedVersions,
    versionDateFilter,
    setVersionDateFilter,
    versionDateCustomStart,
    setVersionDateCustomStart,
    versionDateCustomEnd,
    setVersionDateCustomEnd,
    versionTypeFilter,
    setVersionTypeFilter,
    versionRatioFilter,
    setVersionRatioFilter,
    versionKeyword,
    setVersionKeyword,
    versionSortBy,
    setVersionSortBy,
    versionGroupFilter,
    setVersionGroupFilter,
    selectedVersionIdsForBatch,
    setSelectedVersionIdsForBatch,
    batchDeleting,
    newGroupName,
    setNewGroupName,
    groupCreating,
    editingGroupId,
    setEditingGroupId,
    editingGroupName,
    setEditingGroupName,
    groupSaving,
    deleteGroupTarget,
    setDeleteGroupTarget,
    groupDeleting,
    versionDialogOpen,
    setVersionDialogOpen,
    editingVersionId,
    versionForm,
    setVersionForm,
    versionSubmitError,
    versionSubmitErrors,
    versionSaving,
    versionUploading,
    versionUploadError,
    deletePackageTarget,
    setDeletePackageTarget,
    deleteVersionTarget,
    setDeleteVersionTarget,
    packageDeleting,
    versionDeleting,
    pendingDetection,
    submitCreativeReviewAfterSave,
    setSubmitCreativeReviewAfterSave,
    suggestedGroupNameForForm,
    versionSectionRef,
    versionGridScrollRef,
    toast,
    openCreatePackage,
    openPackage,
    openAddVersion,
    openEditVersion,
    handleVersionFileUpload,
    savePackage,
    saveVersion,
    setVersionPrimary,
    deletePackage,
    deleteVersion,
    batchDeleteVersions,
    createAssetGroup,
    saveGroupEdit,
    deleteGroup,
  };
}

export type AssetsWorkbench = ReturnType<typeof useAssetsWorkbench>;
