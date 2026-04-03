import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronRight, ChevronLeft } from "lucide-react";

export function TeamTransferList({
  leftItems,
  rightItems,
  rightSet,
  onMoveToRight,
  onMoveToLeft,
  getLabel,
  leftTitle,
  rightTitle,
  search,
  onSearchChange,
}: {
  leftItems: string[];
  rightItems: string[];
  rightSet: Set<string>;
  onMoveToRight: (ids: string[]) => void;
  onMoveToLeft: (ids: string[]) => void;
  getLabel: (id: string) => string;
  leftTitle: string;
  rightTitle: string;
  search: string;
  onSearchChange: (v: string) => void;
}) {
  const [leftSel, setLeftSel] = useState<Set<string>>(new Set());
  const [rightSel, setRightSel] = useState<Set<string>>(new Set());
  const [showOnlyRight, setShowOnlyRight] = useState(false);
  const filteredLeft = search.trim()
    ? leftItems.filter((id) => getLabel(id).toLowerCase().includes(search.trim().toLowerCase()))
    : leftItems;
  const filteredRight = search.trim()
    ? rightItems.filter((id) => getLabel(id).toLowerCase().includes(search.trim().toLowerCase()))
    : rightItems;
  const displayRight = showOnlyRight ? filteredRight.filter((id) => rightSel.has(id)) : filteredRight;
  const hasSearch = search.trim().length > 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="🔍 搜尋" value={search} onChange={(e) => onSearchChange(e.target.value)} className="max-w-xs" />
        {hasSearch && (
          <span className="text-xs text-muted-foreground">搜尋結果：左 {filteredLeft.length} 筆、右 {filteredRight.length} 筆</span>
        )}
      </div>
      <div className="flex gap-2 items-stretch">
        <div className="flex-1 rounded-md border flex flex-col min-h-[200px]">
          <div className="px-2 py-1 border-b flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">{leftTitle}（{filteredLeft.length}）</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => { setLeftSel(new Set(filteredLeft)); }}
              disabled={filteredLeft.length === 0}
            >
              全選目前篩選
            </Button>
          </div>
          <ul className="flex-1 overflow-y-auto p-1 space-y-0.5">
            {filteredLeft.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setLeftSel((s) => (s.has(id) ? (() => { const n = new Set(s); n.delete(id); return n; })() : new Set(s).add(id)))}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm truncate block ${leftSel.has(id) ? "bg-primary/20" : "hover:bg-muted"}`}
                >
                  {getLabel(id)}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col justify-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => { const ids = [...leftSel]; onMoveToRight(ids); setLeftSel(new Set()); setRightSel(new Set()); }}
            disabled={leftSel.size === 0}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => { const ids = [...rightSel]; onMoveToLeft(ids); setLeftSel(new Set()); setRightSel(new Set()); }}
            disabled={rightSel.size === 0}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 rounded-md border flex flex-col min-h-[200px]">
          <div className="px-2 py-1 border-b flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">{rightTitle}（{displayRight.length}）</span>
            <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={showOnlyRight} onChange={(e) => setShowOnlyRight(e.target.checked)} className="rounded" />
              只看已選
            </label>
          </div>
          <ul className="flex-1 overflow-y-auto p-1 space-y-0.5">
            {displayRight.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setRightSel((s) => (s.has(id) ? (() => { const n = new Set(s); n.delete(id); return n; })() : new Set(s).add(id)))}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm truncate block ${rightSel.has(id) ? "bg-primary/20" : "hover:bg-muted"}`}
                >
                  {getLabel(id)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
