import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  campaign_id?: string;
  tactic_id?: string;
  to_email: string;
  subject: string;
  content: string;
  from_name?: string;
  from_email?: string;
  dry_run?: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: EmailRequest = await req.json();
    const { 
      campaign_id, 
      tactic_id, 
      to_email, 
      subject, 
      content, 
      from_name = "Marketing", 
      from_email,
      dry_run = false 
    } = body;

    console.log(`Processing email request for campaign: ${campaign_id}, tactic: ${tactic_id}`);
    console.log(`To: ${to_email}, Subject: ${subject}`);

    // Validate required fields
    if (!to_email || !subject || !content) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to_email, subject, content" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use test domain if no custom domain configured
    // Users can update this once they verify their domain in Resend
    const senderEmail = from_email || "onboarding@resend.dev";
    const sender = `${from_name} <${senderEmail}>`;

    if (dry_run) {
      console.log("DRY RUN - Would send email:");
      console.log({ from: sender, to: to_email, subject, content });
      return new Response(
        JSON.stringify({ 
          success: true, 
          dry_run: true, 
          message: "Email would be sent",
          details: { from: sender, to: to_email, subject }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send the email
    const emailResponse = await resend.emails.send({
      from: sender,
      to: [to_email],
      subject: subject,
      html: formatEmailContent(content),
    });

    console.log("Email sent successfully:", emailResponse);

    // Log the action if we have campaign info
    if (campaign_id) {
      const { error: logError } = await supabase.from("actions_taken").insert({
        campaign_id,
        platform: "email",
        action_type: "email_sent",
        content: `Subject: ${subject}\n\n${content.substring(0, 500)}`,
        url: null,
        status: "completed",
        executed_at: new Date().toISOString(),
      });

      if (logError) {
        console.error("Error logging action:", logError);
      }

      // Mark tactic as executed if provided
      if (tactic_id) {
        const { error: updateError } = await supabase
          .from("marketing_tactics")
          .update({ executed: true })
          .eq("id", tactic_id);

        if (updateError) {
          console.error("Error updating tactic:", updateError);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        email_id: (emailResponse as any).id || "sent",
        message: "Email sent successfully" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in agent-send-email:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function formatEmailContent(content: string): string {
  // Convert plain text to basic HTML formatting
  const paragraphs = content.split("\n\n").map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        p {
          margin: 0 0 16px 0;
        }
      </style>
    </head>
    <body>
      ${paragraphs}
    </body>
    </html>
  `;
}
