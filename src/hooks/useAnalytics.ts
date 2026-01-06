import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TwitterMetrics {
  total_tweets: number;
  total_impressions: number;
  total_likes: number;
  total_retweets: number;
  total_replies: number;
  total_engagement: number;
  engagement_rate: number | string;
}

export interface TweetWithMetrics {
  tweet_id: string;
  content: string;
  posted_at: string;
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  url: string;
}

export interface AnalyticsData {
  success: boolean;
  metrics: TwitterMetrics;
  tweets: TweetWithMetrics[];
}

export function useTwitterMetrics(campaignId?: string) {
  return useQuery({
    queryKey: ["twitter-metrics", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("fetch-twitter-metrics", {
        body: campaignId ? { campaign_id: campaignId } : {},
      });

      if (error) throw error;
      return data as AnalyticsData;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useActionsTaken(campaignId?: string) {
  return useQuery({
    queryKey: ["actions-taken", campaignId],
    queryFn: async () => {
      let query = supabase
        .from("actions_taken")
        .select("*")
        .order("executed_at", { ascending: false });

      if (campaignId) {
        query = query.eq("campaign_id", campaignId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useAgentRunLogs(campaignId?: string) {
  return useQuery({
    queryKey: ["agent-run-logs", campaignId],
    queryFn: async () => {
      let query = supabase
        .from("agent_run_logs")
        .select("*")
        .order("run_started_at", { ascending: false })
        .limit(50);

      if (campaignId) {
        query = query.eq("campaign_id", campaignId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useDailyStats(campaignId?: string) {
  return useQuery({
    queryKey: ["daily-stats", campaignId],
    queryFn: async () => {
      // Get actions grouped by day
      let query = supabase
        .from("actions_taken")
        .select("executed_at, platform, engagement_count, click_count")
        .eq("status", "completed")
        .not("executed_at", "is", null)
        .order("executed_at", { ascending: true });

      if (campaignId) {
        query = query.eq("campaign_id", campaignId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group by day
      const dailyMap: Record<string, { actions: number; engagement: number }> = {};
      
      for (const action of data || []) {
        if (!action.executed_at) continue;
        const day = new Date(action.executed_at).toISOString().split('T')[0];
        if (!dailyMap[day]) {
          dailyMap[day] = { actions: 0, engagement: 0 };
        }
        dailyMap[day].actions++;
        dailyMap[day].engagement += action.engagement_count || 0;
      }

      // Convert to array sorted by date
      return Object.entries(dailyMap)
        .map(([date, stats]) => ({
          date,
          actions: stats.actions,
          engagement: stats.engagement,
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-14); // Last 14 days
    },
  });
}

export function usePlatformStats(campaignId?: string) {
  return useQuery({
    queryKey: ["platform-stats", campaignId],
    queryFn: async () => {
      let query = supabase
        .from("actions_taken")
        .select("platform, engagement_count, click_count")
        .eq("status", "completed");

      if (campaignId) {
        query = query.eq("campaign_id", campaignId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group by platform
      const platformMap: Record<string, { count: number; engagement: number; clicks: number }> = {};
      
      for (const action of data || []) {
        if (!platformMap[action.platform]) {
          platformMap[action.platform] = { count: 0, engagement: 0, clicks: 0 };
        }
        platformMap[action.platform].count++;
        platformMap[action.platform].engagement += action.engagement_count || 0;
        platformMap[action.platform].clicks += action.click_count || 0;
      }

      return Object.entries(platformMap).map(([platform, stats]) => ({
        platform,
        posts: stats.count,
        engagement: stats.engagement,
        clicks: stats.clicks,
      }));
    },
  });
}
