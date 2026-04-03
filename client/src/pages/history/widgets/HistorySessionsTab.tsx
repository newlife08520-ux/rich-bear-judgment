import { Link } from "wouter";
import { MessageSquare, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReviewSession } from "@shared/schema";
import { formatHistoryDate } from "../history-formatters";

export function HistorySessionsTab({
  loadingSessions,
  reviewSessions,
}: {
  loadingSessions: boolean;
  reviewSessions: ReviewSession[];
}) {
  if (loadingSessions) {
    return (
      <div className="space-y-3 max-w-3xl mx-auto">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-5 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  if (!reviewSessions.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm">尚無對話紀錄</p>
        <p className="text-xs mt-1">在「內容判讀」開始對話後，這裡會列出所有對話串</p>
      </div>
    );
  }
  return (
    <div className="space-y-3 max-w-3xl mx-auto">
      {reviewSessions.map((s) => (
        <Link key={s.id} href={`/judgment?sessionId=${encodeURIComponent(s.id)}`}>
          <Card className="hover-elevate cursor-pointer" data-testid={`card-session-${s.id}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1">{s.title || "未命名判讀"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {s.messages.length} 則訊息 · {formatHistoryDate(s.updatedAt)}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
