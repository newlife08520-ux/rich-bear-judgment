import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LifecycleItem } from "../lifecycle-types";

export function LifecycleColumn({
  title,
  icon: Icon,
  items,
  variant,
}: {
  title: string;
  icon: React.ElementType;
  items: LifecycleItem[];
  variant: "success" | "underfunded" | "retired";
}) {
  const bg =
    variant === "success"
      ? "bg-white dark:bg-card border-slate-200 border-l-4 border-l-[var(--status-profit)] dark:border-border"
      : variant === "underfunded"
        ? "bg-white dark:bg-card border-slate-200 border-l-4 border-l-amber-500 dark:border-border"
        : "bg-white dark:bg-card border-slate-200 border-l-4 border-l-slate-400 dark:border-border";
  return (
    <Card className={`border ${bg}`}>
      <CardHeader className="py-2 px-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className="w-4 h-4" />
          {title}
          <span className="text-muted-foreground font-normal">({items.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="py-0 px-3 pb-3">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">尚無</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {items.map((i) => (
              <li key={i.id} className="rounded border bg-background/80 p-2">
                <div className="font-medium truncate" title={i.name}>{i.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  ROAS {i.roas.toFixed(1)} · 花費 NT${i.spend.toLocaleString()}
                </div>
                {i.reason && <div className="text-xs text-muted-foreground mt-1 border-t pt-1">{i.reason}</div>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
