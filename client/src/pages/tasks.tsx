/**
 * Phase 3A 行動紀錄工作台 — 來源、優先級、截止日、影響金額、類型、只看我負責、批次操作
 * 支援 ?highlight=<taskId> 建立後高亮並滾動到該筆；任務列深連結至商品／素材／審判／投放。
 */
import { useTasksWorkbench } from "./tasks/useTasksWorkbench";
import { TasksPageView } from "./tasks/TasksPageView";

export default function TasksPage() {
  const wb = useTasksWorkbench();
  return <TasksPageView wb={wb} />;
}
