import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMarketingTactics, useMarkTacticExecuted, useDeleteTactic, type MarketingTactic } from "@/hooks/useContentQueue";
import { useCampaigns, useRunAgent } from "@/hooks/useCampaigns";
import { 
  Copy, 
  Check, 
  X, 
  ExternalLink, 
  MessageCircle, 
  Loader2,
  Play,
  RefreshCw,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";

const platformIcons: Record<string, string> = {
  reddit: "🔴",
  facebook: "📘",
  twitter: "🐦",
  tiktok: "🎵",
  instagram: "📸",
  general: "💬",
};

const platformColors: Record<string, string> = {
  reddit: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  facebook: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  twitter: "bg-sky-500/10 text-sky-500 border-sky-500/20",
  tiktok: "bg-pink-500/10 text-pink-500 border-pink-500/20",
  instagram: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  general: "bg-muted text-muted-foreground border-border",
};

function ContentCard({ tactic, onCopy, onPost, onSkip }: { 
  tactic: MarketingTactic;
  onCopy: () => void;
  onPost: () => void;
  onSkip: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(tactic.content);
    setCopied(true);
    onCopy();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-border bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{platformIcons[tactic.platform] || "💬"}</span>
            <Badge variant="outline" className={platformColors[tactic.platform] || platformColors.general}>
              {tactic.platform}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {tactic.tactic_type}
            </Badge>
          </div>
          <Badge 
            variant={tactic.estimated_impact === 'high' ? 'default' : 'secondary'}
            className={tactic.estimated_impact === 'high' ? 'bg-primary' : ''}
          >
            {tactic.estimated_impact || 'medium'} impact
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-secondary/50 p-4 text-sm leading-relaxed">
          {tactic.content}
        </div>
        
        {tactic.target_audience && (
          <p className="text-xs text-muted-foreground">
            Target: {tactic.target_audience}
          </p>
        )}

        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleCopy}
            className="flex-1"
          >
            {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            {copied ? "Copied!" : "Copy"}
          </Button>
          <Button 
            size="sm" 
            variant="default" 
            onClick={onPost}
            className="flex-1"
          >
            <Check className="h-4 w-4 mr-1" />
            Mark Posted
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={onSkip}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ContentQueuePanel() {
  const { data: campaigns, isLoading: campaignsLoading } = useCampaigns();
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  
  const { data: tactics, isLoading: tacticsLoading, refetch } = useMarketingTactics(selectedCampaign || undefined);
  const markExecuted = useMarkTacticExecuted();
  const deleteTactic = useDeleteTactic();
  const runAgent = useRunAgent();

  const pendingTactics = tactics?.filter(t => !t.executed) || [];
  const postedTactics = tactics?.filter(t => t.executed) || [];

  const handleRunAgent = async () => {
    if (!selectedCampaign) {
      toast.error("Please select a campaign first");
      return;
    }
    await runAgent.mutateAsync({ campaignId: selectedCampaign });
    refetch();
  };

  // Auto-select first campaign
  if (!selectedCampaign && campaigns?.length) {
    setSelectedCampaign(campaigns[0].id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Content Queue</h2>
          <p className="text-muted-foreground">Review and post AI-generated marketing content</p>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedCampaign || ""}
            onChange={(e) => setSelectedCampaign(e.target.value)}
            className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
          >
            <option value="">Select Campaign</option>
            {campaigns?.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <Button 
            onClick={handleRunAgent} 
            disabled={runAgent.isPending || !selectedCampaign}
            variant="glow"
          >
            {runAgent.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Generate Content
          </Button>
        </div>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            Ready to Post ({pendingTactics.length})
          </TabsTrigger>
          <TabsTrigger value="posted" className="gap-2">
            <Check className="h-4 w-4" />
            Posted ({postedTactics.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          {tacticsLoading || campaignsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : pendingTactics.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MessageCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No content in queue</h3>
                <p className="text-muted-foreground text-center max-w-md mb-4">
                  Click "Generate Content" to have the AI research opportunities and create marketing content for your campaign.
                </p>
                <Button onClick={handleRunAgent} disabled={runAgent.isPending || !selectedCampaign}>
                  {runAgent.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Run Agent Now
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {pendingTactics.map((tactic) => (
                <ContentCard
                  key={tactic.id}
                  tactic={tactic}
                  onCopy={() => toast.success("Content copied to clipboard!")}
                  onPost={() => markExecuted.mutate({ tacticId: tactic.id, executed: true })}
                  onSkip={() => deleteTactic.mutate(tactic.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="posted" className="mt-6">
          {postedTactics.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Check className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-foreground">No posted content yet</h3>
                <p className="text-muted-foreground">Content you mark as posted will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {postedTactics.map((tactic) => (
                <Card key={tactic.id} className="border-border bg-card/30 opacity-75">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <span>{platformIcons[tactic.platform] || "💬"}</span>
                      <Badge variant="outline" className={platformColors[tactic.platform]}>
                        {tactic.platform}
                      </Badge>
                      <Badge variant="secondary" className="bg-success/10 text-success">
                        <Check className="h-3 w-3 mr-1" /> Posted
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {tactic.content}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
