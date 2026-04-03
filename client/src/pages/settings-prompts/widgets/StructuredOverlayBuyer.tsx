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

export function StructuredOverlayBuyer({
  modeId,
  draftStructured,
  setDraftStructured,
}: Props) {
  return (
    <div className="grid gap-3 mb-4 p-3 rounded border bg-muted/30">
      <p className="text-xs font-medium text-muted-foreground">結構化設定（選填）</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="text-xs text-muted-foreground">預設展開區塊（頓號分隔）</label>
          <input
            className="mt-0.5 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            placeholder="例：rescue、scale_up"
            value={arrayToStr(
              draftStructured[modeId]?.defaultExpand as string[] | undefined
            )}
            onChange={(e) =>
              setDraftStructured((prev) => ({
                ...prev,
                [modeId]: {
                  ...(prev[modeId] ?? {}),
                  defaultExpand: parseArrayStr(e.target.value),
                },
              }))
            }
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">排序偏好（頓號分隔）</label>
          <input
            className="mt-0.5 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            placeholder="例：ROAS、CVR、花費"
            value={arrayToStr(
              draftStructured[modeId]?.sortPreference as string[] | undefined
            )}
            onChange={(e) =>
              setDraftStructured((prev) => ({
                ...prev,
                [modeId]: {
                  ...(prev[modeId] ?? {}),
                  sortPreference: parseArrayStr(e.target.value),
                },
              }))
            }
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">優先層級</label>
          <Select
            value={(draftStructured[modeId]?.priorityLevel as string) ?? ""}
            onValueChange={(v) =>
              setDraftStructured((prev) => ({
                ...prev,
                [modeId]: { ...(prev[modeId] ?? {}), priorityLevel: v },
              }))
            }
          >
            <SelectTrigger className="mt-0.5">
              <SelectValue placeholder="選一個" />
            </SelectTrigger>
            <SelectContent>
              {["campaign", "product", "creative"].map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">whyNotMore 呈現</label>
          <Select
            value={(draftStructured[modeId]?.whyNotMoreStyle as string) ?? ""}
            onValueChange={(v) =>
              setDraftStructured((prev) => ({
                ...prev,
                [modeId]: { ...(prev[modeId] ?? {}), whyNotMoreStyle: v },
              }))
            }
          >
            <SelectTrigger className="mt-0.5">
              <SelectValue placeholder="選一個" />
            </SelectTrigger>
            <SelectContent>
              {["one_line", "paragraph", "with_suggestion"].map((o) => (
                <SelectItem key={o} value={o}>
                  {o === "one_line"
                    ? "簡短一句"
                    : o === "paragraph"
                      ? "獨立段"
                      : "與建議動作合併"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
