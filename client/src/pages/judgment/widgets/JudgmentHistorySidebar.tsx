import { Paperclip } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ReviewSession } from "@shared/schema";
import { UI_MODE_LABELS, UI_MODE_TO_WORKFLOW, QUICK_PROMPTS } from "../judgment-types";
import type { UIMode } from "../judgment-types";
import type { Workflow } from "@shared/schema";

export function JudgmentHistorySidebar(props: {
  sessions: ReviewSession[];
  loadingSessions: boolean;
  historySearch: string;
  onHistorySearchChange: (v: string) => void;
  currentSessionId: string | null;
  onSelectSession: (s: ReviewSession) => void;
  uiMode: UIMode;
  onModeChange: (m: UIMode) => void;
  onQuickPrompt: (text: string, workflow?: Workflow) => void;
  onTriggerFileSelect?: () => void;
}) {
  const {
    sessions,
    loadingSessions,
    historySearch,
    onHistorySearchChange,
    currentSessionId,
    onSelectSession,
    uiMode,
    onModeChange,
    onQuickPrompt,
    onTriggerFileSelect,
  } = props;
  return (
    <aside className="w-64 border-r border-border bg-background shrink-0 flex flex-col min-h-0 no-print">
      <div className="p-2 border-b shrink-0">
        <Input
          type="search"
          placeholder="搜尋歷史對話…"
          value={historySearch}
          onChange={(e) => onHistorySearchChange(e.target.value)}
          className="h-9"
        />
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col">
          <ul className="p-2 space-y-0.5 shrink-0">
            {loadingSessions ? (
              <li className="py-4 text-center text-muted-foreground text-sm">載入中…</li>
            ) : sessions.length === 0 ? (
              <li className="py-4 text-center text-muted-foreground text-sm">尚無歷史對話</li>
            ) : (
              sessions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onSelectSession(s)}
                    className={
                      currentSessionId === s.id
                        ? "w-full text-left px-3 py-2 rounded-lg text-sm truncate block bg-primary text-primary-foreground"
                        : "w-full text-left px-3 py-2 rounded-lg text-sm truncate block hover:bg-muted"
                    }
                    data-testid={"session-" + s.id}
                  >
                    <span className="block truncate">{s.title || "未命名"}</span>
                    <span className="block text-xs opacity-80 mt-0.5">
                      {new Date(s.updatedAt).toLocaleDateString("zh-TW", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
          <div className="p-2 border-t border-border mt-auto space-y-2">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">常用審判模式</p>
              <div className="flex flex-wrap gap-1">
                {(Object.keys(UI_MODE_LABELS) as UIMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onModeChange(m)}
                    className={
                      uiMode === m
                        ? "text-xs px-2 py-1 rounded shrink-0 bg-primary text-primary-foreground"
                        : "text-xs px-2 py-1 rounded shrink-0 bg-muted hover:bg-muted/80"
                    }
                  >
                    {UI_MODE_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">最近使用模板</p>
              <div className="flex flex-col gap-0.5">
                {QUICK_PROMPTS.slice(0, 4).map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => onQuickPrompt(q.text, q.workflow)}
                    className="text-xs text-left px-2 py-1.5 rounded hover:bg-muted truncate"
                  >
                    {q.icon} {q.label}
                  </button>
                ))}
              </div>
            </div>
            {onTriggerFileSelect && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">快速上傳素材</p>
                <button
                  type="button"
                  onClick={onTriggerFileSelect}
                  className="text-xs w-full px-2 py-1.5 rounded bg-muted hover:bg-muted/80 flex items-center gap-1"
                >
                  <Paperclip className="w-3 h-3" /> 選擇檔案
                </button>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">快速入口</p>
              <div className="flex flex-wrap gap-1">
                <a href="/products" className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80">商品中心</a>
                <a href="/" className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80">今日決策中心</a>
                <a href="/assets" className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80">素材生命週期</a>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
