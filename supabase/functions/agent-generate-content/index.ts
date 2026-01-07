import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const maxPosts = Math.min(Math.max(quantity, 1), 50); // Clamp between 1 and 50
    console.log(`Generating ${maxPosts} posts for campaign ${campaign_id}, target platform: ${targetPlatform || 'all'}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
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

    // Get unprocessed findings
    // When targeting Twitter, we need to specifically query for findings with tweet status URLs
    let findingsQuery;
    
    if (finding_id) {
      findingsQuery = supabase
        .from('research_findings')
        .select('*')
        .eq('id', finding_id);
    } else if (targetPlatform === 'twitter') {
      // For Twitter, specifically query for findings with tweet status URLs
      // Use ilike to match /status/ patterns in twitter.com or x.com URLs
      findingsQuery = supabase
        .from('research_findings')
        .select('*')
        .eq('campaign_id', campaign_id)
        .eq('processed', false)
        .or('source_url.ilike.%twitter.com%/status/%,source_url.ilike.%x.com%/status/%')
        .order('relevance_score', { ascending: false })
        .limit(maxPosts + 5);
    } else {
      // General query for all findings
      findingsQuery = supabase
        .from('research_findings')
        .select('*')
        .eq('campaign_id', campaign_id)
        .eq('processed', false)
        .order('relevance_score', { ascending: false })
        .limit(50);
    }

    const { data: findings, error: findingsError } = await findingsQuery;

    console.log(`Found ${findings?.length || 0} unprocessed findings for campaign ${campaign_id}, target: ${targetPlatform || 'all'}`);

    if (findingsError || !findings?.length) {
      console.log('No findings found, error:', findingsError);
      const errorMsg = targetPlatform === 'twitter' 
        ? 'No valid tweet URLs found in research findings. Run research to find tweets first.'
        : 'No findings to process';
      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log sample of findings for debugging
    console.log('Sample findings:', findings.slice(0, 3).map(f => ({ id: f.id, url: f.source_url })));

    const inferPlatform = (url?: string | null) => {
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
    };

    // Check if a URL is a valid tweet status URL (can be replied to)
    const isValidTweetUrl = (url?: string | null) => {
      if (!url) return false;
      const u = url.toLowerCase();
      return (u.includes("twitter.com") || u.includes("x.com")) && u.includes("/status/");
    };

    const allFindings = findings ?? [];
    let selectedFindings = allFindings;

    // For Twitter, findings are already filtered by query to have valid status URLs
    if (targetPlatform === 'twitter') {
      selectedFindings = allFindings.slice(0, maxPosts);
      console.log(`Generating ${selectedFindings.length} ${targetPlatform} replies from tweet opportunities`);
    } else if (targetPlatform && targetPlatform !== 'all') {
      // Other specific platform
      selectedFindings = allFindings.slice(0, maxPosts);
      console.log(`Generating ${selectedFindings.length} ${targetPlatform} posts`);
    } else if (!finding_id) {
      // Default behavior: pick diverse platforms up to quantity
      const perPlatformCount: Record<string, number> = {};
      const picked: any[] = [];
      const maxPerPlatform = Math.ceil(maxPosts / 5); // Distribute across platforms

      for (const f of allFindings) {
        const p = inferPlatform(f.source_url);
        const count = perPlatformCount[p] ?? 0;
        if (count >= maxPerPlatform) continue;

        picked.push(f);
        perPlatformCount[p] = count + 1;

        if (picked.length >= maxPosts) break;
      }

      selectedFindings = picked.length ? picked : allFindings.slice(0, maxPosts);
    }

    console.log(
      `Generating content for ${selectedFindings.length} findings (from ${allFindings.length} opportunities)`
    );

    const tactics: any[] = [];

    for (const finding of selectedFindings) {
      // Determine platform - use target platform if specified, otherwise infer from URL
      let platform = targetPlatform && targetPlatform !== 'all' 
        ? targetPlatform 
        : inferPlatform(finding.source_url);

      // Generate content using Lovable AI
      if (lovableApiKey) {
        try {
          // Determine campaign-specific details
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
          } else {
            appUrl = campaign.product;
            productDescription = campaign.product;
            targetAudience = 'general';
          }
          
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
            default: `Write a helpful, natural response.
- Provide value first
- Include CTA with URL: ${appUrl}
- Match the platform tone`
          };
          
          const guidelines = platformGuidelines[platform] || platformGuidelines.default;
          
          const systemPrompt = `You are a helpful marketing assistant for ${productDescription}.

Product: ${campaign.product}
URL: ${appUrl}

RULES:
- ALWAYS include the URL (${appUrl}) in your response as plain text
- Never use markdown links like [text](url)
- Be genuinely helpful, not pushy
- ${guidelines}`;

          const userPrompt = `Generate a ${platform} response for this opportunity:

Title: ${finding.title}
Context: ${finding.content}
${finding.source_url ? `Source: ${finding.source_url}` : ''}

Write a ${platform === 'twitter' ? 'tweet (MAX 250 characters including URL!)' : platform === 'reddit' ? 'Reddit comment' : 'post'} that:
1. Addresses the user's actual concern or question
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
            const generatedContent = data.choices?.[0]?.message?.content;

            if (generatedContent) {
              tactics.push({
                campaign_id,
                platform,
                tactic_type: platform === 'reddit' ? 'comment' : platform === 'twitter' ? 'tweet' : 'post',
                content: generatedContent.trim(),
                target_audience: targetAudience,
                estimated_impact: finding.relevance_score >= 8 ? 'high' : 'medium',
                priority: finding.relevance_score,
                executed: false,
                source_finding_id: finding.id,
                source_url: finding.source_url,
                source_context: finding.content,
              });
            }
          } else {
            const errorText = await response.text();
            console.error('AI API error:', response.status, errorText);
          }
        } catch (err) {
          console.error('Content generation error:', err);
        }
      } else {
        // Fallback content generation (when no AI key)
        const productLower = campaign.product.toLowerCase();
        let appUrl: string;
        let templates: Record<string, string>;
        let targetAudience: string;
        
        if (productLower.includes('airport') || productLower.includes('travel') || productLower.includes('buddy')) {
          appUrl = 'https://airportbuddy.app/';
          targetAudience = 'travelers';
          templates = {
            reddit: `I've been using AirportBuddy for exactly this! It shows real-time TSA wait times so you know exactly when to head to the airport. Saved me from missing a flight last month. Check it out: ${appUrl}`,
            facebook: `Great question! For real-time TSA wait times, I recommend AirportBuddy (${appUrl}) - it's a free web app that shows current wait times at major US airports. Makes travel planning so much easier! 🛫`,
            twitter: `Skip the TSA guessing game ✈️ AirportBuddy shows real-time wait times so you know exactly when to arrive. ${appUrl}`,
            craigslist: `If you're flying soon, check out AirportBuddy - free app that shows real-time TSA wait times. Helps you know exactly when to leave: ${appUrl}`,
            nextdoor: `Hey neighbor! If you're traveling soon, I've found this really helpful - AirportBuddy shows current TSA wait times so you're not guessing: ${appUrl}`,
            general: `For real-time TSA wait times, AirportBuddy is a great free tool covering major US airports: ${appUrl}`,
          };
        } else if (productLower.includes('etsy') || productLower.includes('coloring') || productLower.includes('kids') || productLower.includes('prompted')) {
          appUrl = 'https://www.etsy.com/shop/PromptedbyJamesandCo';
          targetAudience = 'parents';
          templates = {
            twitter: `Keeping kids busy? 🎨 Check out these fun coloring & tracing printables - instant download! ${appUrl}`,
            reddit: `My kids love printable activities! We use coloring books and tracing sheets from this Etsy shop - instant downloads so you can print right away: ${appUrl}`,
            craigslist: `Great printable activities for kids - coloring books and tracing worksheets you can download instantly: ${appUrl}`,
            nextdoor: `Hey! If you need something to keep the kids busy, I've been using these printable coloring books and tracing sheets - instant download: ${appUrl}`,
            general: `Looking for kids activities? Check out these digital coloring books and tracing worksheets: ${appUrl}`,
          };
        } else if (productLower.includes('cover letter') || productLower.includes('coverletter')) {
          appUrl = 'https://coverletterai.app/?utm_source=twitter';
          targetAudience = 'job seekers';
          templates = {
            twitter: `Writing cover letters is painful 😅 Try CoverLetterAI - generates professional cover letters in seconds: ${appUrl}`,
            reddit: `I feel you on the cover letter struggle. I've been using CoverLetterAI lately - it generates solid drafts you can customize: ${appUrl}`,
            craigslist: `If you're job hunting, this might help - CoverLetterAI generates professional cover letters fast: ${appUrl}`,
            nextdoor: `Hey! Just saw you're job hunting. A neighbor recommended CoverLetterAI to me - makes writing cover letters so much easier: ${appUrl}`,
            linkedin: `Cover letter writing is one of the most time-consuming parts of job applications. I've found CoverLetterAI helpful for getting solid first drafts: ${appUrl}`,
            general: `Make cover letter writing easier with CoverLetterAI: ${appUrl}`,
          };
        } else {
          appUrl = campaign.product;
          targetAudience = 'general';
          templates = {
            general: `Check out ${campaign.product}`,
          };
        }

        tactics.push({
          campaign_id,
          platform,
          tactic_type: platform === 'reddit' ? 'comment' : 'post',
          content: templates[platform] || templates.general,
          target_audience: targetAudience,
          estimated_impact: 'medium',
          priority: finding.relevance_score,
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

    // Save tactics to database
    if (tactics.length > 0) {
      const { error: insertError } = await supabase
        .from('marketing_tactics')
        .insert(tactics);

      if (insertError) {
        console.error('Error saving tactics:', insertError);
      } else {
        console.log(`Generated ${tactics.length} marketing tactics`);
      }
    }

    // Update agent state
    await supabase
      .from('agent_state')
      .update({
        phase: 'execution',
      })
      .eq('campaign_id', campaign_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        tactics_count: tactics.length,
        tactics: tactics.map(t => ({ 
          platform: t.platform, 
          type: t.tactic_type,
          content: t.content.substring(0, 100) + '...',
          priority: t.priority 
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Content generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
