import { useFbAdsWorkbench } from "@/pages/fb-ads/useFbAdsWorkbench";
import { FbAdsPageView } from "@/pages/fb-ads/FbAdsPageView";

export default function FbAdsPage() {
  const workbench = useFbAdsWorkbench();
  return <FbAdsPageView {...workbench} />;
}
