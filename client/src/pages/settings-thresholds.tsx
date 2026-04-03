import { useSettingsThresholdsWorkbench } from "./settings-thresholds/useSettingsThresholdsWorkbench";
import { SettingsThresholdsPageView } from "./settings-thresholds/SettingsThresholdsPageView";

export default function SettingsThresholdsPage() {
  const wb = useSettingsThresholdsWorkbench();
  return <SettingsThresholdsPageView wb={wb} />;
}
