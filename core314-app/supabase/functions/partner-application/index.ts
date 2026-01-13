/**
 * Partner Application Edge Function
 * 
 * Handles partner program application submissions:
 * 1. Validates all required fields and disqualification questions
 * 2. Inserts application into partner_applications table
 * 3. Sends confirmation email to applicant
 * 4. Sends notification email to admin
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY') || '';
const SENDGRID_SENDER_EMAIL = Deno.env.get('SENDGRID_SENDER_EMAIL') || 'noreply@core314.com';
const SENDGRID_SENDER_NAME = Deno.env.get('SENDGRID_SENDER_NAME') || 'Core314';
const PARTNER_ADMIN_EMAIL = Deno.env.get('PARTNER_ADMIN_EMAIL') || 'support@core314.com';

// =============================================================================
// EMAIL TEMPLATES
// =============================================================================

const APPLICANT_CONFIRMATION_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Core314 Partner Application Received</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; line-height: 1.6;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px 24px 40px; border-bottom: 1px solid #e2e8f0;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #0f172a; letter-spacing: -0.5px;">Core314</h1>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Partner Program</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px 40px;">
              <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a;">Application Received</h2>
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #475569;">
                Thank you for your interest in the Core314 Partner Program.
              </p>
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #475569;">
                Your application has been received and is under review.
              </p>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569;">
                If your background aligns with the program, a member of the Core314 team will contact you with next steps.
              </p>
              <p style="margin: 0; font-size: 14px; color: #64748b;">
                This is an automated confirmation. Please do not reply to this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} Core314. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const APPLICANT_CONFIRMATION_TEXT = `Core314 Partner Application Received

Thank you for your interest in the Core314 Partner Program.

Your application has been received and is under review.

If your background aligns with the program, a member of the Core314 team will contact you with next steps.

---
Core314 Team
This is an automated confirmation. Please do not reply to this email.`;

const ADMIN_NOTIFICATION_HTML = (application: Record<string, unknown>) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Partner Application</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; line-height: 1.6;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px 24px 40px; border-bottom: 1px solid #e2e8f0;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #0f172a;">New Partner Application</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding: 8px 0; font-size: 14px; color: #64748b; width: 140px;">Name:</td>
                  <td style="padding: 8px 0; font-size: 14px; color: #0f172a; font-weight: 500;">${application.full_name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 14px; color: #64748b;">Email:</td>
                  <td style="padding: 8px 0; font-size: 14px; color: #0f172a;">${application.email}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 14px; color: #64748b;">Company:</td>
                  <td style="padding: 8px 0; font-size: 14px; color: #0f172a;">${application.company}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 14px; color: #64748b;">Role:</td>
                  <td style="padding: 8px 0; font-size: 14px; color: #0f172a;">${application.role_title}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 14px; color: #64748b;">Experience:</td>
                  <td style="padding: 8px 0; font-size: 14px; color: #0f172a;">${application.years_experience} years</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 14px; color: #64748b;">Industry:</td>
                  <td style="padding: 8px 0; font-size: 14px; color: #0f172a;">${application.primary_industry}</td>
                </tr>
              </table>
              
              <div style="margin-top: 24px; padding: 16px; background-color: #f8fafc; border-radius: 6px;">
                <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0f172a;">How they advise organizations:</h3>
                <p style="margin: 0; font-size: 14px; color: #475569;">${application.how_advises_orgs}</p>
              </div>
              
              <div style="margin-top: 16px; padding: 16px; background-color: #f8fafc; border-radius: 6px;">
                <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0f172a;">How Core314 fits their work:</h3>
                <p style="margin: 0; font-size: 14px; color: #475569;">${application.how_core314_fits}</p>
              </div>
              
              <p style="margin: 24px 0 0 0; font-size: 13px; color: #64748b;">
                Application ID: ${application.id}<br>
                Submitted: ${new Date().toISOString()}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                Review this application in the admin dashboard.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const ADMIN_NOTIFICATION_TEXT = (application: Record<string, unknown>) => `New Partner Application

Name: ${application.full_name}
Email: ${application.email}
Company: ${application.company}
Role: ${application.role_title}
Experience: ${application.years_experience} years
Industry: ${application.primary_industry}

How they advise organizations:
${application.how_advises_orgs}

How Core314 fits their work:
${application.how_core314_fits}

Application ID: ${application.id}
Submitted: ${new Date().toISOString()}

---
Review this application in the admin dashboard.`;

// =============================================================================
// EMAIL SENDING
// =============================================================================

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  if (!SENDGRID_API_KEY) {
    console.error('SENDGRID_API_KEY is not configured');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: {
          email: SENDGRID_SENDER_EMAIL,
          name: SENDGRID_SENDER_NAME,
        },
        subject,
        content: [
          { type: 'text/plain', value: text },
          { type: 'text/html', value: html },
        ],
      }),
    });

    if (response.ok) {
      return { success: true };
    } else {
      const errorText = await response.text();
      console.error('SendGrid API error:', errorText);
      return { success: false, error: errorText };
    }
  } catch (error) {
    console.error('SendGrid request failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// =============================================================================
// VALIDATION
// =============================================================================

interface PartnerApplicationInput {
  full_name: string;
  email: string;
  company: string;
  role_title: string;
  years_experience: number;
  primary_industry: string;
  how_advises_orgs: string;
  how_core314_fits: string;
  not_influencer_marketer: boolean;
  will_not_misrepresent_ai: boolean;
  understands_decision_intelligence: boolean;
  ack_not_agent: boolean;
  ack_no_misrepresent: boolean;
  ack_no_entitlement: boolean;
}

function validateApplication(input: Partial<PartnerApplicationInput>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required text fields
  if (!input.full_name?.trim()) errors.push('Full name is required');
  if (!input.email?.trim()) errors.push('Email is required');
  if (!input.company?.trim()) errors.push('Company is required');
  if (!input.role_title?.trim()) errors.push('Role/title is required');
  if (!input.primary_industry?.trim()) errors.push('Primary industry is required');
  if (!input.how_advises_orgs?.trim()) errors.push('Description of advisory work is required');
  if (!input.how_core314_fits?.trim()) errors.push('Description of how Core314 fits is required');

  // Email format
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.push('Invalid email format');
  }

  // Years experience
  if (input.years_experience === undefined || input.years_experience === null) {
    errors.push('Years of experience is required');
  } else if (typeof input.years_experience !== 'number' || input.years_experience < 0) {
    errors.push('Years of experience must be a non-negative number');
  }

  // Disqualification questions - all must be TRUE
  if (input.not_influencer_marketer !== true) {
    errors.push('You must confirm you are not an influencer, marketer, or traffic-based promoter');
  }
  if (input.will_not_misrepresent_ai !== true) {
    errors.push('You must confirm you will not represent Core314 as autonomous AI or outcome-guaranteed');
  }
  if (input.understands_decision_intelligence !== true) {
    errors.push('You must confirm you understand Core314 provides decision intelligence, not decisions');
  }

  // Legal acknowledgments - all must be TRUE
  if (input.ack_not_agent !== true) {
    errors.push('You must acknowledge you are not an agent, employee, or representative of Core314');
  }
  if (input.ack_no_misrepresent !== true) {
    errors.push('You must agree not to misrepresent Core314\'s AI capabilities');
  }
  if (input.ack_no_entitlement !== true) {
    errors.push('You must acknowledge this application does not create a partnership or entitlement');
  }

  return { valid: errors.length === 0, errors };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    
    // Validate input
    const validation = validateApplication(body);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: validation.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Extract metadata from request
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                      req.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Insert application
    const { data: application, error: insertError } = await supabase
      .from('partner_applications')
      .insert({
        full_name: body.full_name.trim(),
        email: body.email.trim().toLowerCase(),
        company: body.company.trim(),
        role_title: body.role_title.trim(),
        years_experience: body.years_experience,
        primary_industry: body.primary_industry.trim(),
        how_advises_orgs: body.how_advises_orgs.trim(),
        how_core314_fits: body.how_core314_fits.trim(),
        not_influencer_marketer: body.not_influencer_marketer,
        will_not_misrepresent_ai: body.will_not_misrepresent_ai,
        understands_decision_intelligence: body.understands_decision_intelligence,
        ack_not_agent: body.ack_not_agent,
        ack_no_misrepresent: body.ack_no_misrepresent,
        ack_no_entitlement: body.ack_no_entitlement,
        status: 'pending',
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert application:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to submit application', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send confirmation email to applicant
    const applicantEmailResult = await sendEmail(
      body.email.trim().toLowerCase(),
      'Core314 Partner Application Received',
      APPLICANT_CONFIRMATION_HTML,
      APPLICANT_CONFIRMATION_TEXT
    );

    if (!applicantEmailResult.success) {
      console.error('Failed to send applicant confirmation email:', applicantEmailResult.error);
      // Don't fail the request - application was saved
    }

    // Send notification email to admin
    const adminEmailResult = await sendEmail(
      PARTNER_ADMIN_EMAIL,
      `New Partner Application: ${body.full_name} (${body.company})`,
      ADMIN_NOTIFICATION_HTML(application),
      ADMIN_NOTIFICATION_TEXT(application)
    );

    if (!adminEmailResult.success) {
      console.error('Failed to send admin notification email:', adminEmailResult.error);
      // Don't fail the request - application was saved
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Application submitted successfully',
        application_id: application.id 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Partner application error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
