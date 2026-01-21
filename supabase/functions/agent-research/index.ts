import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Intent categories as defined in the agent spec
type IntentCategory = 
  | 'explicit_help_request'
  | 'implicit_pain_struggle'
  | 'solution_research_comparison'
  | 'general_discussion_opinion'
  | 'promotional_irrelevant';

type RecommendedNextStep = 'ignore' | 'review' | 'high_priority';

interface IntentAnalysis {
  platform: string;
  url: string;
  intent_category: IntentCategory;
  intent_score: number;
  should_human_review: boolean;
  confidence_reasoning: string;
  core_problem: string;
  underlying_motivation: string;
  constraints: string[];
  emotional_signals: string[];
  matched_campaign_themes: string[];
  recommended_next_step: RecommendedNextStep;
}

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

// Infer platform from URL
function inferPlatform(url: string): string {
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
  if (url.includes('reddit.com')) return 'reddit';
  if (url.includes('nextdoor.com')) return 'nextdoor';
  if (url.includes('facebook.com')) return 'facebook';
  if (url.includes('linkedin.com')) return 'linkedin';
  if (url.includes('craigslist.org')) return 'craigslist';
  if (url.includes('amazon.com')) return 'amazon';
  return 'unknown';
}

// Search using Firecrawl to find content
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

