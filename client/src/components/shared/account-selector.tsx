import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SyncedAccount } from "@shared/schema";

interface AccountSelectorProps {
  platform?: "meta" | "ga4" | "all";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  showAllOption?: boolean;
  allOptionLabel?: string;
  "data-testid"?: string;
}

function extractAccounts(data: any): SyncedAccount[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.accounts)) return data.accounts;
  return [];
}

export function AccountSelector({
  platform = "all",
  value,
  onChange,
  placeholder = "選擇帳號",
  className = "w-[200px]",
  showAllOption = false,
  allOptionLabel = "全部帳號",
  "data-testid": testId = "select-account",
}: AccountSelectorProps) {
  const { data: rawData } = useQuery<any>({
    queryKey: ["/api/accounts/synced"],
  });

  const syncedAccounts = extractAccounts(rawData);

  const accounts = syncedAccounts.filter((a) => {
    if (platform === "all") return true;
    return a.platform === platform;
  });

  const activeAccounts = accounts.filter((a) => a.status === "active");

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className} data-testid={testId}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {showAllOption && (
          <SelectItem value="all" data-testid={`${testId}-all`}>
            {allOptionLabel}
          </SelectItem>
        )}
        {activeAccounts.map((acc) => (
          <SelectItem
            key={acc.id}
            value={acc.accountId}
            data-testid={`${testId}-${acc.accountId}`}
          >
            {acc.accountName}
          </SelectItem>
        ))}
        {activeAccounts.length === 0 && !showAllOption && (
          <SelectItem value="none" disabled>
            尚未同步帳號
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}

export function useAccountSelector(platform?: "meta" | "ga4" | "all") {
  const { data: rawData, isLoading } = useQuery<any>({
    queryKey: ["/api/accounts/synced"],
  });

  const syncedAccounts = extractAccounts(rawData);

  const accounts = syncedAccounts.filter((a) => {
    if (!platform || platform === "all") return true;
    return a.platform === platform;
  });

  return { accounts, isLoading };
}
