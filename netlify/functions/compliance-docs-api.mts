import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
}

export default async (req: Request, _context: Context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(req.url)

  if (req.method === "GET") {
    return handleGet(url)
  } else if (req.method === "POST") {
    return handlePost(req)
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders })
}

// GET — fetch compliance data for a project
async function handleGet(url: URL) {
  const taskOrderId = url.searchParams.get("task_order_id")
  if (!taskOrderId) {
    return new Response(JSON.stringify({ error: "task_order_id required" }), { status: 400, headers: corsHeaders })
  }

  // Get required docs for this project
  const { data: requiredDocs } = await supabase
    .from("required_compliance_docs")
    .select("*")
    .eq("task_order_id", taskOrderId)
    .order("created_at", { ascending: true })

  // Get all uploaded compliance docs for this project (all subs)
  const { data: uploadedDocs } = await supabase
    .from("sub_compliance_docs")
    .select("*")
    .eq("task_order_id", taskOrderId)
    .order("uploaded_at", { ascending: false })

  // Get subcontractors for context
  const { data: subs } = await supabase
    .from("sow_subcontractors")
    .select("id, subcontractor_id, sow_item_id, subcontractors(id, company_name, contact_email), sow_items(id, sow_name)")
    .eq("task_order_id", taskOrderId)

  return new Response(
    JSON.stringify({
      required_docs: requiredDocs || [],
      uploaded_docs: uploadedDocs || [],
      subcontractors: subs || [],
    }),
    { headers: corsHeaders }
  )
}

// POST — manage required docs or review uploaded docs
async function handlePost(req: Request) {
  const body = await req.json()
  const { action } = body

  if (action === "add_required_doc") {
    return handleAddRequiredDoc(body)
  } else if (action === "remove_required_doc") {
    return handleRemoveRequiredDoc(body)
  } else if (action === "review_doc") {
    return handleReviewDoc(body)
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders })
}

async function handleAddRequiredDoc(body: any) {
  const { task_order_id, sow_item_id, doc_type, doc_label, is_required } = body

  if (!task_order_id || !doc_type || !doc_label) {
    return new Response(
      JSON.stringify({ error: "task_order_id, doc_type, and doc_label are required" }),
      { status: 400, headers: corsHeaders }
    )
  }

  const { data, error } = await supabase
    .from("required_compliance_docs")
    .insert({
      task_order_id,
      sow_item_id: sow_item_id || null,
      doc_type,
      doc_label,
      is_required: is_required !== false,
    })
    .select()
    .single()

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }

  return new Response(JSON.stringify({ success: true, required_doc: data }), { headers: corsHeaders })
}

async function handleRemoveRequiredDoc(body: any) {
  const { id } = body
  if (!id) {
    return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: corsHeaders })
  }

  await supabase.from("required_compliance_docs").delete().eq("id", id)
  return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })
}

async function handleReviewDoc(body: any) {
  const { doc_id, status, reviewer_notes } = body

  if (!doc_id || !status) {
    return new Response(JSON.stringify({ error: "doc_id and status required" }), { status: 400, headers: corsHeaders })
  }

  if (!["approved", "rejected", "pending"].includes(status)) {
    return new Response(JSON.stringify({ error: "status must be approved, rejected, or pending" }), { status: 400, headers: corsHeaders })
  }

  const { data, error } = await supabase
    .from("sub_compliance_docs")
    .update({
      status,
      reviewer_notes: reviewer_notes || null,
      reviewed_at: status !== "pending" ? new Date().toISOString() : null,
    })
    .eq("id", doc_id)
    .select()
    .single()

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }

  return new Response(JSON.stringify({ success: true, document: data }), { headers: corsHeaders })
}
