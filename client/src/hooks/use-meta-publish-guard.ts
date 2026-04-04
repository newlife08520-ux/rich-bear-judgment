import { useQuery } from "@tanstack/react-query";

export type MetaPublishGuardPayload = {
  metaWritesAllowed: boolean;
  message: string | null;
};

export function useMetaPublishGuard() {
  return useQuery({
    queryKey: ["/api/publish/guard-check"],
    queryFn: async (): Promise<MetaPublishGuardPayload> => {
      const res = await fetch("/api/publish/guard-check", { credentials: "include" });
      if (!res.ok) return { metaWritesAllowed: false, message: "無法取得 Meta 寫入狀態" };
      return res.json();
    },
    staleTime: 60_000,
  });
}
