import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn as _cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";

const cn = typeof _cn === "function" ? _cn : (...a: (string | undefined | false)[]) => a.filter(Boolean).join(" ");
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Star,
  Upload,
  Film,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { AssetThumbnailImg, toAbsoluteUploadUrl } from "@/components/AssetThumbnailImg";
import type { AssetPackage, AssetVersion, AssetGroup } from "@shared/schema";
import {
  assetTypes,
  assetTypeLabels,
  assetAspectRatios,
  assetAspectRatioLabels,
  type AssetAdObjective,
  type AssetType,
  type AssetAspectRatio,
  type AssetStatus,
} from "@shared/schema";
import {
  parseAspectRatioFromText,
  parseSuggestedGroupNameFromFilename as parseSuggestedGroupNameFromFilenameShared,
} from "@shared/parse-asset-name";

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string; errors?: unknown };

async function apiFetch<T>(
  method: string,
  url: string,
  body?: object
): Promise<ApiResult<T>> {
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
  return { ok: true, data: data as T };
}

// ----- 素材包表單 -----
type PackageFormState = {
  name: string;
  brandProductName: string;
  adObjective: AssetAdObjective;
  primaryCopy: string;
  headline: string;
  cta: string;
  landingPageUrl: string;
  status: AssetStatus;
  note: string;
};

const emptyPackageForm: PackageFormState = {
  name: "",
  brandProductName: "",
  adObjective: "sales",
  primaryCopy: "",
  headline: "",
  cta: "",
  landingPageUrl: "",
  status: "draft",
  note: "",
};

function packageToForm(p: AssetPackage): PackageFormState {
  return {
    name: p.name,
    brandProductName: p.brandProductName,
    adObjective: p.adObjective,
    primaryCopy: p.primaryCopy,
    headline: p.headline,
    cta: p.cta,
    landingPageUrl: p.landingPageUrl ?? "",
    status: p.status,
    note: p.note ?? "",
  };
}

/** 上傳後伺服器回傳的偵測結果，建立版本時一併送出寫入 */
type UploadDetection = {
  detectedWidth?: number;
  detectedHeight?: number;
  detectedAspectRatio?: AssetAspectRatio;
  detectedDurationSeconds?: number;
  detectStatus: "success" | "fallback" | "failed" | "manual_confirmed";
  detectSource: "metadata" | "filename" | "manual";
};

// ----- 素材版本表單 -----
type VersionFormState = {
  assetType: AssetType;
  aspectRatio: AssetAspectRatio;
  fileName: string;
  fileUrl: string;
  fileType: string;
  storageProvider?: "local" | "nas";
  versionNote: string;
  isPrimary: boolean;
  groupId: string;
  thumbnailUrl?: string;
};

const emptyVersionForm: VersionFormState = {
  assetType: "image",
  aspectRatio: "1:1",
  fileName: "",
  fileUrl: "",
  fileType: "",
  versionNote: "",
  isPrimary: false,
  groupId: "",
};

function versionToForm(v: AssetVersion): VersionFormState {
  return {
    assetType: v.assetType,
    aspectRatio: v.aspectRatio,
    fileName: v.fileName,
    fileUrl: v.fileUrl,
    fileType: v.fileType,
    storageProvider: v.storageProvider,
    versionNote: v.versionNote ?? "",
    isPrimary: v.isPrimary,
    groupId: v.groupId ?? "",
    thumbnailUrl: v.thumbnailUrl,
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ASPECT_RATIOS: { key: AssetAspectRatio; value: number }[] = [
  { key: "9:16", value: 9 / 16 },
  { key: "4:5", value: 4 / 5 },
  { key: "1:1", value: 1 },
  { key: "16:9", value: 16 / 9 },
];

/** 與 server 一致：使用 shared parser，支援 9x16、9:16、9_16、4x5、4:5、4_5、1x1、16x9 等 */
function parseAspectRatioFromFilename(text: string): AssetAspectRatio | null {
  return parseAspectRatioFromText(text);
}

/** 與 server 一致：使用 shared parser，主素材組建議（A、A版、B、B版、C、C版 等） */
function parseSuggestedGroupNameFromFilename(fileName: string): string | null {
  return parseSuggestedGroupNameFromFilenameShared(fileName);
}

function getImageAspectRatio(file: File): Promise<AssetAspectRatio> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!h) {
        resolve("1:1");
        return;
      }
      const r = w / h;
      let best: AssetAspectRatio = "1:1";
      let bestDiff = Infinity;
      for (const { key, value } of ASPECT_RATIOS) {
        const diff = Math.abs(r - value);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = key;
        }
      }
      resolve(best);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("無法讀取圖片"));
    };
    img.src = url;
  });
}

