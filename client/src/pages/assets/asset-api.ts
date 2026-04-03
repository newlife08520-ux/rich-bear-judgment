export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string; errors?: unknown };

export async function apiFetch<T>(
  method: string,
  url: string,
  body?: object
): Promise<ApiResult<T>> {
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
  return { ok: true, data: data as T };
}
