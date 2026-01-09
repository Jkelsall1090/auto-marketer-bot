import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.89.0";

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
    
    // Get campaign channels (defaults to twitter if not set)
    const campaignChannels: string[] = Array.isArray(campaign.channels) ? campaign.channels : ['twitter'];
    console.log(`Campaign channels: ${campaignChannels.join(', ')}`);
    
    // Generate campaign-specific search queries based on product and channels
    const productLower = campaign.product.toLowerCase();
    
    // Build per-platform search queries (one query per platform for better results)
    const getSiteFiltersForChannel = (channel: string): string[] => {
      switch (channel) {
        case 'twitter': return ['site:twitter.com OR site:x.com'];
        case 'craigslist': return ['site:craigslist.org'];
        case 'nextdoor': return ['site:nextdoor.com'];
        case 'reddit': return ['site:reddit.com'];
        case 'facebook': return ['site:facebook.com'];
        default: return [];
      }
    };
    
    // Get all site filters for selected channels
    const channelSiteFilters: { channel: string; filter: string }[] = [];
    for (const channel of campaignChannels) {
      const filters = getSiteFiltersForChannel(channel);
      for (const filter of filters) {
        channelSiteFilters.push({ channel, filter });
      }
    }
    
    // Default to Twitter if no channels
    if (channelSiteFilters.length === 0) {
      channelSiteFilters.push({ channel: 'twitter', filter: 'site:twitter.com OR site:x.com' });
    }
    
    console.log(`Will search ${channelSiteFilters.length} platform filter(s)`);
    
    let searchQueries: { query: string; channel: string }[] = [];
    
    // Get base query terms based on product
    let baseQueryTerms: string[] = [];
    
    if (productLower.includes('airport') || productLower.includes('travel') || productLower.includes('buddy')) {
      baseQueryTerms = [
        'TSA wait times',
        'airport security line long',
        'airport delay security',
        '"how early" airport flight',
        'airport tips travel',
      ];
    } else if (productLower.includes('etsy') || productLower.includes('coloring') || productLower.includes('kids') || productLower.includes('prompted')) {
      baseQueryTerms = [
        '"keep kids busy"',
        '"toddler bored" activities',
        '"rainy day" kids indoor',
        '"screen free" activities kids',
        'preschool homeschool activities',
        '"kids crafts" printable',
        '"quiet time" toddler activities',
        '"what to do" kids home',
        'coloring pages kids',
        '"summer activities" kids',
      ];
    } else if (productLower.includes('cover letter') || productLower.includes('coverletter')) {
      baseQueryTerms = [
        '"writing cover letter" help',
        '"cover letter tips"',
        '"job application" frustrated',
        '"applying for jobs" tired',
        '"hate writing" cover letter',
        '"job hunt" advice',
        '"resume and cover letter"',
        '"how to write" cover letter',
        '"job search" struggling',
        '"career change" application',
      ];
    } else {
      baseQueryTerms = [campaign.product];
    }
    
    // Build search queries for each channel-filter combo
    for (const { channel, filter } of channelSiteFilters) {
      for (const term of baseQueryTerms) {
        searchQueries.push({ query: `${filter} ${term}`, channel });
      }
    }
    
    console.log(`Using ${searchQueries.length} search queries for campaign: ${campaign.name}`);

    if (firecrawlApiKey) {
      console.log(`Searching across ${channelSiteFilters.length} channel(s): ${campaignChannels.join(', ')}`);
      
      for (const { query, channel } of searchQueries) {
        try {
          const results = await searchWithFirecrawl(query, firecrawlApiKey, 5);
          
          for (const result of results) {
            const url = result.url || '';
            
            // Determine platform and finding type from URL
            let findingType = 'general_opportunity';
            let title = '';
            let normalizedUrl = url;
            
            if (url.includes('twitter.com') || url.includes('x.com')) {
              const tweetId = extractTweetId(url);
              if (tweetId) {
                normalizedUrl = `https://x.com/i/web/status/${tweetId}`;
                findingType = 'twitter_opportunity';
                title = `Tweet: ${(result.title || result.description || '').substring(0, 50)}...`;
              } else {
                continue; // Skip Twitter URLs without valid tweet IDs
              }
            } else if (url.includes('craigslist.org')) {
              findingType = 'craigslist_opportunity';
              title = `Craigslist: ${(result.title || result.description || '').substring(0, 50)}...`;
            } else if (url.includes('nextdoor.com')) {
              findingType = 'nextdoor_opportunity';
              title = `Nextdoor: ${(result.title || result.description || '').substring(0, 50)}...`;
            } else if (url.includes('reddit.com')) {
              findingType = 'reddit_opportunity';
              title = `Reddit: ${(result.title || result.description || '').substring(0, 50)}...`;
            } else if (url.includes('facebook.com')) {
              findingType = 'facebook_opportunity';
              title = `Facebook: ${(result.title || result.description || '').substring(0, 50)}...`;
            } else {
              title = `Post: ${(result.title || result.description || '').substring(0, 50)}...`;
            }
            
            findings.push({
              campaign_id,
              title,
              finding_type: findingType,
              source_url: normalizedUrl,
              content: result.description || result.title || '',
              relevance_score: 8,
              processed: false,
            });
          }
          
          console.log(`[${channel}] Found ${results.length} results for: ${query}`);
        } catch (err) {
          console.error('Firecrawl search error for query:', query, err);
        }
      }
    } else {
      console.log('FIRECRAWL_API_KEY not configured, using sample data');
      
      // Fallback sample posts for testing (includes Reddit)
      const samplePosts = [
        {
          title: "Tweet: TSA wait times at LAX are insane today...",
          source_url: "https://x.com/i/web/status/1875961234567890123",
          content: "TSA wait times at LAX are insane today. Been waiting 45 minutes!",
          relevance_score: 10,
          finding_type: 'twitter_opportunity',
        },
        {
          title: "Tweet: Flying out of JFK tomorrow, nervous about lines...",
          source_url: "https://x.com/i/web/status/1875962345678901234",
          content: "Flying out of JFK tomorrow morning. How early should I arrive?",
          relevance_score: 9,
          finding_type: 'twitter_opportunity',
        },
        {
          title: "Reddit: Best activities for toddlers on rainy days?",
          source_url: "https://reddit.com/r/Parenting/comments/sample123/best_activities_for_toddlers",
          content: "Looking for screen-free activities to keep my 3 year old busy on rainy days. Any ideas?",
          relevance_score: 9,
          finding_type: 'reddit_opportunity',
        },
        {
          title: "Reddit: Cover letter writing is so frustrating...",
          source_url: "https://reddit.com/r/jobs/comments/sample456/cover_letter_frustration",
          content: "I've applied to 50 jobs and writing unique cover letters for each is exhausting. There has to be a better way.",
          relevance_score: 10,
          finding_type: 'reddit_opportunity',
        },
        {
          title: "Nextdoor: Looking for kid-friendly activities nearby",
          source_url: "https://nextdoor.com/p/sample789/",
          content: "New to the neighborhood! Looking for recommendations on activities to keep my kids entertained this summer.",
          relevance_score: 9,
          finding_type: 'nextdoor_opportunity',
        },
        {
          title: "Nextdoor: Anyone know good tutors in the area?",
          source_url: "https://nextdoor.com/p/sample012/",
          content: "My daughter needs help with reading. Anyone have recommendations for tutors or educational resources?",
          relevance_score: 8,
          finding_type: 'nextdoor_opportunity',
        },
      ];

      for (const post of samplePosts) {
        findings.push({
          campaign_id,
          ...post,
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
