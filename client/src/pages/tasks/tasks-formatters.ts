import type { WorkbenchTask } from "@shared/workbench-types";
import { TASK_SOURCE_LABELS, TASK_PRIORITY_LABELS } from "@shared/workbench-types";

export function formatTodayExecutionList(
  tasks: WorkbenchTask[],
  employees: { id: string; name: string }[]
): string {
  const empMap = new Map(employees.map((e) => [e.id, e.name]));
  const dateStr = new Date().toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" });
  const active = tasks.filter((t) => ["unassigned", "assigned", "in_progress"].includes(t.status));
  const lines = ["【今日執行清單】 " + dateStr, ""];
  for (const t of active) {
    const who = t.assigneeId ? empMap.get(t.assigneeId) || t.assigneeId : "未指派";
    lines.push(`• ${t.title} － ${t.action} （負責：${who}）`);
  }
  if (active.length === 0) lines.push("（目前無待執行任務）");
  return lines.join("\n");
}

export const TASK_SOURCE_OPTIONS = ["審判官", "素材生命週期", "汰換建議", "手動"] as const;
export const PRIORITY_OPTIONS = ["high", "medium", "low"] as const;

export function formatDueDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit", year: "numeric" });
}

export function getDueDateState(iso: string | undefined | null): "overdue" | "today" | "within3" | null {
  if (!iso) return null;
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays <= 3) return "within3";
  return null;
}

export function getHighlightTaskId(loc: string): string | null {
  const q = loc.includes("?") ? loc.slice(loc.indexOf("?") + 1) : "";
  const params = new URLSearchParams(q);
  return params.get("highlight")?.trim() || null;
}

export { TASK_SOURCE_LABELS, TASK_PRIORITY_LABELS };
