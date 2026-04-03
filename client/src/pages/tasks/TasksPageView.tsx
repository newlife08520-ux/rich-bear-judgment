import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ListTodo, Plus, Copy, User, AlertTriangle } from "lucide-react";
import { formatTodayExecutionList } from "./tasks-formatters";
import type { TasksWorkbench } from "./useTasksWorkbench";
import { TasksDataTable } from "./widgets/TasksDataTable";
import { TasksDialogs } from "./widgets/TasksDialogs";

export function TasksPageView({ wb }: { wb: TasksWorkbench }) {
  const {
    tasks,
    employees,
    toast,
    onlyMine,
    setOnlyMine,
    authUser,
    employee,
    tasksIsError,
    tasksError,
    selectedCount,
    setBatchStatusOpen,
    setBatchAssignOpen,
    setSelectedIds,
    setCreateOpen,
    highPriority,
    dueToday,
    highImpact,
    unassigned,
    inProgress,
    done,
  } = wb;

  return (
    <div className="flex flex-col min-h-full">
      <header className="flex flex-wrap items-center justify-between gap-3 p-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <h1 className="page-title flex items-center gap-2">
            <ListTodo className="w-5 h-5" />
            行動紀錄
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            title="複製為純文字，貼到 Slack 或 LINE 即可用"
            onClick={() => {
              const text = formatTodayExecutionList(tasks, employees);
              navigator.clipboard.writeText(text).then(
                () => toast({ title: "已複製今日執行清單（Slack/LINE 格式）", duration: 2000 }),
                () => toast({ title: "複製失敗", variant: "destructive" })
              );
            }}
          >
            <Copy className="w-4 h-4" />
            複製為今日執行清單
          </Button>
          <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1">
            <Plus className="w-4 h-4" />
            建立任務
          </Button>
        </div>
      </header>

      <div className="flex-1 p-4 md:p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-red-500/80 bg-card">
            <CardContent className="py-4 px-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">高優先</p>
              <p className="text-2xl font-bold mt-1">{highPriority.length}</p>
              <p className="text-xs text-muted-foreground mt-1">建議優先處理</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-500/80 bg-card">
            <CardContent className="py-4 px-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">今日到期</p>
              <p className="text-2xl font-bold mt-1">{dueToday.length}</p>
              <p className="text-xs text-muted-foreground mt-1">今天要完成</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500/80 bg-card">
            <CardContent className="py-4 px-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">高影響金額</p>
              <p className="text-2xl font-bold mt-1">{highImpact.length}</p>
              <p className="text-xs text-muted-foreground mt-1">有標註影響金額</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-primary/20">
          <CardContent className="py-3 px-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <span>
                  待分配／已指派 <strong>{unassigned.length}</strong>
                </span>
                <span>
                  進行中 <strong>{inProgress.length}</strong>
                </span>
                <span>
                  已完成／待確認 <strong>{done.length}</strong>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={onlyMine} onCheckedChange={(c) => setOnlyMine(!!c)} />
                  只看我負責
                </label>
                {onlyMine && (
                  <span className="text-xs text-muted-foreground">
                    目前以「{authUser?.username ?? authUser?.id ?? "登入者"}」(id: {authUser?.id ?? "—"}) 篩選
                    {authUser?.id && employee.id !== authUser.id && (
                      <span className="text-amber-600 ml-1">
                        · 注意：目前為模擬身份切換，篩選依登入帳號為準，與左側角色可能不同
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">依優先級與截止日安排，先處理高優先與即將到期任務。</p>
          </CardContent>
        </Card>

        {tasksIsError && tasksError && (
          <Card className="border-amber-500/50 bg-amber-50/80 dark:bg-amber-950/20">
            <CardContent className="py-4 px-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">任務資料暫不可用</p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">{tasksError.message}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  若為部署環境，請檢查 DB migration 是否已套用，或聯絡維運。
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedCount > 0 && (
          <Card className="bg-muted/50">
            <CardContent className="py-2 px-4 flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium">已選 {selectedCount} 筆</span>
              <Button size="sm" variant="outline" onClick={() => setBatchStatusOpen(true)}>
                批次改狀態
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => setBatchAssignOpen(true)}>
                <User className="w-3 h-3" /> 批次指派
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                取消選取
              </Button>
            </CardContent>
          </Card>
        )}

        <TasksDataTable wb={wb} />
      </div>

      <TasksDialogs wb={wb} />
    </div>
  );
}
