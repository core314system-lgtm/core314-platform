import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"

const sgMail = await import("@sendgrid/mail")

/**
 * AI-Powered Question Submission & Analysis
 *
 * When a subcontractor submits a question:
 * 1. Fetches all documents for the task order
 * 2. Uses OpenAI to search documents for the answer
 * 3. If 95%+ confidence -> auto-answer with exact source citation
 * 4. If 70-94% confidence -> flag for human review
 * 5. If <70% confidence -> queue for formal submission
 *
 * Every answer MUST include document name, section, sub-section, and page.
 * No assumptions. No hallucinations. Documents are the only source of truth.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
}

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.TASKORDER_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
)

const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.TASKORDER_OPENAI_API_KEY || ""
const AUTO_ANSWER_THRESHOLD = 95
const REVIEW_THRESHOLD = 70

interface SourceReference {
  document_name: string
  document_id: string
  section: string
  sub_section: string
  page: number | null
  excerpt: string
}

interface AIAnalysisResult {
  answer_found: boolean
  confidence_score: number
  answer_text: string | null
  source_references: SourceReference[]
  question_category: string
}

async function validatePortalToken(token: string) {
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

async function fetchDocumentTexts(taskOrderId: string): Promise<Array<{ id: string; name: string; text: string; category: string }>> {
  const { data: docs } = await supabase
    .from("documents")
    .select("id, file_name, file_path, file_type, category")
    .eq("task_order_id", taskOrderId)
    .in("category", ["sow", "exhibit", "amendment", "site_info", "wage_determination", "pricing_sheet", "other"])

  if (!docs || docs.length === 0) return []

  const results: Array<{ id: string; name: string; text: string; category: string }> = []

  for (const doc of docs) {
    try {
      const { data: fileData, error } = await supabase.storage
        .from("task-order-documents")
        .download(doc.file_path)

      if (error || !fileData) continue

      let text = ""
      const ext = doc.file_name.split(".").pop()?.toLowerCase() || ""

      if (ext === "pdf") {
        const buffer = await fileData.arrayBuffer()
        text = extractTextFromPdfBuffer(new Uint8Array(buffer), doc.file_name)
      } else if (ext === "txt" || ext === "csv" || ext === "md") {
        text = await fileData.text()
      } else {
        try {
          const rawText = await fileData.text()
          if (rawText && rawText.length > 100 && !rawText.includes("\x00")) {
            text = rawText
          } else {
            text = `[File: ${doc.file_name} - upload as PDF for AI analysis]`
          }
        } catch {
          text = `[File: ${doc.file_name} - content not extractable]`
        }
      }

      if (text && text.length > 50) {
        results.push({ id: doc.id, name: doc.file_name, text, category: doc.category })
      }
    } catch {
      // Skip documents that can't be read
    }
  }

  return results
}

function extractTextFromPdfBuffer(buffer: Uint8Array, filename: string): string {
  try {
    const rawStr = new TextDecoder("latin1").decode(buffer)
    const textParts: string[] = []

    // Extract text from PDF parenthesized strings
    const textRegex = /\(([^)]{2,})\)/g
    let match
    while ((match = textRegex.exec(rawStr)) !== null) {
      const text = match[1]
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "")
        .replace(/\\t/g, " ")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\")
      if (text.length >= 2 && /[a-zA-Z0-9]/.test(text)) {
        textParts.push(text)
      }
    }

    const result = textParts.join(" ").replace(/\s+/g, " ").trim()
    if (result.length < 50) {
      return `[PDF: ${filename} - limited text extraction. For best results, ensure PDFs are text-based.]`
    }
    return result
  } catch {
    return `[PDF: ${filename} - text extraction failed]`
  }
}

async function analyzeQuestionWithAI(
  question: string,
  documents: Array<{ id: string; name: string; text: string; category: string }>,
  relatedSection?: string
): Promise<AIAnalysisResult> {
  if (!OPENAI_KEY || documents.length === 0) {
    return {
      answer_found: false,
      confidence_score: 0,
      answer_text: null,
      source_references: [],
      question_category: "unknown",
    }
  }

  const MAX_CHARS_PER_DOC = 8000
  const MAX_TOTAL_CHARS = 100000

  let docsContext = ""
  for (const doc of documents) {
    const truncated = doc.text.length > MAX_CHARS_PER_DOC
      ? doc.text.slice(0, MAX_CHARS_PER_DOC) + "\n[... document continues ...]"
      : doc.text
    const docEntry = `\n--- DOCUMENT: "${doc.name}" (ID: ${doc.id}, Category: ${doc.category}) ---\n${truncated}\n`
    if (docsContext.length + docEntry.length > MAX_TOTAL_CHARS) break
    docsContext += docEntry
  }

  const systemPrompt = `You are a document analysis AI for government contracting Q&A management. Your ONLY job is to search the provided documents to answer a subcontractor's question.

CRITICAL RULES:
1. ONLY answer from the provided documents. NEVER use general knowledge, assumptions, or inference.
2. If the answer is NOT explicitly stated in the documents, set answer_found to false. Do NOT guess.
3. Every answer MUST include exact source citations: document name, section number, sub-section title, and page number (if determinable).
4. Be conservative with confidence scores - only use 95+ when the answer is explicitly and unambiguously stated.
5. For partial matches or related information, use 70-94 and explain what was found vs what is missing.
6. For no match, use 0-69.

Return JSON with this exact structure:
{
  "answer_found": boolean,
  "confidence_score": number (0-100),
  "answer_text": string or null (the answer with full source citation, e.g. "Per [Document Name], Section 3.2.1 'Performance Requirements', page 5: [exact answer]"),
  "source_references": [
    {
      "document_name": "exact filename",
      "document_id": "the document UUID",
      "section": "section number (e.g., '3.2.1')",
      "sub_section": "sub-section title (e.g., 'Performance Requirements')",
      "page": number or null,
      "excerpt": "exact quoted text from the document (max 200 chars)"
    }
  ],
  "question_category": string (one of: "scope", "labor_rates", "insurance", "schedule", "materials", "compliance", "safety", "environmental", "technical_specs", "payment_terms", "subcontracting", "bonding", "certifications", "general")
}`

  const userPrompt = `QUESTION FROM SUBCONTRACTOR: "${question}"${relatedSection ? `\n(Related to section: ${relatedSection})` : ""}

DOCUMENTS TO SEARCH:
${docsContext}

Search ALL documents thoroughly. If the answer is found, cite the EXACT document, section, sub-section, and page. If NOT found, be honest - set answer_found to false.`

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 2048,
      }),
    })

    if (!res.ok) {
      console.error("OpenAI API error:", res.status)
      return { answer_found: false, confidence_score: 0, answer_text: null, source_references: [], question_category: "unknown" }
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      return { answer_found: false, confidence_score: 0, answer_text: null, source_references: [], question_category: "unknown" }
    }

    const parsed = JSON.parse(content) as AIAnalysisResult
    parsed.confidence_score = Math.max(0, Math.min(100, parsed.confidence_score || 0))
    parsed.source_references = (parsed.source_references || []).map(ref => ({
      document_name: ref.document_name || "Unknown",
      document_id: ref.document_id || "",
      section: ref.section || "N/A",
      sub_section: ref.sub_section || "N/A",
      page: ref.page || null,
      excerpt: ref.excerpt || "",
    }))

    return parsed
  } catch (err) {
    console.error("AI analysis error:", err)
    return { answer_found: false, confidence_score: 0, answer_text: null, source_references: [], question_category: "unknown" }
  }
}

async function getOrgInfo(taskOrderId: string): Promise<{ orgName: string; taskOrderTitle: string; questionDeadline: string | null }> {
  const { data: to } = await supabase.from("task_orders").select("title, org_id, question_deadline").eq("id", taskOrderId).single()
  let orgName = "Procuvex"
  if (to?.org_id) {
    const { data: org } = await supabase.from("organizations").select("name").eq("id", to.org_id).single()
    if (org?.name) orgName = org.name
  }
  return {
    orgName,
    taskOrderTitle: to?.title || "Unknown Project",
    questionDeadline: to?.question_deadline || null,
  }
}

async function sendAutoAnsweredEmail(
  subEmail: string, subName: string, orgName: string, taskOrderTitle: string,
  questionText: string, answerText: string, sourceRefs: SourceReference[], portalLink: string,
) {
  const sendgridKey = process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY
  if (!sendgridKey || !subEmail) return

  sgMail.default.setApiKey(sendgridKey)
  const sourceCitations = sourceRefs.map(ref =>
    `<li><strong>${ref.document_name}</strong> &mdash; Section ${ref.section}${ref.sub_section !== "N/A" ? ` "${ref.sub_section}"` : ""}${ref.page ? `, Page ${ref.page}` : ""}</li>`
  ).join("")

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #1e40af; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">Your Question Has Been Answered</h1>
        <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">On behalf of ${orgName}</p>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <p>Dear ${subName},</p>
        <p>Your question regarding <strong>${taskOrderTitle}</strong> has been answered based on the project documentation.</p>
        <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 16px 0; border-radius: 0 4px 4px 0;">
          <p style="margin: 0 0 8px; font-weight: bold; color: #1e40af;">Your Question:</p>
          <p style="margin: 0; color: #374151;">${questionText}</p>
        </div>
        <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin: 16px 0; border-radius: 0 4px 4px 0;">
          <p style="margin: 0 0 8px; font-weight: bold; color: #166534;">Answer:</p>
          <p style="margin: 0; color: #374151;">${answerText}</p>
        </div>
        <div style="background: #fefce8; border-left: 4px solid #eab308; padding: 12px; margin: 16px 0; border-radius: 0 4px 4px 0;">
          <p style="margin: 0 0 6px; font-weight: bold; font-size: 13px; color: #854d0e;">Source Documentation:</p>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #374151;">${sourceCitations}</ul>
        </div>
        ${portalLink ? `<p><a href="${portalLink}" style="display: inline-block; background: #1e40af; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">View in Portal</a></p>` : ""}
        <p style="font-size: 13px; color: #6b7280; margin-top: 24px;">If you need further clarification, you can ask additional questions through the portal.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 12px; color: #9ca3af; margin: 0;">Delivered on behalf of ${orgName} &bull; Powered by Procuvex</p>
      </div>
    </div>`

  await sgMail.default.send({
    to: subEmail,
    from: { email: "noreply@core314.com", name: orgName },
    subject: `Answer to your question — ${taskOrderTitle}`,
    html: emailHtml,
  })
}

async function sendPendingSubmissionEmail(
  subEmail: string, subName: string, orgName: string, taskOrderTitle: string,
  questionText: string, submissionDeadline: string | null, portalLink: string,
) {
  const sendgridKey = process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY
  if (!sendgridKey || !subEmail) return

  sgMail.default.setApiKey(sendgridKey)
  const deadlineText = submissionDeadline
    ? new Date(submissionDeadline).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : "the next available submission date"

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #1e40af; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">Question Received &mdash; Pending Clarification</h1>
        <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">On behalf of ${orgName}</p>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <p>Dear ${subName},</p>
        <p>Thank you for your question regarding <strong>${taskOrderTitle}</strong>. After reviewing the available project documentation, we were unable to find a definitive answer.</p>
        <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 16px 0; border-radius: 0 4px 4px 0;">
          <p style="margin: 0 0 8px; font-weight: bold; color: #1e40af;">Your Question:</p>
          <p style="margin: 0; color: #374151;">${questionText}</p>
        </div>
        <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin: 16px 0; border-radius: 0 4px 4px 0;">
          <p style="margin: 0; font-weight: bold; color: #92400e;">What happens next:</p>
          <p style="margin: 8px 0 0; color: #374151;">Your question has been added to our formal clarification request, which will be submitted on <strong>${deadlineText}</strong>. You should receive an answer once we receive the official Q&amp;A responses back.</p>
        </div>
        ${portalLink ? `<p><a href="${portalLink}" style="display: inline-block; background: #1e40af; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">View Status in Portal</a></p>` : ""}
        <p style="font-size: 13px; color: #6b7280; margin-top: 24px;">We appreciate your patience and will notify you as soon as an answer is available.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 12px; color: #9ca3af; margin: 0;">Delivered on behalf of ${orgName} &bull; Powered by Procuvex</p>
      </div>
    </div>`

  await sgMail.default.send({
    to: subEmail,
    from: { email: "noreply@core314.com", name: orgName },
    subject: `Question Received — ${taskOrderTitle}`,
    html: emailHtml,
  })
}

export default async (req: Request, _context: Context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { token, question_text, related_section, submitted_by_type, user_id, task_order_id } = body

    if (!question_text?.trim()) {
      return new Response(JSON.stringify({ error: "Question text is required" }), { status: 400, headers: corsHeaders })
    }

    let taskOrderId = task_order_id
    let sowSubcontractorId: string | null = null
    let subcontractorId: string | null = null
    let rfqTokenId: string | null = null
    let subEmail = ""
    let subName = ""
    let portalLink = ""
    let sowItemId: string | null = null

    if (token) {
      const tokenData = await validatePortalToken(token)
      if (!tokenData) {
        return new Response(JSON.stringify({ error: "Invalid or expired token" }), { status: 403, headers: corsHeaders })
      }
      taskOrderId = tokenData.task_order_id
      sowSubcontractorId = tokenData.sow_subcontractor_id
      subcontractorId = tokenData.subcontractor_id
      rfqTokenId = tokenData.id
      sowItemId = tokenData.sow_item_id
      subEmail = (tokenData as Record<string, any>).subcontractors?.contact_email || ""
      subName = (tokenData as Record<string, any>).subcontractors?.contact_name || (tokenData as Record<string, any>).subcontractors?.company_name || ""
      const siteUrl = process.env.URL || "https://procuvex.com"
      portalLink = `${siteUrl}/portal/${token}`
    }

    if (!taskOrderId) {
      return new Response(JSON.stringify({ error: "Task order ID is required" }), { status: 400, headers: corsHeaders })
    }

    const { orgName, taskOrderTitle, questionDeadline } = await getOrgInfo(taskOrderId)

    // Step 1: Fetch all documents for this task order
    const documents = await fetchDocumentTexts(taskOrderId)

    // Step 2: Analyze question against documents using AI
    const analysis = await analyzeQuestionWithAI(question_text.trim(), documents, related_section)

    // Step 3: Determine status based on confidence score
    let status: string
    if (analysis.answer_found && analysis.confidence_score >= AUTO_ANSWER_THRESHOLD) {
      status = "auto_answered"
    } else if (analysis.confidence_score >= REVIEW_THRESHOLD) {
      status = "pending_review"
    } else {
      status = "pending_submission"
    }

    // Step 4: Insert into opportunity_questions
    const { data: question, error: insertError } = await supabase
      .from("opportunity_questions")
      .insert({
        task_order_id: taskOrderId,
        sow_subcontractor_id: sowSubcontractorId,
        subcontractor_id: subcontractorId,
        submitted_by_type: submitted_by_type || (token ? "subcontractor" : "prime_team"),
        submitted_by_user_id: user_id || null,
        question_text: question_text.trim(),
        related_section: related_section || null,
        ai_answer: analysis.answer_text,
        ai_confidence_score: analysis.confidence_score,
        ai_source_references: analysis.source_references,
        status,
        question_category: analysis.question_category,
        is_from_portal: !!token,
        rfq_token_id: rfqTokenId,
        answered_at: status === "auto_answered" ? new Date().toISOString() : null,
      })
      .select()
      .single()

    if (insertError) {
      console.error("Insert error:", insertError)
      return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: corsHeaders })
    }

    // Step 5: Insert into legacy subcontractor_questions for backward compat
    if (token && sowSubcontractorId && subcontractorId && sowItemId) {
      await supabase.from("subcontractor_questions").insert({
        rfq_token_id: rfqTokenId,
        sow_subcontractor_id: sowSubcontractorId,
        sow_item_id: sowItemId,
        task_order_id: taskOrderId,
        subcontractor_id: subcontractorId,
        question_text: question_text.trim(),
        related_section: related_section || null,
        status: status === "auto_answered" ? "answered" : "pending",
        answer_text: status === "auto_answered" ? analysis.answer_text : null,
        answered_at: status === "auto_answered" ? new Date().toISOString() : null,
        shared_with_all: status === "auto_answered",
      }).catch(() => { /* legacy table may not exist */ })
    }

    // Step 6: Log communication
    if (sowSubcontractorId) {
      await supabase.from("sow_communications").insert({
        sow_subcontractor_id: sowSubcontractorId,
        comm_type: "question",
        direction: "inbound",
        subject: `Question${related_section ? `: ${related_section}` : ""} (AI: ${status})`,
        body: question_text.trim(),
      }).catch(() => {})

      const { data: sowSub } = await supabase
        .from("sow_subcontractors")
        .select("outreach_status")
        .eq("id", sowSubcontractorId)
        .single()
      if (sowSub && sowSub.outreach_status === "invited") {
        await supabase
          .from("sow_subcontractors")
          .update({ outreach_status: "questions_pending", updated_at: new Date().toISOString() })
          .eq("id", sowSubcontractorId)
      }
    }

    // Step 7: Send email notifications
    if (status === "auto_answered" && subEmail && analysis.answer_text) {
      await sendAutoAnsweredEmail(
        subEmail, subName, orgName, taskOrderTitle,
        question_text.trim(), analysis.answer_text,
        analysis.source_references, portalLink
      ).catch(err => console.error("Email error:", err))
    } else if (status === "pending_submission" && subEmail) {
      await sendPendingSubmissionEmail(
        subEmail, subName, orgName, taskOrderTitle,
        question_text.trim(), questionDeadline, portalLink
      ).catch(err => console.error("Email error:", err))
    }

    // Step 8: Add to learning history
    await supabase.from("question_answer_history").insert({
      opportunity_question_id: question.id,
      task_order_id: taskOrderId,
      question_category: analysis.question_category,
      question_pattern: question_text.trim(),
      answer_pattern: analysis.answer_text || null,
      was_auto_answered: status === "auto_answered",
      confidence_score: analysis.confidence_score,
      source_document_type: analysis.source_references[0]?.document_name ? "document" : null,
    }).catch(() => { /* learning table may not exist yet */ })

    return new Response(
      JSON.stringify({
        success: true,
        question_id: question.id,
        status,
        ai_analysis: {
          answer_found: analysis.answer_found,
          confidence_score: analysis.confidence_score,
          answer_text: analysis.answer_text,
          source_references: analysis.source_references,
          question_category: analysis.question_category,
        },
      }),
      { headers: corsHeaders }
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    console.error("Submit question error:", msg)
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders })
  }
}
