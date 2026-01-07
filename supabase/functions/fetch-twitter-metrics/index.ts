import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TweetMetrics {
  likes: number;
  retweets: number;
  replies: number;
  views: number;
}

// Scrape tweet page using Firecrawl to extract metrics
async function scrapeTweetMetrics(tweetUrl: string, apiKey: string): Promise<TweetMetrics | null> {
  try {
    console.log('Scraping metrics from:', tweetUrl);
    
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: tweetUrl,
        formats: ['markdown', 'html'],
        onlyMainContent: false,
        waitFor: 2000, // Wait for dynamic content to load
      }),
    });

    if (!response.ok) {
      console.error('Firecrawl error:', response.status);
      return null;
    }

    const data = await response.json();
    const html = data.data?.html || data.html || '';
    const markdown = data.data?.markdown || data.markdown || '';
    
    // Parse metrics from the scraped content
    const metrics = parseMetricsFromContent(html, markdown);
    console.log('Parsed metrics:', metrics);
    
    return metrics;
  } catch (error) {
    console.error('Error scraping tweet:', error);
    return null;
  }
}

// Parse engagement metrics from scraped HTML/markdown content
function parseMetricsFromContent(html: string, markdown: string): TweetMetrics {
  const metrics: TweetMetrics = {
    likes: 0,
    retweets: 0,
    replies: 0,
    views: 0,
  };

  // Common patterns for extracting metrics from Twitter/X pages
  // These patterns may need adjustment as Twitter changes their HTML
  
  // Try to find likes (heart icon followed by number)
  const likesPatterns = [
    /(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)\s*(?:Likes?|likes?)/i,
    /aria-label="(\d+(?:,\d+)*)\s*Likes?"/i,
    /data-testid="like"[^>]*>.*?(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)/is,
  ];
  
  // Try to find retweets
  const retweetsPatterns = [
    /(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)\s*(?:Retweets?|reposts?|Reposts?)/i,
    /aria-label="(\d+(?:,\d+)*)\s*(?:Retweets?|Reposts?)"/i,
    /data-testid="retweet"[^>]*>.*?(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)/is,
  ];
  
  // Try to find replies
  const repliesPatterns = [
    /(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)\s*(?:Replies|replies|Comments?)/i,
    /aria-label="(\d+(?:,\d+)*)\s*(?:Replies|Reply)"/i,
    /data-testid="reply"[^>]*>.*?(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)/is,
  ];
  
  // Try to find views
  const viewsPatterns = [
    /(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)\s*(?:Views?|views?|impressions?)/i,
    /aria-label="(\d+(?:,\d+)*)\s*Views?"/i,
  ];

  const content = html + ' ' + markdown;

  // Extract likes
  for (const pattern of likesPatterns) {
    const match = content.match(pattern);
    if (match) {
      metrics.likes = parseMetricValue(match[1]);
      break;
    }
  }

  // Extract retweets
  for (const pattern of retweetsPatterns) {
    const match = content.match(pattern);
    if (match) {
      metrics.retweets = parseMetricValue(match[1]);
      break;
    }
  }

  // Extract replies
  for (const pattern of repliesPatterns) {
    const match = content.match(pattern);
    if (match) {
      metrics.replies = parseMetricValue(match[1]);
      break;
    }
  }

  // Extract views
  for (const pattern of viewsPatterns) {
    const match = content.match(pattern);
    if (match) {
      metrics.views = parseMetricValue(match[1]);
      break;
    }
  }

  return metrics;
}

