export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64 || "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function parseJudgmentUrlParams(loc: string): {
  productName: string | null;
  creativeId: string | null;
  impactAmount: string | null;
} {
  const q = loc.includes("?") ? loc.slice(loc.indexOf("?") + 1) : "";
  const params = new URLSearchParams(q);
  return {
    productName: params.get("productName")?.trim() || null,
    creativeId: params.get("creativeId")?.trim() || null,
    impactAmount: params.get("impactAmount")?.trim() || null,
  };
}
