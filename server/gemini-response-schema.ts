/**
 * Phase 4：Gemini 回應的 schema-based runtime validation（Zod）。
 * 解析後以 schema 驗證，驗證失敗則回 fallback，不 crash。
 */
import { z } from "zod";

const ReportGradeSchema = z.enum(["S", "A", "B", "C", "D", "F"]);
const RecommendationSchema = z.enum(["launch", "scale", "hold", "stop", "fix_first"]);

const ReportIssueSchema = z.object({
  title: z.string(),
  severity: z.enum(["critical", "high", "medium"]),
  description: z.string(),
}).passthrough();
const PriorityActionSchema = z.object({
  order: z.number(),
  action: z.string(),
  reason: z.string().optional(),
  impact: z.enum(["high", "medium", "low"]).optional(),
  opportunityScore: z.number().optional(),
}).passthrough();

export const ReportSummarySchema = z.object({
  score: z.number().min(0).max(100),
  grade: ReportGradeSchema,
  verdict: z.string(),
  topIssues: z.array(ReportIssueSchema).default([]),
  priorityActions: z.array(PriorityActionSchema).default([]),
  recommendation: RecommendationSchema,
  recommendationNote: z.string().default(""),
  opportunityScore: z.number().optional(),
});

const DiagnosisDimensionSchema = z.object({
  score: z.number(),
  analysis: z.string(),
});

const DetailBaseSchema = z.object({
  reasoning: z.string(),
  executionSuggestions: z.array(z.string()),
});

export const JudgmentResponseSchema = z.object({
  summary: ReportSummarySchema,
  detail: DetailBaseSchema.and(z.record(z.unknown())),
});

export const ContentJudgmentResultSchema = z.object({
  oneLineVerdict: z.string(),
  keyPoints: z.array(z.string()),
  fullAnalysis: z.array(z.object({ title: z.string(), content: z.string() })),
  nextActions: z.array(z.object({ label: z.string(), description: z.string() })),
  followUpSuggestions: z.array(z.string()),
});

/** 審判官結構化輸出（與 parseStructuredJudgmentFromResponse / content-judgment chat 共用） */
export const StructuredJudgmentProblemTypeSchema = z.enum(["創意", "商品頁", "投放", "漏斗"]);
export const StructuredJudgmentConfidenceSchema = z.enum(["高", "中", "低"]);
export const StructuredJudgmentSchema = z.object({
  summary: z.string().optional(),
  nextAction: z.string().optional(),
  problemType: StructuredJudgmentProblemTypeSchema.optional(),
  recommendTask: z.boolean().optional(),
  confidence: StructuredJudgmentConfidenceSchema.optional(),
  reasons: z.string().optional(),
  suggestions: z.string().optional(),
  evidence: z.string().optional(),
  impactAmount: z.string().optional(),
  score: z.number().min(0).max(100).optional(),
  blockingReasons: z.array(z.string()).optional(),
  pendingItems: z.array(z.string()).optional(),
});

export type JudgmentResponseValidated = z.infer<typeof JudgmentResponseSchema>;
export type ContentJudgmentResultValidated = z.infer<typeof ContentJudgmentResultSchema>;

/** 素材版本送審：合併 ContentJudgment 與 StructuredJudgment（單一 JSON 輸出） */
export const CreativeAssetJudgmentPayloadSchema = ContentJudgmentResultSchema.extend({
  summary: z.string().optional(),
  nextAction: z.string().optional(),
  problemType: StructuredJudgmentProblemTypeSchema.optional(),
  recommendTask: z.boolean().optional(),
  confidence: StructuredJudgmentConfidenceSchema.optional(),
  reasons: z.string().optional(),
  suggestions: z.string().optional(),
  evidence: z.string().optional(),
  impactAmount: z.string().optional(),
  score: z.number().min(0).max(100).optional(),
  blockingReasons: z.array(z.string()).optional(),
  pendingItems: z.array(z.string()).optional(),
});

export type CreativeAssetJudgmentPayload = z.infer<typeof CreativeAssetJudgmentPayloadSchema>;
