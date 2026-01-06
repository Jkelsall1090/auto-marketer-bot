import { useState } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';
import { TrendingUp, Target, Users, Zap, Twitter, RefreshCw, ExternalLink, Loader2 } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCampaigns } from "@/hooks/useCampaigns";
import { 
  useTwitterMetrics, 
  useActionsTaken, 
  useDailyStats, 
  usePlatformStats,
  useAgentRunLogs 
} from "@/hooks/useAnalytics";
import { format, formatDistanceToNow } from "date-fns";

const platformColors: Record<string, string> = {
  twitter: 'hsl(200, 90%, 50%)',
  reddit: 'hsl(16, 100%, 50%)',
  facebook: 'hsl(220, 70%, 55%)',
  instagram: 'hsl(300, 70%, 55%)',
  tiktok: 'hsl(340, 80%, 55%)',
  general: 'hsl(215, 20%, 55%)',
};

export function AnalyticsPanel() {
  const { data: campaigns } = useCampaigns();
  const [selectedCampaign, setSelectedCampaign] = useState<string | undefined>(undefined);
  
  const { data: twitterMetrics, isLoading: metricsLoading, refetch: refetchMetrics } = useTwitterMetrics(selectedCampaign);
  const { data: actions } = useActionsTaken(selectedCampaign);
  const { data: dailyStats } = useDailyStats(selectedCampaign);
  const { data: platformStats } = usePlatformStats(selectedCampaign);
  const { data: runLogs } = useAgentRunLogs(selectedCampaign);

  const metrics = twitterMetrics?.metrics;
  const tweets = twitterMetrics?.tweets || [];

  // Calculate totals from actions
  const totalActions = actions?.length || 0;
  const completedActions = actions?.filter(a => a.status === 'completed').length || 0;
  const totalEngagement = actions?.reduce((sum, a) => sum + (a.engagement_count || 0), 0) || 0;
  const totalClicks = actions?.reduce((sum, a) => sum + (a.click_count || 0), 0) || 0;

  // Format daily data for chart
  const chartData = dailyStats?.map(d => ({
    date: format(new Date(d.date), 'MMM d'),
    posts: d.actions,
    engagement: d.engagement,
  })) || [];

  // Format platform data for chart
  const platformData = platformStats?.map(p => ({
    name: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
    posts: p.posts,
    engagement: p.engagement,
    color: platformColors[p.platform] || platformColors.general,
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Analytics</h2>
          <p className="text-muted-foreground">Track your automated marketing performance</p>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedCampaign || ""}
            onChange={(e) => setSelectedCampaign(e.target.value || undefined)}
            className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
          >
            <option value="">All Campaigns</option>
            {campaigns?.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetchMetrics()}
            disabled={metricsLoading}
          >
            {metricsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Posts"
          value={totalActions.toString()}
          change={0}
          trend="up"
          icon={Zap}
        />
        <MetricCard
          title="Twitter Posts"
          value={(metrics?.total_tweets || 0).toString()}
          change={0}
          trend="up"
          icon={Twitter}
        />
        <MetricCard
          title="Total Engagement"
          value={totalEngagement.toLocaleString()}
          change={0}
          trend="up"
          icon={Users}
        />
        <MetricCard
          title="Engagement Rate"
          value={`${metrics?.engagement_rate || 0}%`}
          change={0}
          trend="up"
          icon={TrendingUp}
        />
      </div>

      {/* Twitter Metrics Breakdown */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-card border-border">
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Impressions</p>
              <p className="text-2xl font-bold text-foreground">{metrics.total_impressions.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border">
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Likes</p>
              <p className="text-2xl font-bold text-foreground">{metrics.total_likes.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border">
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Retweets</p>
              <p className="text-2xl font-bold text-foreground">{metrics.total_retweets.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border">
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Replies</p>
              <p className="text-2xl font-bold text-foreground">{metrics.total_replies.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Activity Chart */}
        <div className="rounded-xl border border-border bg-gradient-card p-6">
          <h3 className="text-lg font-semibold text-foreground mb-6">Daily Activity</h3>
          <div className="h-[300px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorPosts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(174, 72%, 50%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(174, 72%, 50%)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142, 72%, 45%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(142, 72%, 45%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 16%)" />
                  <XAxis dataKey="date" stroke="hsl(215, 20%, 55%)" fontSize={12} />
                  <YAxis stroke="hsl(215, 20%, 55%)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(222, 47%, 10%)',
                      border: '1px solid hsl(222, 30%, 16%)',
                      borderRadius: '8px',
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="posts" 
                    stroke="hsl(174, 72%, 50%)" 
                    fillOpacity={1} 
                    fill="url(#colorPosts)" 
                    name="Posts"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="engagement" 
                    stroke="hsl(142, 72%, 45%)" 
                    fillOpacity={1} 
                    fill="url(#colorEngagement)" 
                    name="Engagement"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>No activity data yet. Run the agent to start posting!</p>
              </div>
            )}
          </div>
        </div>

        {/* Platform Performance */}
        <div className="rounded-xl border border-border bg-gradient-card p-6">
          <h3 className="text-lg font-semibold text-foreground mb-6">Platform Performance</h3>
          <div className="h-[300px]">
            {platformData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={platformData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 16%)" horizontal={false} />
                  <XAxis type="number" stroke="hsl(215, 20%, 55%)" fontSize={12} />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    stroke="hsl(215, 20%, 55%)" 
                    fontSize={12}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(222, 47%, 10%)',
                      border: '1px solid hsl(222, 30%, 16%)',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="posts" fill="hsl(174, 72%, 50%)" radius={[0, 4, 4, 0]} name="Posts" />
                  <Bar dataKey="engagement" fill="hsl(142, 72%, 45%)" radius={[0, 4, 4, 0]} name="Engagement" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>No platform data yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Posts with Metrics */}
      <div className="rounded-xl border border-border bg-gradient-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">Recent Twitter Posts</h3>
        {tweets.length > 0 ? (
          <div className="space-y-4">
            {tweets.slice(0, 10).map((tweet, index) => (
              <div 
                key={tweet.tweet_id || index}
                className="flex items-start justify-between p-4 rounded-lg bg-secondary/50 border border-border"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground line-clamp-2">{tweet.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {tweet.posted_at && formatDistanceToNow(new Date(tweet.posted_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-4 ml-4">
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">{tweet.impressions.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">views</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">{tweet.likes}</p>
                    <p className="text-xs text-muted-foreground">likes</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">{tweet.retweets}</p>
                    <p className="text-xs text-muted-foreground">RTs</p>
                  </div>
                  {tweet.url && (
                    <a 
                      href={tweet.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Twitter className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No tweets posted yet</p>
            <p className="text-sm">Run the autopost agent to start tracking performance</p>
          </div>
        )}
      </div>

      {/* Agent Run History */}
      <div className="rounded-xl border border-border bg-gradient-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">Agent Run History</h3>
        {runLogs && runLogs.length > 0 ? (
          <div className="space-y-2">
            {runLogs.slice(0, 10).map((log) => (
              <div 
                key={log.id}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border"
              >
                <div className="flex items-center gap-3">
                  <Badge 
                    variant={log.phase_completed === 'execution' ? 'default' : 'secondary'}
                    className={log.phase_completed === 'execution' ? 'bg-primary' : ''}
                  >
                    {log.phase_completed || 'unknown'}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {log.run_started_at && format(new Date(log.run_started_at), 'MMM d, HH:mm')}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-foreground">
                    {log.actions_count || 0} actions
                  </span>
                  {log.errors_count && log.errors_count > 0 && (
                    <Badge variant="destructive">{log.errors_count} errors</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No agent runs yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
