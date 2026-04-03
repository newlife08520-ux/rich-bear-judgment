export type SyncedAccount = {
  id: string;
  accountId: string;
  accountName?: string;
  platform: string;
};

export type CoverageCheckData = {
  productsWithSpend: string[];
  missingPrimary: string[];
  missingBackup: string[];
  overload: Array<{ userId: string; asPrimaryCount: number; limit: number }>;
};
