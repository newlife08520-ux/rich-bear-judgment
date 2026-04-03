import { useSettingsPromptsWorkbench } from "./settings-prompts/useSettingsPromptsWorkbench";
import { SettingsPromptsPageView } from "./settings-prompts/SettingsPromptsPageView";

export default function SettingsPromptsPage() {
  const wb = useSettingsPromptsWorkbench();
  return <SettingsPromptsPageView wb={wb} />;
}
