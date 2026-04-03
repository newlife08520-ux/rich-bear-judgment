import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { PackageFormState } from "./asset-types-forms";

export function PackageFormFields({
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
