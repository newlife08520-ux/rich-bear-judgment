export type ConnectionStatus = "idle" | "testing" | "success" | "error";

export interface ConnectionResult {
  status: ConnectionStatus;
  message: string;
  checkedAt: string | null;
  testedModel?: string;
  accountPreview?: { totalCount: number; topNames: string[] };
  errorCode?: string;
  statusCode?: number;
  providerErrorMessage?: string;
}
