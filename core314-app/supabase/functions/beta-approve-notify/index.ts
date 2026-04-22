import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// =============================================================================
// BETA APPROVAL WORKFLOW
// Called by admin after approving a beta application.
// 1. Sends approval email to the applicant via SendGrid
// 2. Creates a Supabase auth invite (so they can sign up)
// 3. Creates a lifecycle tracking record (linked once they accept invite)
// =============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// =============================================================================
// EMAIL TEMPLATE
// =============================================================================

function getApprovalEmailHTML(name: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to the Core314 Beta Program</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0A0F1A; color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0A0F1A; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0">
          <!-- Logo -->
          <tr>
            <td style="text-align: center; padding-bottom: 30px;">
              <span style="font-size: 32px; font-weight: 700; color: #00BFFF; letter-spacing: 2px;">CORE314</span>
            </td>
          </tr>
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #00BFFF 0%, #007BFF 100%); padding: 40px 30px; border-radius: 12px; text-align: center;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #ffffff;">You're In! Welcome to the Beta Program</h1>
            </td>
          </tr>
          <!-- Spacer -->
          <tr><td style="height: 24px;"></td></tr>
          <!-- Main Content -->
          <tr>
            <td style="background-color: #1A1F2E; padding: 30px; border-radius: 12px; border: 1px solid #2A3F5F;">
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                ${name},
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                Great news — your application to the <strong style="color: #00BFFF;">Core314 Beta Program</strong> has been approved. You're one of just 25 people selected to help shape the future of operational intelligence.
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 10px 0;">
                <strong style="color: #00BFFF;">Here's what you get:</strong>
              </p>
              <ul style="margin: 0 0 20px 0; padding-left: 24px; font-size: 16px; line-height: 1.8; color: #E0E0E0;">
                <li><strong>45 days</strong> of full access to Core314's Command Center</li>
                <li>Real-time operational intelligence briefs</li>
                <li>Integration with your existing tools</li>
                <li>Direct line to the product team for feedback</li>
                <li><strong style="color: #00BFFF;">50% off</strong> for 6 months ($399.50/mo instead of $799/mo) when you convert after the beta</li>
              </ul>
            </td>
          </tr>
          <!-- Spacer -->
          <tr><td style="height: 24px;"></td></tr>
          <!-- Getting Started -->
          <tr>
            <td style="background-color: #1A1F2E; padding: 30px; border-radius: 12px; border: 1px solid #2A3F5F;">
              <h2 style="font-size: 20px; color: #00BFFF; margin: 0 0 15px 0;">Getting Started</h2>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                Click the button below to set up your account. You should have received (or will shortly receive) a separate email with your login credentials. If you don't see it, check your spam folder.
              </p>
              <p style="font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0;">
                Once logged in, your 45-day beta period begins on your first sign-in. Take your time getting set up — the clock starts when you're ready.
              </p>
              <!-- CTA Button -->
              <center>
                <a href="https://app.core314.com" style="display: inline-block; background: linear-gradient(90deg, #00BFFF, #007BFF); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Go to Core314 App
                </a>
              </center>
            </td>
          </tr>
          <!-- Spacer -->
          <tr><td style="height: 24px;"></td></tr>
          <!-- Support -->
          <tr>
            <td style="background-color: #1A1F2E; padding: 20px 30px; border-radius: 12px; border: 1px solid #2A3F5F;">
              <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0;">
                Questions or need help? Reply to this email or reach us at <a href="mailto:admin@core314.com" style="color: #00BFFF; text-decoration: none;">admin@core314.com</a>. We're here to make sure your beta experience is smooth.
              </p>
            </td>
          </tr>
          <!-- Spacer -->
          <tr><td style="height: 24px;"></td></tr>
          <!-- Footer -->
          <tr>
            <td style="text-align: center; padding: 20px;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                &copy; 2026 Core314&trade; Technologies LLC. All rights reserved.
              </p>
              <p style="margin: 8px 0 0 0; font-size: 12px;">
                <a href="https://core314.com/privacy" style="color: #00BFFF; text-decoration: none;">Privacy Policy</a> |
                <a href="https://core314.com/terms" style="color: #00BFFF; text-decoration: none;">Terms of Service</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function getApprovalEmailText(name: string): string {
  return `Welcome to the Core314 Beta Program!

${name},

Great news - your application to the Core314 Beta Program has been approved. You're one of just 25 people selected to help shape the future of operational intelligence.

HERE'S WHAT YOU GET:
- 45 days of full access to Core314's Command Center
- Real-time operational intelligence briefs
- Integration with your existing tools
- Direct line to the product team for feedback
- 50% off for 6 months ($399.50/mo instead of $799/mo) when you convert after the beta

GETTING STARTED:
Visit https://app.core314.com to set up your account. You should have received (or will shortly receive) a separate email with your login credentials.

Once logged in, your 45-day beta period begins on your first sign-in. Take your time getting set up - the clock starts when you're ready.

Questions? Reply to this email or reach us at admin@core314.com.

- The Core314 Team

(c) 2026 Core314 Technologies LLC. All rights reserved.`;
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
        reply_to: { email: 'admin@core314.com', name: 'Core314 Team' },
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
      return { success: false, error: `SendGrid error: ${response.status}` };
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Verify admin authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract JWT token and verify user
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error('Auth verification failed:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Not authenticated', detail: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const body = await req.json();
    const { application_id } = body;

    if (!application_id) {
      return new Response(
        JSON.stringify({ error: 'application_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the approved application
    const { data: application, error: appError } = await supabase
      .from('beta_applications')
      .select('*')
      .eq('id', application_id)
      .single();

    if (appError || !application) {
      return new Response(
        JSON.stringify({ error: 'Application not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (application.status !== 'approved') {
      return new Response(
        JSON.stringify({ error: 'Application is not in approved status' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: {
      email_sent: boolean;
      email_error?: string;
      invite_sent: boolean;
      invite_error?: string;
      lifecycle_created: boolean;
      lifecycle_error?: string;
    } = {
      email_sent: false,
      invite_sent: false,
      lifecycle_created: false,
    };

    // Step 1: Send approval email
    console.log(`Sending approval email to ${application.email}`);
    const emailResult = await sendEmail(
      application.email,
      "You're In! Welcome to the Core314 Beta Program",
      getApprovalEmailHTML(application.full_name),
      getApprovalEmailText(application.full_name)
    );
    results.email_sent = emailResult.success;
    if (!emailResult.success) {
      results.email_error = emailResult.error;
      console.warn('Approval email failed:', emailResult.error);
    }

    // Step 2: Create Supabase auth invite (if user doesn't already exist)
    console.log(`Checking if user account exists for ${application.email}`);
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === application.email.toLowerCase()
    );

    if (existingUser) {
      console.log(`User account already exists for ${application.email} (id: ${existingUser.id})`);
      results.invite_sent = true; // No invite needed

      // Step 3: Create lifecycle record for existing user
      console.log(`Creating lifecycle record for existing user ${existingUser.id}`);
      const { error: lifecycleError } = await supabase.rpc('create_beta_lifecycle', {
        p_user_id: existingUser.id,
        p_admin_notes: `Approved from beta application ${application_id}`,
      });

      if (lifecycleError) {
        console.warn('Lifecycle creation failed:', lifecycleError.message);
        results.lifecycle_error = lifecycleError.message;
      } else {
        results.lifecycle_created = true;
      }
    } else {
      // Send Supabase magic link invite
      console.log(`Inviting new user ${application.email}`);
      const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
        application.email,
        {
          data: {
            full_name: application.full_name,
            role: 'manager',
            beta_tester: true,
            beta_application_id: application_id,
          },
          redirectTo: 'https://app.core314.com',
        }
      );

      if (inviteError) {
        console.warn('Invite failed:', inviteError.message);
        results.invite_error = inviteError.message;
      } else {
        results.invite_sent = true;

        // Create lifecycle record for newly invited user
        if (inviteData?.user?.id) {
          console.log(`Creating lifecycle record for invited user ${inviteData.user.id}`);
          const { error: lifecycleError } = await supabase.rpc('create_beta_lifecycle', {
            p_user_id: inviteData.user.id,
            p_admin_notes: `Approved from beta application ${application_id}`,
          });

          if (lifecycleError) {
            console.warn('Lifecycle creation failed:', lifecycleError.message);
            results.lifecycle_error = lifecycleError.message;
          } else {
            results.lifecycle_created = true;
          }
        }
      }
    }

    console.log('Approval workflow complete:', results);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Approval workflow completed',
        ...results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in beta-approve-notify:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
