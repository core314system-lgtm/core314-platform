import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { name, email, company, phone, message } = JSON.parse(event.body || '{}');

    if (!name || !email || !message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Name, email, and message are required.' }),
      };
    }

    // Store submission in Supabase so it is never lost
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    let savedToDb = false;

    if (supabaseUrl && supabaseServiceKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { error: dbError } = await supabase
          .from('contact_submissions')
          .insert({
            name,
            email,
            company: company || null,
            phone: phone || null,
            message,
            email_sent: false,
          });

        if (dbError) {
          console.error('Supabase insert error:', dbError.message);
        } else {
          savedToDb = true;
        }
      } catch (dbErr) {
        console.error('Supabase connection error:', dbErr);
      }
    }

    // Attempt to send email via SendGrid
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    let emailSent = false;

    if (sendgridApiKey) {
      const CONTACT_RECIPIENT = 'chris.brown@core314.com';

      const emailHtml = `
        <div style="font-family: Inter, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #1e293b;">
          <div style="border-bottom: 2px solid #0284c7; padding-bottom: 16px; margin-bottom: 24px;">
            <h1 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0;">New Contact Form Submission</h1>
            <p style="font-size: 14px; color: #64748b; margin: 4px 0 0;">core314.com/contact</p>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 8px 0; font-weight: 600; color: #475569; width: 100px; vertical-align: top;">Name</td>
              <td style="padding: 8px 0; color: #1e293b;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600; color: #475569; vertical-align: top;">Email</td>
              <td style="padding: 8px 0; color: #1e293b;"><a href="mailto:${email}" style="color: #0284c7;">${email}</a></td>
            </tr>
            ${company ? `<tr><td style="padding: 8px 0; font-weight: 600; color: #475569; vertical-align: top;">Company</td><td style="padding: 8px 0; color: #1e293b;">${company}</td></tr>` : ''}
            ${phone ? `<tr><td style="padding: 8px 0; font-weight: 600; color: #475569; vertical-align: top;">Phone</td><td style="padding: 8px 0; color: #1e293b;">${phone}</td></tr>` : ''}
          </table>
          <div style="margin-top: 16px; padding: 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
            <p style="font-size: 12px; font-weight: 600; color: #475569; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.05em;">Message</p>
            <p style="font-size: 14px; color: #1e293b; margin: 0; white-space: pre-wrap;">${message}</p>
          </div>
          <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">Sent from Core314 contact form at ${new Date().toISOString()}</p>
        </div>
      `;

      const emailText = `New Contact Form Submission\n\nName: ${name}\nEmail: ${email}${company ? `\nCompany: ${company}` : ''}${phone ? `\nPhone: ${phone}` : ''}\n\nMessage:\n${message}\n\nSent at ${new Date().toISOString()}`;

      try {
        const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sendgridApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{
              to: [{ email: CONTACT_RECIPIENT, name: 'Chris Brown' }],
              subject: `Core314 Contact: ${name}${company ? ` (${company})` : ''}`,
            }],
            from: {
              email: 'noreply@core314.com',
              name: 'Core314 Contact Form',
            },
            reply_to: {
              email: email,
              name: name,
            },
            content: [
              { type: 'text/plain', value: emailText },
              { type: 'text/html', value: emailHtml },
            ],
          }),
        });

        if (sendgridResponse.ok) {
          emailSent = true;
        } else {
          const errorText = await sendgridResponse.text();
          console.error('SendGrid error:', sendgridResponse.status, errorText);
        }
      } catch (sendErr) {
        console.error('SendGrid request failed:', sendErr);
      }

      // Update the DB record if email was sent successfully
      if (emailSent && savedToDb && supabaseUrl && supabaseServiceKey) {
        try {
          const supabase = createClient(supabaseUrl, supabaseServiceKey);
          await supabase
            .from('contact_submissions')
            .update({ email_sent: true })
            .eq('email', email)
            .eq('message', message)
            .order('created_at', { ascending: false })
            .limit(1);
        } catch {
          // Non-critical update
        }
      }
    }

    // Succeed if we saved to DB OR sent the email
    if (savedToDb || emailSent) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true }),
      };
    }

    // Neither worked
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to send message. Please try again.' }),
    };
  } catch (error) {
    console.error('Contact form error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }),
    };
  }
};
