/**
 * 通用：半自動 execution 核准（dry-run 已記錄，此處人工勾選後 apply）
 */
import { useState, useId } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import type { ExecGateState } from "@/lib/execution-client";

export type ExecutionGateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gate: ExecGateState | null;
  onConfirm: () => Promise<void>;
  confirming: boolean;
  error: string | null;
  /** 預設：執行前確認（半自動） */
  title?: string;
  intro: string;
  checkboxLabel: string;
};

export function ExecutionGateDialog({
  open,
  onOpenChange,
  gate,
  onConfirm,
  confirming,
  error,
  title = "執行前確認（半自動）",
  intro,
  checkboxLabel,
}: ExecutionGateDialogProps) {
  const [checked, setChecked] = useState(false);
  const id = useId();
  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!confirming) {
          if (!o) setChecked(false);
          onOpenChange(o);
        }
      }}
    >
      <AlertDialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left text-sm text-muted-foreground">
              <p>{intro}</p>
              {gate && (
                <>
                  <pre className="text-xs bg-muted/50 p-2 rounded whitespace-pre-wrap break-all max-h-32 overflow-auto">
                    {gate.summary}
                  </pre>
                  <ul className="list-decimal pl-4 space-y-1 text-xs">
                    {(Array.isArray(gate.steps) ? gate.steps : []).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </>
              )}
              {error && (
                <p className="text-destructive text-sm font-medium">{error}</p>
              )}
              <div className="flex items-start gap-2 pt-2">
                <Checkbox
                  id={id}
                  checked={checked}
                  onCheckedChange={(v) => setChecked(v === true)}
                  disabled={confirming}
                />
                <Label htmlFor={id} className="text-sm font-normal leading-tight cursor-pointer">
                  {checkboxLabel}
                </Label>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={confirming}>取消</AlertDialogCancel>
          <AlertDialogAction
            disabled={!checked || confirming || !gate}
            onClick={(e) => {
              e.preventDefault();
              void onConfirm();
            }}
            className="gap-2"
          >
            {confirming && <Loader2 className="h-4 w-4 animate-spin" />}
            核准並繼續
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
