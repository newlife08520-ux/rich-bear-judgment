import { motion } from "framer-motion";
import { History, Clock, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { JudgmentRecord } from "@shared/schema";
import {
  judgmentTypeLabels,
  recommendationLabels,
  recommendationColors,
} from "@shared/schema";
import { OpportunityScoreBadge } from "@/components/shared/score-badge";
import { RecommendationLevelBadge } from "@/components/shared/recommendation-badge";
import { HistoryScoreBadge } from "./HistoryScoreBadge";
import { historyTypeIcons, historyTypeColors, historyTypeIconBg } from "../history-types";
import { formatHistoryDate } from "../history-formatters";

export function HistoryReportsTab({
  isLoading,
  filteredRecords,
  searchQuery,
  typeFilter,
  loadingId,
  onViewReport,
}: {
  isLoading: boolean;
  filteredRecords: JudgmentRecord[];
  searchQuery: string;
  typeFilter: string;
  loadingId: string | null;
  onViewReport: (id: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3 max-w-3xl mx-auto">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="w-10 h-6 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  if (!filteredRecords.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <History className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm">
          {searchQuery || typeFilter !== "all" ? "找不到符合的紀錄" : "尚無審判紀錄"}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3 max-w-3xl mx-auto">
      {filteredRecords.map((record, i) => {
        const TypeIcon = historyTypeIcons[record.type];
        return (
          <motion.div
            key={record.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.25 }}
          >
            <Card className="hover-elevate" data-testid={`card-history-${record.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${historyTypeIconBg[record.type]}`}
                  >
                    <TypeIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] ${historyTypeColors[record.type]}`}>
                        {judgmentTypeLabels[record.type]}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${recommendationColors[record.recommendation]}`}
                      >
                        {recommendationLabels[record.recommendation]}
                      </Badge>
                      <RecommendationLevelBadge level={record.recommendationLevel} />
                      <OpportunityScoreBadge score={record.opportunityScore} />
                    </div>
                    <p
                      className="text-sm text-muted-foreground line-clamp-1 mb-1"
                      data-testid={`text-verdict-${record.id}`}
                    >
                      {record.verdict}
                    </p>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {formatHistoryDate(record.createdAt)}
                      </span>
                      {record.version > 1 && (
                        <Badge variant="secondary" className="text-[10px]">
                          v{record.version}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <HistoryScoreBadge score={record.score} grade={record.grade} />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onViewReport(record.id)}
                      disabled={loadingId === record.id}
                      data-testid={`button-view-${record.id}`}
                    >
                      {loadingId === record.id ? (
                        <span className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