export default function AssetsPage() {
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
  const [suggestedGroupNameForForm, setSuggestedGroupNameForForm] = useState<string | null>(null);
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
    queryKey: selectedPackageId ? ["/api/asset-packages", selectedPackageId, "versions"] : ["/api/asset-packages", "__none__", "versions"],
    queryFn: async () => {
      if (!selectedPackageId) return [];
      const res = await fetch(`/api/asset-packages/${selectedPackageId}/versions`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedPackageId,
  });

  const { data: assetGroups = [] } = useQuery<AssetGroup[]>({
    queryKey: selectedPackageId ? ["/api/asset-packages", selectedPackageId, "groups"] : ["/api/asset-packages", "__none__", "groups"],
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
  }, [versions, versionKeyword, versionTypeFilter, versionRatioFilter, versionDateFilter, versionDateCustomStart, versionDateCustomEnd, versionSortBy, versionGroupFilter, getDateRange, selectedPackage]);

  useEffect(() => {
    setSelectedVersionIdsForBatch(new Set());
    setVersionGroupFilter("");
  }, [selectedPackageId]);

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
      // 三層比例：1 metadata 真偵測 → 2 檔名解析 → 3 待確認
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
        suggestedGroupName && assetGroups.find((g) => g.name === suggestedGroupName || g.name === suggestedGroupName + "版" || suggestedGroupName === g.name + "版")?.id;
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
      // groupSource：新建且帶 groupId 視為系統建議；編輯時 groupId 有變更即改為 manual，且一旦 manual 不再改回（見 docs/groupSource與偵測狀態規則.md）
      if (!editingVersionId && (versionForm.groupId ?? "").trim()) {
        body.groupSource = "suggested";
      }
      if (editingVersionId) {
        const editingVersion = versions.find((x) => x.id === editingVersionId);
        if (editingVersion) {
          if ((body.groupId ?? "") !== (editingVersion.groupId ?? "")) body.groupSource = "manual";
          // 僅在「比例實際被修改」時寫入 manual_confirmed / manual；開編輯未改比例不送，避免污染原有偵測狀態
          if (body.aspectRatio !== editingVersion.aspectRatio) {
            body.detectStatus = "manual_confirmed";
            body.detectSource = "manual";
          }
        }
      }
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
        toast({ title: "已建立", description: "素材版本已建立" });
        setPendingDetection(null);
      }
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

  const versionSectionRef = useRef<HTMLDivElement>(null);
  const versionGridScrollRef = useRef<HTMLDivElement>(null);
  const [justCreatedPackageId, setJustCreatedPackageId] = useState<string | null>(null);

  const VERSION_GRID_COLS = 3;
  const VERSION_ROW_HEIGHT = 130;
  const versionRowCount = Math.ceil(filteredAndSortedVersions.length / VERSION_GRID_COLS);
  const versionVirtualizer = useVirtualizer({
    count: versionRowCount,
    getScrollElement: () => versionGridScrollRef.current,
    estimateSize: () => VERSION_ROW_HEIGHT,
    overscan: 3,
  });
  useEffect(() => {
    if (!justCreatedPackageId || selectedPackageId !== justCreatedPackageId) return;
    const t = setTimeout(() => {
      versionSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setJustCreatedPackageId(null);
    }, 100);
    return () => clearTimeout(t);
  }, [justCreatedPackageId, selectedPackageId]);

  const rightPanelContent = () => {
    if (createPackageMode) {
      return (
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-medium mb-4">新增素材包</h3>
            <p className="text-sm text-muted-foreground mb-4">填名稱即可建立，建立後可立刻上傳版本。</p>
            {packageSubmitError && (
              <div className="text-sm text-destructive bg-destructive/10 p-2 rounded mb-4">
                {packageSubmitError}
                {packageSubmitErrors != null && typeof packageSubmitErrors === "object" && "fieldErrors" in (packageSubmitErrors as object) && (
                  <pre className="mt-2 text-xs overflow-auto max-h-24">{JSON.stringify((packageSubmitErrors as { fieldErrors?: unknown }).fieldErrors, null, 2)}</pre>
                )}
              </div>
            )}
            <PackageFormFields form={packageForm} setForm={setPackageForm} mode="create" />
            <div className="flex gap-2 mt-4">
              <Button onClick={savePackage} disabled={packageSaving || !packageForm.name.trim()}>
                {packageSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                建立
              </Button>
              <Button variant="outline" onClick={() => { setCreatePackageMode(false); setSelectedPackageId(packages[0]?.id ?? null); if (packages[0]) setPackageForm(packageToForm(packages[0])); }} disabled={packageSaving}>
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }
    if (!selectedPackageId) {
      return (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            請從左側選擇素材包，或點「新增素材包」建立
          </CardContent>
        </Card>
      );
    }
    if (selectedPackageLoading) {
      return (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">載入中...</CardContent>
        </Card>
      );
    }
    return (
      <div className="space-y-4">
        {/* 主素材組：同一支創意（A版/B版）底下掛多尺寸版本 */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-medium mb-3">主素材組</h3>
            <p className="text-sm text-muted-foreground mb-3">建立 A版、B版 等組別，新增版本時可指定所屬組；投放中心將依組批次建草稿。</p>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {assetGroups.map((g) => (
                <div key={g.id} className="flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-1">
                  <Badge variant="secondary" className="text-sm font-normal">{g.name}</Badge>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingGroupId(g.id); setEditingGroupName(g.name); }} title="編輯組名">
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => setDeleteGroupTarget(g)} title="刪除主素材組">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="例如 A版、B版"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="max-w-[180px]"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), createAssetGroup())}
              />
              <Button size="sm" onClick={createAssetGroup} disabled={groupCreating || !newGroupName.trim()}>
                {groupCreating && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                建立主素材組
              </Button>
            </div>
          </CardContent>
        </Card>

        <div ref={versionSectionRef}>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">素材版本</h3>
              <Button size="sm" onClick={openAddVersion}>
                <Plus className="w-4 h-4 mr-2" />
                新增版本
              </Button>
            </div>

            {/* 篩選與排序 */}
            {versions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-lg border bg-muted/30">
                <Select value={versionDateFilter} onValueChange={setVersionDateFilter}>
                  <SelectTrigger className="w-[130px] h-9">
                    <SelectValue placeholder="日期" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部日期</SelectItem>
                    <SelectItem value="today">今天</SelectItem>
                    <SelectItem value="yesterday">昨天</SelectItem>
                    <SelectItem value="last7">最近 7 天</SelectItem>
                    <SelectItem value="last30">最近 30 天</SelectItem>
                    <SelectItem value="custom">自訂區間</SelectItem>
                  </SelectContent>
                </Select>
                {versionDateFilter === "custom" && (
                  <div className="flex items-center gap-1">
                    <Input type="date" value={versionDateCustomStart} onChange={(e) => setVersionDateCustomStart(e.target.value)} className="w-[130px] h-9" />
                    <span className="text-muted-foreground">～</span>
                    <Input type="date" value={versionDateCustomEnd} onChange={(e) => setVersionDateCustomEnd(e.target.value)} className="w-[130px] h-9" />
                  </div>
                )}
                <Select value={versionTypeFilter} onValueChange={setVersionTypeFilter}>
                  <SelectTrigger className="w-[100px] h-9">
                    <SelectValue placeholder="類型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="image">圖片</SelectItem>
                    <SelectItem value="video">影片</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={versionRatioFilter} onValueChange={setVersionRatioFilter}>
                  <SelectTrigger className="w-[100px] h-9">
                    <SelectValue placeholder="比例" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    {assetAspectRatios.map((k) => (
                      <SelectItem key={k} value={k}>{assetAspectRatioLabels[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="關鍵字（檔名、素材包）"
                  value={versionKeyword}
                  onChange={(e) => setVersionKeyword(e.target.value)}
                  className="max-w-[180px] h-9"
                />
                <Select
                  value={
                    versionGroupFilter === "" || versionGroupFilter === "_none" || assetGroups.some((g) => g.id === versionGroupFilter)
                      ? (versionGroupFilter || "all")
                      : "all"
                  }
                  onValueChange={(v) => setVersionGroupFilter(v === "all" ? "" : v)}
                >
                  <SelectTrigger className="w-[130px] h-9">
                    <SelectValue placeholder="主素材組" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="_none">未分組</SelectItem>
                    {assetGroups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={versionSortBy} onValueChange={(v) => setVersionSortBy(v as "newest" | "name")}>
                  <SelectTrigger className="w-[120px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">最新上傳</SelectItem>
                    <SelectItem value="name">名稱排序</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 批次操作 */}
            {versions.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <Checkbox
                  checked={filteredAndSortedVersions.length > 0 && filteredAndSortedVersions.every((v) => selectedVersionIdsForBatch.has(v.id))}
                  onCheckedChange={(checked) => {
                    if (checked) setSelectedVersionIdsForBatch(new Set(filteredAndSortedVersions.map((v) => v.id)));
                    else setSelectedVersionIdsForBatch(new Set());
                  }}
                />
                <span className="text-sm text-muted-foreground">全選</span>
                {selectedVersionIdsForBatch.size > 0 && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setSelectedVersionIdsForBatch(new Set())}>取消選取</Button>
                    <Button variant="destructive" size="sm" onClick={batchDeleteVersions} disabled={batchDeleting}>
                      {batchDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      批次刪除 ({selectedVersionIdsForBatch.size})
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toast({ title: "即將推出", description: "批次移動到另一素材包" })}>
                      批次移動
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toast({ title: "即將推出", description: "批次設標籤" })}>
                      批次標記
                    </Button>
                  </>
                )}
              </div>
            )}

            {versionsLoading ? (
              <p className="text-sm text-muted-foreground py-4">載入中...</p>
            ) : versions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">尚無版本，請點「新增版本」</p>
            ) : filteredAndSortedVersions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">篩選後無符合的版本</p>
            ) : (
              <div ref={versionGridScrollRef} className="overflow-auto max-h-[60vh] rounded border">
                <div style={{ height: versionVirtualizer.getTotalSize(), position: "relative", width: "100%" }}>
                  {versionVirtualizer.getVirtualItems().map((virtualRow) => {
                    const start = virtualRow.index * VERSION_GRID_COLS;
                    const rowItems = filteredAndSortedVersions.slice(start, start + VERSION_GRID_COLS);
                    return (
                      <div
                        key={virtualRow.key}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-1 py-1"
                      >
                        {rowItems.map((v) => (
                          <Card key={v.id} className="overflow-hidden">
                            <div className="flex gap-3 p-3">
                              <div className="flex-shrink-0 flex items-center justify-center w-20 h-20 rounded border bg-muted/50 overflow-hidden">
                                {v.assetType === "video" ? (
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
                                    <div className="flex flex-col items-center justify-center gap-0.5 text-muted-foreground">
                                      <Film className="w-8 h-8" />
                                      <span className="text-[10px]">影片</span>
                                    </div>
                                  )
                                ) : (
                                  <AssetThumbnailImg
                                    versionId={v.id}
                                    url={toAbsoluteUploadUrl(v.thumbnailUrl || v.fileUrl || "")}
                                    className="w-full h-full object-cover"
                                  />
                                )}
                              </div>
                              <div className="flex-1 min-w-0 flex flex-col gap-1">
                                <div className="flex items-start justify-between gap-1">
                                  <span className="font-medium text-sm truncate" title={v.fileName}>{v.fileName}</span>
                                  <Checkbox
                                    checked={selectedVersionIdsForBatch.has(v.id)}
                                    onCheckedChange={(checked) => {
                                      setSelectedVersionIdsForBatch((prev) => {
                                        const next = new Set(prev);
                                        if (checked) next.add(v.id);
                                        else next.delete(v.id);
                                        return next;
                                      });
                                    }}
                                  />
                                </div>
                                <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                                  {v.groupId && assetGroups.find((g) => g.id === v.groupId) && (
                                    <>
                                      <span>{assetGroups.find((g) => g.id === v.groupId)!.name}</span>
                                      <span>·</span>
                                    </>
                                  )}
                                  {!v.groupId && (
                                    <>
                                      <span className="text-amber-600">未歸組</span>
                                      <span>·</span>
                                    </>
                                  )}
                                  <span>{assetTypeLabels[v.assetType]}</span>
                                  <span>·</span>
                                  <span>{assetAspectRatioLabels[v.aspectRatio]}</span>
                                  {v.detectStatus && (
                                    <Badge
                                      variant={v.detectStatus === "success" ? "default" : v.detectStatus === "manual_confirmed" ? "secondary" : "outline"}
                                      className={cn(
                                        "text-xs font-normal",
                                        v.detectStatus === "failed" && "border-amber-500/50 text-amber-700",
                                        v.detectStatus === "fallback" && "border-amber-400/50 text-amber-600"
                                      )}
                                      title={
                                        v.detectStatus === "failed"
                                          ? "比例偵測失敗；請確認主機已安裝 ffmpeg（ffprobe）或手動選擇比例"
                                          : v.detectSource === "metadata"
                                            ? "從檔案偵測"
                                            : v.detectSource === "filename"
                                              ? "從檔名推測"
                                              : "手動選擇／已確認"
                                      }
                                    >
                                      {v.detectStatus === "success" ? "真偵測" : v.detectStatus === "manual_confirmed" ? "已確認" : v.detectStatus === "fallback" ? "推測" : "待確認"}
                                    </Badge>
                                  )}
                                  {v.groupId && (
                                    <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                      {v.groupSource === "manual" ? "人工組" : "建議組"}
                                    </Badge>
                                  )}
                                  {!v.groupId && (
                                    <Badge variant="outline" className="text-xs font-normal border-amber-500/50 text-amber-600">未歸組</Badge>
                                  )}
                                  <span>·</span>
                                  <span>{formatDate(v.createdAt)}</span>
                                </div>
                                {v.isPrimary && <Badge variant="secondary" className="w-fit text-xs">主版本</Badge>}
                                <div className="flex items-center gap-1 mt-auto">
                                  {!v.isPrimary && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setVersionPrimary(v)} title="設為主版本">
                                      <Star className="w-4 h-4" />
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditVersion(v)} title="編輯">
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteVersionTarget(v)} title="刪除">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </div>

        <Card>
          <CardContent className="pt-6">
            <h3 className="font-medium mb-4">素材包主檔</h3>
            {packageSubmitError && (
              <div className="text-sm text-destructive bg-destructive/10 p-2 rounded mb-4">
                {packageSubmitError}
                {packageSubmitErrors != null && typeof packageSubmitErrors === "object" && "fieldErrors" in (packageSubmitErrors as object) && (
                  <pre className="mt-2 text-xs overflow-auto max-h-24">{JSON.stringify((packageSubmitErrors as { fieldErrors?: unknown }).fieldErrors, null, 2)}</pre>
                )}
              </div>
            )}
            <PackageFormFields form={packageForm} setForm={setPackageForm} mode="edit" />
            <div className="flex gap-2 mt-4">
              <Button onClick={savePackage} disabled={packageSaving}>
                {packageSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                儲存
              </Button>
              <Button variant="destructive" size="sm" onClick={() => selectedPackageForForm && setDeletePackageTarget(selectedPackageForForm)} disabled={packageSaving}>
                刪除素材包
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger />
        <h1 className="font-semibold">素材中心</h1>
      </header>
      <div className="flex-1 overflow-hidden flex">
        <div className="w-[380px] shrink-0 border-r flex flex-col overflow-hidden">
          <div className="p-2 border-b flex gap-2">
            <Button size="sm" onClick={openCreatePackage} className="flex-1">
              <Plus className="w-4 h-4 mr-2" />
              新增素材包
            </Button>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {packagesLoading && (
              <div className="py-8 text-center text-sm text-muted-foreground">載入中...</div>
            )}
            {packagesError && (
              <div className="py-8 text-center text-sm text-destructive">載入失敗，請重新整理或重新登入</div>
            )}
            {!packagesLoading && !packagesError && packages.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">尚無素材包，請點「新增素材包」</div>
            )}
            {!packagesLoading && !packagesError && packages.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground px-1 pb-1 sticky top-0 bg-background z-10">共 {packages.length} 個素材包</p>
                {packages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedPackageId === pkg.id && !createPackageMode ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                    onClick={() => openPackage(pkg)}
                  >
                    <div className="font-medium truncate">{pkg.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{pkg.brandProductName || "—"}</div>
                    {selectedPackageId === pkg.id && (
                      <div className="text-xs text-muted-foreground mt-1">{versions.length} 個版本</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">更新：{formatDate(pkg.updatedAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-3xl">{rightPanelContent()}</div>
        </div>
      </div>

      {/* 版本新增/編輯 Dialog */}
      <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVersionId ? "編輯素材版本" : "新增素材版本"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {versionSubmitError && (
              <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                {versionSubmitError}
                {versionSubmitErrors != null && typeof versionSubmitErrors === "object" && "fieldErrors" in (versionSubmitErrors as object) && (
                  <pre className="mt-2 text-xs overflow-auto max-h-24">{JSON.stringify((versionSubmitErrors as { fieldErrors?: unknown }).fieldErrors, null, 2)}</pre>
                )}
              </div>
            )}

            {/* 第一步：選檔案上傳或貼 URL */}
            <div className="space-y-2">
              <Label>素材檔案</Label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    id="version-file-upload"
                    className="hidden"
                    accept="image/*,video/*"
                    onChange={handleVersionFileUpload}
                    disabled={versionUploading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={versionUploading || !selectedPackageId}
                    onClick={() => document.getElementById("version-file-upload")?.click()}
                  >
                    {versionUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    選擇檔案上傳
                  </Button>
                  <span className="text-xs text-muted-foreground">上傳後自動帶入檔名、URL、類型</span>
                </div>
                {versionUploadError && <p className="text-sm text-destructive">{versionUploadError}</p>}
                <p className="text-xs text-muted-foreground">或貼上 URL（備用）</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>檔案 URL *</Label>
              <Input value={versionForm.fileUrl} onChange={(e) => setVersionForm((f) => ({ ...f, fileUrl: e.target.value }))} placeholder="上傳後自動帶入，或手動貼上" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>檔名 *</Label>
                <Input value={versionForm.fileName} onChange={(e) => setVersionForm((f) => ({ ...f, fileName: e.target.value }))} placeholder="上傳後自動帶入" />
              </div>
              <div className="space-y-2">
                <Label>檔案類型 (MIME)</Label>
                <Input value={versionForm.fileType} onChange={(e) => setVersionForm((f) => ({ ...f, fileType: e.target.value }))} placeholder="例如 image/png、video/mp4" />
              </div>
            </div>

            <div className="border-t pt-4 space-y-4">
              <Label className="text-muted-foreground">類型與比例</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>類型</Label>
                  <Select value={versionForm.assetType} onValueChange={(v) => setVersionForm((f) => ({ ...f, assetType: v as AssetType }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {assetTypes.map((k) => (
                        <SelectItem key={k} value={k}>{assetTypeLabels[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>比例</Label>
                  <Select value={versionForm.aspectRatio} onValueChange={(v) => setVersionForm((f) => ({ ...f, aspectRatio: v as AssetAspectRatio }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {assetAspectRatios.map((k) => (
                        <SelectItem key={k} value={k}>{assetAspectRatioLabels[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {pendingDetection?.detectStatus === "failed" && (
                    <p className="text-xs text-amber-600">比例待確認，請手動選擇</p>
                  )}
                  {pendingDetection?.detectStatus === "fallback" && (
                    <p className="text-xs text-muted-foreground">比例由檔名推測，請確認</p>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>版本備註</Label>
              <Textarea value={versionForm.versionNote} onChange={(e) => setVersionForm((f) => ({ ...f, versionNote: e.target.value }))} rows={2} placeholder="選填" />
            </div>
            <div className="space-y-2">
              <Label>主素材組（A/B/C，同一支素材不同尺寸可歸同組）</Label>
              <Select
                value={versionForm.groupId || "_none"}
                onValueChange={(v) => setVersionForm((f) => ({ ...f, groupId: v === "_none" ? "" : v }))}
              >
                <SelectTrigger><SelectValue placeholder="不指定" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— 不指定 —</SelectItem>
                  {assetGroups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                例：A版的 9:16 / 4:5 / 1:1 可放同一組，投放時可一鍵帶入
              </p>
              {suggestedGroupNameForForm && (
                <p className="text-xs text-muted-foreground">
                  建議主素材組：<span className="font-medium text-foreground">{suggestedGroupNameForForm}</span>
                  （請先建立主素材組或選其他）
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="version-isPrimary"
                checked={versionForm.isPrimary}
                onChange={(e) => setVersionForm((f) => ({ ...f, isPrimary: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="version-isPrimary">設為主版本</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVersionDialogOpen(false)} disabled={versionSaving}>取消</Button>
            <Button onClick={saveVersion} disabled={versionSaving}>
              {versionSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingVersionId ? "儲存" : "建立"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingGroupId} onOpenChange={(open) => !open && (setEditingGroupId(null), setEditingGroupName(""))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>編輯主素材組名稱</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>名稱</Label>
            <Input
              value={editingGroupName}
              onChange={(e) => setEditingGroupName(e.target.value)}
              placeholder="例如 A版"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), saveGroupEdit())}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingGroupId(null); setEditingGroupName(""); }} disabled={groupSaving}>取消</Button>
            <Button onClick={saveGroupEdit} disabled={groupSaving || !editingGroupName.trim()}>
              {groupSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletePackageTarget} onOpenChange={(open) => !open && setDeletePackageTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除素材包</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除「{deletePackageTarget?.name}」嗎？底下的所有素材版本也會一併刪除，此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={packageDeleting}>取消</AlertDialogCancel>
            <Button variant="destructive" onClick={deletePackage} disabled={packageDeleting}>
              {packageDeleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              刪除
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteVersionTarget} onOpenChange={(open) => !open && setDeleteVersionTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除版本</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除此素材版本「{deleteVersionTarget?.fileName}」嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={versionDeleting}>取消</AlertDialogCancel>
            <Button variant="destructive" onClick={deleteVersion} disabled={versionDeleting}>
              {versionDeleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              刪除
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteGroupTarget} onOpenChange={(open) => !open && setDeleteGroupTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除主素材組</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteGroupTarget && versions.some((v) => v.groupId === deleteGroupTarget.id)
                ? "此主素材組底下仍有版本，請先將版本改為未分組或移到其他組後再刪除。"
                : `確定要刪除主素材組「${deleteGroupTarget?.name}」嗎？此操作無法復原。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={groupDeleting}>取消</AlertDialogCancel>
            {deleteGroupTarget && versions.some((v) => v.groupId === deleteGroupTarget.id) ? (
              <Button onClick={() => setDeleteGroupTarget(null)}>關閉</Button>
            ) : (
              <Button variant="destructive" onClick={deleteGroup} disabled={groupDeleting}>
                {groupDeleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                刪除
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PackageFormFields({
  form,
  setForm,
  mode,
}: {
  form: PackageFormState;
  setForm: React.Dispatch<React.SetStateAction<PackageFormState>>;
  mode: "create" | "edit";
}) {
  if (mode === "create") {
    return (
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label>名稱 *</Label>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="素材包名稱" />
        </div>
        <div className="space-y-2">
          <Label>產品名稱</Label>
          <Input value={form.brandProductName} onChange={(e) => setForm((f) => ({ ...f, brandProductName: e.target.value }))} placeholder="預設帶入名稱，可後補" />
        </div>
      </div>
    );
  }
  const [copyOpen, setCopyOpen] = useState(false);
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>名稱 *</Label>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="素材包名稱" />
        </div>
        <div className="space-y-2">
          <Label>產品名稱</Label>
          <Input value={form.brandProductName} onChange={(e) => setForm((f) => ({ ...f, brandProductName: e.target.value }))} placeholder="預設帶入名稱，可後補" />
        </div>
      </div>
      <Collapsible open={copyOpen} onOpenChange={setCopyOpen}>
        <CollapsibleTrigger asChild>
          <button type="button" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground py-2">
            {copyOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            預設文案，可後補
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid gap-4 pt-2 pl-6 border-l border-muted">
            <div className="space-y-2">
              <Label>主文案</Label>
              <Textarea value={form.primaryCopy} onChange={(e) => setForm((f) => ({ ...f, primaryCopy: e.target.value }))} rows={2} placeholder="選填" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>標題</Label>
                <Input value={form.headline} onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))} placeholder="選填" />
              </div>
              <div className="space-y-2">
                <Label>CTA</Label>
                <Input value={form.cta} onChange={(e) => setForm((f) => ({ ...f, cta: e.target.value }))} placeholder="選填，常用「來去逛逛」" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>落地頁 URL</Label>
              <Input value={form.landingPageUrl} onChange={(e) => setForm((f) => ({ ...f, landingPageUrl: e.target.value }))} placeholder="選填" />
            </div>
            <div className="space-y-2">
              <Label>備註</Label>
              <Textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={2} placeholder="選填" />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
