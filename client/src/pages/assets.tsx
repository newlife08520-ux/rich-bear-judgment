import { useAssetsWorkbench } from "./assets/useAssetsWorkbench";
import { AssetsPageView } from "./assets/AssetsPageView";

export default function AssetsPage() {
  const wb = useAssetsWorkbench();
  return <AssetsPageView wb={wb} />;
}
