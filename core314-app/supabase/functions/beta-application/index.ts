import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// =============================================================================
// TYPES
// =============================================================================

interface BetaApplicationInput {
  full_name: string;
  email: string;
  role_title: string;
  company_size: string;
  tools_systems_used: string;
  biggest_challenge: string;
  why_beta_test: string;
}

// =============================================================================
// EMAIL TEMPLATES
// =============================================================================

const APPLICANT_CONFIRMATION_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Core314 Beta Application Received</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 30px 40px; border-bottom: 1px solid #e2e8f0;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #0f172a;">Core314 Beta Application Received</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #334155;">
                Thank you for your interest in the Core314 Beta Program.
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #334155;">
                Your application has been received and is under review. Our beta program is limited to 25 participants, and we carefully review each application to ensure a productive collaboration.
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #334155;">
                If your background aligns with the program, a member of the Core314 team will contact you with next steps.
              </p>
              <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #334155;">
                — Core314 Team
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 12px; color: #64748b; text-align: center;">
                © 2026 Core314™ Technologies LLC. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const APPLICANT_CONFIRMATION_TEXT = `Core314 Beta Application Received

Thank you for your interest in the Core314 Beta Program.

Your application has been received and is under review. Our beta program is limited to 25 participants, and we carefully review each application to ensure a productive collaboration.

If your background aligns with the program, a member of the Core314 team will contact you with next steps.

— Core314 Team

© 2026 Core314™ Technologies LLC. All rights reserved.
`;

const ADMIN_NOTIFICATION_HTML = (application: BetaApplicationInput) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Beta Application</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 30px 40px; border-bottom: 1px solid #e2e8f0;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #0f172a;">New Beta Application</h1>
              <p style="margin: 10px 0 0 0; font-size: 14px; color: #64748b;">A new beta tester application has been submitted.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                    <strong style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Full Name</strong>
                    <p style="margin: 4px 0 0 0; font-size: 16px; color: #0f172a;">${application.full_name}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                    <strong style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Email</strong>
                    <p style="margin: 4px 0 0 0; font-size: 16px; color: #0f172a;">${application.email}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                    <strong style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Role / Title</strong>
                    <p style="margin: 4px 0 0 0; font-size: 16px; color: #0f172a;">${application.role_title}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                    <strong style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Company Size</strong>
                    <p style="margin: 4px 0 0 0; font-size: 16px; color: #0f172a;">${application.company_size}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                    <strong style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Tools/Systems Used</strong>
                    <p style="margin: 4px 0 0 0; font-size: 16px; color: #0f172a; white-space: pre-wrap;">${application.tools_systems_used}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                    <strong style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Biggest Operational Challenge</strong>
                    <p style="margin: 4px 0 0 0; font-size: 16px; color: #0f172a; white-space: pre-wrap;">${application.biggest_challenge}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <strong style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Why They Want to Beta Test</strong>
                    <p style="margin: 4px 0 0 0; font-size: 16px; color: #0f172a; white-space: pre-wrap;">${application.why_beta_test}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 12px; color: #64748b; text-align: center;">
                Review this application in the Supabase dashboard.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const ADMIN_NOTIFICATION_TEXT = (application: BetaApplicationInput) => `
New Beta Application

A new beta tester application has been submitted.

Full Name: ${application.full_name}
Email: ${application.email}
Role / Title: ${application.role_title}
Company Size: ${application.company_size}

Tools/Systems Used:
${application.tools_systems_used}

Biggest Operational Challenge:
${application.biggest_challenge}

Why They Want to Beta Test:
${application.why_beta_test}

Review this application in the Supabase dashboard.
`;

// =============================================================================
// VALIDATION
// =============================================================================

function validateApplication(input: Partial<BetaApplicationInput>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!input.full_name?.trim()) {
    errors.push('Full name is required');
  }

  if (!input.email?.trim()) {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.push('Invalid email format');
  }

  if (!input.role_title?.trim()) {
    errors.push('Role/title is required');
  }

  if (!input.company_size) {
    errors.push('Company size is required');
  } else if (!['1-10', '11-100', '100+'].includes(input.company_size)) {
    errors.push('Invalid company size selection');
  }

  if (!input.tools_systems_used?.trim()) {
    errors.push('Tools/systems currently used is required');
  }

  if (!input.biggest_challenge?.trim()) {
    errors.push('Biggest operational challenge is required');
  }

  if (!input.why_beta_test?.trim()) {
    errors.push('Why you want to beta test is required');
  }

  return { valid: errors.length === 0, errors };
}

// =============================================================================
// EMAIL SENDING
// =============================================================================

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');
  const senderEmail = Deno.env.get('SENDGRID_SENDER_EMAIL') || 'noreply@core314.com';
  const senderName = Deno.env.get('SENDGRID_SENDER_NAME') || 'Core314';

  if (!sendgridApiKey) {
    console.error('SENDGRID_API_KEY not configured');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendgridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: senderEmail, name: senderName },
        subject,
        content: [
          { type: 'text/plain', value: text },
          { type: 'text/html', value: html },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SendGrid error:', errorText);
      return { success: false, error: 'Failed to send email' };
    }

    return { success: true };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: 'Failed to send email' };
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Parse request body
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase configuration missing');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract metadata from request
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                      req.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Insert application
    const applicationData = {
      full_name: body.full_name.trim(),
      email: body.email.trim().toLowerCase(),
      role_title: body.role_title.trim(),
      company_size: body.company_size,
      tools_systems_used: body.tools_systems_used.trim(),
      biggest_challenge: body.biggest_challenge.trim(),
      why_beta_test: body.why_beta_test.trim(),
      status: 'pending',
      ip_address: ipAddress,
      user_agent: userAgent,
      source: 'website',
    };

    const { data: application, error: insertError } = await supabase
      .from('beta_applications')
      .insert(applicationData)
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      
      // Check for duplicate email
      if (insertError.code === '23505') {
        return new Response(
          JSON.stringify({ error: 'An application with this email already exists' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to submit application' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send confirmation email to applicant
    const applicantEmailResult = await sendEmail(
      applicationData.email,
      'Core314 Beta Application Received',
      APPLICANT_CONFIRMATION_HTML,
      APPLICANT_CONFIRMATION_TEXT
    );

    if (!applicantEmailResult.success) {
      console.warn('Failed to send applicant confirmation email:', applicantEmailResult.error);
    }

    // Send notification email to admin
    const adminEmail = Deno.env.get('BETA_ADMIN_EMAIL') || 'support@core314.com';
    const adminEmailResult = await sendEmail(
      adminEmail,
      `New Beta Application: ${applicationData.full_name}`,
      ADMIN_NOTIFICATION_HTML(applicationData),
      ADMIN_NOTIFICATION_TEXT(applicationData)
    );

    if (!adminEmailResult.success) {
      console.warn('Failed to send admin notification email:', adminEmailResult.error);
    }

    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Application submitted successfully',
        application_id: application.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
