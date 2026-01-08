import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Search using Firecrawl API
async function searchWithFirecrawl(query: string, apiKey: string, limit: number = 10): Promise<any[]> {
  try {
    console.log(`Firecrawl search: "${query}" (limit: ${limit})`);
    
    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        limit,
        scrapeOptions: {
          formats: ['markdown'],
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Firecrawl API error:', response.status, errorText);
      return [];
    }

    const data = await response.json();
    console.log(`Firecrawl returned ${data.data?.length || 0} results`);
    return data.data || [];
  } catch (error) {
    console.error('Firecrawl search error:', error);
    return [];
  }
}

// Generate platform-specific search queries based on campaign and platform
function generateSearchQueries(campaign: any, platform: string): string[] {
  const productLower = campaign.product.toLowerCase();
  const queries: string[] = [];
  
  if (productLower.includes('cover letter') || productLower.includes('coverletter')) {
    // CoverLetterAI queries - Nextdoor isn't well-indexed by search engines
    // so we use broader community/neighborhood-themed job search queries
    if (platform === 'nextdoor') {
      queries.push('neighborhood job hunting advice 2024');
      queries.push('local community career networking tips');
      queries.push('job seekers community help resume cover letter');
      queries.push('neighbors helping with job search applications');
    } else if (platform === 'reddit') {
      queries.push('site:reddit.com cover letter help');
      queries.push('site:reddit.com job application advice');
      queries.push('site:reddit.com resume tips');
    } else if (platform === 'linkedin') {
      queries.push('site:linkedin.com job search tips');
      queries.push('site:linkedin.com cover letter advice');
    } else if (platform === 'craigslist') {
      queries.push('site:craigslist.org job hunting');
      queries.push('site:craigslist.org career services');
    } else if (platform === 'facebook') {
      queries.push('site:facebook.com job hunting group');
      queries.push('site:facebook.com career advice');
    } else {
      // General search for any platform
      queries.push('job hunting tips cover letter');
      queries.push('resume help job application');
    }
  } else if (productLower.includes('airport') || productLower.includes('travel') || productLower.includes('buddy')) {
    // AirportBuddy queries - Nextdoor isn't well-indexed, use broader travel queries
    if (platform === 'nextdoor') {
      queries.push('neighborhood airport travel tips 2024');
      queries.push('local community travel advice flying');
      queries.push('neighbors airport recommendations TSA');
    } else if (platform === 'reddit') {
      queries.push('site:reddit.com TSA wait times');
      queries.push('site:reddit.com airport travel tips');
    } else if (platform === 'craigslist') {
      queries.push('site:craigslist.org airport transportation');
      queries.push('site:craigslist.org travel tips');
    } else {
      queries.push('airport travel tips TSA');
      queries.push('flight travel advice');
    }
  } else if (productLower.includes('etsy') || productLower.includes('coloring') || productLower.includes('kids')) {
    // Etsy shop queries
    if (platform === 'nextdoor') {
      queries.push('site:nextdoor.com kids activities');
      queries.push('site:nextdoor.com children crafts');
    } else if (platform === 'reddit') {
      queries.push('site:reddit.com kids coloring activities');
      queries.push('site:reddit.com children printables');
    } else if (platform === 'facebook') {
      queries.push('site:facebook.com kids activities printables');
    } else {
      queries.push('kids coloring activities printables');
    }
  } else {
    // Generic queries
    queries.push(`${campaign.product} recommendations`);
    queries.push(`${campaign.product} help`);
  }
  
  return queries;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaign_id, finding_id, platform: targetPlatform, quantity = 10 } = await req.json();
    
    if (!campaign_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'campaign_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const maxPosts = Math.min(Math.max(quantity, 1), 50);
    console.log(`Generating ${maxPosts} posts for campaign ${campaign_id}, target platform: ${targetPlatform || 'all'}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaign_id)
      .single();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ success: false, error: 'Campaign not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine campaign-specific details upfront
    const productLower = campaign.product.toLowerCase();
    let appUrl: string;
    let productDescription: string;
    let targetAudience: string;
    
    if (productLower.includes('airport') || productLower.includes('travel') || productLower.includes('buddy')) {
      appUrl = 'https://airportbuddy.app/';
      productDescription = 'AirportBuddy - a free app that shows real-time TSA wait times at US airports';
      targetAudience = 'travelers';
    } else if (productLower.includes('etsy') || productLower.includes('coloring') || productLower.includes('kids') || productLower.includes('prompted')) {
      appUrl = 'https://www.etsy.com/shop/PromptedbyJamesandCo';
      productDescription = 'PromptedbyJamesandCo - an Etsy shop with kids coloring books, tracing worksheets, and educational digital downloads';
      targetAudience = 'parents';
    } else if (productLower.includes('cover letter') || productLower.includes('coverletter')) {
      appUrl = 'https://coverletterai.app/?utm_source=marketing';
      productDescription = 'CoverLetterAI - AI-powered cover letter generator that creates professional cover letters in seconds';
      targetAudience = 'job seekers';
    } else {
      appUrl = campaign.product;
      productDescription = campaign.product;
      targetAudience = 'general';
    }

    let findings: any[] = [];
    let searchResults: any[] = [];
    let usedFirecrawlSearch = false;

    // For non-Twitter platforms, try to find existing findings first, then fall back to Firecrawl search
    if (targetPlatform && targetPlatform !== 'twitter' && targetPlatform !== 'all') {
      // Try to get existing findings for this platform
      const platformFilter = `%${targetPlatform}%`;
      const { data: existingFindings } = await supabase
        .from('research_findings')
        .select('*')
        .eq('campaign_id', campaign_id)
        .eq('processed', false)
        .ilike('source_url', platformFilter)
        .order('relevance_score', { ascending: false })
        .limit(maxPosts + 5);

      if (existingFindings && existingFindings.length > 0) {
        console.log(`Found ${existingFindings.length} existing findings for ${targetPlatform}`);
        findings = existingFindings;
      } else if (firecrawlApiKey) {
        // No existing findings - use Firecrawl to search for content
        console.log(`No existing findings for ${targetPlatform}, searching with Firecrawl...`);
        usedFirecrawlSearch = true;
        
        const queries = generateSearchQueries(campaign, targetPlatform);
        console.log(`Generated ${queries.length} search queries for ${targetPlatform}`);
        
        for (const query of queries) {
          const results = await searchWithFirecrawl(query, firecrawlApiKey, Math.ceil(maxPosts / queries.length) + 2);
          searchResults.push(...results);
          
          if (searchResults.length >= maxPosts) break;
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.log(`Firecrawl found ${searchResults.length} total results`);
      } else {
        console.log(`No Firecrawl API key configured, cannot search for ${targetPlatform} content`);
      }
    } else if (targetPlatform === 'twitter') {
      // For Twitter, query for tweet status URLs
      const { data: twitterFindings } = await supabase
        .from('research_findings')
        .select('*')
        .eq('campaign_id', campaign_id)
        .eq('processed', false)
        .or('source_url.ilike.%twitter.com%/status/%,source_url.ilike.%x.com%/status/%')
        .order('relevance_score', { ascending: false })
        .limit(maxPosts + 5);

      if (twitterFindings && twitterFindings.length > 0) {
        findings = twitterFindings;
      } else {
        return new Response(
          JSON.stringify({ success: false, error: 'No valid tweet URLs found. Run research to find tweets first.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (finding_id) {
      // Specific finding requested
      const { data: specificFinding } = await supabase
        .from('research_findings')
        .select('*')
        .eq('id', finding_id);
      
      if (specificFinding) {
        findings = specificFinding;
      }
    } else {
      // General query for all findings
      const { data: allFindings } = await supabase
        .from('research_findings')
        .select('*')
        .eq('campaign_id', campaign_id)
        .eq('processed', false)
        .order('relevance_score', { ascending: false })
        .limit(50);

      findings = allFindings || [];
    }

    // If we have no findings and no search results, return error
    if (findings.length === 0 && searchResults.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `No content opportunities found for ${targetPlatform || 'any platform'}. ${!firecrawlApiKey ? 'Firecrawl API key not configured.' : ''}` 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing: ${findings.length} findings, ${searchResults.length} search results`);

    const tactics: any[] = [];

    const platformGuidelines: Record<string, string> = {
      twitter: `CRITICAL: Tweet must be UNDER 250 characters (leave room for URL). 
- Be concise and punchy
- Include a clear CTA with the URL: ${appUrl}
- Use 1-2 relevant emojis max
- No hashtags cluttering the message`,
      reddit: `Write a helpful, conversational Reddit comment (300-500 chars).
- Address the specific question/problem
- Provide genuine value first
- Naturally mention the product with URL: ${appUrl}
- Don't be salesy`,
      craigslist: `Write a helpful Craigslist-style response (200-400 chars).
- Be direct and practical
- Reference the specific need in their post
- Include URL: ${appUrl}
- Keep it simple and local-feeling`,
      nextdoor: `Write a friendly Nextdoor neighbor-style comment (200-400 chars).
- Be warm and helpful like talking to a neighbor
- Reference local/community context if possible
- Include URL: ${appUrl}
- Keep it casual and genuine`,
      linkedin: `Write a professional LinkedIn comment (200-400 chars).
- Be thoughtful and professional
- Add industry insight
- Include URL: ${appUrl}
- Avoid being too casual`,
      facebook: `Write a friendly Facebook comment (200-400 chars).
- Be conversational and helpful
- Reference the community or group context
- Include URL: ${appUrl}
- Keep it social and genuine`,
      default: `Write a helpful, natural response.
- Provide value first
- Include CTA with URL: ${appUrl}
- Match the platform tone`
    };

    // Process existing findings
    for (const finding of findings.slice(0, maxPosts)) {
      const platform = targetPlatform && targetPlatform !== 'all' ? targetPlatform : inferPlatform(finding.source_url);
      const guidelines = platformGuidelines[platform] || platformGuidelines.default;
      
      const content = await generateContent(
        lovableApiKey,
        productDescription,
        campaign.product,
        appUrl,
        guidelines,
        platform,
        finding.title,
        finding.content,
        finding.source_url
      );

      if (content) {
        tactics.push({
          campaign_id,
          platform,
          tactic_type: platform === 'reddit' ? 'comment' : platform === 'twitter' ? 'tweet' : 'post',
          content: content.trim(),
          target_audience: targetAudience,
          estimated_impact: finding.relevance_score >= 8 ? 'high' : 'medium',
          priority: finding.relevance_score || 7,
          executed: false,
          source_finding_id: finding.id,
          source_url: finding.source_url,
          source_context: finding.content,
        });
      }

      // Mark finding as processed
      await supabase
        .from('research_findings')
        .update({ processed: true })
        .eq('id', finding.id);
    }

    // Process Firecrawl search results (for non-Twitter platforms when no findings exist)
    for (const result of searchResults.slice(0, maxPosts - tactics.length)) {
      const platform = targetPlatform || 'general';
      const guidelines = platformGuidelines[platform] || platformGuidelines.default;
      
      const title = result.title || 'Opportunity';
      const context = result.description || result.markdown?.substring(0, 500) || '';
      const sourceUrl = result.url || '';
      
      const content = await generateContent(
        lovableApiKey,
        productDescription,
        campaign.product,
        appUrl,
        guidelines,
        platform,
        title,
        context,
        sourceUrl
      );

      if (content) {
        tactics.push({
          campaign_id,
          platform,
          tactic_type: 'post',
          content: content.trim(),
          target_audience: targetAudience,
          estimated_impact: 'medium',
          priority: 7,
          executed: false,
          source_finding_id: null,
          source_url: sourceUrl,
          source_context: context.substring(0, 500),
        });
      }
    }

    // Save tactics to database
    if (tactics.length > 0) {
      const { error: insertError } = await supabase
        .from('marketing_tactics')
        .insert(tactics);

      if (insertError) {
        console.error('Error saving tactics:', insertError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to save tactics' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Update agent state
    await supabase
      .from('agent_state')
      .upsert({
        campaign_id,
        current_phase: 'execution',
        last_action: `Generated ${tactics.length} ${targetPlatform || 'mixed'} posts${usedFirecrawlSearch ? ' (via Firecrawl search)' : ''}`,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'campaign_id' });

    console.log(`Successfully generated ${tactics.length} tactics`);

    return new Response(
      JSON.stringify({
        success: true,
        count: tactics.length,
        usedFirecrawlSearch,
        summary: tactics.map(t => ({
          platform: t.platform,
          preview: t.content.substring(0, 80) + '...',
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in agent-generate-content:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function inferPlatform(url?: string | null): string {
  const u = (url ?? "").toLowerCase();
  if (u.includes("reddit")) return "reddit";
  if (u.includes("facebook")) return "facebook";
  if (u.includes("twitter") || u.includes("x.com")) return "twitter";
  if (u.includes("craigslist")) return "craigslist";
  if (u.includes("nextdoor")) return "nextdoor";
  if (u.includes("tiktok")) return "tiktok";
  if (u.includes("instagram")) return "instagram";
  if (u.includes("linkedin")) return "linkedin";
  return "general";
}

async function generateContent(
  lovableApiKey: string | undefined,
  productDescription: string,
  product: string,
  appUrl: string,
  guidelines: string,
  platform: string,
  title: string,
  context: string,
  sourceUrl?: string
): Promise<string | null> {
  if (!lovableApiKey) {
    // Fallback templates
    const templates: Record<string, Record<string, string>> = {
      coverletter: {
        twitter: `Writing cover letters is painful 😅 Try CoverLetterAI - generates professional cover letters in seconds: ${appUrl}`,
        reddit: `I feel you on the cover letter struggle. I've been using CoverLetterAI lately - it generates solid drafts you can customize: ${appUrl}`,
        craigslist: `If you're job hunting, this might help - CoverLetterAI generates professional cover letters fast: ${appUrl}`,
        nextdoor: `Hey neighbor! Job hunting can be tough. A friend recommended CoverLetterAI to me - makes writing cover letters so much easier: ${appUrl}`,
        linkedin: `Cover letter writing is one of the most time-consuming parts of job applications. I've found CoverLetterAI helpful for getting solid first drafts: ${appUrl}`,
        facebook: `If you're job hunting, check out CoverLetterAI - it generates professional cover letters in seconds: ${appUrl}`,
        default: `Make cover letter writing easier with CoverLetterAI: ${appUrl}`,
      },
      airport: {
        twitter: `Skip the TSA guessing game ✈️ AirportBuddy shows real-time wait times so you know exactly when to arrive. ${appUrl}`,
        nextdoor: `Hey neighbor! If you're traveling soon, I've found this really helpful - AirportBuddy shows current TSA wait times: ${appUrl}`,
        default: `For real-time TSA wait times, AirportBuddy is a great free tool: ${appUrl}`,
      },
      default: {
        default: `Check out ${product}: ${appUrl}`,
      },
    };
    
    const productKey = product.toLowerCase().includes('cover') ? 'coverletter' : 
                       product.toLowerCase().includes('airport') ? 'airport' : 'default';
    const productTemplates = templates[productKey] || templates.default;
    return productTemplates[platform] || productTemplates.default;
  }

  try {
    const systemPrompt = `You are a helpful marketing assistant for ${productDescription}.

Product: ${product}
URL: ${appUrl}

RULES:
- ALWAYS include the URL (${appUrl}) in your response as plain text
- Never use markdown links like [text](url)
- Be genuinely helpful, not pushy
- ${guidelines}`;

    const userPrompt = `Generate a ${platform} response for this opportunity:

Title: ${title}
Context: ${context}
${sourceUrl ? `Source: ${sourceUrl}` : ''}

Write a ${platform === 'twitter' ? 'tweet (MAX 250 characters including URL!)' : platform === 'reddit' ? 'Reddit comment' : 'post'} that:
1. Addresses a relevant concern or question that people have
2. Provides helpful value related to ${productDescription}
3. MUST include ${appUrl} as plain text

${platform === 'twitter' ? 'IMPORTANT: Keep it SHORT - under 250 chars total!' : ''}

Return ONLY the final content text, nothing else.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices?.[0]?.message?.content || null;
    } else {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      return null;
    }
  } catch (err) {
    console.error('Content generation error:', err);
    return null;
  }
}
