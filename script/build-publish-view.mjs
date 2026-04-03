import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "client", "src", "pages", "publish-center-page.tsx");
const lines = fs.readFileSync(src, "utf8").split(/\r?\n/);
const jsx = lines.slice(829, 1747).join("\n");

const header = `/**
 * 投放中心 UI（邏輯見 publish/usePublishWorkbench）
 */
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
import { queryClient } from "@/lib/queryClient";
import { Plus, Pencil, Loader2, Send, Copy, Film, ChevronDown, ChevronRight, Check, AlertTriangle } from "lucide-react";
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
import { Link } from "wouter";
import { AssetThumbnailImg, toAbsoluteUploadUrl } from "@/components/AssetThumbnailImg";
import type { PublishDraft } from "@shared/schema";
import {
  audienceStrategies,
  audienceStrategyLabels,
  placementStrategies,
  placementStrategyLabels,
  publishStatusLabels,
  assetTypeLabels,
  assetAspectRatioLabels,
  type AudienceStrategy,
  type PlacementStrategy,
} from "@shared/schema";
import { OBJECTIVE_TO_PREFIX, WIZARD_STEPS, META_CTA_OPTIONS } from "./publish-constants";
import { usePublishWorkbench } from "./usePublishWorkbench";

type WB = ReturnType<typeof usePublishWorkbench>;

export function PublishPageView({ wb }: { wb: WB }) {
  const {
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
    handleBatchCreate,
    formatDate,
    isLoading,
    hasDraftsError,
    toast,
  } = wb;

`;

const out = path.join(root, "client", "src", "pages", "publish", "PublishPageView.tsx");
fs.writeFileSync(out, header + jsx + "\n");
console.log("lines", (header + jsx).split("\n").length);
