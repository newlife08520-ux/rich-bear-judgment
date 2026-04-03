import type { AssetPackage, AssetVersion } from "@shared/schema";
import type { AssetAdObjective, AssetType, AssetAspectRatio, AssetStatus } from "@shared/schema";

export type PackageFormState = {
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

export const emptyPackageForm: PackageFormState = {
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

export function packageToForm(p: AssetPackage): PackageFormState {
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

export type UploadDetection = {
  detectedWidth?: number;
  detectedHeight?: number;
  detectedAspectRatio?: AssetAspectRatio;
  detectedDurationSeconds?: number;
  detectStatus: "success" | "fallback" | "failed" | "manual_confirmed";
  detectSource: "metadata" | "filename" | "manual";
};

export type VersionFormState = {
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

export const emptyVersionForm: VersionFormState = {
  assetType: "image",
  aspectRatio: "1:1",
  fileName: "",
  fileUrl: "",
  fileType: "",
  versionNote: "",
  isPrimary: false,
  groupId: "",
};

export function versionToForm(v: AssetVersion): VersionFormState {
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
