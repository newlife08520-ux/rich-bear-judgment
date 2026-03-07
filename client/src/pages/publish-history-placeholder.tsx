import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListChecks } from "lucide-react";
import type { PublishLog } from "@shared/schema";

/**
 * 後端 GET /api/publish/logs 回傳順序為「舊到新」（append 順序）。
 * 前端改為「最新在前」顯示，方便查看最近紀錄。
 */
export default function PublishHistoryPage() {
  const { data: list = [], isLoading, isError } = useQuery<PublishLog[]>({
    queryKey: ["/api/publish/logs"],
  });

  const displayList = useMemo(() => {
    const copy = [...list];
    copy.reverse();
    return copy;
  }, [list]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("zh-TW", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="flex flex-col min-h-full">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger />
        <h1 className="font-semibold">投放紀錄</h1>
      </header>
      <div className="min-h-full p-4">
        <div className="page-container-reading max-w-4xl mx-auto">
          {isLoading && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                載入中...
              </CardContent>
            </Card>
          )}
          {isError && (
            <Card>
              <CardContent className="py-8 text-center text-destructive">
                載入失敗，請重新整理或重新登入
              </CardContent>
            </Card>
          )}
          {!isLoading && !isError && list.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <ListChecks className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">尚無投放紀錄</p>
                <p className="text-sm text-muted-foreground mt-1">
                  建立或更新投放草稿後，紀錄會顯示於此
                </p>
              </CardContent>
            </Card>
          )}
          {!isLoading && !isError && displayList.length > 0 && (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>時間</TableHead>
                    <TableHead>訊息</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>草稿 ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayList.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </TableCell>
                      <TableCell>{log.message}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{log.status}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {log.draftId}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
