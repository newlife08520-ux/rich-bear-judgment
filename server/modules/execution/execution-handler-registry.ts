import type { IExecutionHandler } from "./execution-handler-types";
import { taskCreateHandler } from "./handlers/task-create-handler";
import { taskBatchPatchHandler } from "./handlers/task-batch-patch-handler";
import { taskCreateFromJudgmentHandler } from "./handlers/task-create-from-judgment-handler";
import { publishDraftCreateHandler } from "./handlers/publish-draft-create-handler";
import { publishDraftUpdateHandler } from "./handlers/publish-draft-update-handler";
import { publishDraftBatchCreateHandler } from "./handlers/publish-draft-batch-create-handler";
import { metaCampaignPauseHandler } from "./handlers/meta-campaign-pause-handler";
import { metaCampaignResumeHandler } from "./handlers/meta-campaign-resume-handler";
import { metaCampaignUpdateBudgetHandler } from "./handlers/meta-campaign-update-budget-handler";
import { metaPublishDraftExecuteHandler } from "./handlers/meta-publish-draft-execute-handler";

const HANDLERS: IExecutionHandler[] = [
  taskCreateHandler,
  taskBatchPatchHandler,
  taskCreateFromJudgmentHandler,
  publishDraftCreateHandler,
  publishDraftUpdateHandler,
  publishDraftBatchCreateHandler,
  metaCampaignPauseHandler,
  metaCampaignResumeHandler,
  metaCampaignUpdateBudgetHandler,
  metaPublishDraftExecuteHandler,
];

const BY_ACTION = new Map<string, IExecutionHandler>();
for (const h of HANDLERS) {
  BY_ACTION.set(h.actionType, h);
}

export function getHandler(actionType: string): IExecutionHandler | undefined {
  return BY_ACTION.get(actionType.trim());
}

export function allActionTypes(): string[] {
  return HANDLERS.map((h) => h.actionType);
}

export function hasHandler(actionType: string): boolean {
  return BY_ACTION.has(actionType.trim());
}
