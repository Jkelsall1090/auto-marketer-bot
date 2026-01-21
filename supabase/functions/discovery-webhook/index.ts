import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

interface DiscoveredPost {
  title: string;
  content: string;
  source_url: string;
  platform: string;
  author?: string;
  posted_at?: string;
}

interface WebhookPayload {
  campaign_id: string;
  findings: DiscoveredPost[];
  platform: string;
  run_id?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate webhook secret
    const webhookSecret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("DISCOVERY_WEBHOOK_SECRET");
    
    if (!expectedSecret) {
      console.error("DISCOVERY_WEBHOOK_SECRET not configured");
      return new Response(
        JSON.stringify({ error: "Webhook not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (webhookSecret !== expectedSecret) {
      console.error("Invalid webhook secret");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: WebhookPayload = await req.json();
    console.log(`Received ${payload.findings?.length || 0} findings for campaign ${payload.campaign_id} from ${payload.platform}`);

    if (!payload.campaign_id || !payload.findings || !Array.isArray(payload.findings)) {
      return new Response(
        JSON.stringify({ error: "Invalid payload: requires campaign_id and findings array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Filter out duplicates by source_url
    const existingUrls = new Set<string>();
    const { data: existingFindings } = await supabase
      .from("research_findings")
      .select("source_url")
      .eq("campaign_id", payload.campaign_id)
      .in("source_url", payload.findings.map(f => f.source_url).filter(Boolean));
    
    if (existingFindings) {
      existingFindings.forEach(f => existingUrls.add(f.source_url));
    }

    const newFindings = payload.findings.filter(f => f.source_url && !existingUrls.has(f.source_url));
    console.log(`${newFindings.length} new findings after deduplication`);

    if (newFindings.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No new findings to save",
          saved: 0,
          duplicates: payload.findings.length 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert new findings
    const recordsToInsert = newFindings.map(finding => ({
      campaign_id: payload.campaign_id,
      title: finding.title || "Untitled",
      content: finding.content || "",
      source_url: finding.source_url,
      finding_type: "social_post",
      relevance_score: 50, // Default score, will be updated by intent analysis
      processed: false,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("research_findings")
      .insert(recordsToInsert)
      .select("id");

    if (insertError) {
      console.error("Failed to insert findings:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to save findings", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Successfully saved ${inserted?.length || 0} findings`);

    // Update agent state
    await supabase
      .from("agent_state")
      .upsert({
        campaign_id: payload.campaign_id,
        phase: "idle",
        last_run_at: new Date().toISOString(),
        opportunities_queued: (inserted?.length || 0),
      }, { onConflict: "campaign_id" });

    return new Response(
      JSON.stringify({ 
        success: true, 
        saved: inserted?.length || 0,
        duplicates: payload.findings.length - newFindings.length,
        message: `Saved ${inserted?.length || 0} new findings from ${payload.platform}`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
