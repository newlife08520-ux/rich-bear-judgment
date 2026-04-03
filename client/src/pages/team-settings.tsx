/**
 * 團隊權限：防漏三件套 — 雙欄 Transfer List、Coverage guardrail、儲存前 diff + undo
 */
import { useTeamSettingsWorkbench } from "./team-settings/useTeamSettingsWorkbench";
import { TeamSettingsPageView } from "./team-settings/TeamSettingsPageView";

export default function TeamSettingsPage() {
  const wb = useTeamSettingsWorkbench();
  return <TeamSettingsPageView wb={wb} />;
}
