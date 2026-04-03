import type { JudgmentReport } from "@shared/schema";
import {
  judgmentTypeLabels,
  gradeLabels,
  recommendationLabels,
} from "@shared/schema";

export async function generateJudgmentReportPdf(report: JudgmentReport): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const marginL = 20;
  const marginR = 20;
  const contentW = pageW - marginL - marginR;
  let y = 20;
  const addPage = () => {
    doc.addPage();
    y = 20;
  };
  const checkPage = (needed: number) => {
    if (y + needed > 270) addPage();
  };
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("AI Marketing Judgment Report", marginL, y);
  y += 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(marginL, y, pageW - marginR, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  const typeName = judgmentTypeLabels[report.type] || report.type;
  doc.text(`Type: ${typeName}`, marginL, y);
  doc.text(`Case: ${report.caseId} v${report.version}`, pageW - marginR, y, { align: "right" });
  y += 5;
  doc.text(`Date: ${new Date(report.createdAt).toLocaleString()}`, marginL, y);
  y += 10;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  const scoreColor =
    report.summary.score >= 70 ? [34, 197, 94] : report.summary.score >= 40 ? [234, 179, 8] : [239, 68, 68];
  doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  doc.text(`${report.summary.score}`, marginL, y);
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`  ${report.summary.grade} - ${gradeLabels[report.summary.grade]}`, marginL + 20, y);
  y += 5;
  if (report.summary.opportunityScore !== undefined) {
    doc.setFontSize(9);
    doc.setTextColor(180, 130, 0);
    doc.text(`Opportunity Score: ${report.summary.opportunityScore}`, marginL, y);
    y += 5;
  }
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Recommendation: ${recommendationLabels[report.summary.recommendation]}`, marginL, y);
  y += 8;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const verdictLines = doc.splitTextToSize(report.summary.verdict, contentW);
  checkPage(verdictLines.length * 5 + 5);
  doc.text(verdictLines, marginL, y);
  y += verdictLines.length * 5 + 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(marginL, y, pageW - marginR, y);
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Critical Issues", marginL, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  report.summary.topIssues.forEach((issue) => {
    checkPage(15);
    const sevLabel = issue.severity === "critical" ? "[CRITICAL]" : issue.severity === "high" ? "[HIGH]" : "[MEDIUM]";
    doc.setFont("helvetica", "bold");
    doc.text(`${sevLabel} ${issue.title}`, marginL, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    const descLines = doc.splitTextToSize(issue.description, contentW - 5);
    doc.text(descLines, marginL + 3, y);
    y += descLines.length * 4 + 4;
  });
  y += 3;
  checkPage(10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Priority Actions", marginL, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  report.summary.priorityActions.forEach((action) => {
    checkPage(15);
    doc.setFont("helvetica", "bold");
    const actionHeader = `${action.order}. ${action.action}`;
    const headerLines = doc.splitTextToSize(actionHeader, contentW - 5);
    doc.text(headerLines, marginL, y);
    y += headerLines.length * 4;
    doc.setFont("helvetica", "normal");
    if (action.reason) {
      const reasonLines = doc.splitTextToSize(`Reason: ${action.reason}`, contentW - 8);
      doc.setTextColor(100, 100, 100);
      doc.text(reasonLines, marginL + 5, y);
      doc.setTextColor(0, 0, 0);
      y += reasonLines.length * 4;
    }
    if (action.opportunityScore !== undefined) {
      doc.setTextColor(180, 130, 0);
      doc.text(`Opportunity: ${action.opportunityScore}`, marginL + 5, y);
      doc.setTextColor(0, 0, 0);
      y += 4;
    }
    y += 3;
  });
  y += 3;
  checkPage(10);
  doc.setDrawColor(200, 200, 200);
  doc.line(marginL, y, pageW - marginR, y);
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Diagnosis Details", marginL, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  Object.entries(report.detail.diagnosis).forEach(([key, dim]) => {
    const d = dim as { score: number; analysis: string };
    checkPage(15);
    doc.setFont("helvetica", "bold");
    doc.text(`${key}: ${d.score}/100`, marginL, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    const aLines = doc.splitTextToSize(d.analysis, contentW - 5);
    doc.text(aLines, marginL + 3, y);
    y += aLines.length * 4 + 4;
  });
  y += 3;
  checkPage(10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("AI Reasoning", marginL, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const reasoningLines = doc.splitTextToSize(report.detail.reasoning, contentW);
  checkPage(reasoningLines.length * 4 + 5);
  doc.text(reasoningLines, marginL, y);
  y += reasoningLines.length * 4 + 5;
  checkPage(10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Execution Suggestions", marginL, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  report.detail.executionSuggestions.forEach((s, i) => {
    checkPage(10);
    const sLines = doc.splitTextToSize(`${i + 1}. ${s}`, contentW - 5);
    doc.text(sLines, marginL, y);
    y += sLines.length * 4 + 2;
  });
  y += 5;
  checkPage(10);
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("Generated by AI Marketing Judgment System", marginL, y);
  doc.text(new Date().toLocaleString(), pageW - marginR, y, { align: "right" });
  const fileName = `judgment-${report.caseId}-v${report.version}.pdf`;
  doc.save(fileName);
}
