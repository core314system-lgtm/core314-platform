import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
import { sanitizeAndLimit } from "./_shared/sanitize.ts"

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
}

async function createNotification(orgId: string, type: string, title: string, message: string, link?: string) {
  try {
    await supabase.from("notifications").insert({
      org_id: orgId,
      type,
      title,
      message,
      link: link || null,
      read: false,
      metadata: {},
    })
  } catch {
    // Non-critical — don't fail the main operation
  }
}

async function validateToken(token: string) {
  const { data, error } = await supabase
    .from("rfq_tokens")
    .select("*, sow_items(*), task_orders(*), subcontractors(*), sow_subcontractors(*)")
    .eq("token", token)
    .eq("is_active", true)
    .single()

  if (error || !data) return null
  if (new Date(data.expires_at) < new Date()) return null
  return data
}

// GET /api/portal-api?token=xxx — load portal data
async function handleGet(url: URL) {
  const token = url.searchParams.get("token")
  if (!token) {
    return new Response(JSON.stringify({ error: "Token required" }), { status: 400, headers: corsHeaders })
  }

  const tokenData = await validateToken(token)
  if (!tokenData) {
    return new Response(JSON.stringify({ error: "Invalid or expired token" }), { status: 403, headers: corsHeaders })
  }

  // Update portal viewed timestamp
  await supabase
    .from("sow_subcontractors")
    .update({ portal_viewed_at: new Date().toISOString() })
    .eq("id", tokenData.sow_subcontractor_id)

  // Get form template for this SOW/task order
  let formTemplate = null
  const { data: sowTemplate } = await supabase
    .from("quote_form_templates")
    .select("*, quote_form_fields(*)")
    .eq("sow_item_id", tokenData.sow_item_id)
    .single()

  if (sowTemplate) {
    formTemplate = sowTemplate
  } else {
    // Try task-order-level template
    const { data: toTemplate } = await supabase
      .from("quote_form_templates")
      .select("*, quote_form_fields(*)")
      .eq("task_order_id", tokenData.task_order_id)
      .is("sow_item_id", null)
      .single()
    if (toTemplate) formTemplate = toTemplate
  }

  // If no custom template, use defaults
  if (!formTemplate) {
    formTemplate = {
      id: "default",
      name: "Standard Quote Form",
      fields: getDefaultFields(),
    }
  } else {
    // Sort fields by display_order
    formTemplate.fields = (formTemplate.quote_form_fields || []).sort(
      (a: any, b: any) => a.display_order - b.display_order
    )
  }

  // Get existing questions (shared ones + this sub's own) from legacy table
  const { data: questions } = await supabase
    .from("subcontractor_questions")
    .select("*")
    .eq("sow_item_id", tokenData.sow_item_id)
    .or(`shared_with_all.eq.true,subcontractor_id.eq.${tokenData.subcontractor_id}`)
    .order("created_at", { ascending: true })

  // Get AI-analyzed questions from the new opportunity_questions table
  const { data: aiQuestions } = await supabase
    .from("opportunity_questions")
    .select("id, question_text, related_section, status, ai_answer, ai_confidence_score, ai_source_references, question_category, created_at, answered_at")
    .eq("task_order_id", tokenData.task_order_id)
    .or(`subcontractor_id.eq.${tokenData.subcontractor_id},status.eq.auto_answered`)
    .order("created_at", { ascending: true })
    .then(r => r)
    .catch(() => ({ data: null }))

  // Get existing quote if already submitted
  const { data: existingQuote } = await supabase
    .from("sow_quotes")
    .select("*")
    .eq("sow_subcontractor_id", tokenData.sow_subcontractor_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  // Get task order documents — only those relevant to this sub's SOW item
  const { data: rawDocs } = await supabase
    .from("documents")
    .select("id, file_name, file_path, file_type, file_size, category, sow_item_id")
    .eq("task_order_id", tokenData.task_order_id)
    .in("category", ["sow", "flowdown", "pricing_sheet", "exhibit", "site_info", "amendment", "qa_response"])

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!
  const documents = (rawDocs || [])
    .filter((d: any) => {
      // If document has sow_item_id, only show if it matches this sub's SOW
      if (d.sow_item_id) return d.sow_item_id === tokenData.sow_item_id
      // Check file_path for SOW-specific uploads (path: taskOrderId/sowId/file)
      const parts = d.file_path?.split("/") || []
      if (parts.length >= 3 && parts[1] === tokenData.sow_item_id) return true
      if (parts.length >= 3) return false
      // Shared categories (flowdowns, site info, etc.) without sow_item_id are visible to all
      if (["flowdown", "site_info", "exhibit", "amendment"].includes(d.category)) return true
      // SOW docs without sow_item_id and short paths — hide to avoid showing wrong SOW
      return false
    })
    .map((d: any) => ({
      ...d,
      download_url: `${supabaseUrl}/storage/v1/object/public/task-order-documents/${d.file_path}`,
    }))

  return new Response(
    JSON.stringify({
      task_order: {
        title: (tokenData as any).task_orders?.title,
        site_name: (tokenData as any).task_orders?.site_name,
        location_city: (tokenData as any).task_orders?.location_city,
        location_state: (tokenData as any).task_orders?.location_state,
        due_date: (tokenData as any).task_orders?.due_date,
        solicitation_number: (tokenData as any).task_orders?.solicitation_number,
        notes: (tokenData as any).task_orders?.notes,
      },
      sow: {
        id: (tokenData as any).sow_items?.id,
        sow_name: (tokenData as any).sow_items?.sow_name,
        service_category: (tokenData as any).sow_items?.service_category,
        description: (tokenData as any).sow_items?.description,
      },
      subcontractor: {
        company_name: (tokenData as any).subcontractors?.company_name,
        contact_name: (tokenData as any).subcontractors?.contact_name,
      },
      rfq_due_date: (tokenData as any).sow_subcontractors?.rfq_due_date,
      outreach_status: (tokenData as any).sow_subcontractors?.outreach_status,
      form_template: formTemplate,
      existing_quote: existingQuote,
      questions: questions || [],
      ai_questions: aiQuestions || [],
      documents: documents || [],
      question_deadline: (tokenData as any).task_orders?.question_deadline || null,
    }),
    { headers: corsHeaders }
  )
}

// POST /api/portal-api — submit quote or question
async function handlePost(req: Request) {
  const body = await req.json()
  const { token, action } = body

  if (!token) {
    return new Response(JSON.stringify({ error: "Token required" }), { status: 400, headers: corsHeaders })
  }

  const tokenData = await validateToken(token)
  if (!tokenData) {
    return new Response(JSON.stringify({ error: "Invalid or expired token" }), { status: 403, headers: corsHeaders })
  }

  if (action === "submit_quote") {
    return handleQuoteSubmission(tokenData, body)
  } else if (action === "submit_question") {
    return handleQuestionSubmission(tokenData, body)
  } else if (action === "submit_questions_batch") {
    return handleBatchQuestionSubmission(tokenData, body)
  } else if (action === "decline") {
    return handleDecline(tokenData, body)
  } else if (action === "save_incumbent_status") {
    return handleIncumbentStatus(tokenData, body)
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders })
}

