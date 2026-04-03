import { Filter, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function HistoryFiltersBar({
  typeFilter,
  onTypeFilter,
  searchQuery,
  onSearchQuery,
}: {
  typeFilter: string;
  onTypeFilter: (v: string) => void;
  searchQuery: string;
  onSearchQuery: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Select value={typeFilter} onValueChange={onTypeFilter}>
        <SelectTrigger className="w-[160px]" data-testid="select-type-filter">
          <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
          <SelectValue placeholder="全部類型" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部類型</SelectItem>
          <SelectItem value="creative">素材審判</SelectItem>
          <SelectItem value="landing_page">銷售頁審判</SelectItem>
          <SelectItem value="fb_ads">FB/Meta 廣告審判</SelectItem>
          <SelectItem value="ga4_funnel">GA4 漏斗審判</SelectItem>
        </SelectContent>
      </Select>
      <div className="relative w-56">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="搜尋紀錄..."
          value={searchQuery}
          onChange={(e) => onSearchQuery(e.target.value)}
          className="pl-9"
          data-testid="input-search-history"
        />
      </div>
    </div>
  );
}
