import { cn } from "@/lib/utils";
import { 
  MoreVertical, 
  Play, 
  Pause, 
  TrendingUp,
  Users,
  MousePointerClick,
  MessageCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface CampaignCardProps {
  name: string;
  product: string;
  status: "active" | "paused" | "completed";
  channels: string[];
  metrics: {
    impressions: number;
    clicks: number;
    engagements: number;
    sentiment: number;
  };
  nextRun?: string;
}

const statusStyles = {
  active: "bg-success/10 text-success border-success/30",
  paused: "bg-warning/10 text-warning border-warning/30",
  completed: "bg-muted text-muted-foreground border-border",
};

export function CampaignCard({ 
  name, 
  product, 
  status, 
  channels, 
  metrics, 
  nextRun 
}: CampaignCardProps) {
  return (
    <div className="group rounded-xl border border-border bg-gradient-card p-5 transition-all duration-300 hover:border-primary/50 hover:shadow-glow">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-lg font-semibold text-foreground">{name}</h4>
            <span className={cn(
              "rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
              statusStyles[status]
            )}>
              {status}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{product}</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8"
          >
            {status === "active" ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Channels */}
      <div className="mt-4 flex flex-wrap gap-2">
        {channels.map((channel) => (
          <span
            key={channel}
            className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground"
          >
            {channel}
          </span>
        ))}
      </div>

      {/* Metrics */}
      <div className="mt-4 grid grid-cols-4 gap-3">
        <div className="rounded-lg bg-secondary/50 p-2.5 text-center">
          <Users className="mx-auto h-4 w-4 text-muted-foreground" />
          <p className="mt-1 text-lg font-semibold text-foreground">
            {metrics.impressions.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">Impressions</p>
        </div>
        <div className="rounded-lg bg-secondary/50 p-2.5 text-center">
          <MousePointerClick className="mx-auto h-4 w-4 text-muted-foreground" />
          <p className="mt-1 text-lg font-semibold text-foreground">
            {metrics.clicks.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">Clicks</p>
        </div>
        <div className="rounded-lg bg-secondary/50 p-2.5 text-center">
          <MessageCircle className="mx-auto h-4 w-4 text-muted-foreground" />
          <p className="mt-1 text-lg font-semibold text-foreground">
            {metrics.engagements}
          </p>
          <p className="text-xs text-muted-foreground">Engagements</p>
        </div>
        <div className="rounded-lg bg-secondary/50 p-2.5 text-center">
          <TrendingUp className="mx-auto h-4 w-4 text-muted-foreground" />
          <p className="mt-1 text-lg font-semibold text-foreground">
            {(metrics.sentiment * 100).toFixed(0)}%
          </p>
          <p className="text-xs text-muted-foreground">Sentiment</p>
        </div>
      </div>

      {nextRun && status === "active" && (
        <p className="mt-4 text-xs text-muted-foreground">
          Next scheduled run: <span className="font-medium text-primary">{nextRun}</span>
        </p>
      )}
    </div>
  );
}
