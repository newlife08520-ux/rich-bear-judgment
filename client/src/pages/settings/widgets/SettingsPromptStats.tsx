import { useMemo } from "react";
import { Type, Hash, Coins, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TOKEN_WARNING_THRESHOLD } from "../settings-constants";
import { estimateTokens } from "../settings-formatters";

export function SettingsPromptStats({ text, label }: { text: string; label?: string }) {
  const stats = useMemo(() => {
    const charCount = text.length;
    const lineCount = text ? text.split("\n").length : 0;
    const tokens = estimateTokens(text);
    return { charCount, lineCount, tokens };
  }, [text]);

  const isOverThreshold = stats.tokens > TOKEN_WARNING_THRESHOLD;
  const suffix = label ? `-${label}` : "";

  return (
    <div className="flex items-center gap-4 flex-wrap" data-testid={`prompt-stats${suffix}`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Type className="w-3 h-3" />
        <span>
          字數:{" "}
          <span className="font-semibold text-foreground" data-testid={`stat-char-count${suffix}`}>
            {stats.charCount.toLocaleString()}
          </span>
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Hash className="w-3 h-3" />
        <span>
          行數: <span className="font-semibold text-foreground">{stats.lineCount}</span>
        </span>
      </div>
      <div
        className={`flex items-center gap-1.5 text-xs ${isOverThreshold ? "text-amber-600" : "text-muted-foreground"}`}
      >
        <Coins className="w-3 h-3" />
        <span>
          預估 tokens:{" "}
          <span
            className={`font-semibold ${isOverThreshold ? "text-amber-700" : "text-foreground"}`}
            data-testid={`stat-tokens${suffix}`}
          >
            {stats.tokens.toLocaleString()}
          </span>
        </span>
        {isOverThreshold && (
          <Badge variant="secondary" className="text-[10px] text-amber-700 bg-amber-100 ml-1">
            <AlertTriangle className="w-3 h-3 mr-0.5" />
            偏長
          </Badge>
        )}
      </div>
    </div>
  );
}
