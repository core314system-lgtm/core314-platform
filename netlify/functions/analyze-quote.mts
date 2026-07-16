import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
import { htmlToPlainText } from "./_shared/html-to-text.ts"
const sgMail = await import("@sendgrid/mail")

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-user-id",
}

interface AnalysisResult {
  overall_score: number
  requirements_met: string[]
  requirements_missing: string[]
  pricing_gaps: string[]
  recommendations: string[]
  summary: string
}

async function extractPdfText(fileBuffer: Buffer): Promise<string> {
  try {
    // Use pdfjs-dist directly for text extraction — no native canvas needed.
    // Imported lazily inside try/catch so any load/parse failure degrades to
    // description-based analysis instead of crashing the whole function.
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(fileBuffer),
      disableWorker: true,
      isEvalSupported: false,
      useSystemFonts: false,
    }).promise
    let text = ""
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      text += content.items.map((it: any) => ("str" in it ? it.str : "")).join(" ") + "\n"
    }
    return text.trim()
  } catch {
    return ""
  }
}

export const _diag: any = {}

async function getDocumentTexts(
  taskOrderId: string,
  sowItemId: string
): Promise<{ sowDocText: string; projectDocTexts: string }> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL!

  // Get all documents for this project
  const { data: docs, error: docsErr } = await supabase
    .from("documents")
    .select("id, file_name, file_path, file_type, category, sow_item_id")
    .eq("task_order_id", taskOrderId)

  _diag.docsErr = docsErr?.message || null
  _diag.docCount = docs?.length || 0
  if (!docs?.length) return { sowDocText: "", projectDocTexts: "" }

  // Separate SOW-specific docs from project-level docs
  const sowDocs = docs.filter(d => d.sow_item_id === sowItemId)
  const projectDocs = docs.filter(
    d => !d.sow_item_id && d.file_name.toLowerCase().endsWith(".pdf")
  )
  _diag.sowDocsCount = sowDocs.length
  _diag.perDoc = []

  const downloadAndExtract = async (doc: any): Promise<string> => {
    try {
      const { data, error } = await supabase.storage
        .from("task-order-documents")
        .download(doc.file_path)
      if (error || !data) {
        _diag.perDoc.push({ f: doc.file_name, dlErr: error?.message || "no data" })
        return ""
      }
      const buffer = Buffer.from(await data.arrayBuffer())
      const text = await extractPdfText(buffer)
      _diag.perDoc.push({ f: doc.file_name, bytes: buffer.length, textLen: text.length })
      return text ? `--- ${doc.file_name} ---\n${text}` : ""
    } catch (e: any) {
      _diag.perDoc.push({ f: doc.file_name, catch: e?.message })
      return ""
    }
  }

  // Extract text from SOW documents assigned to this sub's SOW item
  const sowTexts = await Promise.all(sowDocs.map(downloadAndExtract))
  const sowDocText = sowTexts.filter(Boolean).join("\n\n")

  // Extract text from project-level documents (Master Solicitation, etc.)
  const projTexts = await Promise.all(projectDocs.map(downloadAndExtract))
  const projectDocTexts = projTexts.filter(Boolean).join("\n\n")

  return { sowDocText, projectDocTexts }
}

async function analyzeWithAI(
  sowDescription: string,
  sowName: string,
  quoteData: any,
  sowDocText: string,
  projectDocTexts: string
): Promise<AnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.TASKORDER_OPENAI_API_KEY
  if (!apiKey) throw new Error("OpenAI API key not configured")

  const quoteText = Object.entries(quoteData)
    .filter(([_, v]) => v != null && v !== "")
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
    .join("\n")

  // Build the SOW context — prefer full document text, fall back to description
  const sowContext = sowDocText || sowDescription || "No detailed SOW provided."

  // Build additional project document context if available
  const projectContext = projectDocTexts
    ? `\n\nAdditional Project Documents (Master Solicitation, etc.):\nThese documents may contain cross-cutting requirements that affect all scopes of work. Flag any requirements from these documents that the subcontractor should also address.\n\n${projectDocTexts}`
    : ""

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a government contracting compliance analyst. Analyze a subcontractor's quote against a Statement of Work (SOW) and any additional project documents to identify compliance gaps.

