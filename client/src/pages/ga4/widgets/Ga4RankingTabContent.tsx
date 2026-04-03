import { Fragment } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { V2ScoreMini, DiagnosisBadge } from "@/components/shared/v2-scoring";
import type { PageGroup } from "@shared/schema";
import { pageGroupLabels } from "../ga4-types";
import { formatNumber, formatPercent } from "../ga4-formatters";
import { RiskLevelBadge, TriScoreDisplay, PageRecommendationCard, ChangeIndicator } from "./shared";
import type { DetailedSortKey } from "../ga4-types";
import type { Ga4Workbench } from "../useGa4Workbench";

export function Ga4RankingTabContent(w: Ga4Workbench) {
  const {
    pageGroupFilter, setPageGroupFilter, filteredDetailedPages, pagesDetailedLoading,
    pageRecommendationMap, expandedDetailedRows, toggleDetailedRow,
    detailedSortKey, detailedSortDir, toggleDetailedSort,
  } = w;

  const DetailedSortableHead = ({ label, sortKeyName }: { label: string; sortKeyName: DetailedSortKey }) => (
    <TableHead>
      <button
        type="button"
        className="flex items-center gap-1 cursor-pointer text-xs"
        onClick={() => toggleDetailedSort(sortKeyName)}
        data-testid={`button-sort-detailed-${sortKeyName}`}
      >
        {label}
        {detailedSortKey === sortKeyName ? (
          detailedSortDir === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </button>
    </TableHead>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={pageGroupFilter} onValueChange={setPageGroupFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-page-group-filter">
            <SelectValue placeholder="篩選頁面類型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部類型</SelectItem>
            {(Object.entries(pageGroupLabels) as [PageGroup, string][]).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground" data-testid="text-ranking-count">
          共 {filteredDetailedPages.length} 個頁面
        </span>
      </div>

      {pagesDetailedLoading ? (
        <Card><CardContent className="p-4"><Skeleton className="h-64" /></CardContent></Card>
      ) : filteredDetailedPages.length > 0 ? (
        <Card data-testid="card-detailed-ranking">
          <CardContent className="p-0">
            <div className="table-scroll-container">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">頁面路徑</TableHead>
                    <TableHead className="text-xs">頁面標題</TableHead>
                    <TableHead className="text-xs">類型</TableHead>
                    <DetailedSortableHead label="工作階段" sortKeyName="sessions" />
                    <DetailedSortableHead label="轉換率" sortKeyName="conversionRate" />
                    <DetailedSortableHead label="營收" sortKeyName="revenue" />
                    <DetailedSortableHead label="跳出率" sortKeyName="bounceRate" />
                    <TableHead className="text-xs">診斷 / 風險</TableHead>
                    <TableHead className="text-xs">V2 評分 / 三維</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDetailedPages.map((page, idx) => {
                    const rec = pageRecommendationMap.get(page.pagePath);
                    const isExpanded = expandedDetailedRows.has(page.pagePath);
                    return (
                      <Fragment key={page.pagePath}>
                        <TableRow
                          className="cursor-pointer"
                          onClick={() => toggleDetailedRow(page.pagePath)}
                          data-testid={`row-detailed-${idx}`}
                        >
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" data-testid={`text-pagepath-${idx}`}>
                            <div className="flex items-center gap-1">
                              {rec && (
                                isExpanded
                                  ? <ChevronDown className="w-3 h-3 shrink-0" />
                                  : <ChevronRight className="w-3 h-3 shrink-0" />
                              )}
                              {page.pagePath}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-medium max-w-[180px] truncate" data-testid={`text-pagetitle-${idx}`}>
                            {page.pageTitle}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs" data-testid={`badge-group-${idx}`}>
                              {pageGroupLabels[page.pageGroup]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm" data-testid={`text-sessions-${idx}`}>
                            <div className="flex items-center gap-1">
                              {formatNumber(page.sessions)}
                              {page.sessionsPrev > 0 && (
                                <ChangeIndicator current={page.sessions} previous={page.sessionsPrev} />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-semibold" data-testid={`text-cvr-${idx}`}>
                            <div className="flex items-center gap-1">
                              {formatPercent(page.conversionRate)}
                              {page.conversionRatePrev > 0 && (
                                <ChangeIndicator current={page.conversionRate} previous={page.conversionRatePrev} />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm" data-testid={`text-revenue-${idx}`}>
                            <div className="flex items-center gap-1">
                              ${page.revenue.toLocaleString()}
                              {page.revenuePrev > 0 && (
                                <ChangeIndicator current={page.revenue} previous={page.revenuePrev} />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm" data-testid={`text-bounce-${idx}`}>
                            <div className="flex items-center gap-1">
                              {formatPercent(page.bounceRate)}
                              {page.bounceRatePrev > 0 && (
                                <ChangeIndicator current={page.bounceRate} previous={page.bounceRatePrev} inverse />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {page.scoring ? <DiagnosisBadge diagnosis={page.scoring.diagnosis} /> : <RiskLevelBadge level={page.riskLevel} />}
                          </TableCell>
                          <TableCell>
                            {page.scoring ? <V2ScoreMini scoring={page.scoring} /> : <TriScoreDisplay triScore={page.triScore} />}
                          </TableCell>
                        </TableRow>
                        {isExpanded && rec && (
                          <TableRow data-testid={`row-detailed-rec-${idx}`}>
                            <TableCell colSpan={9} className="p-0">
                              <PageRecommendationCard recommendation={rec} />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8">
            <p className="text-center text-sm text-muted-foreground" data-testid="text-ranking-empty">尚無頁面排行資料，請先更新資料</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
