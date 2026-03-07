/**
 * Layer 3：Hidden Calibration。隱性校準，不與 Draft 主 prompt 混在同一編輯框。
 * 一般角色僅可見「已啟用模組名稱」摘要，不可編輯全文。
 */

export const CALIBRATION_SLICE_EMOTIONAL_TRIGGER = `【隱性校準・情緒觸發】
判斷時納入目標受眾的情緒觸發點與共鳴門檻，不只看表面文案。`;

export const CALIBRATION_SLICE_VISUAL_IMPACT = `【隱性校準・視覺衝擊】
以「滑動中能否被記住、前 3 秒是否抓住注意力」為底線，兼顧品牌識別與轉換訊號。`;

export const CALIBRATION_SLICE_BRAND_CONVERSION = `【隱性校準・品牌與轉換平衡】
在品牌調性與賣貨轉換之間取得平衡，不偏廢其一；建議要具體可執行。`;

export const CALIBRATION_SLICE_EXAMPLE = `【隱性校準・範例引導】
以業界爆款與常見失敗為參照，給出可對照的改動方向，不用空泛形容詞。`;

/** 僅供設定頁顯示「已啟用校準模組」摘要，不暴露全文。 */
export const CALIBRATION_MODULE_NAMES: Record<string, string> = {
  EmotionalTrigger: "情緒觸發 (Emotional Trigger)",
  VisualImpact: "視覺衝擊 (Visual Impact)",
  BrandConversion: "品牌 × 轉換平衡 (Brand x Conversion Balance)",
  ExampleCalibration: "範例校準 (Example Calibration)",
};

export function getCalibrationSlice(name: keyof typeof CALIBRATION_SLICES): string {
  return CALIBRATION_SLICES[name] ?? "";
}

const CALIBRATION_SLICES = {
  EmotionalTrigger: CALIBRATION_SLICE_EMOTIONAL_TRIGGER,
  VisualImpact: CALIBRATION_SLICE_VISUAL_IMPACT,
  BrandConversion: CALIBRATION_SLICE_BRAND_CONVERSION,
  ExampleCalibration: CALIBRATION_SLICE_EXAMPLE,
} as const;
