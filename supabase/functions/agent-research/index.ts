import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extract tweet ID from various Twitter/X URL formats
function extractTweetId(url: string): string | null {
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

// Search using Firecrawl to find Twitter content
async function searchWithFirecrawl(
  query: string,
  apiKey: string,
  limit: number = 10
): Promise<any[]> {
  console.log(`Firecrawl search: "${query}"`);
  
  const response = await fetch('https://api.firecrawl.dev/v1/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      limit,
      tbs: 'qdr:d', // Last 24 hours for fresh content
    }),
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('Firecrawl search error:', data);
    return [];
  }

  return data.data || [];
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
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    
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

    console.log('Starting Firecrawl-powered research for campaign:', campaign.name);

    // Update agent state to research phase
    await supabase
      .from('agent_state')
      .upsert({
        campaign_id,
        phase: 'research',
        last_run_at: new Date().toISOString(),
      }, { onConflict: 'campaign_id' });

    const findings: any[] = [];
    
    // Generate campaign-specific search queries based on product
    const productLower = campaign.product.toLowerCase();
    let searchQueries: string[] = [];
    
    if (productLower.includes('airport') || productLower.includes('travel') || productLower.includes('buddy')) {
      // AirportBuddy campaign queries
      searchQueries = [
        'site:twitter.com OR site:x.com TSA wait times',
        'site:twitter.com OR site:x.com airport security line long',
        'site:twitter.com OR site:x.com airport delay security',
        'site:twitter.com OR site:x.com "how early" airport flight',
        'site:twitter.com OR site:x.com airport tips travel',
      ];
    } else if (productLower.includes('etsy') || productLower.includes('coloring') || productLower.includes('kids') || productLower.includes('prompted')) {
      // Etsy Kids Digital Downloads campaign queries
      searchQueries = [
        'site:twitter.com OR site:x.com kids coloring books activities',
        'site:twitter.com OR site:x.com toddler activities at home',
        'site:twitter.com OR site:x.com kids printable worksheets',
        'site:twitter.com OR site:x.com rainy day activities kids',
        'site:twitter.com OR site:x.com homeschool printables toddler',
        'site:twitter.com OR site:x.com preschool tracing letters',
      ];
    } else {
      // Generic product queries
      searchQueries = [
        `site:twitter.com OR site:x.com ${campaign.product}`,
      ];
    }
    
    console.log(`Using ${searchQueries.length} search queries for campaign: ${campaign.name}`);

    if (firecrawlApiKey) {
      console.log('Using Firecrawl to search for Twitter content');
      
      for (const query of searchQueries) {
        try {
          const results = await searchWithFirecrawl(query, firecrawlApiKey, 5);
          
          for (const result of results) {
            const url = result.url || '';
            const tweetId = extractTweetId(url);
            
            // Only include actual Twitter/X URLs with valid tweet IDs
            if (tweetId && (url.includes('twitter.com') || url.includes('x.com'))) {
              // Normalize URL format
              const normalizedUrl = `https://x.com/i/web/status/${tweetId}`;
              
              findings.push({
                campaign_id,
                title: `Tweet: ${(result.title || result.description || '').substring(0, 50)}...`,
                finding_type: 'twitter_opportunity',
                source_url: normalizedUrl,
                content: result.description || result.title || '',
                relevance_score: 8,
                processed: false,
              });
            }
          }
          
          console.log(`Found ${results.length} results for: ${query}`);
        } catch (err) {
          console.error('Firecrawl search error for query:', query, err);
        }
      }
    } else {
      console.log('FIRECRAWL_API_KEY not configured, using sample data');
      
      // Fallback sample tweets for testing
      const sampleTweets = [
        {
          title: "Tweet: TSA wait times at LAX are insane today...",
          source_url: "https://x.com/i/web/status/1875961234567890123",
          content: "TSA wait times at LAX are insane today. Been waiting 45 minutes!",
          relevance_score: 10,
        },
        {
          title: "Tweet: Flying out of JFK tomorrow, nervous about lines...",
          source_url: "https://x.com/i/web/status/1875962345678901234",
          content: "Flying out of JFK tomorrow morning. How early should I arrive?",
          relevance_score: 9,
        },
      ];

      for (const tweet of sampleTweets) {
        findings.push({
          campaign_id,
          ...tweet,
          finding_type: 'twitter_opportunity',
          processed: false,
        });
      }
    }

    // Deduplicate by source_url
    const uniqueFindings = findings.filter((finding, index, self) =>
      index === self.findIndex(f => f.source_url === finding.source_url)
    );

    // Check for existing findings to avoid duplicates
    const { data: existingFindings } = await supabase
      .from('research_findings')
      .select('source_url')
      .eq('campaign_id', campaign_id);
    
    const existingUrls = new Set((existingFindings || []).map(f => f.source_url));
    const newFindings = uniqueFindings.filter(f => !existingUrls.has(f.source_url));

    // Save new findings to database
    if (newFindings.length > 0) {
      const { error: insertError } = await supabase
        .from('research_findings')
        .insert(newFindings);

      if (insertError) {
        console.error('Error saving findings:', insertError);
      } else {
        console.log(`Saved ${newFindings.length} new Twitter research findings`);
      }
    } else {
      console.log('No new findings to save (all duplicates or empty)');
    }

    // Update agent state
    await supabase
      .from('agent_state')
      .update({
        phase: 'planning',
        opportunities_queued: newFindings.length,
      })
      .eq('campaign_id', campaign_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        findings_count: newFindings.length,
        platform: 'twitter',
        method: firecrawlApiKey ? 'firecrawl' : 'sample_data',
        findings: newFindings.map(f => ({ title: f.title, url: f.source_url, score: f.relevance_score }))
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
