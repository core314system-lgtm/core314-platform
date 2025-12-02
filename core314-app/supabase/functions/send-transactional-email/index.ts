import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withSentry, breadcrumb, handleSentryTest } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY') || '';
const SENDGRID_SENDER_EMAIL = Deno.env.get('SENDGRID_SENDER_EMAIL') || 'support@core314.com';
const SENDGRID_SENDER_NAME = Deno.env.get('SENDGRID_SENDER_NAME') || 'Core314 Intelligence System';

const WELCOME_HTML = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Core314</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4; padding: 20px;">
      <tr>
        <td align="center">
          <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <tr>
              <td style="padding: 40px 40px 30px 40px;">
                <h2 style="margin: 0 0 20px 0; color: #ff6b00; font-size: 28px; font-weight: bold;">Welcome to Core314 🚀</h2>
                <p style="margin: 0 0 15px 0; color: #222; font-size: 16px; line-height: 1.6;">Hi {{name}},</p>
                <p style="margin: 0 0 15px 0; color: #222; font-size: 16px; line-height: 1.6;">Your organization <strong>{{organization}}</strong> has been successfully onboarded to Core314.</p>
                <p style="margin: 0 0 25px 0; color: #222; font-size: 16px; line-height: 1.6;">You can log in anytime to monitor your system performance, AI metrics, and insights.</p>
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background-color: #ff6b00; border-radius: 6px; text-align: center;">
                      <a href="https://polite-mochi-fc5be5.netlify.app/" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold;">Go to Dashboard</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 40px 40px 40px; border-top: 1px solid #e0e0e0;">
                <p style="margin: 0; color: #777; font-size: 12px; line-height: 1.4;">Core314 Intelligence System<br>© 2025 Core314. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const WELCOME_TEXT = `Welcome to Core314!

Hi {{name}},

Your organization {{organization}} has been successfully onboarded to Core314.

You can log in anytime to monitor your system performance, AI metrics, and insights.

Go to Dashboard: https://polite-mochi-fc5be5.netlify.app/

---
Core314 Intelligence System
© 2025 Core314. All rights reserved.`;

const OPTIMIZATION_SUCCESS_HTML = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Optimization Applied Successfully</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4; padding: 20px;">
      <tr>
        <td align="center">
          <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <tr>
              <td style="padding: 40px 40px 30px 40px;">
                <h2 style="margin: 0 0 20px 0; color: #00a86b; font-size: 28px; font-weight: bold;">✅ Optimization Applied Successfully</h2>
                <p style="margin: 0 0 15px 0; color: #222; font-size: 16px; line-height: 1.6;">Hi {{name}},</p>
                <p style="margin: 0 0 25px 0; color: #222; font-size: 16px; line-height: 1.6;">Great news! An AI-powered optimization has been successfully applied to your organization <strong>{{organization}}</strong>.</p>
                
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f9f9f9; border-radius: 6px; padding: 20px; margin-bottom: 25px;">
                  <tr>
                    <td>
                      <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">Optimization Results:</h3>
                      <table cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                          <td style="padding: 8px 0; color: #666; font-size: 14px;">New Fusion Score:</td>
                          <td style="padding: 8px 0; color: #222; font-size: 14px; font-weight: bold; text-align: right;">{{new_fusion_score}}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #666; font-size: 14px;">Confidence Improvement:</td>
                          <td style="padding: 8px 0; color: #00a86b; font-size: 14px; font-weight: bold; text-align: right;">+{{confidence_improvement}}%</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #666; font-size: 14px;">Optimization Type:</td>
                          <td style="padding: 8px 0; color: #222; font-size: 14px; font-weight: bold; text-align: right;">{{optimization_type}}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background-color: #ff6b00; border-radius: 6px; text-align: center;">
                      <a href="https://polite-mochi-fc5be5.netlify.app/admin/optimizations" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold;">View Optimization Report</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 40px 40px 40px; border-top: 1px solid #e0e0e0;">
                <p style="margin: 0; color: #777; font-size: 12px; line-height: 1.4;">Core314 Intelligence System<br>© 2025 Core314. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const OPTIMIZATION_SUCCESS_TEXT = `Optimization Applied Successfully

Hi {{name}},

Great news! An AI-powered optimization has been successfully applied to your organization {{organization}}.

Optimization Results:
- New Fusion Score: {{new_fusion_score}}
- Confidence Improvement: +{{confidence_improvement}}%
- Optimization Type: {{optimization_type}}

View the full optimization report: https://polite-mochi-fc5be5.netlify.app/admin/optimizations

---
Core314 Intelligence System
© 2025 Core314. All rights reserved.`;

