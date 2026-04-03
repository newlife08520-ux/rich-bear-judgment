import { AccountExceptionsBlock } from "@/components/account-exceptions-block";
import type { PendingAttachment } from "../judgment-types";

export function JudgmentEvidencePanel({
  scopeAccountIds,
  attachments,
}: {
  scopeAccountIds: string[];
  attachments: PendingAttachment[];
}) {
  return (
    <aside className="w-72 border-l border-gray-200 bg-white shrink-0 flex flex-col no-print">
      <div className="p-3 border-b">
        <p className="text-xs font-semibold text-gray-700">證據與指標</p>
        <p className="text-[11px] text-gray-500 mt-0.5">Meta · GA4 · ROI 漏斗 · 任務</p>
      </div>
      <div className="flex-1 p-3 overflow-auto text-sm">
        <AccountExceptionsBlock scopeAccountIds={scopeAccountIds} compact />
        <p className="text-xs font-medium text-gray-600 mt-4 mb-2">本次上傳的素材與指標</p>
        {attachments.length > 0 ? (
          <div className="space-y-2">
            {attachments.map((a) => (
              <div key={a.id} className="rounded-lg border border-gray-200 p-2 text-xs">
                {a.preview && (
                  <img src={a.preview} alt="" className="w-full rounded mb-1 max-h-24 object-cover" />
                )}
                <span className="truncate block text-gray-700">{a.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500">尚無附加檔案</p>
        )}
      </div>
    </aside>
  );
}
