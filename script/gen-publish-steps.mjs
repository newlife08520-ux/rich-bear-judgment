import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pub = path.join(root, "client", "src", "pages", "publish");
const widgets = path.join(pub, "widgets");

const step1Raw = fs.readFileSync(path.join(pub, "_step1.txt"), "utf8");
const step2Raw = fs.readFileSync(path.join(pub, "_step2.txt"), "utf8");
const step3Raw = fs.readFileSync(path.join(pub, "_step3.txt"), "utf8");

const step1Content = step1Raw.split("\n").slice(0, -1).join("\n");
const step2Content = step2Raw.split("\n").slice(3, 232).join("\n");
const step3Content = step3Raw.split("\n").slice(2, 213).join("\n");

const step1Header = `import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Link } from "wouter";
import { ChevronDown } from "lucide-react";
import { OBJECTIVE_TO_PREFIX } from "../publish-constants";
import {
  audienceStrategies,
  audienceStrategyLabels,
  placementStrategies,
  placementStrategyLabels,
  type AudienceStrategy,
  type PlacementStrategy,
} from "@shared/schema";
import type { PublishWorkbench } from "../usePublishWorkbench";

export function PublishWizardStep1({ wb }: { wb: PublishWorkbench }) {
  const {
    form,
    setForm,
    accounts,
    accountPopoverOpen,
    setAccountPopoverOpen,
    pagePopoverOpen,
    setPagePopoverOpen,
    igPopoverOpen,
    setIgPopoverOpen,
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
  } = wb;
  return (
<>
`;

const step1Footer = `
</>
  );
}
`;

fs.writeFileSync(
  path.join(widgets, "PublishWizardStep1.tsx"),
  step1Header + step1Content + step1Footer
);

const step2Header = `import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Film } from "lucide-react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AssetThumbnailImg, toAbsoluteUploadUrl } from "@/components/AssetThumbnailImg";
import { assetTypeLabels, assetAspectRatioLabels } from "@shared/schema";
import type { PublishWorkbench } from "../usePublishWorkbench";

export function PublishWizardStep2({ wb }: { wb: PublishWorkbench }) {
  const {
    form,
    setForm,
    packages,
    versions,
    batchGroups,
    selectedBatchGroupKeys,
    setSelectedBatchGroupKeys,
    onSelectPackage,
    toggleVersion,
    handleBatchCreate,
    batchCreating,
  } = wb;
  return (
<>
`;

const step2Footer = `
</>
  );
}
`;

fs.writeFileSync(
  path.join(widgets, "PublishWizardStep2.tsx"),
  step2Header + step2Content + step2Footer
);

const step3Header = `import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
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
import { ChevronRight } from "lucide-react";
import { Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
import { publishStatusLabels, publishStatuses, type PublishStatus } from "@shared/schema";
import { META_CTA_OPTIONS } from "../publish-constants";
import type { PublishWorkbench } from "../usePublishWorkbench";

export function PublishWizardStep3({ wb }: { wb: PublishWorkbench }) {
  const {
    form,
    setForm,
    metaPages,
    igAccountsForSelectedPage,
    placementIncludesIg,
    selectedPageHasNoIg,
    preflight,
    selectedPackage,
    effectivePrimaryCopy,
    effectiveHeadline,
    effectiveCta,
    effectiveNote,
    effectiveLandingPageUrl,
    advancedOpen,
    setAdvancedOpen,
    toast,
  } = wb;
  return (
<>
`;

const step3Footer = `
</>
  );
}
`;

fs.writeFileSync(
  path.join(widgets, "PublishWizardStep3.tsx"),
  step3Header + step3Content + step3Footer
);

console.log("Generated PublishWizardStep1, Step2, Step3");
console.log("Step1", (step1Header + step1Content + step1Footer).split("\n").length);
console.log("Step2", (step2Header + step2Content + step2Footer).split("\n").length);
console.log("Step3", (step3Header + step3Content + step3Footer).split("\n").length);
