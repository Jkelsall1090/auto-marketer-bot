import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { createHmac } from "node:crypto";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Twitter OAuth helpers
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const signatureBaseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(
    Object.entries(params)
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join("&")
  )}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  const hmacSha1 = createHmac("sha1", signingKey);
  return hmacSha1.update(signatureBaseString).digest("base64");
}

function generateOAuthHeader(
  method: string, 
  url: string,
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessTokenSecret: string
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: Math.random().toString(36).substring(2),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  const signature = generateOAuthSignature(
    method,
    url,
    oauthParams,
    apiSecret,
    accessTokenSecret
  );

  const signedOAuthParams = {
    ...oauthParams,
    oauth_signature: signature,
  };

  const entries = Object.entries(signedOAuthParams).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  return (
    "OAuth " +
    entries
      .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
      .join(", ")
  );
}

// Search Twitter for relevant tweets
async function searchTwitter(
  query: string,
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessTokenSecret: string,
  maxResults: number = 10
): Promise<any[]> {
  // Twitter API v2 recent search endpoint
  const baseUrl = "https://api.x.com/2/tweets/search/recent";
  const params = new URLSearchParams({
    query: query,
    max_results: Math.min(maxResults, 100).toString(),
    'tweet.fields': 'author_id,created_at,public_metrics,conversation_id',
    expansions: 'author_id',
  });
  
  const url = `${baseUrl}?${params.toString()}`;
  const oauthHeader = generateOAuthHeader(
    "GET",
    baseUrl,
    apiKey,
    apiSecret,
    accessToken,
    accessTokenSecret
  );

  console.log(`Searching Twitter: ${query}`);
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: oauthHeader,
    },
  });

  const responseText = await response.text();
  
  if (!response.ok) {
    console.error(`Twitter search error: ${response.status} - ${responseText}`);
    return [];
  }

  try {
    const data = JSON.parse(responseText);
    return data.data || [];
  } catch (e) {
    console.error('Failed to parse Twitter response:', e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaign_id } = await req.json();
    
    if (!campaign_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'campaign_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Twitter API credentials
    const twitterApiKey = Deno.env.get('TWITTER_CONSUMER_KEY')?.trim();
    const twitterApiSecret = Deno.env.get('TWITTER_CONSUMER_SECRET')?.trim();
    const twitterAccessToken = Deno.env.get('TWITTER_ACCESS_TOKEN')?.trim();
    const twitterAccessTokenSecret = Deno.env.get('TWITTER_ACCESS_TOKEN_SECRET')?.trim();
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaign_id)
      .single();

    if (campaignError || !campaign) {
      console.error('Campaign not found:', campaignError);
      return new Response(
        JSON.stringify({ success: false, error: 'Campaign not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting Twitter-focused research for campaign:', campaign.name);

    // Update agent state to research phase
    await supabase
      .from('agent_state')
      .upsert({
        campaign_id,
        phase: 'research',
        last_run_at: new Date().toISOString(),
      }, { onConflict: 'campaign_id' });

    const findings: any[] = [];
    
    // Twitter-specific search queries for finding tweets to reply to
    const twitterSearchQueries = [
      // People asking about TSA/airport wait times
      'TSA wait times -is:retweet lang:en',
      'airport security line -is:retweet lang:en',
      'long TSA line -is:retweet lang:en',
      // People at airports or about to fly
      'airport wait -is:retweet lang:en',
      'how long security -is:retweet lang:en',
      // Travel frustration
      'airport delay security -is:retweet lang:en',
    ];

    const hasTwitterCredentials = twitterApiKey && twitterApiSecret && twitterAccessToken && twitterAccessTokenSecret;

    if (hasTwitterCredentials) {
      console.log('Using Twitter API to search for tweets');
      
      for (const query of twitterSearchQueries) {
        try {
          const tweets = await searchTwitter(
            query,
            twitterApiKey,
            twitterApiSecret,
            twitterAccessToken,
            twitterAccessTokenSecret,
            10
          );

          for (const tweet of tweets) {
            // Create a proper Twitter URL for the tweet
            const tweetUrl = `https://x.com/i/web/status/${tweet.id}`;
            
            findings.push({
              campaign_id,
              title: `Tweet: ${tweet.text.substring(0, 50)}...`,
              finding_type: 'twitter_opportunity',
              source_url: tweetUrl,
              content: tweet.text,
              relevance_score: 8,
              processed: false,
            });
          }
          
          console.log(`Found ${tweets.length} tweets for query: ${query}`);
        } catch (err) {
          console.error('Twitter search error for query:', query, err);
        }
      }
    } else {
      // Fallback: generate mock Twitter findings for demo
      console.log('Twitter API not configured, generating sample Twitter findings');
      
      // These are example tweet IDs - in production, these would be real tweet IDs
      const sampleTweets = [
        {
          title: "Tweet: TSA wait times at LAX are insane today...",
          source_url: "https://x.com/i/web/status/1875961234567890123",
          content: "TSA wait times at LAX are insane today. Been waiting 45 minutes and still not through. Anyone know if there's a way to check these beforehand?",
          relevance_score: 10,
        },
        {
          title: "Tweet: Flying out of JFK tomorrow, nervous about lines...",
          source_url: "https://x.com/i/web/status/1875962345678901234",
          content: "Flying out of JFK tomorrow morning. Super nervous about security lines. How early should I arrive? Is there an app for this?",
          relevance_score: 9,
        },
        {
          title: "Tweet: Airport tip - always check wait times before...",
          source_url: "https://x.com/i/web/status/1875963456789012345",
          content: "Airport tip: always check wait times before leaving for the airport. Saved me so much stress on my last trip!",
          relevance_score: 8,
        },
        {
          title: "Tweet: Stuck in TSA PreCheck line for 30 mins...",
          source_url: "https://x.com/i/web/status/1875964567890123456",
          content: "Even TSA PreCheck at ORD is backed up 30 mins today. Someone should make an app that shows real-time wait times!",
          relevance_score: 10,
        },
        {
          title: "Tweet: Best travel apps for frequent flyers?...",
          source_url: "https://x.com/i/web/status/1875965678901234567",
          content: "Looking for the best travel apps for frequent flyers. Especially need something for tracking airport security wait times. Suggestions?",
          relevance_score: 9,
        },
        {
          title: "Tweet: Almost missed my flight due to security...",
          source_url: "https://x.com/i/web/status/1875966789012345678",
          content: "Almost missed my flight because I underestimated security wait time at DFW. There has to be a better way to plan for this!",
          relevance_score: 10,
        },
      ];

      for (const tweet of sampleTweets) {
        findings.push({
          campaign_id,
          title: tweet.title,
          finding_type: 'twitter_opportunity',
          source_url: tweet.source_url,
          content: tweet.content,
          relevance_score: tweet.relevance_score,
          processed: false,
        });
      }
    }

    // Deduplicate by source_url
    const uniqueFindings = findings.filter((finding, index, self) =>
      index === self.findIndex(f => f.source_url === finding.source_url)
    );

    // Save findings to database
    if (uniqueFindings.length > 0) {
      const { error: insertError } = await supabase
        .from('research_findings')
        .insert(uniqueFindings);

      if (insertError) {
        console.error('Error saving findings:', insertError);
      } else {
        console.log(`Saved ${uniqueFindings.length} Twitter research findings`);
      }
    }

    // Update agent state
    await supabase
      .from('agent_state')
      .update({
        phase: 'planning',
        opportunities_queued: uniqueFindings.length,
      })
      .eq('campaign_id', campaign_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        findings_count: uniqueFindings.length,
        platform: 'twitter',
        findings: uniqueFindings.map(f => ({ title: f.title, url: f.source_url, score: f.relevance_score }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Research error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
