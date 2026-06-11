import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * AGENT HUB — Backend for AI agent operations
 * 
 * Actions:
 * - run_compliance_watchdog: Checks cert/SAM expiry for an org's subs
 * - run_opportunity_hunter: Scans SAM.gov for matching opportunities
 * - run_sub_recruitment: Finds subs to fill project gaps
 * - run_quote_analysis: Analyzes a quote against market data
 * - get_agent_stats: Returns agent activity summary
 */

export default async (req: Request, _context: Context) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers })
  }

  try {
    const body = await req.json()
    const { action, org_id, project_id, user_id } = body

    if (!org_id) {
      return new Response(JSON.stringify({ error: "org_id required" }), { status: 400, headers })
    }

    switch (action) {
      case 'run_compliance_watchdog':
        return new Response(JSON.stringify(await runComplianceWatchdog(org_id, project_id, user_id)), { headers })

      case 'run_opportunity_hunter':
        return new Response(JSON.stringify(await runOpportunityHunter(org_id, user_id)), { headers })

      case 'run_sub_recruitment':
        return new Response(JSON.stringify(await runSubRecruitment(org_id, project_id, user_id)), { headers })

      case 'run_quote_analysis':
        return new Response(JSON.stringify(await runQuoteAnalysis(org_id, project_id, body.quote_id, user_id)), { headers })

      case 'execute_action':
        return new Response(JSON.stringify(await executeAction(body.action_id, user_id)), { headers })

      case 'get_agent_stats':
        return new Response(JSON.stringify(await getAgentStats(org_id)), { headers })

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers })
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 500, headers })
  }
}

// ========== COMPLIANCE WATCHDOG ==========
async function runComplianceWatchdog(orgId: string, projectId: string | null, userId: string) {
  const actions: Array<Record<string, unknown>> = []

  // Find subs associated with this org's projects (sequential queries — Supabase JS doesn't support nested .in() subqueries)
  const { data: orgProjects } = await supabase
    .from('task_orders')
    .select('id')
    .eq('org_id', orgId)

  if (!orgProjects || orgProjects.length === 0) {
    return { actions_created: 0, message: 'No projects found for this organization.' }
  }

  const projectIds = orgProjects.map(p => p.id)

  const { data: sowItemRows } = await supabase
    .from('sow_items')
    .select('id')
    .in('task_order_id', projectIds)

  if (!sowItemRows || sowItemRows.length === 0) {
    return { actions_created: 0, message: 'No SOW items found in your projects.' }
  }

  const sowItemIds = sowItemRows.map(s => s.id)

  const { data: orgSubs } = await supabase
    .from('sow_subcontractors')
    .select('subcontractor_id')
    .in('sow_item_id', sowItemIds)

  if (!orgSubs || orgSubs.length === 0) {
    return { actions_created: 0, message: 'No subcontractors found in your projects.' }
  }

  const subIds = [...new Set(orgSubs.map(s => s.subcontractor_id))]

  // Check master DB for SAM expiry, certifications, and compliance issues
  const { data: subs } = await supabase
    .from('master_subcontractors')
    .select('id, company_name, sam_expiration_date, contact_email, small_business_types, state')
    .in('id', subIds.slice(0, 100))
    .eq('archived', false)

  const now = new Date()
  const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysOut = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)

  for (const sub of (subs || [])) {
    // Check SAM expiry (30-day warning)
    if (sub.sam_expiration_date) {
      const expiry = new Date(sub.sam_expiration_date)
      if (expiry <= thirtyDaysOut && expiry > now) {
        const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        actions.push({
          org_id: orgId,
          project_id: projectId,
          agent_type: 'compliance_watchdog',
          action_type: 'flag_compliance',
          status: 'pending_approval',
          title: `SAM Registration Expiring: ${sub.company_name}`,
          description: `${sub.company_name}'s SAM.gov registration expires in ${daysLeft} days (${sub.sam_expiration_date}). They may become ineligible for government contracts.`,
          payload: { subcontractor_id: sub.id, expiry_type: 'sam_registration', days_left: daysLeft, company_name: sub.company_name },
          context: { company_name: sub.company_name, email: sub.contact_email },
          assigned_to: userId,
        })
      }
      // Also flag if ALREADY expired
      if (expiry < now) {
        actions.push({
          org_id: orgId,
          project_id: projectId,
          agent_type: 'compliance_watchdog',
          action_type: 'flag_compliance',
          status: 'pending_approval',
          title: `SAM EXPIRED: ${sub.company_name}`,
          description: `${sub.company_name}'s SAM.gov registration expired on ${sub.sam_expiration_date}. This subcontractor is currently INELIGIBLE for government contracts.`,
          payload: { subcontractor_id: sub.id, expiry_type: 'sam_expired', days_left: 0, company_name: sub.company_name, severity: 'critical' },
          context: { company_name: sub.company_name, email: sub.contact_email },
          assigned_to: userId,
        })
      }
    }

    // Check for missing SAM registration entirely
    if (!sub.sam_expiration_date) {
      actions.push({
        org_id: orgId,
        project_id: projectId,
        agent_type: 'compliance_watchdog',
        action_type: 'flag_compliance',
        status: 'pending_approval',
        title: `No SAM Registration: ${sub.company_name}`,
        description: `${sub.company_name} has no SAM.gov expiration date on file. Verify their registration status before including on proposals.`,
        payload: { subcontractor_id: sub.id, expiry_type: 'sam_missing', days_left: -1, company_name: sub.company_name, severity: 'warning' },
        context: { company_name: sub.company_name, email: sub.contact_email },
        assigned_to: userId,
      })
    }
  }

  // Also check compliance documents if the table exists
  try {
    const { data: compDocs } = await supabase
      .from('compliance_documents')
      .select('id, subcontractor_id, document_type, expires_at, status')
      .in('subcontractor_id', subIds.slice(0, 100))
      .lt('expires_at', sixtyDaysOut.toISOString())
      .gt('expires_at', now.toISOString())

    for (const doc of (compDocs || [])) {
      const expiry = new Date(doc.expires_at)
      const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      const matchingSub = (subs || []).find(s => s.id === doc.subcontractor_id)
      actions.push({
        org_id: orgId,
        project_id: projectId,
        agent_type: 'compliance_watchdog',
        action_type: 'flag_compliance',
        status: 'pending_approval',
        title: `${doc.document_type} Expiring: ${matchingSub?.company_name || 'Unknown'}`,
        description: `${doc.document_type} expires in ${daysLeft} days. Request updated documentation.`,
        payload: { subcontractor_id: doc.subcontractor_id, expiry_type: 'compliance_doc', document_type: doc.document_type, days_left: daysLeft, company_name: matchingSub?.company_name },
        context: { document_id: doc.id },
        assigned_to: userId,
      })
    }
  } catch {
    // compliance_documents table may not exist yet
  }

  if (actions.length > 0) {
    await supabase.from('agent_actions').insert(actions)
  }

  return { actions_created: actions.length, message: `Found ${actions.length} compliance issue${actions.length !== 1 ? 's' : ''} to review.` }
}

