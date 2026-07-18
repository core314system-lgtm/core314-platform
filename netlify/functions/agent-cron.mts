import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CERT_TYPE_LABELS: Record<string, string> = {
  license: "License",
  insurance: "Insurance",
  certification: "Certification",
  bond: "Bond",
  w9: "W-9",
  capability_statement: "Capability Statement",
  other: "Document",
}

/**
 * AGENT CRON — Scheduled agent execution
 * 
 * Runs daily at 6 AM UTC. For each org with enabled agents:
 * - Compliance Watchdog: checks cert/SAM expiry
 * - Opportunity Hunter: scans for new SAM.gov matches
 * 
 * Only runs agents set to "supervised" or "autonomous" mode.
 * Advisor-mode agents must be triggered manually from the Agent Hub.
 * 
 * Schedule: @daily (configured in netlify.toml)
 */

export default async (req: Request, _context: Context) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  }

  // Accept scheduled POST invocations (Netlify cron sends POST)
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers })
  }

  try {
    // Find all enabled agent settings that are supervised or autonomous
    const { data: autoSettings, error } = await supabase
      .from('agent_settings')
      .select('*')
      .eq('enabled', true)
      .in('autonomy_level', ['supervised', 'autonomous'])

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers })
    }

    if (!autoSettings || autoSettings.length === 0) {
      return new Response(JSON.stringify({ message: 'No agents in supervised/autonomous mode.', runs: 0 }), { headers })
    }

    let totalActions = 0
    const results: Array<{ org_id: string; agent_type: string; actions_created: number }> = []

    for (const setting of autoSettings) {
      const { org_id, agent_type, primary_contact_id, autonomy_level } = setting

      try {
        let actionsCreated = 0

        if (agent_type === 'compliance_watchdog') {
          actionsCreated = await runComplianceCheck(org_id, primary_contact_id, autonomy_level)
        } else if (agent_type === 'opportunity_hunter') {
          actionsCreated = await runOpportunityCheck(org_id, primary_contact_id, autonomy_level)
        }

        totalActions += actionsCreated
        results.push({ org_id, agent_type, actions_created: actionsCreated })

        // If autonomous mode and actions were created, send email notification
        if (autonomy_level === 'autonomous' && actionsCreated > 0 && primary_contact_id) {
          await sendAgentDigest(primary_contact_id, agent_type, actionsCreated)
        }
      } catch {
        results.push({ org_id, agent_type, actions_created: 0 })
      }
    }

    return new Response(JSON.stringify({
      message: `Cron complete. ${totalActions} actions created across ${results.length} agent runs.`,
      runs: results.length,
      total_actions: totalActions,
      results,
    }), { headers })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 500, headers })
  }
}