IMPORTANT RULES:
- Only flag requirements that ACTUALLY EXIST in the provided documents. Never invent or assume requirements.
- If a requirement appears in the SOW document, it is a valid gap if the quote doesn't address it.
- If a requirement appears in additional project documents (Master Solicitation, etc.) that could affect this scope, flag it separately and note which document it comes from.
- Be thorough but fair. Do not penalize the subcontractor for vague or ambiguous language in the SOW.
- Every item in requirements_missing and pricing_gaps must trace back to a specific section or statement in the provided documents.

Return JSON with this exact structure:
{
  "overall_score": <0-100 integer representing % of SOW requirements addressed>,
  "requirements_met": [<array of strings: SOW requirements explicitly covered in the quote>],
  "requirements_missing": [<array of strings: SOW requirements NOT mentioned or inadequately addressed — cite the document section>],
  "pricing_gaps": [<array of strings: line items or cost elements required by the documents that are not priced in the quote>],
  "recommendations": [<array of strings: specific actions the subcontractor should take to improve the quote>],
  "summary": "<2-3 sentence executive summary of the compliance analysis>"
}`,
        },
        {
          role: "user",
          content: `SOW Name: ${sowName}\n\nSOW Document Content:\n${sowContext}${projectContext}\n\nSubcontractor Quote:\n${quoteText || "No quote details provided."}`,
        },
      ],
    }),
  })

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`OpenAI error: ${err}`)
  }

  const data = await resp.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error("No response from AI")

  return JSON.parse(content) as AnalysisResult
}

function buildGapEmail(
  companyName: string,
  sowName: string,
  siteName: string,
  analysis: AnalysisResult,
  portalUrl: string
): string {
  const missingItems = analysis.requirements_missing
    .map(r => `<li style="margin: 4px 0; color: #dc2626;">${r}</li>`)
    .join("")
  const pricingItems = analysis.pricing_gaps
    .map(r => `<li style="margin: 4px 0; color: #d97706;">${r}</li>`)
    .join("")
  const recommendations = analysis.recommendations
    .map(r => `<li style="margin: 4px 0; color: #2563eb;">${r}</li>`)
    .join("")

  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1e40af, #7c3aed); border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
        <h1 style="color: white; font-size: 20px; margin: 0;">Quote Compliance Review</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 13px;">Procuvex AI Analysis</p>
      </div>
      <div style="background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
        <p style="color: #374151; font-size: 14px; margin: 0 0 16px;">
          Hello <strong>${companyName}</strong>,
        </p>
        <p style="color: #374151; font-size: 14px; margin: 0 0 16px;">
          Thank you for submitting your quote for <strong>${sowName}</strong> at <strong>${siteName}</strong>. 
          Our AI compliance system has reviewed your quote against the Statement of Work requirements and identified areas that need attention.
        </p>

        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="font-size: 16px;">⚠️</span>
            <strong style="color: #991b1b; font-size: 14px;">SOW Requirements Not Addressed (${analysis.requirements_missing.length})</strong>
          </div>
          <p style="color: #7f1d1d; font-size: 13px; margin: 0 0 8px;">
            The following requirements from the Statement of Work were not explicitly mentioned or adequately covered in your quote:
          </p>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px;">${missingItems}</ul>
        </div>

        ${analysis.pricing_gaps.length > 0 ? `
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="font-size: 16px;">💰</span>
            <strong style="color: #92400e; font-size: 14px;">Pricing Gaps (${analysis.pricing_gaps.length})</strong>
          </div>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px;">${pricingItems}</ul>
        </div>
        ` : ""}

        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="font-size: 16px;">💡</span>
            <strong style="color: #1e40af; font-size: 14px;">Recommendations</strong>
          </div>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px;">${recommendations}</ul>
        </div>

        <div style="background: #f3f4f6; border-radius: 8px; padding: 12px; margin: 16px 0; text-align: center;">
          <span style="font-size: 13px; color: #6b7280;">Compliance Score:</span>
          <span style="font-size: 24px; font-weight: 700; color: ${analysis.overall_score >= 80 ? "#059669" : analysis.overall_score >= 60 ? "#d97706" : "#dc2626"}; margin-left: 8px;">
            ${analysis.overall_score}%
          </span>
        </div>

        <p style="color: #374151; font-size: 14px; margin: 16px 0 8px;">
          <strong>Next Steps:</strong> Please review the items above and submit a revised quote that explicitly addresses each SOW requirement. 
          This ensures your quote is competitive and compliant.
        </p>

        <div style="text-align: center; margin: 24px 0 16px;">
          <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Revise Your Quote →
          </a>
        </div>

        <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 20px;">
          This is an automated compliance review by Procuvex AI. Questions? Reply to this email.
        </p>
      </div>
    </div>
  `
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
    const { quote_id, sow_item_id, auto_email } = body

    if (!quote_id) {
      return new Response(JSON.stringify({ error: "quote_id required" }), { status: 400, headers: corsHeaders })
    }

    // Fetch quote details
    const { data: quote, error: quoteErr } = await supabase
      .from("sow_quotes")
      .select("*, sow_items(id, sow_name, service_category, description, task_order_id), subcontractors(company_name, contact_email, contact_name)")
      .eq("id", quote_id)
      .single()

    if (quoteErr || !quote) {
      return new Response(JSON.stringify({ error: "Quote not found" }), { status: 404, headers: corsHeaders })
    }

    const sow = quote.sow_items
    const sub = quote.subcontractors

    if (!sow) {
      return new Response(JSON.stringify({ error: "SOW not found for this quote" }), { status: 404, headers: corsHeaders })
    }

    // Get task order info for site name
    const { data: taskOrder } = await supabase
      .from("task_orders")
      .select("title, site_name, solicitation_number")
      .eq("id", sow.task_order_id)
      .single()

    // Build quote data object for analysis
    const quoteData: Record<string, any> = {}
    const quoteFields = [
      "total_amount", "monthly_amount", "annual_amount",
      "labor_cost", "materials_cost", "equipment_cost", "overhead_markup",
      "scope_inclusions", "scope_exclusions", "assumptions",
      "timeline", "payment_terms", "validity_period",
    ]
    for (const field of quoteFields) {
      if ((quote as any)[field] != null) {
        quoteData[field] = (quote as any)[field]
      }
    }

    // Also fetch custom fields
    const { data: customSubmission } = await supabase
      .from("portal_quote_submissions")
      .select("custom_fields")
      .eq("sow_quote_id", quote_id)
      .single()

    if (customSubmission?.custom_fields) {
      Object.assign(quoteData, customSubmission.custom_fields)
    }

    // Extract actual document text for thorough compliance analysis
    const { sowDocText, projectDocTexts } = await getDocumentTexts(
      sow.task_order_id,
      sow.id
    )

    // Run AI analysis with full document content
    const analysis = await analyzeWithAI(
      sow.description || sow.sow_name,
      sow.sow_name,
      quoteData,
      sowDocText,
      projectDocTexts
    )

    // Store analysis result on the quote
    await supabase
      .from("sow_quotes")
      .update({
        ai_compliance_score: analysis.overall_score,
        ai_compliance_analysis: analysis,
        ai_analyzed_at: new Date().toISOString(),
      })
      .eq("id", quote_id)

    // If there are gaps and auto_email is true, send notification to sub
    const hasGaps = analysis.requirements_missing.length > 0 || analysis.pricing_gaps.length > 0
    let emailSent = false

    if (hasGaps && auto_email !== false && sub?.contact_email) {
      const sendgridKey = process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY
      if (sendgridKey) {
        sgMail.default.setApiKey(sendgridKey)

        // Get portal URL for the sub
        const { data: tokenData } = await supabase
          .from("rfq_tokens")
          .select("token")
          .eq("subcontractor_id", sub.id || quote.subcontractor_id)
          .eq("sow_item_id", sow.id)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .single()

        const portalUrl = tokenData
          ? `https://procuvex.com/portal/${tokenData.token}?revise=true`
          : "https://procuvex.com"

        const html = buildGapEmail(
          sub.company_name || "Subcontractor",
          sow.sow_name,
          taskOrder?.site_name || taskOrder?.title || "the project",
          analysis,
          portalUrl
        )

        try {
          await sgMail.default.send({
            to: sub.contact_email,
            from: { email: "team@procuvex.com", name: "Procuvex" },
            replyTo: { email: "team@procuvex.com", name: "Procuvex Support" },
            subject: `Action Required: Your quote for ${sow.sow_name} needs revision`,
            html,
            text: htmlToPlainText(html),
          })
          emailSent = true

          // Log communication
          await supabase.from("sow_communications").insert({
            sow_subcontractor_id: quote.sow_subcontractor_id,
            comm_type: "compliance_gap_notification",
            direction: "outbound",
            subject: `AI Compliance Review — ${analysis.requirements_missing.length} gaps found`,
            body: analysis.summary,
          })
        } catch (emailErr: any) {
          console.error("Failed to send gap notification:", emailErr.message)
        }
      }
    }

    // Notify admin of the analysis
    const adminSendgridKey = process.env.SENDGRID_API_KEY || process.env.TASKORDER_SENDGRID_API_KEY
    if (adminSendgridKey) {
      sgMail.default.setApiKey(adminSendgridKey)
      try {
        await sgMail.default.send({
          to: "admin@core314.com",
          from: { email: "team@procuvex.com", name: "Procuvex AI" },
          subject: `Quote Analysis: ${sub?.company_name || "Sub"} — ${analysis.overall_score}% compliant for ${sow.sow_name}`,
          html: `
            <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
              <div style="background: ${analysis.overall_score >= 80 ? '#f0fdf4' : analysis.overall_score >= 60 ? '#fffbeb' : '#fef2f2'}; border: 1px solid ${analysis.overall_score >= 80 ? '#bbf7d0' : analysis.overall_score >= 60 ? '#fde68a' : '#fecaca'}; border-radius: 12px; padding: 20px;">
                <h2 style="margin: 0 0 12px; font-size: 16px; color: #111827;">Quote Compliance Analysis</h2>
                <table style="width: 100%; font-size: 13px; color: #374151;">
                  <tr><td style="padding: 4px 0; font-weight: 600;">Company:</td><td>${sub?.company_name || "N/A"}</td></tr>
                  <tr><td style="padding: 4px 0; font-weight: 600;">SOW:</td><td>${sow.sow_name}</td></tr>
                  <tr><td style="padding: 4px 0; font-weight: 600;">Score:</td><td><strong style="color: ${analysis.overall_score >= 80 ? '#059669' : analysis.overall_score >= 60 ? '#d97706' : '#dc2626'}">${analysis.overall_score}%</strong></td></tr>
                  <tr><td style="padding: 4px 0; font-weight: 600;">Requirements Met:</td><td>${analysis.requirements_met.length}</td></tr>
                  <tr><td style="padding: 4px 0; font-weight: 600;">Requirements Missing:</td><td style="color: #dc2626; font-weight: 600;">${analysis.requirements_missing.length}</td></tr>
                  <tr><td style="padding: 4px 0; font-weight: 600;">Pricing Gaps:</td><td style="color: #d97706; font-weight: 600;">${analysis.pricing_gaps.length}</td></tr>
                  <tr><td style="padding: 4px 0; font-weight: 600;">Email Sent to Sub:</td><td>${emailSent ? "Yes" : "No"}</td></tr>
                </table>
                <p style="font-size: 12px; color: #6b7280; margin: 12px 0 0;">${analysis.summary}</p>
              </div>
            </div>
          `,
          text: `Quote Compliance Analysis\n\nCompany: ${sub?.company_name || "N/A"}\nSOW: ${sow.sow_name}\nScore: ${analysis.overall_score}%\nRequirements Met: ${analysis.requirements_met.length}\nRequirements Missing: ${analysis.requirements_missing.length}\nPricing Gaps: ${analysis.pricing_gaps.length}\nEmail Sent to Sub: ${emailSent ? "Yes" : "No"}\n\n${analysis.summary}`,
        })
      } catch { /* silent */ }
    }

    return new Response(JSON.stringify({
      success: true,
      analysis,
      email_sent: emailSent,
      has_gaps: hasGaps,
      _debug: {
        sowDocTextLen: sowDocText.length,
        projectDocTextsLen: projectDocTexts.length,
        diag: _diag,
      },
    }), { headers: corsHeaders })
  } catch (err: any) {
    console.error("Quote analysis error:", err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
}
