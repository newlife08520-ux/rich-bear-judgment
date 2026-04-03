import type { LucideIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function SettingsPillToggleGroup({
  label,
  icon: Icon,
  iconColor,
  description,
  options,
  value,
  onChange,
  testIdPrefix,
}: {
  label: string;
  icon: LucideIcon;
  iconColor: string;
  description: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  testIdPrefix: string;
}) {
  return (
    <div className="space-y-2" data-testid={`pills-${testIdPrefix}`}>
      <Label className="flex items-center gap-2 text-sm font-medium">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        {label}
      </Label>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="flex gap-2">
        {options.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            variant={value === opt.value ? "default" : "outline"}
            size="sm"
            onClick={() => onChange(opt.value)}
            data-testid={`pill-${testIdPrefix}-${opt.value}`}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
