import { z } from "zod";

export const userRoles = ["admin", "manager", "user"] as const;
export type UserRole = (typeof userRoles)[number];

/** 角色驅動行動工作區：依視角區分（與 userRoles 可並存） */
export const workRoles = ["ADMIN", "MEDIA_BUYER", "MARKETER", "DESIGNER"] as const;
export type WorkRole = (typeof workRoles)[number];

export const workRoleLabels: Record<WorkRole, string> = {
  ADMIN: "總監（管理員）",
  MEDIA_BUYER: "廣告投手",
  MARKETER: "行銷企劃",
  DESIGNER: "設計美編",
};

export interface User {
  id: string;
  username: string;
  /** 明文密碼（僅 legacy；新帳號應為空並使用 passwordHash） */
  password: string;
  /** bcrypt 雜湊；優先以此驗證 */
  passwordHash?: string | null;
  role: UserRole;
  displayName: string;
  /** 角色驅動視角（選填，用於 Action Center） */
  workRole?: WorkRole;
  /** 負責商品名稱列表，與 Campaign 解析出的產品名對齊；空陣列表示 ADMIN 看全部 */
  assignedProductNames?: string[];
}

export type SafeUser = Omit<User, "password" | "passwordHash">;

export const loginSchema = z.object({
  username: z.string().min(1, "請輸入帳號"),
  password: z.string().min(1, "請輸入密碼"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type InsertUser = Omit<User, "id">;
