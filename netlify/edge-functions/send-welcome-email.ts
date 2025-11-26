import type { Context } from "https://edge.netlify.com";

export default async (request: Request, context: Context) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { email, fullName, companyName, plan } = await request.json();

    if (!email || !fullName || !plan) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const sendgridApiKey = Netlify.env.get('SENDGRID_API_KEY');
    
    if (!sendgridApiKey) {
      console.error('SendGrid API key not configured');
      return new Response(JSON.stringify({ error: 'Email service not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Core314</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background-color: #0A0F1A;
            color: #ffffff;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 40px 20px;
          }
          .header {
            text-align: center;
            padding: 40px 0;
            border-bottom: 2px solid rgba(0, 191, 255, 0.3);
          }
          .logo {
            width: 80px;
            height: 80px;
            margin: 0 auto 20px;
          }
          .title {
            font-size: 32px;
            font-weight: 800;
            background: linear-gradient(90deg, #00BFFF, #66FCF1);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin: 0;
          }
          .content {
            padding: 40px 0;
          }
          .greeting {
            font-size: 24px;
            font-weight: 600;
            color: #66FCF1;
            margin-bottom: 20px;
          }
          .text {
            font-size: 16px;
            line-height: 1.6;
            color: rgba(255, 255, 255, 0.9);
            margin-bottom: 20px;
          }
          .plan-info {
            background: linear-gradient(135deg, rgba(0, 191, 255, 0.1), rgba(0, 123, 255, 0.1));
            border: 1px solid rgba(0, 191, 255, 0.3);
            border-radius: 12px;
            padding: 24px;
            margin: 30px 0;
          }
          .plan-label {
            font-size: 14px;
            color: rgba(255, 255, 255, 0.6);
            margin-bottom: 8px;
          }
          .plan-name {
            font-size: 24px;
            font-weight: 700;
            color: #00BFFF;
          }
          .cta-button {
            display: inline-block;
            padding: 16px 40px;
            background: linear-gradient(90deg, #00BFFF, #007BFF);
            color: #ffffff;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            margin: 20px 0;
          }
          .features {
            margin: 30px 0;
          }
          .feature-item {
            display: flex;
            align-items: flex-start;
            margin-bottom: 16px;
          }
          .feature-icon {
            color: #00BFFF;
            margin-right: 12px;
            font-size: 20px;
          }
          .footer {
            border-top: 2px solid rgba(0, 191, 255, 0.3);
            padding: 30px 0;
            text-align: center;
            color: rgba(255, 255, 255, 0.6);
            font-size: 14px;
          }
          .signature {
            font-style: italic;
            color: #66FCF1;
            margin-top: 20px;
          }
          .tagline {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.5);
            margin-top: 8px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="40" cy="40" r="38" stroke="#00BFFF" stroke-width="2"/>
                <circle cx="40" cy="40" r="30" fill="#00BFFF" opacity="0.2"/>
                <circle cx="40" cy="40" r="20" fill="#66FCF1" opacity="0.4"/>
                <circle cx="40" cy="40" r="10" fill="#00BFFF"/>
              </svg>
            </div>
            <h1 class="title">Welcome to Core314</h1>
          </div>
          
          <div class="content">
            <p class="greeting">Hello ${fullName},</p>
            
            <p class="text">
              Welcome to Core314 — the future of business orchestration powered by AI. 
              Your account has been successfully created and your system is now live.
            </p>
            
            <div class="plan-info">
              <div class="plan-label">Your Selected Plan</div>
              <div class="plan-name">${plan.charAt(0).toUpperCase() + plan.slice(1)}</div>
            </div>
            
            <p class="text">
              You now have access to our patent-pending intelligence systems that will transform 
              how ${companyName || 'your organization'} operates:
            </p>
            
            <div class="features">
              <div class="feature-item">
                <span class="feature-icon">⚡</span>
                <span>Fusion & Scoring Intelligence Layer™ — Real-time operational pattern learning</span>
              </div>
              <div class="feature-item">
                <span class="feature-icon">📈</span>
                <span>Proactive Optimization Engine™ — Predictive inefficiency detection</span>
              </div>
              <div class="feature-item">
                <span class="feature-icon">🛡️</span>
                <span>Autonomous Governance Framework™ — Compliance and stability assurance</span>
              </div>
            </div>
            
            <p class="text">
              Your Core is now active. Connect your systems, synchronize your intelligence, 
              and let logic take over. Your 14-day free trial has begun.
            </p>
            
            <center>
              <a href="https://core314.com/login" class="cta-button">
                Access Your Dashboard
              </a>
            </center>
            
            <p class="text">
              Need help getting started? Visit our <a href="https://core314.com/contact" style="color: #00BFFF;">Help Center</a> 
              or reply to this email — our team is here to support you.
            </p>
            
            <p class="signature">
              – The Core314 Team
            </p>
            <p class="tagline">
              Logic in Motion. Intelligence in Control.
            </p>
          </div>
          
          <div class="footer">
            <p>© 2025 Core314. All Rights Reserved.</p>
            <p>
              <a href="https://core314.com/privacy" style="color: #00BFFF; text-decoration: none;">Privacy Policy</a> | 
              <a href="https://core314.com/terms" style="color: #00BFFF; text-decoration: none;">Terms of Service</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailText = `
Welcome to Core314, ${fullName}!

Your account has been successfully created and your system is now live.

Selected Plan: ${plan.charAt(0).toUpperCase() + plan.slice(1)}

You now have access to our patent-pending intelligence systems:
- Fusion & Scoring Intelligence Layer™
- Proactive Optimization Engine™
- Autonomous Governance Framework™

Your Core is now active. Connect your systems, synchronize your intelligence, and let logic take over.

Your 14-day free trial has begun. Access your dashboard at: https://core314.com/login

Need help? Visit https://core314.com/contact or reply to this email.

– The Core314 Team
Logic in Motion. Intelligence in Control.
    `;

    const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendgridApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email, name: fullName }],
          subject: 'Welcome to Core314 — Your Operations, Unified by Logic'
        }],
        from: {
          email: 'noreply@core314.com',
          name: 'Core314'
        },
        content: [
          {
            type: 'text/plain',
            value: emailText
          },
          {
            type: 'text/html',
            value: emailHtml
          }
        ]
      })
    });

    if (!sendgridResponse.ok) {
      const errorText = await sendgridResponse.text();
      console.error('SendGrid error:', errorText);
      throw new Error('Failed to send email');
    }

    return new Response(JSON.stringify({ success: true, message: 'Welcome email sent' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error sending welcome email:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to send welcome email',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = {
  path: "/api/send-welcome-email"
};
