import { createHmac } from "node:crypto";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_KEY = Deno.env.get("TWITTER_CONSUMER_KEY")?.trim();
const API_SECRET = Deno.env.get("TWITTER_CONSUMER_SECRET")?.trim();
const ACCESS_TOKEN = Deno.env.get("TWITTER_ACCESS_TOKEN")?.trim();
const ACCESS_TOKEN_SECRET = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET")?.trim();

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const signatureBaseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(
    Object.entries(params).sort().map(([k, v]) => `${k}=${v}`).join("&")
  )}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  const hmacSha1 = createHmac("sha1", signingKey);
  return hmacSha1.update(signatureBaseString).digest("base64");
}

function generateOAuthHeader(method: string, url: string): string {
  const oauthParams = {
    oauth_consumer_key: API_KEY!,
    oauth_nonce: Math.random().toString(36).substring(2),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: ACCESS_TOKEN!,
    oauth_version: "1.0",
  };

  const signature = generateOAuthSignature(method, url, oauthParams, API_SECRET!, ACCESS_TOKEN_SECRET!);
  const signedOAuthParams = { ...oauthParams, oauth_signature: signature };

  return "OAuth " + Object.entries(signedOAuthParams)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
    .join(", ");
}

async function getTweetMetrics(tweetIds: string[]): Promise<any> {
  if (!tweetIds.length) return { data: [] };
  
  // Twitter API allows up to 100 tweet IDs per request
  const ids = tweetIds.slice(0, 100).join(',');
  const baseUrl = "https://api.x.com/2/tweets";
  const queryParams = `ids=${ids}&tweet.fields=public_metrics,created_at`;
  const fullUrl = `${baseUrl}?${queryParams}`;
  
  const oauthHeader = generateOAuthHeader("GET", baseUrl);

  const response = await fetch(fullUrl, {
    method: "GET",
    headers: {
      Authorization: oauthHeader,
    },
  });

  const responseText = await response.text();
  console.log("Twitter metrics response:", response.status);

  if (!response.ok) {
    console.error("Twitter API error:", responseText);
    return { data: [], error: responseText };
  }

  return JSON.parse(responseText);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let campaignId: string | null = null;
    try {
      const body = await req.json();
      campaignId = body.campaign_id || null;
    } catch {
      // No body provided
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

    // Extract tweet IDs from URLs
    const tweetIds: string[] = [];
    const actionMap: Record<string, any> = {};
    
    for (const action of actions) {
      if (action.url) {
        // Extract tweet ID from URL like https://twitter.com/i/web/status/123456789
        const match = action.url.match(/status\/(\d+)/);
        if (match) {
          tweetIds.push(match[1]);
          actionMap[match[1]] = action;
        }
      }
    }

    console.log(`Fetching metrics for ${tweetIds.length} tweets`);

    // Fetch metrics from Twitter API
    let twitterData: any = { data: [] };
    if (tweetIds.length > 0 && API_KEY && API_SECRET && ACCESS_TOKEN && ACCESS_TOKEN_SECRET) {
      twitterData = await getTweetMetrics(tweetIds);
    }

    // Aggregate metrics
    let totalImpressions = 0;
    let totalLikes = 0;
    let totalRetweets = 0;
    let totalReplies = 0;
    let totalClicks = 0;

    const tweetsWithMetrics: any[] = [];

    if (twitterData.data) {
      for (const tweet of twitterData.data) {
        const metrics = tweet.public_metrics || {};
        const action = actionMap[tweet.id];

        totalImpressions += metrics.impression_count || 0;
        totalLikes += metrics.like_count || 0;
        totalRetweets += metrics.retweet_count || 0;
        totalReplies += metrics.reply_count || 0;
        // Note: Click data requires Twitter Analytics API (paid tier)

        tweetsWithMetrics.push({
          tweet_id: tweet.id,
          content: action?.content?.substring(0, 100) + '...',
          posted_at: action?.executed_at,
          impressions: metrics.impression_count || 0,
          likes: metrics.like_count || 0,
          retweets: metrics.retweet_count || 0,
          replies: metrics.reply_count || 0,
          url: action?.url,
        });

        // Update action with engagement count
        if (action) {
          const engagement = (metrics.like_count || 0) + (metrics.retweet_count || 0) + (metrics.reply_count || 0);
          await supabase
            .from('actions_taken')
            .update({ 
              engagement_count: engagement,
              click_count: metrics.impression_count || 0, // Using impressions as proxy
            })
            .eq('id', action.id);
        }
      }
    }

    // Also include actions without Twitter API data (using stored engagement counts)
    for (const action of actions) {
      const tweetId = action.url?.match(/status\/(\d+)/)?.[1];
      if (tweetId && !tweetsWithMetrics.find(t => t.tweet_id === tweetId)) {
        tweetsWithMetrics.push({
          tweet_id: tweetId,
          content: action.content?.substring(0, 100) + '...',
          posted_at: action.executed_at,
          impressions: action.click_count || 0,
          likes: 0,
          retweets: 0,
          replies: 0,
          engagement: action.engagement_count || 0,
          url: action.url,
        });
        totalClicks += action.click_count || 0;
      }
    }

    const metrics = {
      total_tweets: actions.length,
      total_impressions: totalImpressions,
      total_likes: totalLikes,
      total_retweets: totalRetweets,
      total_replies: totalReplies,
      total_engagement: totalLikes + totalRetweets + totalReplies,
      engagement_rate: totalImpressions > 0 
        ? ((totalLikes + totalRetweets + totalReplies) / totalImpressions * 100).toFixed(2)
        : 0,
    };

    console.log('Metrics aggregated:', metrics);

    return new Response(
      JSON.stringify({ 
        success: true, 
        metrics,
        tweets: tweetsWithMetrics.slice(0, 20), // Return top 20 tweets
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