const GOVERNANCE_ALERT_HTML = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Action Halted by Governance</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4; padding: 20px;">
      <tr>
        <td align="center">
          <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <tr>
              <td style="padding: 40px 40px 30px 40px;">
                <h2 style="margin: 0 0 20px 0; color: #dc3545; font-size: 28px; font-weight: bold;">⚠️ Action Halted by AI Governance</h2>
                <p style="margin: 0 0 15px 0; color: #222; font-size: 16px; line-height: 1.6;">Hi {{name}},</p>
                <p style="margin: 0 0 25px 0; color: #222; font-size: 16px; line-height: 1.6;">An AI optimization for <strong>{{organization}}</strong> has been automatically halted by Core314's governance system to ensure safety and compliance.</p>
                
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 6px; padding: 20px; margin-bottom: 25px;">
                  <tr>
                    <td>
                      <h3 style="margin: 0 0 15px 0; color: #856404; font-size: 18px;">Governance Details:</h3>
                      <table cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                          <td style="padding: 8px 0; color: #856404; font-size: 14px;">Triggered Policy:</td>
                          <td style="padding: 8px 0; color: #222; font-size: 14px; font-weight: bold; text-align: right;">{{policy_name}}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #856404; font-size: 14px;">Reason:</td>
                          <td style="padding: 8px 0; color: #222; font-size: 14px; font-weight: bold; text-align: right;">{{reason}}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #856404; font-size: 14px;">Ethical Risk Score:</td>
                          <td style="padding: 8px 0; color: #dc3545; font-size: 14px; font-weight: bold; text-align: right;">{{ethical_risk_score}}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                
                <div style="background-color: #f9f9f9; border-radius: 6px; padding: 20px; margin-bottom: 25px;">
                  <h4 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">AI Explanation:</h4>
                  <p style="margin: 0; color: #555; font-size: 14px; line-height: 1.6;">{{explanation}}</p>
                </div>
                
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background-color: #ff6b00; border-radius: 6px; text-align: center;">
                      <a href="https://polite-mochi-fc5be5.netlify.app/admin/governance" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold;">View Governance Log</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 40px 40px 40px; border-top: 1px solid #e0e0e0;">
                <p style="margin: 0; color: #777; font-size: 12px; line-height: 1.4;">Core314 Intelligence System<br>© 2025 Core314. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const GOVERNANCE_ALERT_TEXT = `Action Halted by AI Governance

Hi {{name}},

An AI optimization for {{organization}} has been automatically halted by Core314's governance system to ensure safety and compliance.

Governance Details:
- Triggered Policy: {{policy_name}}
- Reason: {{reason}}
- Ethical Risk Score: {{ethical_risk_score}}

AI Explanation:
{{explanation}}

View the full governance log: https://polite-mochi-fc5be5.netlify.app/admin/governance

---
Core314 Intelligence System
© 2025 Core314. All rights reserved.`;

