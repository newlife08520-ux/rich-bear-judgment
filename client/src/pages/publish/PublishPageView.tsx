/**
 * 投放中心 UI（邏輯見 publish/usePublishWorkbench）
 */
import { useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
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
import { Link } from "wouter";
import { ExecutionLogDialog } from "@/components/ExecutionLogDialog";
import { ExternalMetaDriftBanner } from "@/components/sync/ExternalMetaDriftBanner";
import { Plus, Pencil, Send, Copy, History, Rocket, ClipboardList } from "lucide-react";
import { audienceStrategyLabels, publishStatusLabels } from "@shared/schema";
import { usePublishWorkbench } from "./usePublishWorkbench";
import { PublishWizardDialog } from "./widgets/PublishWizardDialog";

export function PublishPageView({ wb }: { wb: ReturnType<typeof usePublishWorkbench> }) {
  const [execLogOpen, setExecLogOpen] = useState(false);
  const {
    openCreate,
    drafts,
    isLoading,
    isSubmitting,
    hasDraftsError,
    formatDate,
    openEdit,
    openCopy,
    openCopyAsVariant,
    requestMetaPublishPreview,
  } = wb;

  return (
    <div className="flex flex-col min-h-full">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger />
        <h1 className="font-semibold">投放中心</h1>
      </header>
      <ExternalMetaDriftBanner surface="publish" />
      <div className="min-h-full p-4 page-container-fluid">
        <div className="max-w-5xl mx-auto flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              建立投放草稿
            </Button>
            <Button variant="outline" onClick={() => setExecLogOpen(true)}>
              <History className="w-4 h-4 mr-2" />
              執行紀錄
            </Button>
            <Button variant="outline" asChild>
              <Link href="/execution-history" data-testid="link-publish-to-execution-audit">
                <ClipboardList className="w-4 h-4 mr-2" />
                全域執行稽核
              </Link>
            </Button>
          </div>

          {isLoading && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                載入中...
              </CardContent>
            </Card>
          )}
          {!isLoading && hasDraftsError && (
            <Card>
              <CardContent className="py-8 text-center text-destructive">
                載入失敗，請重新整理或重新登入
              </CardContent>
            </Card>
          )}
          {!isLoading && !hasDraftsError && drafts.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Send className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">尚無投放草稿</p>
                <p className="text-sm text-muted-foreground mt-1">
                  點「建立投放草稿」開始
                </p>
              </CardContent>
            </Card>
          )}
          {!isLoading && !hasDraftsError && drafts.length > 0 && (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign 名稱</TableHead>
                    <TableHead>廣告帳號</TableHead>
                    <TableHead>受眾</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>更新時間</TableHead>
                    <TableHead className="w-[140px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drafts.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.campaignName}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {d.accountId}
                      </TableCell>
                      <TableCell>
                        {audienceStrategyLabels[d.audienceStrategy]}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {publishStatusLabels[d.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(d.updatedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(d)}
                            title="編輯"
                          >
                            <Pencil className="w-4 h-4 mr-1" />
                            編輯
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openCopy(d)}
                            title="複製草稿"
                          >
                            <Copy className="w-4 h-4 mr-1" />
                            複製
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openCopyAsVariant(d)}
                            title="複製為變體（只換素材）"
                          >
                            變體
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isSubmitting}
                            onClick={() => void requestMetaPublishPreview(d.id)}
                            title="經 execution 層：dry-run → 核准 → apply（Meta foundation）"
                          >
                            <Rocket className="w-4 h-4 mr-1" />
                            送往 Meta（預覽）
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </div>

      <PublishWizardDialog wb={wb} />
      <ExecutionLogDialog open={execLogOpen} onOpenChange={setExecLogOpen} />
    </div>
  );
}
