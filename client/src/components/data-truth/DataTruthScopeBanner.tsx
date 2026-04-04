import {
  normalizeDashboardDataStatus,
  dataTruthStateLabelZh,
  dataTruthUserGuidanceZh,
} from "@shared/data-truth-state-machine";

export function DataTruthScopeBanner({ dataStatus }: { dataStatus: string | undefined | null }) {
  const normalized = normalizeDashboardDataStatus(dataStatus);
  if (!normalized || normalized === "has_data") return null;
  return (
    <div
      className="rounded-md border border-amber-500/40 bg-amber-50/80 dark:bg-amber-950/25 px-3 py-2 text-sm text-amber-950 dark:text-amber-50"
      data-testid="strip-data-truth-scope"
    >
      <p className="font-medium">{dataTruthStateLabelZh(normalized)}</p>
      <p className="text-xs text-amber-900/80 dark:text-amber-100/80 mt-0.5">
        {dataTruthUserGuidanceZh(normalized)}
      </p>
    </div>
  );
}
