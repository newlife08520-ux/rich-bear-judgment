import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, "..", "client", "src", "pages", "publish");
const src = path.join(dir, "PublishPageView.tsx");
const L = fs.readFileSync(src, "utf8").split(/\r?\n/);

const step1 = L.slice(248, 576).join("\n");
const step2 = L.slice(579, 811).join("\n");
const step3 = L.slice(815, 1028).join("\n");

const stepHeader = (name) => `import type { PublishWorkbench } from "./publish-workbench-type";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { ChevronDown, ChevronRight, Loader2, Film, Check, AlertTriangle } from "lucide-react";
import { AssetThumbnailImg, toAbsoluteUploadUrl } from "@/components/AssetThumbnailImg";
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
import { OBJECTIVE_TO_PREFIX, META_CTA_OPTIONS } from "./publish-constants";

export function ${name}({ wb }: { wb: PublishWorkbench }) {
`;

// Step1 uses OBJECTIVE_TO_PREFIX, META_CTA_OPTIONS - in publish-constants
// Step2 uses Film, AssetThumbnailImg, etc.
// Step3 uses queryClient, toast, Collapsible, META_CTA_OPTIONS, publishStatusLabels

fs.writeFileSync(
  path.join(dir, "PublishWizardStep1.tsx"),
  stepHeader("PublishWizardStep1") +
    `  const {
    form, setForm, templates, selectedTemplateId, setSelectedTemplateId, loadTemplate,
    accounts, accountPopoverOpen, setAccountPopoverOpen,
    metaPages, metaIgAccounts, metaPagesByAccountFetched, metaPagesData, metaPagesNoFilter,
    pagePopoverOpen, setPagePopoverOpen, igPopoverOpen, setIgPopoverOpen,
    igAccountsForSelectedPage, placementIncludesIg, selectedPageHasNoIg,
  } = wb;
  return (
` +
    step1 +
    `
  );
}
`
);

fs.writeFileSync(
  path.join(dir, "PublishWizardStep2.tsx"),
  stepHeader("PublishWizardStep2") +
    `  const {
    form, setForm, packages, versions, batchGroups, onSelectPackage, toggleVersion,
    selectedBatchGroupKeys, setSelectedBatchGroupKeys, batchCreating, handleBatchCreate,
  } = wb;
  return (
` +
    step2 +
    `
  );
}
`
);

fs.writeFileSync(
  path.join(dir, "PublishWizardStep3.tsx"),
  stepHeader("PublishWizardStep3") +
    `  const {
    form, setForm, metaPages, metaPagesNoFilter, igAccountsForSelectedPage,
    form: f, placementIncludesIg, preflight, effectivePrimaryCopy, effectiveHeadline,
    effectiveCta, effectiveNote, effectiveLandingPageUrl, advancedOpen, setAdvancedOpen,
    toast,
  } = wb;
  const form = f;
  return (
` +
    step3 +
    `
  );
}
`
);

// Fix step3 - duplicate form binding. Use only wb destructuring once:
const step3Fixed = fs.readFileSync(path.join(dir, "PublishWizardStep3.tsx"), "utf8");
fs.writeFileSync(
  path.join(dir, "PublishWizardStep3.tsx"),
  step3Fixed.replace(
    `  const {
    form, setForm, metaPages, metaPagesNoFilter, igAccountsForSelectedPage,
    form: f, placementIncludesIg, preflight, effectivePrimaryCopy, effectiveHeadline,
    effectiveCta, effectiveNote, effectiveLandingPageUrl, advancedOpen, setAdvancedOpen,
    toast,
  } = wb;
  const form = f;`,
    `  const {
    form, setForm, metaPages, metaPagesNoFilter, igAccountsForSelectedPage,
    placementIncludesIg, preflight, effectivePrimaryCopy, effectiveHeadline,
    effectiveCta, effectiveNote, effectiveLandingPageUrl, advancedOpen, setAdvancedOpen,
    toast,
  } = wb;`
  )
);

console.log("Step1 lines", step1.split("\n").length);
console.log("Step2 lines", step2.split("\n").length);
console.log("Step3 lines", step3.split("\n").length);
