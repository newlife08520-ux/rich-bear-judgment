import { useGa4Workbench } from "@/pages/ga4/useGa4Workbench";
import { Ga4PageView } from "@/pages/ga4/Ga4PageView";

export default function GA4AnalysisPage() {
  const workbench = useGa4Workbench();
  return <Ga4PageView {...workbench} />;
}
