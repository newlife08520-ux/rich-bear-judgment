/**
 * P1 工作台：Owner / 任務 / 審計 持久化型別
 */

export type TaskStatusKey = "unassigned" | "assigned" | "in_progress" | "done" | "pending_confirm";

export interface WorkbenchProductOwners {
  /** productName -> 三種 owner id（對應員工/使用者 id） */
  [productName: string]: {
    productOwnerId: string;
    mediaOwnerId: string;
    creativeOwnerId: string;
    taskStatus: TaskStatusKey;
  };
}

/** 任務來源 */
export type TaskSourceKey = "審判官" | "素材生命週期" | "汰換建議" | "手動";

export const TASK_SOURCE_LABELS: Record<string, string> = {
  "審判官": "審判官",
  "素材生命週期": "素材生命週期",
  "汰換建議": "汰換建議",
  "手動": "手動",
};

/** 優先級 */
export type TaskPriorityKey = "high" | "medium" | "low";

export const TASK_PRIORITY_LABELS: Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

export interface WorkbenchTask {
  id: string;
  productName?: string;
  creativeId?: string;
  /** 投放草稿 ID，深連結至 /publish?draftId= */
  draftId?: string | null;
  /** 審判官對話串 ID，用於深連結回該判讀 */
  reviewSessionId?: string | null;
  /** 素材描述（商品/素材維度） */
  title: string;
  /** 建議動作 */
  action: string;
  /** 理由 */
  reason: string;
  assigneeId: string | null;
  status: TaskStatusKey;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  notes: string;
  taskSource?: TaskSourceKey | string | null;
  priority?: TaskPriorityKey | string | null;
  dueDate?: string | null;
  impactAmount?: string | null;
  taskType?: string | null;
}

export interface WorkbenchAuditEntry {
  id: string;
  userId: string;
  entityType: "product_owner" | "task" | "mapping";
  entityId: string;
  action: "create" | "update" | "delete";
  oldValue: unknown;
  newValue: unknown;
  at: string;
}
