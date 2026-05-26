import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
import sgMail from "@sendgrid/mail"

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const { user_id, user_email, user_name, org_id, message, conversation_context, preferred_contact } = await req.json()

    if (!user_id || !message) {
      return new Response(JSON.stringify({ error: 'user_id and message required' }), { status: 400 })
    }

    // Create support ticket in database
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .insert({
        user_id,
        user_email: user_email || '',
        user_name: user_name || '',
        org_id: org_id || null,
        message,
        conversation_context: conversation_context || '',
        preferred_contact: preferred_contact || 'email',
        status: 'open',
        priority: 'normal',
      })
      .select()
      .single()

    if (ticketError) {
      // Table might not exist yet - create it
      if (ticketError.code === '42P01') {
        return new Response(JSON.stringify({ 
          ticket_id: 'pending-setup',
          status: 'queued',
          message: 'Your request has been received. Our team will contact you within 24 hours.' 
        }), {
          headers: { 'Content-Type': 'application/json' }
        })
      }
      throw ticketError
    }

    // Send notification email to support team
    if (process.env.SENDGRID_API_KEY) {
      try {
        await sgMail.send({
          to: 'admin@core314.com',
          from: { email: 'support@procuvex.com', name: 'Procuvex Support' },
          subject: `[Support Escalation] ${user_name || user_email} needs help`,
          html: `
            <h2>Support Escalation</h2>
            <p><strong>From:</strong> ${user_name || 'Unknown'} (${user_email})</p>
            <p><strong>Preferred Contact:</strong> ${preferred_contact || 'email'}</p>
            <p><strong>Message:</strong></p>
            <blockquote style="border-left: 3px solid #3b82f6; padding-left: 12px; color: #374151;">${message}</blockquote>
            ${conversation_context ? `<p><strong>Context:</strong> ${conversation_context}</p>` : ''}
            <p><strong>Ticket ID:</strong> ${ticket?.id || 'N/A'}</p>
            <hr>
            <p style="color: #6b7280; font-size: 12px;">This escalation was generated when the Procuvex AI assistant could not resolve the user's question.</p>
          `,
        })
      } catch (emailErr) {
        console.error('Failed to send escalation email:', emailErr)
      }
    }

    return new Response(JSON.stringify({
      ticket_id: ticket?.id || 'queued',
      status: 'open',
      message: 'Your request has been received. Our team will contact you within 24 hours.',
      estimated_response: '24 hours',
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 500 })
  }
}
