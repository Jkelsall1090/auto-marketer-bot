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
    const { campaign_id, phase, platform } = await req.json();
    
    if (!campaign_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'campaign_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Agent run started for campaign ${campaign_id}, platform: ${platform || 'all'}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get campaign
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

    if (campaign.status !== 'active') {
      return new Response(
        JSON.stringify({ success: false, error: 'Campaign is not active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create run log
    const { data: runLog } = await supabase
      .from('agent_run_logs')
      .insert({
        campaign_id,
        run_started_at: new Date().toISOString(),
      })
      .select()
      .single();

    const results: any = {
      campaign_id,
      campaign_name: campaign.name,
      run_id: runLog?.id,
      phases_completed: [],
      errors: [],
    };

    // Determine which phase to run
    const targetPhase = phase || 'full';

    // PHASE 1: Research
    if (targetPhase === 'full' || targetPhase === 'research') {
      console.log('Running research phase...');
      try {
        const researchResponse = await fetch(`${supabaseUrl}/functions/v1/agent-research`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ campaign_id }),
        });
        
        const researchData = await researchResponse.json();
        results.research = researchData;
        results.phases_completed.push('research');
      } catch (err: any) {
        console.error('Research phase error:', err);
        results.errors.push({ phase: 'research', error: err.message });
      }
    }

    // PHASE 2: Content Generation
    if (targetPhase === 'full' || targetPhase === 'planning') {
      console.log('Running content generation phase...');
      try {
        const contentResponse = await fetch(`${supabaseUrl}/functions/v1/agent-generate-content`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ campaign_id, platform }),
        });
        
        const contentData = await contentResponse.json();
        results.content_generation = contentData;
        results.phases_completed.push('planning');
      } catch (err: any) {
        console.error('Content generation phase error:', err);
        results.errors.push({ phase: 'planning', error: err.message });
      }
    }

    // Update run log
    if (runLog) {
      await supabase
        .from('agent_run_logs')
        .update({
          run_completed_at: new Date().toISOString(),
          phase_completed: results.phases_completed[results.phases_completed.length - 1] || 'idle',
          actions_count: results.content_generation?.tactics_count || 0,
          errors_count: results.errors.length,
          summary: `Completed phases: ${results.phases_completed.join(', ')}. Generated ${results.content_generation?.tactics_count || 0} content pieces.`,
        })
        .eq('id', runLog.id);
    }

    // Update agent state with next run time
    const nextRunAt = new Date();
    nextRunAt.setHours(nextRunAt.getHours() + 6); // Next run in 6 hours

    await supabase
      .from('agent_state')
      .upsert({
        campaign_id,
        phase: 'idle',
        last_run_at: new Date().toISOString(),
        next_run_at: nextRunAt.toISOString(),
        opportunities_queued: results.research?.findings_count || 0,
      }, { onConflict: 'campaign_id' });

    return new Response(
      JSON.stringify({ 
        success: true, 
        ...results,
        next_run_at: nextRunAt.toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Agent run error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