const DAILY_DIGEST_HTML = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Core314 Daily Summary</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4; padding: 20px;">
      <tr>
        <td align="center">
          <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <tr>
              <td style="padding: 40px 40px 30px 40px;">
                <h2 style="margin: 0 0 20px 0; color: #ff6b00; font-size: 28px; font-weight: bold;">📊 Core314 Daily Summary Report</h2>
                <p style="margin: 0 0 15px 0; color: #222; font-size: 16px; line-height: 1.6;">Hi {{name}},</p>
                <p style="margin: 0 0 25px 0; color: #222; font-size: 16px; line-height: 1.6;">Here's your daily summary for <strong>{{organization}}</strong> from the last 24 hours.</p>
                
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 25px;">
                  <tr>
                    <td style="padding: 15px; background-color: #e3f2fd; border-radius: 6px; margin-bottom: 10px; width: 48%;">
                      <div style="font-size: 32px; font-weight: bold; color: #1976d2; margin-bottom: 5px;">{{simulations_count}}</div>
                      <div style="font-size: 14px; color: #666;">Simulations Run</div>
                    </td>
                    <td style="width: 4%;"></td>
                    <td style="padding: 15px; background-color: #f3e5f5; border-radius: 6px; margin-bottom: 10px; width: 48%;">
                      <div style="font-size: 32px; font-weight: bold; color: #7b1fa2; margin-bottom: 5px;">{{optimizations_count}}</div>
                      <div style="font-size: 14px; color: #666;">Optimizations Applied</div>
                    </td>
                  </tr>
                </table>
                
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 25px;">
                  <tr>
                    <td style="padding: 15px; background-color: #fff3e0; border-radius: 6px; width: 48%;">
                      <div style="font-size: 32px; font-weight: bold; color: #f57c00; margin-bottom: 5px;">{{governance_actions}}</div>
                      <div style="font-size: 14px; color: #666;">Governance Actions</div>
                    </td>
                    <td style="width: 4%;"></td>
                    <td style="padding: 15px; background-color: #e8f5e9; border-radius: 6px; width: 48%;">
                      <div style="font-size: 32px; font-weight: bold; color: #388e3c; margin-bottom: 5px;">{{fusion_score}}</div>
                      <div style="font-size: 14px; color: #666;">Current Fusion Score</div>
                    </td>
                  </tr>
                </table>
                
                <div style="background-color: #f9f9f9; border-radius: 6px; padding: 20px; margin-bottom: 25px;">
                  <h4 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">Performance Trends (Last 24h):</h4>
                  <p style="margin: 0; color: #555; font-size: 14px; line-height: 1.6;">{{performance_summary}}</p>
                </div>
                
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background-color: #ff6b00; border-radius: 6px; text-align: center;">
                      <a href="https://polite-mochi-fc5be5.netlify.app/dashboard" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold;">View Full Dashboard</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 40px 40px 40px; border-top: 1px solid #e0e0e0;">
                <p style="margin: 0; color: #777; font-size: 12px; line-height: 1.4;">Core314 Intelligence System<br>© 2025 Core314. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const DAILY_DIGEST_TEXT = `Core314 Daily Summary Report

Hi {{name}},

Here's your daily summary for {{organization}} from the last 24 hours.

Activity Summary:
- Simulations Run: {{simulations_count}}
- Optimizations Applied: {{optimizations_count}}
- Governance Actions: {{governance_actions}}
- Current Fusion Score: {{fusion_score}}

Performance Trends (Last 24h):
{{performance_summary}}

View the full dashboard: https://polite-mochi-fc5be5.netlify.app/dashboard

---
Core314 Intelligence System
© 2025 Core314. All rights reserved.`;

