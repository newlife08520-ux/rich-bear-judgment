import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
export function ProductCreateTaskDialog({
  open,
  onOpenChange,
  taskTitle,
  setTaskTitle,
  taskAction,
  setTaskAction,
  taskReason,
  setTaskReason,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle: string;
  setTaskTitle: (v: string) => void;
  taskAction: string;
  setTaskAction: (v: string) => void;
  taskReason: string;
  setTaskReason: (v: string) => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>一鍵生成任務</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>標題</Label>
            <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="任務標題" />
          </div>
          <div>
            <Label>建議動作</Label>
            <Input value={taskAction} onChange={(e) => setTaskAction(e.target.value)} placeholder="動作" />
          </div>
          <div>
            <Label>理由</Label>
            <Textarea value={taskReason} onChange={(e) => setTaskReason(e.target.value)} placeholder="理由" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!taskTitle.trim() || !taskAction.trim() || !taskReason.trim() || pending}
          >
            {pending ? "建立中…" : "建立任務"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
