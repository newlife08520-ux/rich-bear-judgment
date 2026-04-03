import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TASK_STATUS } from "@/lib/decision-workbench";
import {
  TASK_SOURCE_OPTIONS,
  PRIORITY_OPTIONS,
  TASK_SOURCE_LABELS,
  TASK_PRIORITY_LABELS,
} from "../tasks-formatters";
import type { TasksWorkbench } from "../useTasksWorkbench";
import { ExecutionGateDialog } from "@/components/ExecutionGateDialog";

export function TasksDialogs({ wb }: { wb: TasksWorkbench }) {
  const {
    createOpen,
    setCreateOpen,
    batchStatusOpen,
    setBatchStatusOpen,
    batchAssignOpen,
    setBatchAssignOpen,
    selectedCount,
    selectedIds,
    employees,
    newTitle,
    setNewTitle,
    newAction,
    setNewAction,
    newReason,
    setNewReason,
    newProductName,
    setNewProductName,
    newTaskSource,
    setNewTaskSource,
    newPriority,
    setNewPriority,
    newDueDate,
    setNewDueDate,
    newImpactAmount,
    setNewImpactAmount,
    newTaskType,
    setNewTaskType,
    requestTaskCreate,
    startBatchExecution,
    confirmTaskExecution,
    execGateOpen,
    onExecGateOpenChange,
    execGate,
    execConfirmError,
    execBusy,
    execGateConfirming,
  } = wb;

  return (
    <>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>建立任務</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>標題</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="例：商品 A 停損" />
            </div>
            <div>
              <Label>任務來源</Label>
              <Select value={newTaskSource} onValueChange={setNewTaskSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_SOURCE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {TASK_SOURCE_LABELS[s] ?? s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>優先級</Label>
                <Select value={newPriority} onValueChange={setNewPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {TASK_PRIORITY_LABELS[p] ?? p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>截止日</Label>
                <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>商品名稱（選填）</Label>
              <Input
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                placeholder="對應商品"
              />
            </div>
            <div>
              <Label>建議動作</Label>
              <Input value={newAction} onChange={(e) => setNewAction(e.target.value)} placeholder="例：立即停損" />
            </div>
            <div>
              <Label>理由</Label>
              <Textarea
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="觸發規則或證據"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>影響金額（選填）</Label>
                <Input
                  value={newImpactAmount}
                  onChange={(e) => setNewImpactAmount(e.target.value)}
                  placeholder="例：約 5 萬"
                />
              </div>
              <div>
                <Label>任務類型（選填）</Label>
                <Input value={newTaskType} onChange={(e) => setNewTaskType(e.target.value)} placeholder="例：停損" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => void requestTaskCreate()}
              disabled={
                !newTitle.trim() ||
                !newAction.trim() ||
                !newReason.trim() ||
                execBusy ||
                execGateOpen
              }
            >
              {execGateConfirming
                ? "建立中…"
                : execBusy && !execGateOpen
                  ? "預覽中…"
                  : "建立"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={batchStatusOpen} onOpenChange={setBatchStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批次改狀態</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">已選 {selectedCount} 筆，請選擇新狀態：</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(TASK_STATUS).map(([k, label]) => (
              <Button
                key={k}
                variant="outline"
                size="sm"
                onClick={() => void startBatchExecution({ ids: [...selectedIds], status: k })}
                disabled={execBusy || execGateConfirming}
              >
                {label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={batchAssignOpen} onOpenChange={setBatchAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批次指派</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">已選 {selectedCount} 筆，請選擇負責人：</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void startBatchExecution({ ids: [...selectedIds], assigneeId: null })}
              disabled={execBusy || execGateConfirming}
            >
              未指派
            </Button>
            {employees.map((e) => (
              <Button
                key={e.id}
                variant="outline"
                size="sm"
                onClick={() => void startBatchExecution({ ids: [...selectedIds], assigneeId: e.id })}
                disabled={execBusy || execGateConfirming}
              >
                {e.name}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <ExecutionGateDialog
        open={execGateOpen}
        onOpenChange={onExecGateOpenChange}
        gate={execGate}
        onConfirm={async () => {
          await confirmTaskExecution();
        }}
        confirming={execGateConfirming}
        error={execConfirmError}
        intro="系統已記錄本次任務操作的 dry-run。勾選確認後將寫入 apply 稽核並建立或批次更新任務。"
        checkboxLabel="我已閱讀預覽，確認要執行此任務操作並接受稽核紀錄"
      />
    </>
  );
}
