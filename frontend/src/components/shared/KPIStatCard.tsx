import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface KPIStatCardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  sparkData?: number[];
  icon?: React.ReactNode;
  className?: string;
}

export function KPIStatCard({
  title, value, change, changeLabel, sparkData, icon, className,
}: KPIStatCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;
  const isNeutral = !change || change === 0;

  const chartData = sparkData?.map((v, i) => ({ v, i }));

  return (
    <Card className={cn("p-4 animate-fade-in", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1 flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
          {change !== undefined && (
            <div className="flex items-center gap-1">
              {isPositive && <TrendingUp className="h-3 w-3 text-success" />}
              {isNegative && <TrendingDown className="h-3 w-3 text-destructive" />}
              {isNeutral && <Minus className="h-3 w-3 text-muted-foreground" />}
              <span
                className={cn(
                  "text-xs font-medium tabular-nums",
                  isPositive && "text-success",
                  isNegative && "text-destructive",
                  isNeutral && "text-muted-foreground"
                )}
              >
                {isPositive && "+"}{typeof change === 'number' ? change.toFixed(1) : '0.0'}%
              </span>
              {changeLabel && (
                <span className="text-xs text-muted-foreground">{changeLabel}</span>
              )}
            </div>
          )}
        </div>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      {chartData && chartData.length > 0 && (
        <div className="mt-3 h-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone" dataKey="v" stroke="hsl(var(--primary))"
                strokeWidth={1.5} fill="url(#sparkGrad)" dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
