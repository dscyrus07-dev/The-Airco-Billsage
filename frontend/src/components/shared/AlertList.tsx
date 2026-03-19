import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Alert } from "@/types/api";
import { useNavigate } from "react-router-dom";

const severityConfig = {
  high: { icon: AlertCircle, className: "text-destructive" },
  medium: { icon: AlertTriangle, className: "text-warning" },
  low: { icon: Info, className: "text-info" },
};

export function AlertList({ alerts, limit = 6 }: { alerts: Alert[]; limit?: number }) {
  const navigate = useNavigate();
  const displayed = alerts.slice(0, limit);

  return (
    <div className="space-y-2">
      {displayed.map((alert) => {
        const config = severityConfig[alert.severity];
        const Icon = config.icon;
        return (
          <Card
            key={alert.id}
            className="p-3 flex items-start gap-3 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => navigate(alert.link)}
          >
            <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", config.className)} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">{alert.title}</p>
                <Badge variant="outline" className={cn("text-[10px] shrink-0 capitalize", config.className)}>
                  {alert.severity}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{alert.description}</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
