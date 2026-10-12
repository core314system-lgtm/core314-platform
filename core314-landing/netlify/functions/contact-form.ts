import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const CONTACT_RECIPIENT = 'admin@core314.com';
const FROM = { email: 'noreply@core314.com', name: 'Core314 Technologies' };
const PRODUCTION_HOSTS = ['core314.com', 'www.core314.com'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function escapeHtml(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function clean(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export function isProductionHost(host: string | undefined): boolean {
  return PRODUCTION_HOSTS.includes((host || '').toLowerCase().split(':')[0]);
}

export interface Inquiry {
  name: string;
  email: string;
  company: string;
  phone: string;
  message: string;
  details: [string, string][];
}

export function parseInquiry(body: Record<string, unknown>): Inquiry | { error: string } | { spam: true } {
  if (clean(body.website, 200) || clean(body['bot-field'], 200)) return { spam: true };
  const name = clean(body.name, 200);
  const email = clean(body.email, 320);
  const challenge = clean(body.challenge, 5000) || clean(body.message, 5000);
  if (!name || !email || !challenge) return { error: 'Name, email, and a short description of your challenge are required.' };
  if (!EMAIL_RE.test(email)) return { error: 'Please enter a valid email address.' };
  const lead = (typeof body.lead === 'object' && body.lead !== null ? body.lead : {}) as Record<string, unknown>;
  const details: [string, string][] = [
    ['Interest', clean(body.interest, 100)],
    ['Current tools', clean(body.tools, 500)],
    ['Timeline', clean(body.timeline, 100)],
    ['Found us via', clean(body.source, 100)],
    ['UTM source', clean(lead.utm_source, 200)],
    ['UTM medium', clean(lead.utm_medium, 200)],
    ['UTM campaign', clean(lead.utm_campaign, 200)],
    ['Referrer', clean(lead.referrer, 500)],
    ['Landing page', clean(lead.landing_page, 300)],
  ].filter(([, v]) => v) as [string, string][];
  const message = [challenge, '', ...details.map(([k, v]) => `${k}: ${v}`)].join('\n').trim();
  return { name, email, company: clean(body.company, 200), phone: clean(body.phone, 50), message, details };
}

async function sendEmail(apiKey: string, payload: unknown): Promise<boolean> {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) console.error('SendGrid error:', res.status, await res.text());
  return res.ok;
}

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request.' }) };
  }
  const parsed = parseInquiry(body);
  if ('spam' in parsed) return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  if ('error' in parsed) return { statusCode: 400, headers, body: JSON.stringify({ error: parsed.error }) };
  const { name, email, company, phone, message, details } = parsed;

  if (!isProductionHost(event.headers.host)) {
    console.log('Staging test submission (not stored, no email):', JSON.stringify({ host: event.headers.host, name, email, details }));
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, test: true }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;
  let submissionId: string | null = null;
  if (supabase) {
    const { data, error } = await supabase
      .from('contact_submissions')
      .insert({ name, email, company: company || null, phone: phone || null, message, email_sent: false })
      .select('id')
      .single();
    if (error) console.error('Supabase insert error:', error.message);
    else submissionId = data?.id ?? null;
  }

  const apiKey = process.env.SENDGRID_API_KEY;
  let emailSent = false;
  if (apiKey) {
    const rows = [['Name', name], ['Email', email], ['Company', company], ['Phone', phone], ...details]
      .filter(([, v]) => v)
      .map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#475569;vertical-align:top">${escapeHtml(k)}</td><td style="padding:6px 0;color:#1e293b">${escapeHtml(v)}</td></tr>`)
      .join('');
    const challenge = escapeHtml(message.split('\n\n')[0]).replace(/\n/g, '<br>');
    emailSent = await sendEmail(apiKey, {
      personalizations: [{ to: [{ email: CONTACT_RECIPIENT, name: 'Chris Brown' }], subject: `[${details.find(([k]) => k === 'Interest')?.[1] || 'Inquiry'}] New Core314 lead: ${name}${company ? ` (${company})` : ''}` }],
      from: { email: FROM.email, name: 'Core314 Contact Form' },
      reply_to: { email, name },
      content: [
        { type: 'text/plain', value: `New inquiry from core314.com\n\nName: ${name}\nEmail: ${email}\nCompany: ${company}\n\n${message}` },
        { type: 'text/html', value: `<div style="font-family:Arial,sans-serif;max-width:600px"><h2>New inquiry from core314.com</h2><table>${rows}</table><h3>Challenge</h3><p>${challenge}</p></div>` },
      ],
    });
    const first = escapeHtml(name.split(' ')[0]);
    await sendEmail(apiKey, {
      personalizations: [{ to: [{ email, name }], subject: 'We received your request | Core314 Technologies' }],
      from: FROM,
      reply_to: { email: CONTACT_RECIPIENT, name: 'Core314 Technologies' },
      content: [
        { type: 'text/plain', value: `Hi ${name.split(' ')[0]},\n\nThanks for contacting Core314 Technologies. We received your request and will reply within one business day to set up your Business Workflow Discovery Call.\n\nIf you need to add anything, just reply to this email.\n\nCore314 Technologies\nhttps://core314.com` },
        { type: 'text/html', value: `<div style="font-family:Arial,sans-serif;max-width:600px;color:#1e293b"><p>Hi ${first},</p><p>Thanks for contacting Core314 Technologies. We received your request and will reply within one business day to set up your Business Workflow Discovery Call.</p><p>If you need to add anything, just reply to this email.</p><p>Core314 Technologies<br><a href="https://core314.com">core314.com</a></p></div>` },
      ],
    }).catch((e) => console.error('Confirmation email failed:', e));
  }

  if (emailSent && supabase && submissionId) {
    await supabase.from('contact_submissions').update({ email_sent: true }).eq('id', submissionId);
  }
  if (!submissionId && !emailSent) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'We could not send your message. Please email admin@core314.com directly.' }) };
  }
  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
};
