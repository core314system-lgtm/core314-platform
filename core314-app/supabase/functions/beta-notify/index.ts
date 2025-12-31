import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationRequest {
  userId: string
  email: string
  fullName: string
  newStatus: 'approved' | 'revoked'
  oldStatus: string
}

const APPROVED_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Beta Access Approved - Core314</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0A0F1A; color: #ffffff; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .logo { text-align: center; margin-bottom: 30px; }
    .logo-text { font-size: 32px; font-weight: 700; color: #00BFFF; letter-spacing: 2px; }
    .header { background: linear-gradient(135deg, #00BFFF 0%, #007BFF 100%); padding: 40px 30px; border-radius: 12px; text-align: center; margin-bottom: 30px; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; }
    .content { background-color: #1A1F2E; padding: 30px; border-radius: 12px; border: 1px solid #2A3F5F; margin-bottom: 30px; }
    .content p { font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0; }
    .cta-button { display: inline-block; background: linear-gradient(90deg, #00BFFF, #007BFF); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; text-align: center; margin: 20px 0; }
    .features { background-color: #1A1F2E; padding: 20px 30px; border-radius: 12px; border: 1px solid #2A3F5F; margin-bottom: 30px; }
    .features h2 { font-size: 20px; color: #00BFFF; margin: 0 0 15px 0; }
    .features ul { margin: 0; padding-left: 20px; }
    .features li { color: #E0E0E0; margin-bottom: 10px; line-height: 1.5; }
    .footer { text-align: center; padding: 20px; color: #888888; font-size: 14px; }
    .footer a { color: #00BFFF; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo"><div class="logo-text">CORE314</div></div>
    <div class="header"><h1>🎉 Your Beta Access Has Been Approved!</h1></div>
    <div class="content">
      <p>Hello {{fullName}},</p>
      <p>Great news! Your Core314 beta access request has been approved. You now have full access to the Core314 platform.</p>
      <p>Click the button below to log in and get started:</p>
      <center><a href="https://app.core314.com/login" class="cta-button">Access Core314 Dashboard</a></center>
    </div>
    <div class="features">
      <h2>What You Can Do Now:</h2>
      <ul>
        <li><strong>Connect Your Systems</strong> - Integrate your business apps</li>
        <li><strong>AI-Powered Insights</strong> - Get intelligent recommendations</li>
        <li><strong>Real-Time Monitoring</strong> - Track KPIs and performance</li>
        <li><strong>Proactive Optimization</strong> - Let AI detect inefficiencies</li>
      </ul>
    </div>
    <div class="content">
      <p>Need help? Check out our <a href="https://core314.com/support" style="color: #00BFFF;">documentation</a>.</p>
      <p style="margin-top: 30px;"><strong>– The Core314 Team</strong><br><em>"Logic in Motion. Intelligence in Control."</em></p>
    </div>
    <div class="footer">
      <p>© 2025 Core314. All Rights Reserved.</p>
      <p><a href="https://core314.com/privacy">Privacy Policy</a> | <a href="https://core314.com/terms">Terms of Service</a></p>
    </div>
  </div>
</body>
</html>`;

const REVOKED_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Beta Access Update - Core314</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0A0F1A; color: #ffffff; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .logo { text-align: center; margin-bottom: 30px; }
    .logo-text { font-size: 32px; font-weight: 700; color: #00BFFF; letter-spacing: 2px; }
    .header { background: linear-gradient(135deg, #FF6B6B 0%, #C92A2A 100%); padding: 40px 30px; border-radius: 12px; text-align: center; margin-bottom: 30px; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; }
    .content { background-color: #1A1F2E; padding: 30px; border-radius: 12px; border: 1px solid #2A3F5F; margin-bottom: 30px; }
    .content p { font-size: 16px; line-height: 1.6; color: #E0E0E0; margin: 0 0 20px 0; }
    .info-box { background-color: #2A1F1F; border-left: 4px solid #FF6B6B; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .info-box p { margin: 0; color: #FFB3B3; }
    .cta-button { display: inline-block; background: linear-gradient(90deg, #00BFFF, #007BFF); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; text-align: center; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #888888; font-size: 14px; }
    .footer a { color: #00BFFF; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo"><div class="logo-text">CORE314</div></div>
    <div class="header"><h1>Beta Access Status Update</h1></div>
    <div class="content">
      <p>Hello {{fullName}},</p>
      <p>We're writing to inform you that your Core314 beta access has been revoked.</p>
      <div class="info-box">
        <p><strong>What This Means:</strong> Your account remains active, but access to the Core314 dashboard has been suspended.</p>
      </div>
      <p>If you believe this is an error, please contact our support team.</p>
      <center><a href="https://core314.com/contact" class="cta-button">Contact Support</a></center>
    </div>
    <div class="content">
      <p style="margin-top: 30px;"><strong>– The Core314 Team</strong><br><em>"Logic in Motion. Intelligence in Control."</em></p>
    </div>
    <div class="footer">
      <p>© 2025 Core314. All Rights Reserved.</p>
      <p><a href="https://core314.com/privacy">Privacy Policy</a> | <a href="https://core314.com/terms">Terms of Service</a></p>
    </div>
  </div>
</body>
</html>`;

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId, email, fullName, newStatus, oldStatus }: NotificationRequest = await req.json()

    console.log(`[BETA-NOTIFY] Processing notification for user ${userId}: ${oldStatus} → ${newStatus}`)

    const dryRun = Deno.env.get('BETA_NOTIFY_DRY_RUN') === 'true'

    if (dryRun) {
      console.log('[BETA-NOTIFY] DRY RUN MODE - Email not sent')
      console.log(`[BETA-NOTIFY] Would send ${newStatus} email to ${email} (${fullName})`)
      return new Response(JSON.stringify({ 
        success: true, 
        dryRun: true,
        message: `Would send ${newStatus} email to ${email}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const sendGridApiKey = Deno.env.get('SENDGRID_API_KEY')
    if (!sendGridApiKey) {
      console.error('[BETA-NOTIFY] SENDGRID_API_KEY not configured')
      return new Response(JSON.stringify({ error: 'SendGrid not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let htmlContent: string
    let subject: string

    if (newStatus === 'approved') {
      htmlContent = APPROVED_TEMPLATE.replace(/\{\{fullName\}\}/g, fullName || 'there')
      subject = 'Your Core314 Beta Access Has Been Approved! 🎉'
    } else if (newStatus === 'revoked') {
      htmlContent = REVOKED_TEMPLATE.replace(/\{\{fullName\}\}/g, fullName || 'there')
      subject = 'Core314 Beta Access Status Update'
    } else {
      console.error('[BETA-NOTIFY] Invalid status:', newStatus)
      return new Response(JSON.stringify({ error: 'Invalid status' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const sendGridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendGridApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email, name: fullName }],
          subject
        }],
        from: {
          email: Deno.env.get('SENDGRID_SENDER_EMAIL') || 'welcome@core314.com',
          name: Deno.env.get('SENDGRID_SENDER_NAME') || 'Core314'
        },
        content: [{
          type: 'text/html',
          value: htmlContent
        }]
      })
    })

    if (!sendGridResponse.ok) {
      const errorText = await sendGridResponse.text()
      console.error('[BETA-NOTIFY] SendGrid error:', errorText)
      return new Response(JSON.stringify({ error: 'Failed to send email' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[BETA-NOTIFY] Email sent successfully to ${email}`)

    return new Response(JSON.stringify({ 
      success: true,
      userId,
      email,
      status: newStatus
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[BETA-NOTIFY] Unexpected error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}, { name: "beta-notify" }));