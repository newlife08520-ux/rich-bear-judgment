import { useHistoryWorkbench } from "./history/useHistoryWorkbench";
import { HistoryPageView } from "./history/HistoryPageView";

export default function HistoryPage() {
  const wb = useHistoryWorkbench();
  return <HistoryPageView wb={wb} />;
}
