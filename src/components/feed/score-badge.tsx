import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number;
  label: string;
}

export function ScoreBadge({ score, label }: ScoreBadgeProps) {
  const color = score >= 8
    ? "bg-green-100 text-green-800"
    : score >= 6
      ? "bg-yellow-100 text-yellow-800"
      : "bg-zinc-100 text-zinc-600";

  return (
    <Badge variant="outline" className={cn("text-xs", color)}>
      {label}: {score}
    </Badge>
  );
}