async function handleIncumbentStatus(tokenData: any, body: any) {
  const { incumbent_data } = body
  if (!incumbent_data) {
    return new Response(JSON.stringify({ error: "Incumbent data required" }), { status: 400, headers: corsHeaders })
  }

  // Update the subcontractor's incumbent status
  const updateData: Record<string, any> = {
    incumbent_status: incumbent_data.is_incumbent ? "known" : "not_incumbent",
    updated_at: new Date().toISOString(),
  }

  await supabase
    .from("subcontractors")
    .update(updateData)
    .eq("id", tokenData.subcontractor_id)

  // Store detailed incumbent intel
  await supabase.from("incumbent_intel").insert({
    subcontractor_id: tokenData.subcontractor_id,
    task_order_id: tokenData.task_order_id,
    sow_item_id: tokenData.sow_item_id,
    is_incumbent: incumbent_data.is_incumbent,
    incumbent_locations: incumbent_data.incumbent_locations,
    contract_info: incumbent_data.incumbent_contract_info,
    years_experience: incumbent_data.incumbent_years,
    source: "portal_self_report",
  }).catch(() => {
    // Table may not exist yet, that's OK — the subcontractors update above still captures the status
  })

  // Update the sow_subcontractors record
  await supabase
    .from("sow_subcontractors")
    .update({
      incumbent_status: incumbent_data.is_incumbent ? "known" : "not_incumbent",
      updated_at: new Date().toISOString(),
    })
    .eq("id", tokenData.sow_subcontractor_id)
    .catch(() => {})

  // Log communication
  await supabase.from("sow_communications").insert({
    sow_subcontractor_id: tokenData.sow_subcontractor_id,
    comm_type: "quote_received",
    direction: "inbound",
    subject: "Incumbent status submitted via portal",
    body: `Self-reported: ${incumbent_data.is_incumbent ? "Yes, incumbent" : "Not incumbent"}${incumbent_data.incumbent_locations ? `. Locations: ${incumbent_data.incumbent_locations}` : ""}`,
  }).catch(() => {})

  return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })
}

