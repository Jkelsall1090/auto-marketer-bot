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
    const { campaign_id, finding_id } = await req.json();
    
    if (!campaign_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'campaign_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
    let findingsQuery = supabase
      .from('research_findings')
      .select('*')
      .eq('campaign_id', campaign_id)
      .eq('processed', false)
      .order('relevance_score', { ascending: false })
      .limit(5);

    if (finding_id) {
      findingsQuery = supabase
        .from('research_findings')
        .select('*')
        .eq('id', finding_id);
    }

    const { data: findings, error: findingsError } = await findingsQuery;

    if (findingsError || !findings?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'No findings to process' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating content for ${findings.length} findings`);

    const tactics: any[] = [];

    for (const finding of findings) {
      // Determine platform from URL
      let platform = 'general';
      if (finding.source_url?.includes('reddit')) platform = 'reddit';
      else if (finding.source_url?.includes('facebook')) platform = 'facebook';
      else if (finding.source_url?.includes('twitter') || finding.source_url?.includes('x.com')) platform = 'twitter';
      else if (finding.source_url?.includes('tiktok')) platform = 'tiktok';
      else if (finding.source_url?.includes('instagram')) platform = 'instagram';

      // Generate content using Lovable AI
      if (lovableApiKey) {
        try {
          const systemPrompt = `You are a helpful marketing assistant for ${campaign.name}. 
Product: ${campaign.product}
Goals: ${JSON.stringify(campaign.goals)}

Generate authentic, helpful content that naturally mentions the product value. 
- Never be pushy or salesy
- Provide genuine value first
- Keep it conversational and natural
- Match the platform's tone and style`;

          const userPrompt = `Generate a ${platform} response for this opportunity:

Title: ${finding.title}
Context: ${finding.content}
URL: ${finding.source_url}

Create a helpful, authentic ${platform === 'reddit' ? 'comment' : platform === 'twitter' ? 'tweet' : 'post'} that:
1. Addresses the user's actual question/pain point
2. Provides genuine value
3. Naturally mentions the app as a solution (not as an ad)
4. Fits the ${platform} platform style

Return ONLY the content text, no explanations.`;

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
                target_audience: 'travelers',
                estimated_impact: finding.relevance_score >= 8 ? 'high' : 'medium',
                priority: finding.relevance_score,
                executed: false,
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
        // Fallback content generation
        const templates: Record<string, string> = {
          reddit: `I've been using AirportBuddy for exactly this! It shows real-time TSA wait times so you know exactly when to head to the airport. Saved me from missing a flight at LAX last month when wait times spiked unexpectedly. It's a free web app at [link].`,
          facebook: `Great question! For real-time TSA wait times, I recommend checking out AirportBuddy - it's a free web app that shows current wait times at major US airports. Makes travel planning so much easier! 🛫`,
          twitter: `Pro tip for frequent flyers: AirportBuddy shows real-time TSA wait times so you never have to guess. Game changer for stress-free travel ✈️ #TravelTips #AirportHacks`,
          tiktok: `POV: You stop stressing about TSA lines because AirportBuddy tells you exactly how long the wait is before you leave home 🎯✈️ #traveltok #airporthacks #tsawait`,
          general: `If you're looking for real-time TSA wait times, AirportBuddy is a great free tool. It covers major US airports and helps you plan when to arrive. Has been really helpful for my travels!`,
        };

        tactics.push({
          campaign_id,
          platform,
          tactic_type: platform === 'reddit' ? 'comment' : 'post',
          content: templates[platform] || templates.general,
          target_audience: 'travelers',
          estimated_impact: 'medium',
          priority: finding.relevance_score,
          executed: false,
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
