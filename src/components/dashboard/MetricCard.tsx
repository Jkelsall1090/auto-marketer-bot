import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  trend?: "up" | "down";
}

export function MetricCard({ title, value, change, icon: Icon, trend }: MetricCardProps) {
  const TrendIcon = trend === "up" ? TrendingUp : TrendingDown;
  
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-gradient-card p-6 transition-all duration-300 hover:border-primary/50 hover:shadow-glow">
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-glow opacity-0 transition-opacity group-hover:opacity-100" />
      
      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
          </div>
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>

        {change !== undefined && (
          <div className="mt-4 flex items-center gap-1">
            <TrendIcon
              className={cn(
                "h-4 w-4",
                trend === "up" ? "text-success" : "text-destructive"
              )}
            />
            <span
              className={cn(
                "text-sm font-medium",
                trend === "up" ? "text-success" : "text-destructive"
              )}
            >
              {change > 0 ? "+" : ""}{change}%
            </span>
            <span className="text-sm text-muted-foreground">vs last week</span>
          </div>
        )}
      </div>
    </div>
  );
}