async function handleQuoteSubmission(tokenData: any, body: any) {
  const { quote_data, custom_fields, incumbent_data, is_revision } = body

  // Build quote record
  const quoteRecord: Record<string, any> = {
    sow_subcontractor_id: tokenData.sow_subcontractor_id,
    sow_item_id: tokenData.sow_item_id,
    subcontractor_id: tokenData.subcontractor_id,
    status: "received",
    submitted_at: new Date().toISOString(),
    is_revision: is_revision || false,
  }

  const standardFields = [
    "total_amount", "monthly_amount", "annual_amount",
    "labor_cost", "materials_cost", "equipment_cost", "overhead_markup",
    "scope_inclusions", "scope_exclusions", "assumptions",
    "timeline", "payment_terms", "validity_period",
  ]
  for (const field of standardFields) {
    if (quote_data[field] !== undefined && quote_data[field] !== null && quote_data[field] !== "") {
      quoteRecord[field] = quote_data[field]
    }
  }

  // CRITICAL: Insert quote first — this is the only required operation
  const { data: quote, error: quoteErr } = await supabase
    .from("sow_quotes")
    .insert(quoteRecord)
    .select()
    .single()

  if (quoteErr) {
    return new Response(JSON.stringify({ error: quoteErr.message }), { status: 500, headers: corsHeaders })
  }

  // Run all secondary operations in parallel to avoid timeout
  const sub = tokenData.subcontractors
  const now = new Date().toISOString()
  const secondaryOps: Promise<any>[] = []

  // Save incumbent data
  if (incumbent_data) {
    secondaryOps.push(
      supabase
        .from("subcontractors")
        .update({
          incumbent_status: incumbent_data.is_incumbent ? "known" : "not_incumbent",
          updated_at: now,
        })
        .eq("id", tokenData.subcontractor_id)
        .then(() => {})
        .catch(() => {})
    )
  }

  // Save custom field values
  if (custom_fields && Object.keys(custom_fields).length > 0) {
    secondaryOps.push(
      supabase.from("portal_quote_submissions").insert({
        rfq_token_id: tokenData.id,
        sow_quote_id: quote.id,
        custom_fields,
      }).then(() => {}).catch(() => {})
    )
  }

  // Update outreach status
  secondaryOps.push(
    supabase
      .from("sow_subcontractors")
      .update({
        outreach_status: "quote_submitted",
        response_date: now,
        updated_at: now,
      })
      .eq("id", tokenData.sow_subcontractor_id)
      .then(() => {}).catch(() => {})
  )

  // Auto-update SOW status
  secondaryOps.push(
    supabase
      .from("sow_items")
      .select("status")
      .eq("id", tokenData.sow_item_id)
      .single()
      .then(({ data: sow }) => {
        if (sow && (sow.status === "not_started" || sow.status === "subs_identified" || sow.status === "rfqs_sent")) {
          return supabase
            .from("sow_items")
            .update({ status: "quotes_received", updated_at: now })
            .eq("id", tokenData.sow_item_id)
        }
      })
      .catch(() => {})
  )

  // Log communication
  secondaryOps.push(
    supabase.from("sow_communications").insert({
      sow_subcontractor_id: tokenData.sow_subcontractor_id,
      comm_type: "quote_received",
      direction: "inbound",
      subject: `Quote submitted via portal`,
      body: `${sub?.company_name || "Subcontractor"} submitted a quote of $${quoteRecord.total_amount || "N/A"} through the subcontractor portal.`,
    }).then(() => {}).catch(() => {})
  )

  // Create in-app notification
  const orgId = tokenData.task_orders?.org_id
  if (orgId) {
    const subName = sub?.company_name || "A subcontractor"
    const projectTitle = tokenData.task_orders?.title || "a project"
    secondaryOps.push(
      createNotification(
        orgId,
        "quote_received",
        `${subName} submitted a quote`,
        `Quote of $${quoteRecord.total_amount || "N/A"} received for ${projectTitle}`,
        `/projects/${tokenData.task_order_id}/sow-tracker`
      ).catch(() => {})
    )
  }

  // Wait for secondary ops (with 8s timeout to avoid function timeout)
  await Promise.race([
    Promise.allSettled(secondaryOps),
    new Promise(resolve => setTimeout(resolve, 8000)),
  ])

  // Trigger AI compliance analysis (fire-and-forget, after response prep)
  const siteUrl = process.env.URL || "https://procuvex.com"
  fetch(`${siteUrl}/.netlify/functions/analyze-quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quote_id: quote.id, auto_email: true }),
  }).catch(() => {})

  return new Response(
    JSON.stringify({ success: true, quote_id: quote.id }),
    { headers: corsHeaders }
  )
}

async function handleQuestionSubmission(tokenData: any, body: any) {
  const { question_text, related_section } = body

  if (!question_text?.trim()) {
    return new Response(JSON.stringify({ error: "Question text required" }), { status: 400, headers: corsHeaders })
  }

  const cleanQuestion = sanitizeAndLimit(question_text, 2000)
  const cleanSection = related_section ? sanitizeAndLimit(related_section, 500) : null

  // Route through AI-powered submit-question for document analysis
  const siteUrl = process.env.URL || "https://procuvex.com"
  try {
    const aiRes = await fetch(`${siteUrl}/.netlify/functions/submit-question`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: body.token,
        question_text: cleanQuestion,
        related_section: cleanSection,
      }),
    })

    if (aiRes.ok) {
      const result = await aiRes.json()
      return new Response(JSON.stringify(result), { headers: corsHeaders })
    }
    console.error("AI question analysis failed, falling back:", await aiRes.text())
  } catch (err) {
    console.error("AI question analysis error, falling back:", err)
  }

  // Fallback: basic insert without AI analysis
  const { data: question, error } = await supabase
    .from("subcontractor_questions")
    .insert({
      rfq_token_id: tokenData.id,
      sow_subcontractor_id: tokenData.sow_subcontractor_id,
      sow_item_id: tokenData.sow_item_id,
      task_order_id: tokenData.task_order_id,
      subcontractor_id: tokenData.subcontractor_id,
      question_text: cleanQuestion,
      related_section: cleanSection,
      status: "pending",
    })
    .select()
    .single()

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }

  // Also insert into opportunity_questions for the new Q&A system
  await supabase.from("opportunity_questions").insert({
    task_order_id: tokenData.task_order_id,
    sow_subcontractor_id: tokenData.sow_subcontractor_id,
    subcontractor_id: tokenData.subcontractor_id,
    submitted_by_type: "subcontractor",
    question_text: cleanQuestion,
    related_section: cleanSection,
    status: "pending_submission",
    is_from_portal: true,
    rfq_token_id: tokenData.id,
  }).catch(() => {})

  // Update outreach status to questions_pending if currently just invited
  const { data: sowSub } = await supabase
    .from("sow_subcontractors")
    .select("outreach_status")
    .eq("id", tokenData.sow_subcontractor_id)
    .single()

  if (sowSub && sowSub.outreach_status === "invited") {
    await supabase
      .from("sow_subcontractors")
      .update({ outreach_status: "questions_pending", updated_at: new Date().toISOString() })
      .eq("id", tokenData.sow_subcontractor_id)
  }

  // Log communication
  await supabase.from("sow_communications").insert({
    sow_subcontractor_id: tokenData.sow_subcontractor_id,
    comm_type: "question",
    direction: "inbound",
    subject: `Question from portal${cleanSection ? `: ${cleanSection}` : ""}`,
    body: cleanQuestion,
  })

  // Create in-app notification for question
  const qOrgId = tokenData.task_orders?.org_id
  const qSubName = tokenData.subcontractors?.company_name || "A subcontractor"
  const qProjectTitle = tokenData.task_orders?.title || "a project"
  if (qOrgId) {
    createNotification(
      qOrgId,
      "question_asked",
      `${qSubName} asked a question`,
      `New question about ${qProjectTitle}${cleanSection ? ` (${cleanSection})` : ""}`,
      `/projects/${tokenData.task_order_id}`
    )
  }

  return new Response(
    JSON.stringify({ success: true, question_id: question.id }),
    { headers: corsHeaders }
  )
}

async function handleBatchQuestionSubmission(tokenData: any, body: any) {
  const { questions } = body

  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return new Response(JSON.stringify({ error: "At least one question is required" }), { status: 400, headers: corsHeaders })
  }

  if (questions.length > 20) {
    return new Response(JSON.stringify({ error: "Maximum 20 questions per submission" }), { status: 400, headers: corsHeaders })
  }

  const siteUrl = process.env.URL || "https://procuvex.com"
  const results: Array<{ status: string; ai_analysis?: any }> = []

  for (const q of questions) {
    const questionText = sanitizeAndLimit(q.question_text || "", 2000)
    if (!questionText) continue
    const qSection = q.related_section ? sanitizeAndLimit(q.related_section, 500) : null

    try {
      const aiRes = await fetch(`${siteUrl}/.netlify/functions/submit-question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: body.token,
          question_text: questionText,
          related_section: qSection,
        }),
      })

      if (aiRes.ok) {
        const result = await aiRes.json()
        results.push(result)
      } else {
        // Fallback: basic insert
        await supabase.from("subcontractor_questions").insert({
          rfq_token_id: tokenData.id,
          sow_subcontractor_id: tokenData.sow_subcontractor_id,
          sow_item_id: tokenData.sow_item_id,
          task_order_id: tokenData.task_order_id,
          subcontractor_id: tokenData.subcontractor_id,
          question_text: questionText,
          related_section: qSection,
          status: "pending",
        })
        results.push({ status: "pending_submission" })
      }
    } catch {
      // Fallback on error
      await supabase.from("subcontractor_questions").insert({
        rfq_token_id: tokenData.id,
        sow_subcontractor_id: tokenData.sow_subcontractor_id,
        sow_item_id: tokenData.sow_item_id,
        task_order_id: tokenData.task_order_id,
        subcontractor_id: tokenData.subcontractor_id,
        question_text: questionText,
        related_section: qSection,
        status: "pending",
      })
      results.push({ status: "pending_submission" })
    }
  }

  // Update outreach status
  const { data: sowSub } = await supabase
    .from("sow_subcontractors")
    .select("outreach_status")
    .eq("id", tokenData.sow_subcontractor_id)
    .single()

  if (sowSub && sowSub.outreach_status === "invited") {
    await supabase
      .from("sow_subcontractors")
      .update({ outreach_status: "questions_pending", updated_at: new Date().toISOString() })
      .eq("id", tokenData.sow_subcontractor_id)
  }

  // Log batch communication
  const sub = tokenData.subcontractors
  await supabase.from("sow_communications").insert({
    sow_subcontractor_id: tokenData.sow_subcontractor_id,
    comm_type: "question",
    direction: "inbound",
    subject: `Batch question submission (${results.length} questions)`,
    body: `${sub?.company_name || "Subcontractor"} submitted ${results.length} questions through the portal.`,
  })

  return new Response(
    JSON.stringify({ success: true, count: results.length, results }),
    { headers: corsHeaders }
  )
}