async function runComplianceCheck(orgId: string, contactId: string | null, autonomyLevel: string): Promise<number> {
  // Check for subs with expiring SAM registration (within 30 days)
  const { data: orgSubs } = await supabase.rpc('get_org_subcontractor_ids', { p_org_id: orgId }).limit(200)
  
  // Fallback: query directly if RPC doesn't exist
  let subIds: string[]
  if (orgSubs) {
    subIds = orgSubs.map((s: any) => s.subcontractor_id)
  } else {
    const { data: sowSubs } = await supabase
      .from('sow_subcontractors')
      .select('subcontractor_id, sow_items!inner(task_order_id, task_orders!inner(org_id))')
      .eq('sow_items.task_orders.org_id', orgId)
      .limit(200)
    subIds = [...new Set((sowSubs || []).map((s: any) => s.subcontractor_id))]
  }

  if (subIds.length === 0) return 0

  const { data: subs } = await supabase
    .from('master_subcontractors')
    .select('id, company_name, sam_expiration_date, contact_email')
    .in('id', subIds.slice(0, 100))
    .eq('archived', false)

  const now = new Date()
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const actions: Array<Record<string, unknown>> = []

  for (const sub of (subs || [])) {
    if (sub.sam_expiration_date) {
      const expiry = new Date(sub.sam_expiration_date)
      if (expiry <= thirtyDays && expiry > now) {
        const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        
        // Check if we already flagged this in the last 7 days
        const { data: existing } = await supabase
          .from('agent_actions')
          .select('id')
          .eq('org_id', orgId)
          .eq('agent_type', 'compliance_watchdog')
          .eq('payload->>subcontractor_id', sub.id)
          .gte('created_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .limit(1)

        if (existing && existing.length > 0) continue

        const status = autonomyLevel === 'autonomous' ? 'executed' : 'pending_approval'
        actions.push({
          org_id: orgId,
          project_id: null,
          agent_type: 'compliance_watchdog',
          action_type: 'flag_compliance',
          status,
          title: `SAM Expiring: ${sub.company_name} (${daysLeft} days)`,
          description: `${sub.company_name}'s SAM.gov registration expires on ${sub.sam_expiration_date}. They are on active projects and may become ineligible.`,
          payload: { subcontractor_id: sub.id, expiry_type: 'sam_registration', days_left: daysLeft, company_name: sub.company_name },
          context: { email: sub.contact_email, auto_executed: autonomyLevel === 'autonomous' },
          assigned_to: contactId,
          ...(status === 'executed' ? { executed_at: new Date().toISOString() } : {}),
        })

        // In autonomous mode, also create a notification immediately
        if (autonomyLevel === 'autonomous' && contactId) {
          await supabase.from('notifications').insert({
            org_id: orgId,
            user_id: contactId,
            type: 'compliance_gap',
            title: `SAM Expiring: ${sub.company_name}`,
            message: `${sub.company_name}'s SAM registration expires in ${daysLeft} days.`,
            read: false,
            metadata: { agent_type: 'compliance_watchdog', subcontractor_id: sub.id },
          })
        }
      }
    }
  }

  // Check subcontractor certifications, insurance, and bonding for expiry
  // (expiring within 30 days OR already expired) so buyers are not surprised
  // by a lapsed document on an active sub.
  const { data: certs } = await supabase
    .from('master_sub_certifications')
    .select('id, master_sub_id, cert_type, cert_name, expiration_date')
    .in('master_sub_id', subIds.slice(0, 100))
    .not('expiration_date', 'is', null)
    .lte('expiration_date', thirtyDays.toISOString())

  for (const cert of (certs || [])) {
    const expiry = new Date(cert.expiration_date)
    const sub = (subs || []).find(s => s.id === cert.master_sub_id)
    const company = sub?.company_name || 'Unknown subcontractor'
    const label = CERT_TYPE_LABELS[cert.cert_type] || 'Document'
    const isExpired = expiry < now
    const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    // Skip if already flagged in the last 7 days
    const { data: existing } = await supabase
      .from('agent_actions')
      .select('id')
      .eq('org_id', orgId)
      .eq('agent_type', 'compliance_watchdog')
      .eq('payload->>cert_id', cert.id)
      .gte('created_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(1)
    if (existing && existing.length > 0) continue

    const status = autonomyLevel === 'autonomous' ? 'executed' : 'pending_approval'
    actions.push({
      org_id: orgId,
      project_id: null,
      agent_type: 'compliance_watchdog',
      action_type: 'flag_compliance',
      status,
      title: isExpired ? `${label} Expired: ${company}` : `${label} Expiring: ${company} (${daysLeft} days)`,
      description: isExpired
        ? `${company}'s ${cert.cert_name || label} expired on ${cert.expiration_date}. They are on active projects — confirm updated documentation.`
        : `${company}'s ${cert.cert_name || label} expires in ${daysLeft} days (${cert.expiration_date}). Request updated documentation.`,
      payload: { subcontractor_id: cert.master_sub_id, expiry_type: isExpired ? 'certification_expired' : 'certification_expiring', cert_type: cert.cert_type, cert_id: cert.id, days_left: isExpired ? 0 : daysLeft, company_name: company, ...(isExpired ? { severity: 'high' } : {}) },
      context: { company_name: company, cert_name: cert.cert_name, auto_executed: autonomyLevel === 'autonomous' },
      assigned_to: contactId,
      ...(status === 'executed' ? { executed_at: new Date().toISOString() } : {}),
    })
  }

  if (actions.length > 0) {
    await supabase.from('agent_actions').insert(actions)
  }
  return actions.length
}

async function runOpportunityCheck(orgId: string, contactId: string | null, autonomyLevel: string): Promise<number> {
  const samApiKey = process.env.SAM_GOV_API_KEY
  if (!samApiKey) return 0

  // Get org NAICS codes
  const { data: projects } = await supabase
    .from('task_orders')
    .select('naics_code')
    .eq('org_id', orgId)
    .not('naics_code', 'is', null)

  const naicsCodes = [...new Set((projects || []).map((p: any) => p.naics_code).filter(Boolean))]
  if (naicsCodes.length === 0) return 0

  const actions: Array<Record<string, unknown>> = []
  const postedFrom = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Last 24 hours

  for (const naics of naicsCodes.slice(0, 3)) {
    try {
      const url = `https://api.sam.gov/opportunities/v2/search?api_key=${samApiKey}&postedFrom=${postedFrom}&naics=${naics}&limit=5`
      const resp = await fetch(url)
      if (!resp.ok) continue

      const data = await resp.json()
      for (const opp of (data.opportunitiesData || []).slice(0, 3)) {
        const status = autonomyLevel === 'autonomous' ? 'executed' : 'pending_approval'
        actions.push({
          org_id: orgId,
          project_id: null,
          agent_type: 'opportunity_hunter',
          action_type: 'score_opportunity',
          status,
          title: `New: ${(opp.title || 'Untitled').substring(0, 100)}`,
          description: `NAICS: ${opp.naicsCode || 'N/A'}. Set-aside: ${opp.typeOfSetAside || 'None'}. Due: ${opp.responseDeadLine || 'TBD'}`,
          payload: {
            solicitation_number: opp.solicitationNumber,
            title: opp.title,
            naics: opp.naicsCode,
            set_aside: opp.typeOfSetAside,
            due_date: opp.responseDeadLine,
            url: opp.uiLink,
          },
          context: { source: 'sam_gov_cron', auto_executed: autonomyLevel === 'autonomous' },
          assigned_to: contactId,
          ...(status === 'executed' ? { executed_at: new Date().toISOString() } : {}),
        })
      }
    } catch {
      // SAM.gov may be unavailable
    }
  }

  if (actions.length > 0) {
    await supabase.from('agent_actions').insert(actions)
  }
  return actions.length
}

async function sendAgentDigest(userId: string, agentType: string, actionsCount: number) {
  // Get user email
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('email, full_name')
    .eq('id', userId)
    .single()

  if (!profile?.email) return

  // Create in-app notification as digest summary
  const { data: userOrg } = await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', userId)
    .limit(1)
    .single()

  const agentLabels: Record<string, string> = {
    compliance_watchdog: 'Compliance Watchdog',
    opportunity_hunter: 'Opportunity Hunter',
  }

  await supabase.from('notifications').insert({
    org_id: userOrg?.org_id,
    user_id: userId,
    type: 'system',
    title: `${agentLabels[agentType] || agentType}: ${actionsCount} new item${actionsCount > 1 ? 's' : ''}`,
    message: `Your ${agentLabels[agentType] || agentType} agent found ${actionsCount} new item${actionsCount > 1 ? 's' : ''} overnight. Review them in the Agent Hub.`,
    link: '/agent-hub',
    read: false,
    metadata: { agent_type: agentType, cron: true, count: actionsCount },
  })

  // Send email via SendGrid if configured
  try {
    const sgMail = await import("@sendgrid/mail")
    const apiKey = process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY
    if (!apiKey) return

    sgMail.default.setApiKey(apiKey)
    await sgMail.default.send({
      to: profile.email,
      from: { email: 'team@procuvex.com', name: 'Procuvex AI' },
      subject: `[Procuvex] ${agentLabels[agentType] || agentType}: ${actionsCount} new item${actionsCount > 1 ? 's' : ''}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1f2937; margin-bottom: 8px;">Agent Update</h2>
          <p style="color: #6b7280; font-size: 14px;">Hi ${profile.full_name || 'there'},</p>
          <p style="color: #374151; font-size: 14px;">
            Your <strong>${agentLabels[agentType] || agentType}</strong> agent found <strong>${actionsCount}</strong> new item${actionsCount > 1 ? 's' : ''} that ${actionsCount > 1 ? 'need' : 'needs'} your attention.
          </p>
          <div style="margin: 24px 0;">
            <a href="https://procuvex.com/agent-hub" style="display: inline-block; background: #7c3aed; color: white; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;">Review in Agent Hub</a>
          </div>
          <p style="color: #9ca3af; font-size: 12px;">This is an automated notification from your Procuvex AI agent.</p>
        </div>
      `,
      text: `Agent Update\n\nHi ${profile.full_name || 'there'},\n\nYour ${agentLabels[agentType] || agentType} agent found ${actionsCount} new item${actionsCount > 1 ? 's' : ''} that ${actionsCount > 1 ? 'need' : 'needs'} your attention.\n\nReview in Agent Hub: https://procuvex.com/agent-hub`,
      headers: {
        "List-Unsubscribe": "<mailto:team@procuvex.com?subject=Unsubscribe%20Agent%20Notifications>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    })
  } catch {
    // Email is best-effort
  }
}
