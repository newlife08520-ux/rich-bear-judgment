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

export function StructuredOverlayCreative({
  modeId,
  draftStructured,
  setDraftStructured,
}: Props) {
  return (
    <div className="grid gap-3 mb-4 p-3 rounded border bg-muted/30">
      <p className="text-xs font-medium text-muted-foreground">結構化設定（選填）</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="text-xs text-muted-foreground">先看維度（頓號分隔）</label>
          <input
            className="mt-0.5 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            placeholder="例：鉤子、前3秒、首圖"
            value={arrayToStr(
              draftStructured[modeId]?.lookAtFirst as string[] | undefined
            )}
            onChange={(e) =>
              setDraftStructured((prev) => ({
                ...prev,
                [modeId]: {
                  ...(prev[modeId] ?? {}),
                  lookAtFirst: parseArrayStr(e.target.value),
                },
              }))
            }
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">產出形式</label>
          <Select
            value={(draftStructured[modeId]?.outputForm as string) ?? ""}
            onValueChange={(v) =>
              setDraftStructured((prev) => ({
                ...prev,
                [modeId]: { ...(prev[modeId] ?? {}), outputForm: v },
              }))
            }
          >
            <SelectTrigger className="mt-0.5">
              <SelectValue placeholder="選一個" />
            </SelectTrigger>
            <SelectContent>
              {["three_directions", "one_full", "parallel"].map((o) => (
                <SelectItem key={o} value={o}>
                  {o === "three_directions"
                    ? "先給 3 方向"
                    : o === "one_full"
                      ? "1 完整版"
                      : "並行"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">輸出偏向</label>
          <Select
            value={(draftStructured[modeId]?.outputStyle as string) ?? ""}
            onValueChange={(v) =>
              setDraftStructured((prev) => ({
                ...prev,
                [modeId]: { ...(prev[modeId] ?? {}), outputStyle: v },
              }))
            }
          >
            <SelectTrigger className="mt-0.5">
              <SelectValue placeholder="選一個" />
            </SelectTrigger>
            <SelectContent>
              {["create", "revise"].map((o) => (
                <SelectItem key={o} value={o}>
                  {o === "create"
                    ? "創作（直接給文案腳本）"
                    : "改稿建議（先點問題再給改法）"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
