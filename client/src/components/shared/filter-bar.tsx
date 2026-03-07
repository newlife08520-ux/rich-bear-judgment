import { DateRangeSelector } from "@/components/shared/date-range-selector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SAVED_VIEW_LABELS, SAVED_VIEW_IDS, PRODUCT_STATUS, type SavedViewId } from "@/lib/decision-workbench";
import { useWorkbenchFilter, type SortKey } from "@/lib/workbench-filter-context";
import { useAppScope } from "@/hooks/use-app-scope";
import { Filter, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "spend", label: "花費" },
  { value: "revenue", label: "營收" },
  { value: "roas", label: "ROAS" },
  { value: "ctr", label: "CTR" },
  { value: "cvr", label: "CVR" },
  { value: "priority", label: "優先級" },
  { value: "updated", label: "最近更新" },
];

export interface FilterBarProps {
  productOptions?: string[];
  ownerOptions?: { id: string; name: string }[];
  showSavedViews?: boolean;
  showProductFilter?: boolean;
  showOwnerFilter?: boolean;
  showStatusFilter?: boolean;
  showMinSpend?: boolean;
  showSort?: boolean;
  className?: string;
}

export function FilterBar({
  productOptions = [],
  ownerOptions = [],
  showSavedViews = true,
  showProductFilter = true,
  showOwnerFilter = true,
  showStatusFilter = true,
  showMinSpend = true,
  showSort = true,
  className = "",
}: FilterBarProps) {
  const scope = useAppScope();
  const { filter, setSavedView, setProductFilter, setOwnerFilter, setStatusFilter, setMinSpend, setSort, resetFilter } = useWorkbenchFilter();

  const toggleProduct = (id: string) => {
    const next = filter.productIds.includes(id)
      ? filter.productIds.filter((x) => x !== id)
      : [...filter.productIds, id];
    setProductFilter(next);
  };
  const toggleOwner = (id: string) => {
    const next = filter.ownerIds.includes(id)
      ? filter.ownerIds.filter((x) => x !== id)
      : [...filter.ownerIds, id];
    setOwnerFilter(next);
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-muted/30", className)}>
      <div className="flex items-center gap-2 shrink-0">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">篩選</span>
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">日期</Label>
        <DateRangeSelector value={scope.dateDisplayValue} onChange={scope.handleDateChange} />
      </div>

      {showProductFilter && productOptions.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="w-[140px] justify-between">
              <span className="truncate">
                {filter.productIds.length === 0 ? "商品" : `商品 (${filter.productIds.length})`}
              </span>
              <ChevronDown className="w-3 h-3 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start">
            <ScrollArea className="max-h-48">
              <div className="p-2 space-y-1">
                {productOptions.map((name) => (
                  <label key={name} className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-muted/50 text-sm">
                    <Checkbox
                      checked={filter.productIds.includes(name)}
                      onCheckedChange={() => toggleProduct(name)}
                    />
                    <span className="truncate">{name}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      )}

      {showOwnerFilter && ownerOptions.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="w-[140px] justify-between">
              <span className="truncate">
                {filter.ownerIds.length === 0 ? "負責人" : `負責人 (${filter.ownerIds.length})`}
              </span>
              <ChevronDown className="w-3 h-3 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start">
            <ScrollArea className="max-h-48">
              <div className="p-2 space-y-1">
                {ownerOptions.map((o) => (
                  <label key={o.id} className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-muted/50 text-sm">
                    <Checkbox
                      checked={filter.ownerIds.includes(o.id)}
                      onCheckedChange={() => toggleOwner(o.id)}
                    />
                    <span className="truncate">{o.name}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      )}

      {showSavedViews && (
        <Select
          value={filter.savedViewId || "none"}
          onValueChange={(v) => setSavedView((v === "none" ? "" : v) as SavedViewId)}
        >
          <SelectTrigger className="w-[160px]" data-testid="select-saved-view">
            <SelectValue placeholder="檢視" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none" data-testid="saved-view-none">全部</SelectItem>
            {SAVED_VIEW_IDS.map((id) => (
              <SelectItem key={id} value={id} data-testid={`saved-view-${id}`}>
                {SAVED_VIEW_LABELS[id]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {showStatusFilter && (
        <Select
          value={filter.statusFilter[0] || "all"}
          onValueChange={(v) => setStatusFilter(v === "all" ? [] : [v])}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部狀態</SelectItem>
            {Object.entries(PRODUCT_STATUS).map(([k, label]) => (
              <SelectItem key={k} value={k}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {showMinSpend && (
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">最低花費</Label>
          <Input
            type="number"
            min={0}
            step={100}
            value={filter.minSpend || ""}
            onChange={(e) => setMinSpend(Number(e.target.value) || 0)}
            placeholder="0"
            className="w-24"
          />
        </div>
      )}

      {showSort && (
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">排序</Label>
          <Select
            value={filter.sortBy}
            onValueChange={(v) => setSort(v as SortKey)}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSort(filter.sortBy, !filter.sortDesc)}
            className="shrink-0"
          >
            {filter.sortDesc ? "↓" : "↑"}
          </Button>
        </div>
      )}

      <Button type="button" variant="ghost" size="sm" onClick={resetFilter} className="gap-1">
        <X className="w-3.5 h-3.5" />
        清除
      </Button>
    </div>
  );
}
