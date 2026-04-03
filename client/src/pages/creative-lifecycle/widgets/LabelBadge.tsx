import { Badge } from "@/components/ui/badge";
import type { LifecycleLabel } from "../lifecycle-types";
import { LABEL_DISPLAY } from "../lifecycle-constants";

export function LabelBadge({ label }: { label: LifecycleLabel }) {
  const normalized = String(label);
  const display = LABEL_DISPLAY[normalized] ?? normalized;
  const variant =
    display === "Winner"
      ? "default"
      : display === "Underfunded"
        ? "secondary"
        : display === "Lucky"
          ? "destructive"
          : "outline";
  return <Badge variant={variant as "default" | "secondary" | "destructive" | "outline"}>{display}</Badge>;
}
