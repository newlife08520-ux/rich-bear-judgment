/**
 * 投放草稿：半自動核准對話框
 */
import { ExecutionGateDialog } from "@/components/ExecutionGateDialog";
import type { ExecGateState } from "@/lib/execution-client";

type GateMode = "form" | "batch" | "meta";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gate: ExecGateState | null;
  onConfirm: () => Promise<void>;
  confirming: boolean;
  error: string | null;
  /** 預設草稿／批次；meta 時文案標示將呼叫 Graph（受環境旗標與權杖約束） */
  gateMode?: GateMode;
};

const COPY: Record<
  GateMode,
  { intro: string; checkboxLabel: string }
> = {
  form: {
    intro:
      "系統已記錄本次操作的 dry-run。請閱讀下方預覽後勾選確認；按下「核准並繼續」將寫入 apply 稽核並建立／更新投放草稿（僅 DB，不對外呼叫 Meta Graph）。",
    checkboxLabel: "我已閱讀預覽，確認要建立／更新投放草稿並接受稽核紀錄",
  },
  batch: {
    intro:
      "系統已記錄批次建立草稿的 dry-run。核准後將寫入稽核並建立多筆投放草稿（僅 DB，不對外呼叫 Meta Graph）。",
    checkboxLabel: "我已閱讀預覽，確認批次建立草稿並接受稽核紀錄",
  },
  meta: {
    intro:
      "系統已記錄「投放草稿 → Meta」的 dry-run。核准並繼續後，將在允許寫入與 Stage1 旗標開啟時，對 Meta Graph 建立 PAUSED Campaign／AdSet／Creative／Ad；失敗時會記錄於稽核並盡力不留下殘骸。",
    checkboxLabel: "我已閱讀預覽，確認要套用至 Meta（或記錄失敗原因）並接受稽核紀錄",
  },
};

export function PublishExecutionGateDialog(props: Props) {
  const mode = props.gateMode ?? "form";
  const c = COPY[mode];
  return (
    <ExecutionGateDialog
      {...props}
      intro={c.intro}
      checkboxLabel={c.checkboxLabel}
    />
  );
}