// ========== OPPORTUNITY HUNTER ==========
async function runOpportunityHunter(orgId: string, userId: string) {
  // Get org's NAICS codes from their projects
  const { data: projects } = await supabase
    .from('task_orders')
    .select('naics_code, location_state, project_type')
    .eq('org_id', orgId)

  const naicsCodes = [...new Set((projects || []).map(p => (p as Record<string, unknown>).naics_code as string).filter(Boolean))]
  const states = [...new Set((projects || []).map(p => p.location_state).filter(Boolean))]

  if (naicsCodes.length === 0) {
    return { actions_created: 0, message: 'No NAICS codes found in your projects. Add NAICS codes to projects for opportunity matching.' }
  }

  // Query SAM.gov opportunities API
  const samApiKey = process.env.SAM_GOV_API_KEY
  if (!samApiKey) {
    return { actions_created: 0, message: 'SAM.gov API key not configured. Contact your administrator.' }
  }

  const actions: Array<Record<string, unknown>> = []

  try {
    const postedFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const url = `https://api.sam.gov/opportunities/v2/search?api_key=${samApiKey}&postedFrom=${postedFrom}&naics=${naicsCodes[0]}&limit=10`
    
    const resp = await fetch(url)
    if (resp.ok) {
      const data = await resp.json()
      const opportunities = data.opportunitiesData || []

      for (const opp of opportunities.slice(0, 5)) {
        const matchScore = calculateMatchScore(opp, naicsCodes, states)
        if (matchScore >= 40) {
          actions.push({
            org_id: orgId,
            project_id: null,
            agent_type: 'opportunity_hunter',
            action_type: 'score_opportunity',
            status: 'pending_approval',
            title: `New Opportunity: ${(opp.title || 'Untitled').substring(0, 100)}`,
            description: `Match score: ${matchScore}%. NAICS: ${opp.naicsCode || 'N/A'}. Set-aside: ${opp.typeOfSetAside || 'None'}. Due: ${opp.responseDeadLine || 'N/A'}`,
            payload: { 
              solicitation_number: opp.solicitationNumber,
              title: opp.title,
              naics: opp.naicsCode,
              set_aside: opp.typeOfSetAside,
              due_date: opp.responseDeadLine,
              match_score: matchScore,
              url: opp.uiLink,
            },
            context: { source: 'sam_gov', matched_naics: naicsCodes },
            assigned_to: userId,
          })
        }
      }
    }
  } catch {
    // SAM.gov API may be unavailable — fail gracefully
  }

  if (actions.length > 0) {
    await supabase.from('agent_actions').insert(actions)
  }

  return { actions_created: actions.length, message: `Found ${actions.length} matching opportunit${actions.length !== 1 ? 'ies' : 'y'}.` }
}

