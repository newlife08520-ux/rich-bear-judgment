import type { PublishDraft } from "@shared/schema";
import type { SyncedAccount } from "@shared/schema";

export type SyncedResponse = { accounts: SyncedAccount[] };

export async function publishFetch(
  method: string,
  url: string,
  body?: object
): Promise<
  | { ok: true; data: PublishDraft }
  | { ok: true; data: PublishDraft[] }
  | { ok: false; status: number; message: string; errors?: unknown }
> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: (data as { message?: string }).message ?? res.statusText,
      errors: (data as { errors?: unknown }).errors,
    };
  }
  return { ok: true, data };
}
