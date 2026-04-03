import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const fp = path.join(root, "client/src/pages/fb-ads/widgets/fb-ads-sections.tsx");
const lines = fs.readFileSync(fp, "utf-8").split("\n");
const header =
  lines.slice(0, 81).join("\n") +
  `\nimport {
  formatCurrency,
  formatKPIValue,
  getAiLabelClass,
  statusLabels,
  statusColors,
  metaAccountStatusColors,
  FbRiskLevelBadge,
  FbTriScoreMini,
  type SortField,
  type SortDir,
  type AccountFilter,
} from "./shared";
`;

const slices = [
  ["AccountManagerPanel.tsx", 147, 453],
  ["OpportunityBoardSection.tsx", 495, 606],
  ["StopLossSection.tsx", 608, 710],
  ["DirectorSummarySection.tsx", 712, 759],
  ["OperationalSummarySection.tsx", 761, 902],
  ["HighRiskAccountsSection.tsx", 903, 967],
  ["KPISection.tsx", 968, 1035],
  ["CreativeOpportunityBoard.tsx", 1036, 1100],
  ["CreativeTableSection.tsx", 1102, 1273],
  ["BuriedGemsSection.tsx", 1275, 1329],
  ["StopListSection.tsx", 1331, 1384],
  ["CampaignStructureTab.tsx", 1386, 1662],
  ["BudgetRecommendationsTab.tsx", 1664, 1782],
  ["AlertsTab.tsx", 1784, 1874],
  ["CreativeDetailDialog.tsx", 1876, 1975],
];

for (const [name, a, b] of slices) {
  let body = lines.slice(a - 1, b).join("\n");
  body = body.replace(/^function /, "export function ");
  if (name === "CreativeTableSection.tsx") {
    body = body.replace(/^export function CreativeTable\(/, "export function CreativeTable(");
  }
  fs.writeFileSync(path.join(root, "client/src/pages/fb-ads/widgets", name), header + "\n" + body + "\n");
  console.log(name, b - a + 1);
}
