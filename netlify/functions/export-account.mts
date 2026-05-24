import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const { org_id, format } = await req.json()

    if (!org_id) {
      return new Response(JSON.stringify({ error: 'org_id required' }), { status: 400 })
    }

    // Fetch all org data
    const [
      { data: projects },
      { data: subcontractors },
      { data: documents },
      { data: aiOutputs },
      { data: teamingAgreements },
    ] = await Promise.all([
      supabase.from('task_orders').select('*').eq('org_id', org_id),
      supabase.from('subcontractors').select('*').eq('org_id', org_id),
      supabase.from('documents').select('*').eq('org_id', org_id),
      supabase.from('ai_outputs').select('*').eq('org_id', org_id),
      supabase.from('teaming_agreements').select('*').eq('org_id', org_id),
    ])

    // Also fetch project_subcontractors through task_orders
    const projectIds = (projects || []).map(p => p.id)
    let projectSubcontractors: unknown[] = []
    let sowSubcontractors: unknown[] = []

    if (projectIds.length > 0) {
      const { data: ps } = await supabase
        .from('project_subcontractors')
        .select('*')
        .in('task_order_id', projectIds)
      projectSubcontractors = ps || []

      const { data: ss } = await supabase
        .from('sow_subcontractors')
        .select('*')
        .in('task_order_id', projectIds)
      sowSubcontractors = ss || []
    }

    const exportData = {
      exported_at: new Date().toISOString(),
      org_id,
      projects: projects || [],
      subcontractors: subcontractors || [],
      project_subcontractors: projectSubcontractors,
      sow_subcontractors: sowSubcontractors,
      documents: documents || [],
      ai_outputs: aiOutputs || [],
      teaming_agreements: teamingAgreements || [],
    }

    if (format === 'csv') {
      // Return CSV format for main tables
      const csvSections: string[] = []

      // Projects CSV
      if (projects && projects.length > 0) {
        const headers = Object.keys(projects[0]).join(',')
        const rows = projects.map(p => Object.values(p).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
        csvSections.push(`--- PROJECTS ---\n${headers}\n${rows}`)
      }

      // Subcontractors CSV
      if (subcontractors && subcontractors.length > 0) {
        const headers = Object.keys(subcontractors[0]).join(',')
        const rows = subcontractors.map(s => Object.values(s).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
        csvSections.push(`--- SUBCONTRACTORS ---\n${headers}\n${rows}`)
      }

      return new Response(csvSections.join('\n\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="procuvex-export-${new Date().toISOString().split('T')[0]}.csv"`,
        }
      })
    }

    // Default: JSON
    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="procuvex-export-${new Date().toISOString().split('T')[0]}.json"`,
      }
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 500 })
  }
}
