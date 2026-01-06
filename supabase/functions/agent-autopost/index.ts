import { createHmac } from "node:crypto";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Twitter OAuth setup
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

async function sendTweet(tweetText: string, replyToTweetId?: string): Promise<any> {
  const url = "https://api.x.com/2/tweets";
  const oauthHeader = generateOAuthHeader("POST", url);

  const body: any = { text: tweetText };
  
  // If replying to a tweet, add the reply parameter
  if (replyToTweetId) {
    body.reply = { in_reply_to_tweet_id: replyToTweetId };
    console.log(`Posting as reply to tweet: ${replyToTweetId}`);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: oauthHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  console.log("Twitter response:", response.status, responseText);

  if (!response.ok) {
    throw new Error(`Twitter API error: ${response.status} - ${responseText}`);
  }

  return JSON.parse(responseText);
}

// Extract tweet ID from Twitter/X URLs
function extractTweetId(url: string | null | undefined): string | null {
  if (!url) return null;
  
  // Match patterns like:
  // https://twitter.com/user/status/1234567890
  // https://x.com/user/status/1234567890
  // https://x.com/i/web/status/1234567890
  const patterns = [
    /(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/,
    /(?:twitter\.com|x\.com)\/i\/web\/status\/(\d+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Parse optional parameters
    let campaignId: string | null = null;
    let postsPerRun = 5; // Default: post 5 tweets per run
    let dryRun = false;

    try {
      const body = await req.json();
      campaignId = body.campaign_id || null;
      postsPerRun = body.posts_per_run || 5;
      dryRun = body.dry_run || false;
    } catch {
      // No body provided, use defaults
    }

    console.log(`Agent autopost started. Campaign: ${campaignId || 'all active'}, Posts per run: ${postsPerRun}, Dry run: ${dryRun}`);

    // Get active campaigns (or specific one)
    let campaignsQuery = supabase
      .from('campaigns')
      .select('*')
      .eq('status', 'active');

    if (campaignId) {
      campaignsQuery = campaignsQuery.eq('id', campaignId);
    }

    const { data: campaigns, error: campaignsError } = await campaignsQuery;

    if (campaignsError || !campaigns?.length) {
      console.log('No active campaigns found');
      return new Response(
        JSON.stringify({ success: true, message: 'No active campaigns to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: any[] = [];

    for (const campaign of campaigns) {
      console.log(`Processing campaign: ${campaign.name}`);

      // Step 1: Run research to find new opportunities
      console.log('Running research phase...');
      try {
        const researchResponse = await fetch(`${supabaseUrl}/functions/v1/agent-research`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ campaign_id: campaign.id }),
        });
        const researchData = await researchResponse.json();
        console.log(`Research found ${researchData.findings_count || 0} opportunities`);
      } catch (err) {
        console.error('Research error:', err);
      }

      // Step 2: Generate Twitter content
      console.log('Generating Twitter content...');
      try {
        const contentResponse = await fetch(`${supabaseUrl}/functions/v1/agent-generate-content`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            campaign_id: campaign.id, 
            platform: 'twitter',
            quantity: postsPerRun + 2, // Generate a few extra in case some fail
          }),
        });
        const contentData = await contentResponse.json();
        console.log(`Generated ${contentData.tactics_count || 0} tweets`);
      } catch (err) {
        console.error('Content generation error:', err);
      }

      // Step 3: Get pending Twitter tactics and post them
      const { data: tactics, error: tacticsError } = await supabase
        .from('marketing_tactics')
        .select('*')
        .eq('campaign_id', campaign.id)
        .eq('platform', 'twitter')
        .eq('executed', false)
        .order('priority', { ascending: false })
        .limit(postsPerRun);

      if (tacticsError || !tactics?.length) {
        console.log(`No pending Twitter content for campaign ${campaign.name}`);
        results.push({
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          tweets_posted: 0,
          message: 'No pending Twitter content',
        });
        continue;
      }

      let tweetsPosted = 0;
      const postedTweets: any[] = [];
      const errors: any[] = [];

      for (const tactic of tactics) {
        // ONLY post replies - skip if no tweet ID to reply to
        const replyToTweetId = extractTweetId(tactic.source_url);
        
        if (!replyToTweetId) {
          console.log(`Skipping tactic ${tactic.id} - no valid tweet ID to reply to (source: ${tactic.source_url})`);
          // Mark as executed so we don't keep trying
          await supabase
            .from('marketing_tactics')
            .update({ executed: true })
            .eq('id', tactic.id);
          continue;
        }

        // Ensure tweet is within Twitter's limit
        let tweetContent = tactic.content.trim();
        
        // If content is too long, try to smartly truncate before the URL
        if (tweetContent.length > 280) {
          const urlMatch = tweetContent.match(/(https?:\/\/[^\s]+)/);
          const url = urlMatch ? urlMatch[1] : '';
          
          if (url) {
            // Keep the URL, truncate the text before it
            const textBeforeUrl = tweetContent.replace(url, '').trim();
            const maxTextLength = 280 - url.length - 5; // 5 chars for "... " and space before URL
            const truncatedText = textBeforeUrl.substring(0, maxTextLength).trim();
            tweetContent = `${truncatedText}... ${url}`;
          } else {
            // No URL found, just truncate
            tweetContent = tweetContent.substring(0, 277) + '...';
          }
        }

        if (dryRun) {
          console.log(`[DRY RUN] Would reply to ${replyToTweetId}: ${tweetContent.substring(0, 50)}...`);
          postedTweets.push({ id: tactic.id, content: tweetContent, reply_to: replyToTweetId, dry_run: true });
          tweetsPosted++;
          continue;
        }

        try {
          // Post reply to Twitter
          const twitterResult = await sendTweet(tweetContent, replyToTweetId);
          console.log(`Posted reply to ${replyToTweetId}: ${twitterResult.data?.id}`);

          // Mark as executed
          await supabase
            .from('marketing_tactics')
            .update({ executed: true })
            .eq('id', tactic.id);

          // Log the action
          await supabase
            .from('actions_taken')
            .insert({
              campaign_id: campaign.id,
              platform: 'twitter',
              action_type: 'reply',
              content: tweetContent,
              url: `https://twitter.com/i/web/status/${twitterResult.data?.id}`,
              status: 'completed',
              executed_at: new Date().toISOString(),
            });

          postedTweets.push({
            id: tactic.id,
            twitter_id: twitterResult.data?.id,
            reply_to: replyToTweetId,
            content: tweetContent.substring(0, 50) + '...',
          });

          tweetsPosted++;

          // Add delay between tweets to avoid rate limits (2 seconds)
          if (tactics.indexOf(tactic) < tactics.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (err: any) {
          console.error(`Failed to post tweet: ${err.message}`);
          errors.push({ tactic_id: tactic.id, error: err.message });
        }
      }

      results.push({
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        tweets_posted: tweetsPosted,
        tweets: postedTweets,
        errors: errors.length > 0 ? errors : undefined,
      });

      // Update agent state
      await supabase
        .from('agent_state')
        .upsert({
          campaign_id: campaign.id,
          phase: 'idle',
          last_run_at: new Date().toISOString(),
          next_run_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Next run in 24 hours
        }, { onConflict: 'campaign_id' });
    }

    const totalPosted = results.reduce((sum, r) => sum + r.tweets_posted, 0);
    console.log(`Autopost complete. Total tweets posted: ${totalPosted}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        total_tweets_posted: totalPosted,
        campaigns_processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Autopost error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
