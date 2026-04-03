/**
 * Execution handler 合約：validate / buildPreview / apply
 */
export type ExecutionContext = { userId: string };

export type PreviewResult = {
  summary: string;
  steps: string[];
  meta?: Record<string, unknown>;
};

export type ApplyResult = {
  resultSummary: string;
  affectedIds?: string[];
  affectedCount?: number;
  resultMeta?: Record<string, unknown>;
};

export interface IExecutionHandler {
  actionType: string;
  validate(payload: unknown): asserts payload is Record<string, unknown>;
  buildPreview(payload: Record<string, unknown>, ctx: ExecutionContext): PreviewResult;
  apply(payload: Record<string, unknown>, ctx: ExecutionContext): Promise<ApplyResult>;
}