async function handleDecline(tokenData: any, body: any) {
  const { reason } = body

  await supabase
    .from("sow_subcontractors")
    .update({
      outreach_status: "declined",
      response_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", tokenData.sow_subcontractor_id)

  // Log communication
  await supabase.from("sow_communications").insert({
    sow_subcontractor_id: tokenData.sow_subcontractor_id,
    comm_type: "decline_notice",
    direction: "inbound",
    subject: "RFQ Declined via portal",
    body: reason || "Subcontractor declined to quote via the portal.",
  })

  return new Response(
    JSON.stringify({ success: true }),
    { headers: corsHeaders }
  )
}

function getDefaultFields() {
  return [
    { id: "total_amount", field_name: "total_amount", field_label: "Total Amount ($)", field_type: "currency", is_required: true, help_text: "Total annual contract value", display_order: 0, is_default_field: true, default_field_key: "total_amount" },
    { id: "monthly_amount", field_name: "monthly_amount", field_label: "Monthly Amount ($)", field_type: "currency", is_required: false, help_text: "Monthly recurring cost", display_order: 1, is_default_field: true, default_field_key: "monthly_amount" },
    { id: "labor_cost", field_name: "labor_cost", field_label: "Labor Cost ($)", field_type: "currency", is_required: false, help_text: "Total labor component", display_order: 2, is_default_field: true, default_field_key: "labor_cost" },
    { id: "materials_cost", field_name: "materials_cost", field_label: "Materials Cost ($)", field_type: "currency", is_required: false, help_text: "Total materials component", display_order: 3, is_default_field: true, default_field_key: "materials_cost" },
    { id: "equipment_cost", field_name: "equipment_cost", field_label: "Equipment Cost ($)", field_type: "currency", is_required: false, help_text: "Total equipment component", display_order: 4, is_default_field: true, default_field_key: "equipment_cost" },
    { id: "overhead_markup", field_name: "overhead_markup", field_label: "Overhead/Markup (%)", field_type: "number", is_required: false, help_text: "Overhead percentage", display_order: 5, is_default_field: true, default_field_key: "overhead_markup" },
    { id: "scope_inclusions", field_name: "scope_inclusions", field_label: "Scope Inclusions", field_type: "textarea", is_required: true, help_text: "What is included in your quote", display_order: 6, is_default_field: true, default_field_key: "scope_inclusions" },
    { id: "scope_exclusions", field_name: "scope_exclusions", field_label: "Scope Exclusions", field_type: "textarea", is_required: false, help_text: "What is not included", display_order: 7, is_default_field: true, default_field_key: "scope_exclusions" },
    { id: "assumptions", field_name: "assumptions", field_label: "Assumptions", field_type: "textarea", is_required: false, help_text: "Key assumptions your pricing is based on", display_order: 8, is_default_field: true, default_field_key: "assumptions" },
    { id: "timeline", field_name: "timeline", field_label: "Timeline / Mobilization", field_type: "text", is_required: false, help_text: "How quickly you can mobilize", display_order: 9, is_default_field: true, default_field_key: "timeline" },
    { id: "payment_terms", field_name: "payment_terms", field_label: "Payment Terms", field_type: "text", is_required: false, help_text: "e.g., Net 30, Net 45", display_order: 10, is_default_field: true, default_field_key: "payment_terms" },
    { id: "validity_period", field_name: "validity_period", field_label: "Quote Validity Period", field_type: "text", is_required: false, help_text: "How long this quote is valid", display_order: 11, is_default_field: true, default_field_key: "validity_period" },
  ]
}

export default async (req: Request, context: Context) => {
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
