import { Badge } from "@/components/ui/badge";

interface SourceBadgeProps {
  source: string;
}

export function SourceBadge({ source }: SourceBadgeProps) {
  return (
    <Badge variant="secondary" className="text-xs">
      {source}
    </Badge>
  );
}
