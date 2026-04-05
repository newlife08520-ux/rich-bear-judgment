import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import type { MetaAdAccount } from "@shared/schema";
import { metaAccountStatusColors } from "./shared";

export function AccountManagerAccountTable({
  filteredAccounts,
  accountSearch,
  selectedAccountIds,
  toggleSelect,
  toggleFavorite,
}: {
  filteredAccounts: MetaAdAccount[];
  accountSearch: string;
  selectedAccountIds: string[];
  toggleSelect: (accountId: string) => void;
  toggleFavorite: (accountId: string) => void;
}) {
  return (
    <div className="table-scroll-container max-h-[280px] border rounded-md">
      <Table>
        <TableHeader>
          <TableRow className="text-[11px]">
            <TableHead className="w-8 px-2"></TableHead>
            <TableHead className="w-8 px-1"></TableHead>
            <TableHead className="px-2">帳號名稱</TableHead>
            <TableHead className="px-2 w-[100px]">帳號 ID</TableHead>
            <TableHead className="px-2 w-[70px]">狀態</TableHead>
            <TableHead className="px-2 w-[60px]">幣別</TableHead>
            <TableHead className="px-2 w-[120px]">時區</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredAccounts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                {accountSearch ? "無符合搜尋條件的帳號" : "無帳號資料"}
              </TableCell>
            </TableRow>
          ) : (
            filteredAccounts.map((acct) => (
              <TableRow
                key={acct.accountId}
                className={`cursor-pointer text-[12px] ${selectedAccountIds.includes(acct.accountId) ? "bg-slate-100 dark:bg-muted/50" : ""}`}
                onClick={() => toggleSelect(acct.accountId)}
                data-testid={`row-account-${acct.accountId}`}
              >
                <TableCell className="px-2">
                  <Checkbox
                    checked={selectedAccountIds.includes(acct.accountId)}
                    onCheckedChange={() => toggleSelect(acct.accountId)}
                    data-testid={`checkbox-account-${acct.accountId}`}
                  />
                </TableCell>
                <TableCell className="px-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(acct.accountId);
                    }}
                    data-testid={`button-star-account-${acct.accountId}`}
                  >
                    <Star
                      className={`w-3.5 h-3.5 transition-colors ${acct.isFavorite ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
                    />
                  </button>
                </TableCell>
                <TableCell className="px-2 font-medium truncate max-w-[160px]" title={acct.name}>
                  {acct.name}
                </TableCell>
                <TableCell className="px-2 text-muted-foreground font-mono text-[11px]">
                  {acct.accountId}
                </TableCell>
                <TableCell className="px-2">
                  <Badge
                    variant="outline"
                    className={`text-xs px-1.5 py-0 ${metaAccountStatusColors[acct.accountStatus] || "bg-slate-100 text-slate-600 border border-slate-200"}`}
                  >
                    {acct.accountStatusLabel}
                  </Badge>
                </TableCell>
                <TableCell className="px-2 text-muted-foreground">{acct.currency}</TableCell>
                <TableCell
                  className="px-2 text-muted-foreground text-[11px] truncate max-w-[120px]"
                  title={acct.timezoneName}
                >
                  {acct.timezoneName}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
