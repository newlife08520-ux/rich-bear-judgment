import { Send, Paperclip, Loader2, X, FileText, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { workflowLabels } from "@shared/schema";
import type { Workflow } from "@shared/schema";
import { QUICK_PROMPTS, EMPTY_ENTRIES, ACCEPT_ATTACH } from "../judgment-types";
import type { PendingAttachment } from "../judgment-types";

export function JudgmentComposer({
  workflow,
  setWorkflow,
  inputText,
  setInputText,
  attachments,
  removeAttachment,
  addFiles,
  canSubmit,
  isSubmitting,
  submitError,
  onSend,
  onKeyDown,
  onQuickPrompt,
  textareaRef,
  fileInputRef,
  selectedSubtype,
}: {
  workflow: Workflow;
  setWorkflow: (w: Workflow) => void;
  inputText: string;
  setInputText: (v: string) => void;
  attachments: PendingAttachment[];
  removeAttachment: (id: string) => void;
  addFiles: (files: FileList | File[]) => void;
  canSubmit: boolean;
  isSubmitting: boolean;
  submitError: string | null;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onQuickPrompt: (text: string, w?: Workflow) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  selectedSubtype: string | null;
}) {
  const placeholder =
    selectedSubtype
      ? (EMPTY_ENTRIES.find((e) => e.id === selectedSubtype)?.placeholder ??
        "輸入行銷問題、貼網址，或上傳素材（圖片/影片/PDF）… (Enter 送出、Shift+Enter 換行)")
      : "輸入行銷問題、貼網址，或上傳素材（圖片/影片/PDF）… (Enter 送出、Shift+Enter 換行)";

  return (
    <div className="sticky bottom-0 bg-background/95 backdrop-blur-md border-t border-border p-4 no-print">
      <div className="max-w-6xl mx-auto flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground shrink-0">工作流：</span>
          {(Object.keys(workflowLabels) as Workflow[]).map((w) => (
            <Button
              key={w}
              type="button"
              variant={workflow === w ? "default" : "outline"}
              size="sm"
              className="shrink-0 rounded-full text-xs h-7"
              onClick={() => setWorkflow(w)}
              data-testid={`workflow-${w}`}
            >
              {workflowLabels[w]}
            </Button>
          ))}
          <Badge variant="secondary" className="text-[11px] shrink-0 rounded-md">
            目前：{workflowLabels[workflow]}
          </Badge>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {QUICK_PROMPTS.map((q) => (
            <Button
              key={q.id}
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 rounded-full text-xs gap-1"
              onClick={() => onQuickPrompt(q.text, q.workflow)}
              data-testid={`quick-prompt-${q.id}`}
            >
              <span>{q.icon}</span>
              {q.label}
            </Button>
          ))}
        </div>
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2 text-sm"
                data-testid={`attachment-${a.id}`}
              >
                {a.preview ? (
                  <img src={a.preview} alt="" className="w-10 h-10 object-cover rounded" />
                ) : (
                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                <span className="max-w-[120px] truncate">{a.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(a.id)}
                  className="p-0.5 rounded hover:bg-muted"
                  data-testid={`remove-attach-${a.id}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {submitError && (
          <div className="flex items-center gap-2 text-sm text-destructive" data-testid="alert-submit-error">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef as React.RefObject<HTMLTextAreaElement>}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            rows={1}
            className="min-h-[44px] max-h-[200px] resize-y"
            data-testid="textarea-chat-input"
            disabled={isSubmitting}
          />
          <input
            ref={fileInputRef as React.RefObject<HTMLInputElement>}
            type="file"
            accept={ACCEPT_ATTACH}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
            data-testid="input-file-attach"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            title="附加圖片、PDF 或影片"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSubmitting}
            data-testid="button-attach"
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            onClick={onSend}
            disabled={!canSubmit}
            className="shrink-0 gap-1.5"
            data-testid="button-send-judgment"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            送出
          </Button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          支援圖片、PDF、影片 (最高 200MB)；可貼網址，總監會參考頁面內容。判讀依「角色視角 Overlay」該視角已發布補充 ＋ 系統校準。
        </p>
      </div>
    </div>
  );
}
