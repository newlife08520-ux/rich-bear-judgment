import type { AssetAspectRatio } from "@shared/schema";
import {
  parseAspectRatioFromText,
  parseSuggestedGroupNameFromFilename as parseSuggestedGroupNameFromFilenameShared,
} from "@shared/parse-asset-name";

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ASPECT_RATIOS: { key: AssetAspectRatio; value: number }[] = [
  { key: "9:16", value: 9 / 16 },
  { key: "4:5", value: 4 / 5 },
  { key: "1:1", value: 1 },
  { key: "16:9", value: 16 / 9 },
];

export function parseAspectRatioFromFilename(text: string): AssetAspectRatio | null {
  return parseAspectRatioFromText(text);
}

export function parseSuggestedGroupNameFromFilename(fileName: string): string | null {
  return parseSuggestedGroupNameFromFilenameShared(fileName);
}

export function getImageAspectRatio(file: File): Promise<AssetAspectRatio> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!h) {
        resolve("1:1");
        return;
      }
      const r = w / h;
      let best: AssetAspectRatio = "1:1";
      let bestDiff = Infinity;
      for (const { key, value } of ASPECT_RATIOS) {
        const diff = Math.abs(r - value);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = key;
        }
      }
      resolve(best);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("無法讀取圖片"));
    };
    img.src = url;
  });
}
