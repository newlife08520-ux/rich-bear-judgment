/** Analysis batch 版本與 validity 常數（自 schema.ts 拆出，Batch 12.2 schema-split-a） */

export const BATCH_COMPUTATION_VERSION = "1";

export const BATCH_VALIDITY_VALID = "valid";
export const BATCH_VALIDITY_LEGACY = "legacy";
export const BATCH_VALIDITY_INSUFFICIENT = "insufficient";
export type BatchValidity = typeof BATCH_VALIDITY_VALID | typeof BATCH_VALIDITY_LEGACY | typeof BATCH_VALIDITY_INSUFFICIENT;