const SUPPORT_ESCALATION_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Support Escalation - Core314</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="background-color: #ff6b00; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">🚨 Support Escalation</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;">
              <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 20px;">Support Request from {{user_name}}</h2>
              <p style="color: #666666; line-height: 1.6; margin: 0 0 20px 0;">
                <strong>User:</strong> {{user_name}} ({{user_email}})<br>
                <strong>Ticket ID:</strong> {{ticket_id}}
              </p>
              <div style="background-color: #f9f9f9; border-left: 4px solid #ff6b00; padding: 15px; margin: 20px 0;">
                <p style="color: #333333; margin: 0 0 10px 0;"><strong>User Query:</strong></p>
                <p style="color: #666666; margin: 0;">{{query}}</p>
              </div>
              <div style="background-color: #f0f7ff; border-left: 4px solid #0066cc; padding: 15px; margin: 20px 0;">
                <p style="color: #333333; margin: 0 0 10px 0;"><strong>AI Response:</strong></p>
                <p style="color: #666666; margin: 0;">{{ai_response}}</p>
              </div>
              <div style="background-color: #fafafa; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="color: #333333; margin: 0 0 10px 0;"><strong>Recent Conversation:</strong></p>
                <pre style="color: #666666; margin: 0; white-space: pre-wrap; font-family: monospace; font-size: 12px;">{{conversation_history}}</pre>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #999999;">
              <p style="margin: 0;">© 2025 Core314 Intelligence System. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const SUPPORT_ESCALATION_TEXT = `🚨 SUPPORT ESCALATION - CORE314

Support Request from {{user_name}}

User: {{user_name}} ({{user_email}})
Ticket ID: {{ticket_id}}

User Query:
{{query}}

AI Response:
{{ai_response}}

Recent Conversation:
{{conversation_history}}

---
© 2025 Core314 Intelligence System. All rights reserved.`;

const EMAIL_TEMPLATES: Record<string, { subject: string; html: string; text: string }> = {
  welcome: {
    subject: 'Welcome to Core314',
    html: WELCOME_HTML,
    text: WELCOME_TEXT,
  },
  optimization_success: {
    subject: 'Optimization Applied Successfully',
    html: OPTIMIZATION_SUCCESS_HTML,
    text: OPTIMIZATION_SUCCESS_TEXT,
  },
  governance_alert: {
    subject: 'Action Halted by Governance',
    html: GOVERNANCE_ALERT_HTML,
    text: GOVERNANCE_ALERT_TEXT,
  },
  daily_digest: {
    subject: 'Core314 Daily Summary',
    html: DAILY_DIGEST_HTML,
    text: DAILY_DIGEST_TEXT,
  },
  support_escalation: {
    subject: '🚨 Support Escalation - User Needs Help',
    html: SUPPORT_ESCALATION_HTML,
    text: SUPPORT_ESCALATION_TEXT,
  },
};

function replaceTemplateVariables(template: string, data: Record<string, unknown>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, String(value));
  }
  return result;
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, to, name, data } = await req.json();

    if (!type || !to || !name) {
      return new Response(JSON.stringify({ error: 'Missing required fields: type, to, name' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const template = EMAIL_TEMPLATES[type];
    if (!template) {
      return new Response(JSON.stringify({ error: `Unknown email type: ${type}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const templateData = { name, ...data };
    const htmlContent = replaceTemplateVariables(template.html, templateData);
    const textContent = replaceTemplateVariables(template.text, templateData);

    const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: to, name }],
          },
        ],
        from: {
          email: SENDGRID_SENDER_EMAIL,
          name: SENDGRID_SENDER_NAME,
        },
        subject: template.subject,
        content: [
          {
            type: 'text/plain',
            value: textContent,
          },
          {
            type: 'text/html',
            value: htmlContent,
          },
        ],
      }),
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (sendgridResponse.ok) {
      const messageId = sendgridResponse.headers.get('x-message-id');
      
      await supabase.from('fusion_audit_log').insert({
        organization_id: data.organization_id || null,
        user_id: data.user_id || null,
        event_type: 'email_sent',
        event_data: {
          type,
          to,
          name,
          subject: template.subject,
          message_id: messageId,
          status: 'sent',
        },
      });

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Email sent successfully',
        message_id: messageId,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      const errorText = await sendgridResponse.text();
      
      await supabase.from('fusion_audit_log').insert({
        organization_id: data.organization_id || null,
        user_id: data.user_id || null,
        event_type: 'email_failed',
        event_data: {
          type,
          to,
          name,
          subject: template.subject,
          error: errorText,
          status: 'failed',
        },
      });

      return new Response(JSON.stringify({ 
        error: 'Failed to send email',
        details: errorText,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Send email error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}), { name: "send-transactional-email" }));