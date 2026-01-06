import { useState } from "react";
import { cn } from "@/lib/utils";
import { 
  Cpu, 
  Wifi, 
  Database, 
  Clock, 
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCampaigns } from "@/hooks/useCampaigns";

interface AgentStatusProps {
  phase: string;
  isRunning: boolean;
  lastRun: string;
  nextRun: string;
  opportunitiesQueued: number;
}

export function AgentStatus({ 
  phase, 
  isRunning, 
  lastRun, 
  nextRun,
  opportunitiesQueued 
}: AgentStatusProps) {
  const [isTriggering, setIsTriggering] = useState(false);
  const { data: campaigns } = useCampaigns();

  const handleForceRun = async (campaignId?: string) => {
    setIsTriggering(true);
    try {
      const body: { dry_run: boolean; campaign_id?: string } = { dry_run: false };
      if (campaignId) {
        body.campaign_id = campaignId;
      }

      const { data, error } = await supabase.functions.invoke('agent-autopost', {
        body
      });

      if (error) throw error;

      const campaignName = campaignId 
        ? campaigns?.find(c => c.id === campaignId)?.name || 'Selected campaign'
        : 'All campaigns';
      toast.success(`${campaignName}: Posted ${data?.total_tweets_posted || 0} tweets.`);
      console.log('Agent run result:', data);
    } catch (err: any) {
      console.error('Agent run failed:', err);
      toast.error(`Agent run failed: ${err.message}`);
    } finally {
      setIsTriggering(false);
    }
  };

  const activeCampaigns = campaigns?.filter(c => c.status === 'active') || [];

  return (
    <div className="rounded-xl border border-border bg-gradient-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Agent Status</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              disabled={isTriggering}
            >
              {isTriggering ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {isTriggering ? "Running..." : "Force Run"}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Select Campaign</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleForceRun()}>
              <span className="font-medium">Run All Campaigns</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {activeCampaigns.map((campaign) => (
              <DropdownMenuItem 
                key={campaign.id} 
                onClick={() => handleForceRun(campaign.id)}
              >
                {campaign.name}
              </DropdownMenuItem>
            ))}
            {activeCampaigns.length === 0 && (
              <DropdownMenuItem disabled>
                No active campaigns
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-6 grid gap-4">
        {/* Current Phase */}
        <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              isRunning ? "bg-primary/20" : "bg-muted"
            )}>
              <Cpu className={cn(
                "h-5 w-5",
                isRunning ? "text-primary animate-pulse" : "text-muted-foreground"
              )} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Current Phase</p>
              <p className="text-xs text-muted-foreground capitalize">{phase}</p>
            </div>
          </div>
          <span className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
            isRunning 
              ? "bg-success/10 text-success" 
              : "bg-muted text-muted-foreground"
          )}>
            <span className={cn(
              "h-2 w-2 rounded-full",
              isRunning ? "bg-success animate-pulse" : "bg-muted-foreground"
            )} />
            {isRunning ? "Running" : "Idle"}
          </span>
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-secondary/50 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-xs">Last Run</span>
            </div>
            <p className="mt-1 text-sm font-medium text-foreground">{lastRun}</p>
          </div>
          
          <div className="rounded-lg bg-secondary/50 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-xs">Next Run</span>
            </div>
            <p className="mt-1 text-sm font-medium text-primary">{nextRun}</p>
          </div>
          
          <div className="rounded-lg bg-secondary/50 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Database className="h-4 w-4" />
              <span className="text-xs">Queued Tasks</span>
            </div>
            <p className="mt-1 text-sm font-medium text-foreground">{opportunitiesQueued}</p>
          </div>
          
          <div className="rounded-lg bg-secondary/50 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Wifi className="h-4 w-4" />
              <span className="text-xs">API Status</span>
            </div>
            <p className="mt-1 flex items-center gap-1 text-sm font-medium text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Connected
            </p>
          </div>
        </div>

        {/* Health Indicators */}
        <div className="flex items-center gap-3 rounded-lg border border-border bg-background/50 p-3">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <span className="text-sm text-muted-foreground">
            All systems operational • Rate limits: 85% available
          </span>
        </div>
      </div>
    </div>
  );
}
