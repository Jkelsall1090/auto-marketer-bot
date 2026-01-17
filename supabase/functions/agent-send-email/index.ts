import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { Resend } from "https://esm.sh/resend@2.0.0";
import React from "https://esm.sh/react@18.3.1";
import { renderAsync } from "https://esm.sh/@react-email/components@0.0.22";
import { MarketingEmail } from "./_templates/marketing.tsx";
import { NewsletterEmail } from "./_templates/newsletter.tsx";
import { OutreachEmail } from "./_templates/outreach.tsx";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type EmailTemplate = "marketing" | "newsletter" | "outreach";

interface EmailRequest {
  campaign_id?: string;
  tactic_id?: string;
  to_email: string;
  subject: string;
  content: string;
  template?: EmailTemplate;
  // Marketing template options
  headline?: string;
  cta_text?: string;
  cta_url?: string;
  product_name?: string;
  logo_url?: string;
  brand_color?: string;
  // Newsletter template options
  issue_number?: string;
  sections?: Array<{ title: string; content: string; linkUrl?: string; linkText?: string }>;
  // Outreach template options
  recipient_name?: string;
  sender_name?: string;
  sender_title?: string;
  sender_company?: string;
  calendly_url?: string;
  linkedin_url?: string;
  website_url?: string;
  // General
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
      template = "marketing",
      headline,
      cta_text,
      cta_url,
      product_name,
      logo_url,
      brand_color,
      issue_number,
      sections,
      recipient_name,
      sender_name,
      sender_title,
      sender_company,
      calendly_url,
      linkedin_url,
      website_url,
      from_name = "Marketing", 
      from_email,
      dry_run = false 
    } = body;

    console.log(`Processing ${template} email for campaign: ${campaign_id}, tactic: ${tactic_id}`);
    console.log(`To: ${to_email}, Subject: ${subject}`);

    // Validate required fields
    if (!to_email || !subject || !content) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to_email, subject, content" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Render email HTML based on template
    let html: string;
    
    switch (template) {
      case "newsletter":
        html = await renderAsync(
          React.createElement(NewsletterEmail, {
            previewText: subject,
            headline: headline || subject,
            introContent: content,
            issueNumber: issue_number,
            sections: sections,
            productName: product_name,
            logoUrl: logo_url,
            brandColor: brand_color,
          })
        );
        break;
        
      case "outreach":
        html = await renderAsync(
          React.createElement(OutreachEmail, {
            previewText: subject,
            recipientName: recipient_name,
            senderName: sender_name || from_name,
            senderTitle: sender_title,
            senderCompany: sender_company,
            content: content,
            calendlyUrl: calendly_url,
            linkedInUrl: linkedin_url,
            websiteUrl: website_url,
          })
        );
        break;
        
      case "marketing":
      default:
        html = await renderAsync(
          React.createElement(MarketingEmail, {
            previewText: subject,
            headline: headline || subject,
            content: content,
            ctaText: cta_text,
            ctaUrl: cta_url,
            productName: product_name,
            logoUrl: logo_url,
            brandColor: brand_color,
          })
        );
        break;
    }

    // Use test domain if no custom domain configured
    const senderEmail = from_email || "onboarding@resend.dev";
    const sender = `${from_name} <${senderEmail}>`;

    if (dry_run) {
      console.log("DRY RUN - Would send email:");
      console.log({ from: sender, to: to_email, subject, template });
      return new Response(
        JSON.stringify({ 
          success: true, 
          dry_run: true, 
          message: "Email would be sent",
          details: { from: sender, to: to_email, subject, template },
          html_preview: html.substring(0, 500) + "..."
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send the email
    const emailResponse = await resend.emails.send({
      from: sender,
      to: [to_email],
      subject: subject,
      html: html,
    });

    console.log("Email sent successfully:", emailResponse);

    // Log the action if we have campaign info
    if (campaign_id) {
      const { error: logError } = await supabase.from("actions_taken").insert({
        campaign_id,
        platform: "email",
        action_type: `email_${template}`,
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
        template: template,
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
