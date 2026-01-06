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
    const { campaign_id } = await req.json();
    
    if (!campaign_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'campaign_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    
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

    console.log('Starting research for campaign:', campaign.name);

    // Update agent state to research phase
    await supabase
      .from('agent_state')
      .upsert({
        campaign_id,
        phase: 'research',
        last_run_at: new Date().toISOString(),
      }, { onConflict: 'campaign_id' });

    const findings: any[] = [];
    const channels = campaign.channels as string[] || [];
    
    // Research queries based on product
    const searchQueries = [
      `${campaign.product} site:reddit.com`,
      `TSA wait times discussion site:reddit.com`,
      `airport travel tips ${new Date().getFullYear()}`,
      `flight delay app recommendations`,
      `best airport apps travelers`,
    ];

    // Use Firecrawl search if available
    if (firecrawlKey) {
      for (const query of searchQueries.slice(0, 3)) {
        try {
          console.log('Searching:', query);
          
          const response = await fetch('https://api.firecrawl.dev/v1/search', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query,
              limit: 5,
              tbs: 'qdr:w', // Last week
            }),
          });

          const data = await response.json();
          
          if (data.success && data.data) {
            for (const result of data.data) {
              findings.push({
                campaign_id,
                title: result.title || 'Untitled',
                finding_type: 'opportunity',
                source_url: result.url,
                content: result.description || result.markdown?.substring(0, 500),
                relevance_score: 7,
                processed: false,
              });
            }
          }
        } catch (err) {
          console.error('Search error for query:', query, err);
        }
      }
    } else {
      // Fallback: generate mock research findings for demo
      console.log('Firecrawl not configured, generating sample findings');
      
      const sampleFindings = [
        {
          title: "r/travel - Best apps for frequent flyers?",
          source_url: "https://reddit.com/r/travel/comments/example1",
          content: "Looking for apps that help with airport navigation and TSA wait times. Any recommendations?",
          relevance_score: 9,
        },
        {
          title: "r/flights - Long TSA lines frustration thread",
          source_url: "https://reddit.com/r/flights/comments/example2", 
          content: "Just spent 2 hours in TSA line at JFK. There has to be a better way to know wait times!",
          relevance_score: 10,
        },
        {
          title: "Facebook Travel Group - Airport hacks 2024",
          source_url: "https://facebook.com/groups/travelers/posts/example3",
          content: "Share your best airport hacks! I'm looking for ways to speed through security.",
          relevance_score: 8,
        },
        {
          title: "TikTok trending - #AirportHacks",
          source_url: "https://tiktok.com/tag/airporthacks",
          content: "Trending topic with 2.3M views - travelers sharing tips and asking for app recommendations.",
          relevance_score: 8,
        },
      ];

      for (const finding of sampleFindings) {
        findings.push({
          campaign_id,
          title: finding.title,
          finding_type: 'opportunity',
          source_url: finding.source_url,
          content: finding.content,
          relevance_score: finding.relevance_score,
          processed: false,
        });
      }
    }

    // Save findings to database
    if (findings.length > 0) {
      const { error: insertError } = await supabase
        .from('research_findings')
        .insert(findings);

      if (insertError) {
        console.error('Error saving findings:', insertError);
      } else {
        console.log(`Saved ${findings.length} research findings`);
      }
    }

    // Update agent state
    await supabase
      .from('agent_state')
      .update({
        phase: 'planning',
        opportunities_queued: findings.length,
      })
      .eq('campaign_id', campaign_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        findings_count: findings.length,
        findings: findings.map(f => ({ title: f.title, url: f.source_url, score: f.relevance_score }))
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
