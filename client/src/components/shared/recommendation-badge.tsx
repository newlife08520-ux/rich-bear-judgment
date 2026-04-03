import { Badge } from "@/components/ui/badge";
import { recommendationLevelLabels, recommendationLevelColors, type RecommendationLevel } from "@shared/schema";

export function RecommendationLevelBadge({ level }: { level: RecommendationLevel }) {
  return (
    <Badge
      variant="secondary"
      className={`${recommendationLevelColors[level]} border`}
      data-testid={`badge-rec-level-${level}`}
    >
      {recommendationLevelLabels[level]}
    </Badge>
  );
}
