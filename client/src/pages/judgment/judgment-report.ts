import type { ReviewSession, ChatMessage } from "@shared/schema";
import type { ParsedJudgment } from "./judgment-types";
import { DEFAULT_REVIEW_THRESHOLD } from "./judgment-types";
import { getParsedForMessage } from "./judgment-formatters";

export const REPORT_STYLES = `
  @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  body { font-family: system-ui, "Segoe UI", "Microsoft JhengHei", sans-serif; padding: 0; margin: 0; color: #1a1a1a; line-height: 1.7; }
  .print-header { padding: 16px 24px; border-bottom: 2px solid #e5e5e5; margin-bottom: 20px; }
  .print-header .title { font-size: 1.25rem; font-weight: 700; }
  .print-header .meta { font-size: 0.875rem; color: #666; margin-top: 4px; }
  .content { padding: 0 24px 24px; max-width: 64rem; margin: 0 auto; }
  .report-block { page-break-inside: avoid; margin-bottom: 1.5em; padding: 12px 0; border-bottom: 1px solid #eee; }
  .report-block:last-child { border-bottom: 0; }
  .report-block h2 { font-size: 1rem; color: #666; margin: 0 0 4px 0; font-weight: 600; }
  .report-block .value { font-size: 0.95rem; margin-bottom: 12px; white-space: pre-wrap; }
  .report-block ul { margin: 0.25em 0; padding-left: 1.5em; }
  .report-block li { margin: 0.2em 0; }
  .footer { margin-top: 2em; font-size: 12px; color: #666; padding: 0 24px 24px; }
`;

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 單則裁決 → 固定結構裁決報告區塊 HTML */
export function buildReportBlockHtml(parsed: ParsedJudgment, index: number): string {
  const hasScore = typeof parsed.score === "number";
  const passed = hasScore && parsed.score! >= DEFAULT_REVIEW_THRESHOLD;
  const sections: string[] = [];

  sections.push(
    `<div class="report-block"><h2>總判決</h2><div class="value">${escapeHtml(parsed.verdict || "—")}</div></div>`
  );

  if (hasScore) {
    sections.push(
      `<div class="report-block"><h2>分數／是否通過</h2><div class="value">綜合分數 ${parsed.score}，門檻 ${DEFAULT_REVIEW_THRESHOLD}，${passed ? "通過" : "未通過"}</div></div>`
    );
  }

  sections.push(
    `<div class="report-block"><h2>先做什麼</h2><div class="value">${escapeHtml(parsed.actionFirst || "—")}</div></div>`
  );
  sections.push(
    `<div class="report-block"><h2>詳細原因</h2><div class="value">${escapeHtml(parsed.reason || "—")}</div></div>`
  );
  sections.push(
    `<div class="report-block"><h2>具體建議</h2><div class="value">${escapeHtml(parsed.suggestions || "—")}</div></div>`
  );
  sections.push(
    `<div class="report-block"><h2>證據與指標</h2><div class="value">${escapeHtml(parsed.evidence || "—")}</div></div>`
  );
  if (parsed.impactAmount?.trim()) {
    sections.push(
      `<div class="report-block"><h2>影響金額</h2><div class="value">${escapeHtml(parsed.impactAmount)}</div></div>`
    );
  }
  if (parsed.blockingReasons?.length) {
    sections.push(
      `<div class="report-block"><h2>阻擋原因</h2><ul>${parsed.blockingReasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul></div>`
    );
  }
  if (parsed.pendingItems?.length) {
    sections.push(
      `<div class="report-block"><h2>待辦／待補</h2><ul>${parsed.pendingItems.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul></div>`
    );
  }

  const title = index > 0 ? `裁決 ${index + 1}` : "裁決";
  return `<div class="report-section"><h2 style="font-size:1.1rem; margin-bottom:8px;">${title}</h2>${sections.join("")}</div>`;
}

/** 整場 session 的固定結構裁決報告 HTML */
export function buildReportHtmlFromSession(session: ReviewSession): string {
  const assistantMessages = session.messages.filter((m) => m.role === "assistant");
  const blocks = assistantMessages.map((m, i) => buildReportBlockHtml(getParsedForMessage(m), i));
  return blocks.join("");
}

/** 單則訊息的裁決報告 HTML（用於卡片上的「匯出報告」） */
export function buildReportHtmlFromMessage(message: ChatMessage): string {
  const parsed = getParsedForMessage(message);
  return buildReportBlockHtml(parsed, 0);
}

export function openReportPrintWindow(title: string, meta: string, bodyHtml: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  const dateStr = new Date().toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  win.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>${REPORT_STYLES}</style>
</head>
<body>
  <div class="print-header">
    <div class="title">👑 裁決報告 — 審判官</div>
    <div class="meta">${escapeHtml(meta)} · ${dateStr}</div>
  </div>
  <div class="content">${bodyHtml}</div>
  <p class="footer">AI 行銷總監 · ${dateStr}</p>
</body>
</html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.onafterprint = () => win.close();
  }, 300);
}

/** 匯出整場對話為固定結構裁決報告 PDF（不再抓 DOM） */
export function exportFullSessionAsPdf(session: ReviewSession) {
  const assistantMessages = session.messages.filter((m) => m.role === "assistant");
  if (assistantMessages.length === 0) return;
  const bodyHtml = buildReportHtmlFromSession(session);
  openReportPrintWindow(session.title || "內容判讀", session.title || "裁決報告", bodyHtml);
}

/** 匯出單則裁決為固定結構裁決報告 PDF */
export function exportSingleMessageAsPdf(message: ChatMessage, sessionTitle: string) {
  const bodyHtml = buildReportHtmlFromMessage(message);
  openReportPrintWindow(sessionTitle || "單則裁決", sessionTitle || "裁決報告", bodyHtml);
}
