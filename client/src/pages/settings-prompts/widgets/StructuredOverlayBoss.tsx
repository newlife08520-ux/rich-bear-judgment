import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { arrayToStr, parseArrayStr } from "../prompts-constants";

type Props = {
  modeId: string;
  draftStructured: Record<string, Record<string, unknown>>;
  setDraftStructured: React.Dispatch<
    React.SetStateAction<Record<string, Record<string, unknown>>>
  >;
};

export function StructuredOverlayBoss({
  modeId,
  draftStructured,
  setDraftStructured,
}: Props) {
  return (
    <div className="grid gap-3 mb-4 p-3 rounded border bg-muted/30">
      <p className="text-xs font-medium text-muted-foreground">結構化設定（選填）</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="text-xs text-muted-foreground">摘要優先順序（頓號分隔）</label>
          <input
            className="mt-0.5 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            placeholder="例：風險、金額、建議動作、結論"
            value={arrayToStr(
              draftStructured[modeId]?.summaryOrder as string[] | undefined
            )}
            onChange={(e) =>
              setDraftStructured((prev) => ({
                ...prev,
                [modeId]: {
                  ...(prev[modeId] ?? {}),
                  summaryOrder: parseArrayStr(e.target.value),
                },
              }))
            }
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">摘要長度</label>
          <Select
            value={(draftStructured[modeId]?.summaryLength as string) ?? ""}
            onValueChange={(v) =>
              setDraftStructured((prev) => ({
                ...prev,
                [modeId]: { ...(prev[modeId] ?? {}), summaryLength: v },
              }))
            }
          >
            <SelectTrigger className="mt-0.5">
              <SelectValue placeholder="選一個" />
            </SelectTrigger>
            <SelectContent>
              {["short", "medium", "full"].map((o) => (
                <SelectItem key={o} value={o}>
                  {o === "short"
                    ? "簡短（1–3 行）"
                    : o === "medium"
                      ? "中等"
                      : "完整"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">先顯示風險</label>
          <Select
            value={
              draftStructured[modeId]?.showRiskFirst === true
                ? "yes"
                : draftStructured[modeId]?.showRiskFirst === false
                  ? "no"
                  : ""
            }
            onValueChange={(v) =>
              setDraftStructured((prev) => ({
                ...prev,
                [modeId]: {
                  ...(prev[modeId] ?? {}),
                  showRiskFirst: v === "yes",
                },
              }))
            }
          >
            <SelectTrigger className="mt-0.5">
              <SelectValue placeholder="選一個" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">是</SelectItem>
              <SelectItem value="no">否</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">建議動作出現位置</label>
          <Select
            value={(draftStructured[modeId]?.suggestionPosition as string) ?? ""}
            onValueChange={(v) =>
              setDraftStructured((prev) => ({
                ...prev,
                [modeId]: { ...(prev[modeId] ?? {}), suggestionPosition: v },
              }))
            }
          >
            <SelectTrigger className="mt-0.5">
              <SelectValue placeholder="選一個" />
            </SelectTrigger>
            <SelectContent>
              {["first_paragraph", "with_conclusion", "separate_block"].map(
                (o) => (
                  <SelectItem key={o} value={o}>
                    {o === "first_paragraph"
                      ? "第一段"
                      : o === "with_conclusion"
                        ? "與結論並列"
                        : "獨立區塊"}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
