import { useSettingsWorkbench } from "./settings/useSettingsWorkbench";
import { SettingsPageView } from "./settings/SettingsPageView";

export default function SettingsPage() {
  const wb = useSettingsWorkbench();
  return <SettingsPageView wb={wb} />;
}