// Analyze intent using Lovable AI
async function analyzeIntent(
  campaign: any,
  post: { url: string; title: string; content: string; platform: string }
): Promise<IntentAnalysis | null> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  
  if (!lovableApiKey) {
    console.log('LOVABLE_API_KEY not configured, skipping intent analysis');
    return null;
  }

  const systemPrompt = `You are an Intent Detection & Market Signal Intelligence Agent.

Your role is DISCOVERY ONLY.

You must NEVER generate replies, comments, DMs, or outreach messages.

Your job is to analyze social posts and discussions and determine whether they express REAL, HIGH-INTENT NEED related to the provided campaign.

CAMPAIGN CONTEXT:
- Campaign: ${campaign.name}
- Product: ${campaign.product}
- Goals: ${JSON.stringify(campaign.goals || [])}
- Channels: ${JSON.stringify(campaign.channels || [])}

INTENT CLASSIFICATION (REQUIRED):
Classify into ONE category:
1. explicit_help_request - Directly asking for help, tools, recommendations, or guidance
2. implicit_pain_struggle - Expressing frustration, confusion, inefficiency, or dissatisfaction
3. solution_research_comparison - Evaluating tools, approaches, or vendors
4. general_discussion_opinion - Talking about a topic without seeking help
5. promotional_irrelevant - Selling, bragging, announcements, news, or unrelated content

INTENT SCORING (REQUIRED):
Return an intent_score from 0.00 to 1.00
- 0.80 – 1.00 → Strong opportunity (high-intent)
- 0.50 – 0.79 → Possible opportunity (review recommended)
- 0.00 – 0.49 → Ignore

Score based on: Urgency of language, Clarity of the problem, Recency, Engagement, Alignment with campaign themes

HARD RULES:
- DO NOT generate replies
- DO NOT suggest messaging or commenting
- DO NOT sell
- DO NOT fabricate intent
- Discovery ONLY

OUTPUT FORMAT (STRICT JSON ONLY):
{
  "platform": "",
  "url": "",
  "intent_category": "",
  "intent_score": 0.00,
  "should_human_review": true,
  "confidence_reasoning": "",
  "core_problem": "",
  "underlying_motivation": "",
  "constraints": [],
  "emotional_signals": [],
  "matched_campaign_themes": [],
  "recommended_next_step": "ignore | review | high_priority"
}`;

  const userPrompt = `Analyze this post for intent signals:

Platform: ${post.platform}
URL: ${post.url}
Title: ${post.title}
Content: ${post.content}

Return ONLY valid JSON with your analysis.`;

  try {
    const response = await fetch('https://api.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      console.error('Lovable AI error:', await response.text());
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error('No content in AI response');
      return null;
    }

    const analysis = JSON.parse(content) as IntentAnalysis;
    console.log(`Intent analysis for ${post.url}: score=${analysis.intent_score}, category=${analysis.intent_category}`);
    return analysis;
  } catch (error) {
    console.error('Intent analysis error:', error);
    return null;
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

    console.log('Starting Intent Detection research for campaign:', campaign.name);

    // Update agent state to research phase
    await supabase
      .from('agent_state')
      .upsert({
        campaign_id,
        phase: 'research',
        last_run_at: new Date().toISOString(),
      }, { onConflict: 'campaign_id' });

    const rawFindings: any[] = [];
    
    // Get campaign channels (defaults to twitter if not set)
    const campaignChannels: string[] = Array.isArray(campaign.channels) ? campaign.channels : ['twitter'];
    console.log(`Campaign channels: ${campaignChannels.join(', ')}`);
    
    // Generate campaign-specific search queries based on product and channels
    const productLower = campaign.product.toLowerCase();
    
    // Build per-platform search queries
    const getSiteFiltersForChannel = (channel: string): string[] => {
      switch (channel) {
        case 'twitter': return ['site:twitter.com OR site:x.com'];
        case 'craigslist': return ['site:craigslist.org'];
        case 'nextdoor': return ['site:nextdoor.com'];
        case 'reddit': return ['site:reddit.com'];
        case 'facebook': return ['site:facebook.com'];
        case 'linkedin': return ['site:linkedin.com'];
        case 'amazon': return ['site:amazon.com'];
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
    
    // Get base query terms based on product and channel type
    const getBaseQueryTerms = (channel: string): string[] => {
      // Amazon-specific queries for product research
      if (channel === 'amazon') {
        if (productLower.includes('etsy') || productLower.includes('coloring') || productLower.includes('kids') || productLower.includes('prompted')) {
          return [
            'best seller kids activity books',
            'top rated coloring books children',
            'best kids educational workbooks',
          ];
        } else if (productLower.includes('cover letter') || productLower.includes('coverletter')) {
          return [
            'best seller resume writing books',
            'top rated job search guides',
          ];
        } else if (productLower.includes('airport') || productLower.includes('travel') || productLower.includes('buddy')) {
          return [
            'best seller travel guides',
            'travel hacks guides',
          ];
        } else {
          return [`best seller ${campaign.product}`, `top rated ${campaign.product}`];
        }
      }
      
      // Social platform queries for lead generation
      if (productLower.includes('airport') || productLower.includes('travel') || productLower.includes('buddy')) {
        return [
          'TSA wait times',
          'airport security line long',
          '"how early" airport flight',
        ];
      } else if (productLower.includes('etsy') || productLower.includes('coloring') || productLower.includes('kids') || productLower.includes('prompted')) {
        return [
          '"keep kids busy"',
          '"screen free" activities kids',
          'coloring pages kids',
        ];
      } else if (productLower.includes('cover letter') || productLower.includes('coverletter')) {
        return [
          '"writing cover letter" help',
          '"job application" frustrated',
          '"how to write" cover letter',
        ];
      } else {
        return [campaign.product];
      }
    };
    
    // Build search queries for each channel-filter combo
    for (const { channel, filter } of channelSiteFilters) {
      const terms = getBaseQueryTerms(channel);
      for (const term of terms) {
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
            const platform = inferPlatform(url);
            
            // Normalize Twitter URLs
            let normalizedUrl = url;
            if (platform === 'twitter') {
              const tweetId = extractTweetId(url);
              if (tweetId) {
                normalizedUrl = `https://x.com/i/web/status/${tweetId}`;
              } else {
                continue; // Skip Twitter URLs without valid tweet IDs
              }
            }
            
            rawFindings.push({
              url: normalizedUrl,
              title: result.title || '',
              content: result.description || result.title || '',
              platform,
              channel,
            });
          }
          
          console.log(`[${channel}] Found ${results.length} results for: ${query}`);
        } catch (err) {
          console.error('Firecrawl search error for query:', query, err);
        }
      }
    } else {
      console.log('FIRECRAWL_API_KEY not configured, using sample data');
      
      // Fallback sample posts for testing
      const samplePosts = [
        {
          url: "https://x.com/i/web/status/1875961234567890123",
          title: "TSA wait times at LAX are insane today",
          content: "TSA wait times at LAX are insane today. Been waiting 45 minutes! Anyone know a way to check wait times before heading to airport?",
          platform: 'twitter',
          channel: 'twitter',
        },
        {
          url: "https://reddit.com/r/Parenting/comments/sample123/best_activities_for_toddlers",
          title: "Best activities for toddlers on rainy days?",
          content: "Looking for screen-free activities to keep my 3 year old busy on rainy days. We've tried coloring but she gets bored quickly. Any creative ideas?",
          platform: 'reddit',
          channel: 'reddit',
        },
        {
          url: "https://reddit.com/r/jobs/comments/sample456/cover_letter_frustration",
          title: "Cover letter writing is so frustrating",
          content: "I've applied to 50 jobs and writing unique cover letters for each is exhausting. There has to be a better way. How do you all handle this?",
          platform: 'reddit',
          channel: 'reddit',
        },
        {
          url: "https://nextdoor.com/p/sample789/",
          title: "Looking for kid-friendly activities",
          content: "New to the neighborhood! Looking for recommendations on activities to keep my kids entertained this summer. Any local gems?",
          platform: 'nextdoor',
          channel: 'nextdoor',
        },
      ];

      rawFindings.push(...samplePosts);
    }

    // Deduplicate by URL
    const uniqueFindings = rawFindings.filter((finding, index, self) =>
      index === self.findIndex(f => f.url === finding.url)
    );

    console.log(`Found ${uniqueFindings.length} unique posts, analyzing intent...`);

    // Analyze intent for each finding
    const analyzedFindings: any[] = [];
    
    for (const finding of uniqueFindings) {
      const analysis = await analyzeIntent(campaign, finding);
      
      // Determine finding type based on platform
      const findingTypeMap: Record<string, string> = {
        twitter: 'twitter_opportunity',
        reddit: 'reddit_opportunity',
        nextdoor: 'nextdoor_opportunity',
        facebook: 'facebook_opportunity',
        linkedin: 'linkedin_opportunity',
        craigslist: 'craigslist_opportunity',
        amazon: 'amazon_product',
      };
      
      const findingType = findingTypeMap[finding.platform] || 'general_opportunity';
      
      // Build the finding object
      const analyzedFinding: any = {
        campaign_id,
        title: `${finding.platform.charAt(0).toUpperCase() + finding.platform.slice(1)}: ${finding.title.substring(0, 50)}...`,
        finding_type: findingType,
        source_url: finding.url,
        content: finding.content,
        processed: false,
      };
      
      if (analysis) {
        // Add intent analysis data
        analyzedFinding.intent_category = analysis.intent_category;
        analyzedFinding.intent_score = analysis.intent_score;
        analyzedFinding.core_problem = analysis.core_problem;
        analyzedFinding.underlying_motivation = analysis.underlying_motivation;
        analyzedFinding.constraints = analysis.constraints;
        analyzedFinding.emotional_signals = analysis.emotional_signals;
        analyzedFinding.confidence_reasoning = analysis.confidence_reasoning;
        analyzedFinding.recommended_next_step = analysis.recommended_next_step;
        analyzedFinding.relevance_score = Math.round(analysis.intent_score * 10);
        
        // Only include findings with intent_score >= 0.50 (possible opportunity or better)
        if (analysis.intent_score >= 0.50) {
          analyzedFindings.push(analyzedFinding);
        } else {
          console.log(`Filtered out low-intent finding: ${finding.url} (score: ${analysis.intent_score})`);
        }
      } else {
        // No AI analysis available, include with default score
        analyzedFinding.relevance_score = 5;
        analyzedFinding.recommended_next_step = 'review';
        analyzedFindings.push(analyzedFinding);
      }
    }

    console.log(`${analyzedFindings.length} findings passed intent filter (score >= 0.50)`);

    // Check for existing findings to avoid duplicates
    const { data: existingFindings } = await supabase
      .from('research_findings')
      .select('source_url')
      .eq('campaign_id', campaign_id);
    
    const existingUrls = new Set((existingFindings || []).map(f => f.source_url));
    const newFindings = analyzedFindings.filter(f => !existingUrls.has(f.source_url));

    // Save new findings to database
    if (newFindings.length > 0) {
      const { error: insertError } = await supabase
        .from('research_findings')
        .insert(newFindings);

      if (insertError) {
        console.error('Error saving findings:', insertError);
      } else {
        console.log(`Saved ${newFindings.length} new intent-analyzed research findings`);
      }
    } else {
      console.log('No new findings to save (all duplicates or filtered out)');
    }

    // Update agent state
    await supabase
      .from('agent_state')
      .update({
        phase: 'planning',
        opportunities_queued: newFindings.length,
      })
      .eq('campaign_id', campaign_id);

    // Summary stats
    const highPriority = newFindings.filter(f => f.recommended_next_step === 'high_priority').length;
    const reviewNeeded = newFindings.filter(f => f.recommended_next_step === 'review').length;

    return new Response(
      JSON.stringify({ 
        success: true, 
        findings_count: newFindings.length,
        high_priority_count: highPriority,
        review_count: reviewNeeded,
        method: firecrawlApiKey ? 'firecrawl+intent_analysis' : 'sample_data+intent_analysis',
        findings: newFindings.map(f => ({ 
          title: f.title, 
          url: f.source_url, 
          intent_score: f.intent_score,
          intent_category: f.intent_category,
          recommended_next_step: f.recommended_next_step,
          core_problem: f.core_problem
        }))
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