// Convert string like "1.2K" or "1,234" to number
function parseMetricValue(value: string): number {
  if (!value) return 0;
  
  const cleaned = value.replace(/,/g, '').trim();
  
  if (cleaned.endsWith('K') || cleaned.endsWith('k')) {
    return Math.round(parseFloat(cleaned.slice(0, -1)) * 1000);
  }
  if (cleaned.endsWith('M') || cleaned.endsWith('m')) {
    return Math.round(parseFloat(cleaned.slice(0, -1)) * 1000000);
  }
  if (cleaned.endsWith('B') || cleaned.endsWith('b')) {
    return Math.round(parseFloat(cleaned.slice(0, -1)) * 1000000000);
  }
  
  return parseInt(cleaned, 10) || 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let campaignId: string | null = null;
    let maxTweets = 10; // Limit to avoid too many Firecrawl requests
    
    try {
      const body = await req.json();
      campaignId = body.campaign_id || null;
      maxTweets = body.max_tweets || 10;
    } catch {
      // No body provided
    }

    if (!firecrawlApiKey) {
      console.warn('FIRECRAWL_API_KEY not configured - returning stored metrics only');
    }

    // Get posted Twitter actions
    let query = supabase
      .from('actions_taken')
      .select('*')
      .eq('platform', 'twitter')
      .eq('status', 'completed')
      .not('url', 'is', null)
      .order('executed_at', { ascending: false })
      .limit(100);

    if (campaignId) {
      query = query.eq('campaign_id', campaignId);
    }

    const { data: actions, error: actionsError } = await query;

    if (actionsError) {
      throw new Error(`Failed to fetch actions: ${actionsError.message}`);
    }

    if (!actions?.length) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No Twitter posts found',
          metrics: {
            total_tweets: 0,
            total_impressions: 0,
            total_likes: 0,
            total_retweets: 0,
            total_replies: 0,
            total_clicks: 0,
          },
          tweets: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Aggregate metrics
    let totalImpressions = 0;
    let totalLikes = 0;
    let totalRetweets = 0;
    let totalReplies = 0;

    const tweetsWithMetrics: any[] = [];
    let scrapedCount = 0;

    // Process actions and scrape metrics using Firecrawl
    for (const action of actions) {
      if (!action.url) continue;
      
      const tweetIdMatch = action.url.match(/status\/(\d+)/);
      if (!tweetIdMatch) continue;
      
      const tweetId = tweetIdMatch[1];
      let metrics: TweetMetrics | null = null;

      // Scrape fresh metrics if Firecrawl is configured and under limit
      if (firecrawlApiKey && scrapedCount < maxTweets) {
        // Convert URL to x.com format for consistency
        const scrapableUrl = action.url.replace('twitter.com', 'x.com');
        metrics = await scrapeTweetMetrics(scrapableUrl, firecrawlApiKey);
        scrapedCount++;
        
        // Add small delay between requests to avoid rate limiting
        if (scrapedCount < maxTweets && scrapedCount < actions.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Use scraped metrics or fall back to stored values
      const likes = metrics?.likes || 0;
      const retweets = metrics?.retweets || 0;
      const replies = metrics?.replies || 0;
      const views = metrics?.views || action.click_count || 0;

      totalLikes += likes;
      totalRetweets += retweets;
      totalReplies += replies;
      totalImpressions += views;

      tweetsWithMetrics.push({
        tweet_id: tweetId,
        content: action.content?.substring(0, 100) + '...',
        posted_at: action.executed_at,
        impressions: views,
        likes: likes,
        retweets: retweets,
        replies: replies,
        engagement: likes + retweets + replies,
        url: action.url,
        scraped: !!metrics,
      });

      // Update action with fresh engagement count if we got metrics
      if (metrics) {
        const engagement = likes + retweets + replies;
        await supabase
          .from('actions_taken')
          .update({ 
            engagement_count: engagement,
            click_count: views,
          })
          .eq('id', action.id);
      }
    }

    const totalEngagement = totalLikes + totalRetweets + totalReplies;
    const metricsResult = {
      total_tweets: actions.length,
      total_impressions: totalImpressions,
      total_likes: totalLikes,
      total_retweets: totalRetweets,
      total_replies: totalReplies,
      total_engagement: totalEngagement,
      engagement_rate: totalImpressions > 0 
        ? ((totalEngagement) / totalImpressions * 100).toFixed(2)
        : 0,
      scraped_count: scrapedCount,
    };

    console.log('Metrics aggregated:', metricsResult);

    return new Response(
      JSON.stringify({ 
        success: true, 
        metrics: metricsResult,
        tweets: tweetsWithMetrics.slice(0, 20),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Fetch metrics error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
