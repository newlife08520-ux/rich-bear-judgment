/**
 * 素材封面圖：用 fetch(credentials: 'include') 載入 /api/uploads 圖片，
 * 確保帶 cookie，避免 401 導致永遠顯示占位。失敗時顯示「圖片」占位。
 * 會強制將相對路徑改為絕對路徑（開頭補 /），避免請求變成 /assets/api/uploads/... 導致 404。
 */
import { useState, useRef, useEffect } from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** 將 fileUrl/thumbnailUrl 轉成絕對 URL，路徑必須以 / 開頭（如 /api/uploads/...） */
export function toAbsoluteUploadUrl(url: string): string {
  if (!url || url.startsWith("data:")) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const pathPart = url.startsWith("/") ? url : `/${url}`;
  return `${typeof window !== "undefined" ? window.location.origin : ""}${pathPart}`;
}

export function AssetThumbnailImg({
  versionId,
  url,
  className,
}: {
  versionId: string;
  url: string | null | undefined;
  className?: string;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!url || url.startsWith("data:")) {
      setBlobUrl(url || null);
      setFailed(false);
      return () => {};
    }
    const requestUrl = toAbsoluteUploadUrl(url);
    let cancelled = false;
    const ac = new AbortController();
    fetch(requestUrl, { credentials: "include", signal: ac.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const u = URL.createObjectURL(blob);
        blobUrlRef.current = u;
        setBlobUrl(u);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      ac.abort();
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [url, versionId]);

  if (!url?.trim()) {
    return (
      <div
        className={cn(
          "w-[120px] h-[90px] bg-muted rounded flex items-center justify-center shrink-0",
          className
        )}
      >
        <ImageIcon className="w-6 h-6 text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (failed) {
    return (
      <div className={cn("w-full h-full flex flex-col items-center justify-center gap-0.5 text-muted-foreground text-xs", className)}>
        <span>圖片</span>
      </div>
    );
  }
  if (blobUrl) {
    return <img src={blobUrl} alt="" className={cn("w-full h-full object-cover", className)} loading="lazy" />;
  }
  return <div className={cn("w-full h-full bg-muted/50 animate-pulse", className)} />;
}