function calculateMatchScore(opp: any, naicsCodes: string[], states: string[]): number {
  let score = 0
  if (naicsCodes.includes(opp.naicsCode)) score += 40
  if (opp.placeOfPerformance?.state && states.includes(opp.placeOfPerformance.state)) score += 30
  if (opp.typeOfSetAside) score += 15
  if (opp.responseDeadLine) {
    const daysLeft = (new Date(opp.responseDeadLine).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    if (daysLeft > 14) score += 15
    else if (daysLeft > 7) score += 10
  }
  return Math.min(100, score)
}

// ========== SUB RECRUITMENT ==========
async function runSubRecruitment(orgId: string, projectId: string | null, userId: string) {
  if (!projectId) {
    return { actions_created: 0, message: 'Select a project to find sub gaps.' }
  }

  // Find SOW items without awarded subs
  const { data: sowItems } = await supabase
    .from('sow_items')
    .select('id, sow_name, service_category')
    .eq('task_order_id', projectId)
    .is('awarded_subcontractor_id', null)

  if (!sowItems || sowItems.length === 0) {
    return { actions_created: 0, message: 'All SOW lines have awarded subcontractors.' }
  }

  const actions: Array<Record<string, unknown>> = []

  for (const sow of sowItems.slice(0, 5)) {
    // Find potential subs from master DB
    const { data: candidates } = await supabase
      .from('master_subcontractors')
      .select('id, company_name, contact_email, trade_categories, state')
      .eq('archived', false)
      .not('contact_email', 'is', null)
      .contains('trade_categories', [sow.service_category])
      .limit(5)

    if (candidates && candidates.length > 0) {
      actions.push({
        org_id: orgId,
        project_id: projectId,
        agent_type: 'sub_recruitment',
        action_type: 'recommend_sub',
        status: 'pending_approval',
        title: `${candidates.length} sub${candidates.length > 1 ? 's' : ''} found for: ${sow.sow_name}`,
        description: `Found ${candidates.length} potential subcontractors for "${sow.service_category}". Top match: ${candidates[0].company_name} (${candidates[0].state || 'Unknown location'}).`,
        payload: {
          sow_item_id: sow.id,
          sow_name: sow.sow_name,
          candidates: candidates.map(c => ({ id: c.id, name: c.company_name, email: c.contact_email, state: c.state })),
        },
        context: { service_category: sow.service_category },
        assigned_to: userId,
      })
    }
  }

  if (actions.length > 0) {
    await supabase.from('agent_actions').insert(actions)
  }

  return { actions_created: actions.length, message: `Found candidates for ${actions.length} SOW line${actions.length !== 1 ? 's' : ''}.` }
}

// ========== QUOTE ANALYSIS ==========
async function runQuoteAnalysis(orgId: string, projectId: string | null, quoteId: string | null, userId: string) {
  if (!projectId) {
    return { actions_created: 0, message: 'Select a project for quote analysis.' }
  }

  // Get SOW items for this project first (Supabase JS doesn't support nested .in() subqueries)
  const { data: projectSowItems } = await supabase
    .from('sow_items')
    .select('id')
    .eq('task_order_id', projectId)

  if (!projectSowItems || projectSowItems.length === 0) {
    return { actions_created: 0, message: 'No SOW items found in this project.' }
  }

  const sowItemIds = projectSowItems.map(s => s.id)

  // Get recent quotes for this project
  const { data: quotes } = await supabase
    .from('sow_quotes')
    .select('id, sow_item_id, total_amount, monthly_amount, subcontractor_id, status')
    .in('sow_item_id', sowItemIds)
    .eq('status', 'received')
    .limit(10)

  if (!quotes || quotes.length === 0) {
    return { actions_created: 0, message: 'No pending quotes to analyze.' }
  }

  const actions: Array<Record<string, unknown>> = []

  for (const quote of quotes) {
    // Get sub name
    const { data: sub } = await supabase
      .from('master_subcontractors')
      .select('company_name')
      .eq('id', quote.subcontractor_id)
      .single()

    const amount = quote.total_amount || quote.monthly_amount || 0

    actions.push({
      org_id: orgId,
      project_id: projectId,
      agent_type: 'quote_analysis',
      action_type: 'analyze_quote',
      status: 'pending_approval',
      title: `Quote from ${sub?.company_name || 'Unknown'}: $${Number(amount).toLocaleString()}`,
      description: `Review quote of $${Number(amount).toLocaleString()} from ${sub?.company_name || 'Unknown'}. Compare against market rates and historical data.`,
      payload: {
        quote_id: quote.id,
        subcontractor_id: quote.subcontractor_id,
        amount,
        company_name: sub?.company_name,
      },
      context: { sow_item_id: quote.sow_item_id },
      assigned_to: userId,
    })
  }

  if (actions.length > 0) {
    await supabase.from('agent_actions').insert(actions)
  }

  return { actions_created: actions.length, message: `Analyzed ${actions.length} quote${actions.length !== 1 ? 's' : ''}.` }
}

// ========== EXECUTE APPROVED ACTION ==========
async function executeAction(actionId: string, userId: string) {
  if (!actionId) return { error: 'action_id required' }

  const { data: action, error } = await supabase
    .from('agent_actions')
    .select('*')
    .eq('id', actionId)
    .single()

  if (error || !action) return { error: 'Action not found' }
  if (action.status !== 'pending_approval' && action.status !== 'approved') {
    return { error: `Cannot execute action with status: ${action.status}` }
  }

  const now = new Date().toISOString()

  // Execute based on action type
  switch (action.action_type) {
    case 'flag_compliance': {
      // Create compliance notification
      await supabase.from('notifications').insert({
        org_id: action.org_id,
        user_id: action.assigned_to || userId,
        type: 'compliance_gap',
        title: action.title,
        message: action.description,
        read: false,
        metadata: { agent_type: action.agent_type, ...action.payload },
      })
      break
    }
    case 'score_opportunity': {
      // Create opportunity notification with link
      await supabase.from('notifications').insert({
        org_id: action.org_id,
        user_id: action.assigned_to || userId,
        type: 'system',
        title: action.title,
        message: action.description,
        link: action.payload?.url || null,
        read: false,
        metadata: { agent_type: action.agent_type, ...action.payload },
      })
      break
    }
    case 'recommend_sub': {
      // Notify about sub recommendations
      const candidates = (action.payload as any)?.candidates || []
      await supabase.from('notifications').insert({
        org_id: action.org_id,
        user_id: action.assigned_to || userId,
        type: 'system',
        title: `Sub Recommendations: ${action.title}`,
        message: `${candidates.length} subcontractor candidate${candidates.length !== 1 ? 's' : ''} ready for review.`,
        link: '/agent-hub',
        read: false,
        metadata: { agent_type: action.agent_type, ...action.payload },
      })
      break
    }
    case 'analyze_quote': {
      await supabase.from('notifications').insert({
        org_id: action.org_id,
        user_id: action.assigned_to || userId,
        type: 'system',
        title: `Quote Analysis: ${action.title}`,
        message: action.description,
        read: false,
        metadata: { agent_type: action.agent_type, ...action.payload },
      })
      break
    }
  }

  // Mark as executed
  await supabase.from('agent_actions').update({
    status: 'executed',
    approved_at: now,
    executed_at: now,
    resolved_by: userId,
  }).eq('id', actionId)

  return { success: true, action_id: actionId, status: 'executed' }
}

// ========== STATS ==========
async function getAgentStats(orgId: string) {
  const { data: actionCounts } = await supabase
    .from('agent_actions')
    .select('agent_type, status')
    .eq('org_id', orgId)

  const stats: Record<string, { total: number; pending: number; executed: number }> = {}
  for (const a of (actionCounts || [])) {
    if (!stats[a.agent_type]) stats[a.agent_type] = { total: 0, pending: 0, executed: 0 }
    stats[a.agent_type].total++
    if (a.status === 'pending_approval') stats[a.agent_type].pending++
    if (a.status === 'executed') stats[a.agent_type].executed++
  }

  return { stats }
}
