/**
 * 7.5：營運向狀態標籤（映射自既有 evaluateGoalAndPacing，不改閾值語意）。
 */
import type { GoalPacingEvaluation, GoalPacingInput } from "./goal-pacing-engine";

export type OperatorPacingState =
  | "underdelivering_but_acceptable"
  | "underdelivering_and_tight_goal"
  | "acceptable_hold"
  | "over_adjusted_today"
  | "in_observation_window"
  | "engine_default";

export function deriveOperatorPacingState(
  ev: GoalPacingEvaluation,
  input: GoalPacingInput
): OperatorPacingState {
  if (input.observationWindowUntil && new Date(input.observationWindowUntil).getTime() > Date.now()) {
    return "in_observation_window";
  }
  if ((input.todayAdjustCount ?? 0) >= 2) {
    return "over_adjusted_today";
  }
  if (ev.pacingLabel === "HOLD_STABLE" && ev.confidence !== "low" && input.roas >= 1.5) {
    return "acceptable_hold";
  }
  if (ev.pacingLabel === "UNDERSPENT_GOOD" && input.roas >= 1.8) {
    return "underdelivering_but_acceptable";
  }
  if (ev.pacingLabel === "UNDERSPENT_GOOD" && input.spendFullness != null && input.spendFullness < 0.5) {
    return "underdelivering_and_tight_goal";
  }
  return "engine_default";
}
