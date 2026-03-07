import { useState } from "react";
import { Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { dateRangeOptions } from "@shared/schema";

export function DateRangeSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [customOpen, setCustomOpen] = useState(false);

  const handleSelect = (v: string) => {
    if (v === "custom") {
      setCustomOpen(true);
    } else {
      onChange(v);
    }
  };

  const applyCustom = () => {
    if (customStart && customEnd) {
      onChange(`custom:${customStart}~${customEnd}`);
      setCustomOpen(false);
    }
  };

  const displayLabel = value.startsWith("custom:")
    ? value.replace("custom:", "").replace("~", " ~ ")
    : dateRangeOptions.find((o) => o.value === value)?.label || value;

  return (
    <div className="flex items-center gap-2">
      <Select value={value.startsWith("custom:") ? "custom" : value} onValueChange={handleSelect}>
        <SelectTrigger className="w-[140px]" data-testid="select-date-range">
          <SelectValue>{displayLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {dateRangeOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} data-testid={`select-date-${opt.value}`}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Popover open={customOpen} onOpenChange={setCustomOpen}>
        <PopoverTrigger asChild>
          <span />
        </PopoverTrigger>
        <PopoverContent className="w-72 p-4" align="start">
          <div className="space-y-3">
            <p className="text-sm font-semibold">自訂日期範圍</p>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="flex-1"
                data-testid="input-custom-start"
              />
              <span className="text-muted-foreground text-xs">~</span>
              <Input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="flex-1"
                data-testid="input-custom-end"
              />
            </div>
            <Button size="sm" onClick={applyCustom} className="w-full" data-testid="button-apply-custom-date">
              套用
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
