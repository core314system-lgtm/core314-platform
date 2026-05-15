const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || ''
const MODEL = 'gpt-4o-mini'
const MAX_CHARS_PER_DOC = 8000
const MAX_TOTAL_CHARS = 120000
const MAX_RETRIES = 3
const RETRY_BASE_DELAY = 5000

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  const half = Math.floor(maxChars / 2)
  return text.slice(0, half) + '\n\n[... content truncated for analysis ...]\n\n' + text.slice(-half)
}

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<Record<string, unknown>> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured. Contact your administrator.')
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 8192,
      }),
    })

    if (res.status === 429) {
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY * Math.pow(2, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      throw new Error('Rate limit exceeded. Please wait a minute and try again.')
    }

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`AI analysis error: ${err}`)
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || '{}'
    return JSON.parse(content)
  }

  throw new Error('Failed after maximum retries')
}

function buildDocsText(documentTexts: string[], documentNames: string[]): string {
  const truncated = documentTexts.map(t => truncateText(t, MAX_CHARS_PER_DOC))
  let combined = truncated.map((text, i) => `--- DOCUMENT: ${documentNames[i]} ---\n${text}`).join('\n\n')
  if (combined.length > MAX_TOTAL_CHARS) {
    combined = combined.slice(0, MAX_TOTAL_CHARS) + '\n\n[... remaining content truncated ...]'
  }
  return combined
}

export async function analyzeDocuments(
  documentTexts: string[],
  documentNames: string[],
  taskOrderTitle: string,
  siteName?: string,
) {
  const docsText = buildDocsText(documentTexts, documentNames)

  const systemPrompt = `You are an expert government contract analyst specializing in facility maintenance, IFSM, and task order RFQ analysis.
Analyze the provided task order documents and extract structured information.

IMPORTANT: You MUST populate the "requirements" array with at least 10-30 individual requirements extracted from the documents. Each maintenance task, inspection, service standard, staffing requirement, reporting obligation, safety protocol, or compliance item should be its own requirement entry. Do NOT leave requirements empty.

Also extract task order metadata:
- task_order_metadata: {title, solicitation_number, task_order_number, contract_number, contract_vehicle, site_name, location_city, location_state, contracting_officer, co_email, co_phone, period_of_performance_start, period_of_performance_end, estimated_value, naics_code, set_aside, response_due_date}

Return a JSON object with these keys:
- task_order_metadata: object with the fields above (use null for any not found)
- requirements: array of {requirement, source_document, page_section, service_category, frequency, equipment_needed, staffing_needed, compliance_type, risk_level} - MUST have entries
- service_categories: array of {category, description, subcontractor_heavy, estimated_scope}
- staffing_requirements: array of {role, count, qualifications, certifications_needed, source_document}
- compliance_items: array of {requirement, source_document, section, responsible_party, status, risk_level, notes}
- unclear_items: array of {issue, source_document, section, suggested_clarification}
- pricing_alignment_issues: array of {issue, source_document, pricing_sheet_reference, risk_level}
- key_dates: array of {date, description, source_document}
- summary: string with a brief overview of the task order scope`

  const userPrompt = `Task Order: ${taskOrderTitle}\nSite: ${siteName || 'Not specified'}\n\nDOCUMENTS:\n${docsText}`
  return callOpenAI(systemPrompt, userPrompt)
}

export async function generateComplianceMatrix(
  documentTexts: string[],
  documentNames: string[],
  taskOrderTitle: string,
  siteName?: string,
) {
  const docsText = buildDocsText(documentTexts, documentNames)

  const systemPrompt = `You are an expert government contract compliance analyst.
Generate a detailed compliance matrix from the task order documents.
Return a JSON object with key "items", an array of objects with:
- requirement: the specific requirement text
- source_document: which document it came from
- page_section: page/section/paragraph reference
- service_category: which service category this falls under
- responsible_party: who is responsible (prime, subcontractor, joint)
- proposal_response_needed: boolean
- pricing_impact: none, low, medium, high
- risk_level: low, medium, high, critical
- status: covered, unclear, missing, needs_review
- notes: any assumptions or clarifications needed`

  const userPrompt = `Task Order: ${taskOrderTitle}\nSite: ${siteName || 'Not specified'}\n\nDOCUMENTS:\n${docsText}`
  return callOpenAI(systemPrompt, userPrompt)
}

export async function generateRfqPackages(
  documentTexts: string[],
  documentNames: string[],
  taskOrderTitle: string,
  siteName?: string,
) {
  const docsText = buildDocsText(documentTexts, documentNames)

  const systemPrompt = `You are an expert subcontractor procurement specialist for government facility maintenance contracts.
Generate subcontractor-specific RFQ packages for each service category identified in the documents.
Return a JSON object with key "packages", an array of objects with:
- service_category: the service category name
- scope_summary: clear summary of work scope
- required_frequency: how often the service is needed
- site_assumptions: site-specific details and assumptions
- equipment_details: required equipment or area details
- licenses_certifications: required licenses and certifications
- questions_for_subcontractor: array of questions to ask
- due_date_note: when quotes are needed
- quote_format: expected quote format and line items
- sales_tax_treatment: required sales tax handling (request not-to-exceed if exact unavailable)
- partnership_language: note about seeking long-term preferred partners for multiple task orders (no guarantee of award)`

  const userPrompt = `Task Order: ${taskOrderTitle}\nSite: ${siteName || 'Not specified'}\n\nDOCUMENTS:\n${docsText}`
  return callOpenAI(systemPrompt, userPrompt)
}

export async function generateClarificationQuestions(
  documentTexts: string[],
  documentNames: string[],
  taskOrderTitle: string,
  siteName?: string,
) {
  const docsText = buildDocsText(documentTexts, documentNames)

  const systemPrompt = `You are an expert subcontractor procurement specialist analyzing task order SOW documents from the perspective of the subcontractors who will actually perform the work. Your job is to identify EVERY piece of missing information that a subcontractor would need to provide an accurate quote.

CRITICAL: Analyze EACH Statement of Work (SOW) individually and thoroughly. For each requirement in each SOW, ask yourself: "If I were a subcontractor reading this, do I have enough information to price this work?" If the answer is no, generate a clarification question.

Common things subcontractors need that are often missing from SOWs:
- QUANTITIES: How many fire extinguishers? How many HVAC units? How many restrooms? How many light fixtures? How many doors?
- TYPES/SPECS: What type of fire extinguishers (ABC, K-class, CO2)? What HVAC system types (split, packaged, chiller)? What size units (tonnage)?
- DIMENSIONS/MEASUREMENTS: Square footage of areas to be cleaned/treated/salted? Linear feet of sidewalks? Acreage of grounds? Number of floors? Building square footage per service area?
- FREQUENCIES not specified: How often for inspections? Daily/weekly/monthly service schedules? Seasonal variations?
- EQUIPMENT/MATERIALS: Who provides chemicals/supplies? What equipment is required? Who provides replacement parts?
- SITE ACCESS: Hours of access? Security clearance requirements? Escort requirements? Loading dock availability?
- LABOR REQUIREMENTS: Prevailing wage rates applicable? Certifications required (EPA, OSHA, state licenses)? Background check requirements?
- SCOPE BOUNDARIES: Where does one service end and another begin? What areas are included/excluded? What constitutes "emergency" vs "routine"?
- RESPONSE TIMES: Emergency response time requirements? After-hours call requirements?
- EXISTING CONDITIONS: Current equipment age/condition? Known issues? Warranty status on existing equipment?
- REPORTING: What reports are required? What format? How frequently?

Generate at LEAST 15-30 clarification questions covering multiple SOW documents. Do NOT limit yourself to just the main requirements — look for anomalies, missing details, vague language, conflicting information, and anything that would prevent a subcontractor from submitting a complete and accurate quote.

Return a JSON object with key "questions", an array of objects with:
- question: the proposed clarification question (written from the perspective of what a subcontractor performing the work would need to know)
- category: missing_quantities, unclear_frequencies, missing_equipment, access_restrictions, shutdown_requirements, missing_dimensions, missing_specifications, missing_site_conditions, labor_requirements, scope_boundaries, response_times, reporting_requirements, pricing_inconsistencies, conflicting_documents, vague_staffing, materials_responsibility, existing_conditions, other
- source_document: which specific SOW document triggered this question
- section_reference: the relevant section or requirement
- priority: low, medium, high, critical (critical = cannot price without this info, high = significant pricing impact, medium = could affect accuracy, low = nice to know)
- impact: specific explanation of what happens if this isn't clarified (e.g., "Subcontractor cannot determine if 20 or 200 extinguishers need servicing, leading to potential 10x pricing variance")
- subcontractor_trade: which trade/service category this affects (e.g., "Fire Life Safety", "HVAC", "Janitorial", "Snow Removal")

Format questions in a professional style suitable for submission to the contracting officer. Each question should reference specific SOW language when possible.`

  const userPrompt = `Task Order: ${taskOrderTitle}\nSite: ${siteName || 'Not specified'}\n\nDOCUMENTS:\n${docsText}`
  return callOpenAI(systemPrompt, userPrompt)
}

export async function generatePricingRisks(
  documentTexts: string[],
  documentNames: string[],
  taskOrderTitle: string,
  siteName?: string,
) {
  const docsText = buildDocsText(documentTexts, documentNames)

  const systemPrompt = `You are an expert pricing analyst for government facility maintenance contracts.
Identify all pricing risks, gaps, and issues in the task order documents.
Return a JSON object with key "risks", an array of objects with:
- risk: description of the pricing risk
- category: missing_quotes, unpriced_scope, duplicate_scope, underpriced, labor_assumptions, salary_assumptions, sales_tax, markup_issues, reimbursable_vs_fixed, high_risk_category, leadership_review_needed
- source_document: relevant document
- section_reference: relevant section
- severity: low, medium, high, critical
- recommended_action: what should be done to address this
- financial_impact: estimated impact if not addressed`

  const userPrompt = `Task Order: ${taskOrderTitle}\nSite: ${siteName || 'Not specified'}\n\nDOCUMENTS:\n${docsText}`
  return callOpenAI(systemPrompt, userPrompt)
}

export async function generateExecutiveSummary(
  documentTexts: string[],
  documentNames: string[],
  taskOrderTitle: string,
  siteName?: string,
) {
  const docsText = buildDocsText(documentTexts, documentNames)

  const systemPrompt = `You are an expert government contract strategist preparing a management-ready executive bid summary.
Generate a comprehensive executive summary suitable for leadership review.
Return a JSON object with:
- overview: task order overview paragraph
- site_summary: STRING (plain text paragraph describing the site, address, facility type, and key details - do NOT return an object)
- scope_categories: array of {category, description}
- staffing_requirements: summary of staffing needs
- subcontractor_categories: array of categories that are subcontractor-heavy
- major_risks: array of {risk, severity, mitigation}
- pricing_assumptions: array of key pricing assumptions
- unanswered_questions: array of critical unanswered questions
- bid_strategy: recommended bid strategy paragraph
- confidence_rating: high, medium, or low
- confidence_rationale: why this confidence level
- action_items: array of {action, owner, deadline_note, priority}`

  const userPrompt = `Task Order: ${taskOrderTitle}\nSite: ${siteName || 'Not specified'}\n\nDOCUMENTS:\n${docsText}`
  return callOpenAI(systemPrompt, userPrompt)
}

export async function matchSubcontractors(
  analysisResult: Record<string, unknown>,
  subcontractors: Array<{ id: string; company_name: string; service_categories: string[]; geographic_coverage: string[]; incumbent_status: string; preferred: boolean }>,
  taskOrderLocation: string,
) {
  const serviceCategories = (analysisResult.service_categories as Array<{ category: string }>) || []
  const categories = serviceCategories.map(c => c.category)

  const matches: Array<{
    subcontractor_id: string
    company_name: string
    matched_categories: string[]
    location_match: boolean
    incumbent_status: string
    preferred: boolean
    match_score: number
  }> = []

  const locationState = taskOrderLocation?.split(',').pop()?.trim().toUpperCase() || ''

  for (const sub of subcontractors) {
    const matchedCats = sub.service_categories.filter(sc =>
      categories.some(c => c.toLowerCase().includes(sc.toLowerCase()) || sc.toLowerCase().includes(c.toLowerCase()))
    )
    const locationMatch = sub.geographic_coverage.some(g =>
      g.toUpperCase() === locationState ||
      g.toUpperCase() === 'NATIONWIDE' ||
      g.toUpperCase().includes(locationState)
    )

    if (matchedCats.length > 0) {
      let score = matchedCats.length * 25
      if (locationMatch) score += 20
      if (sub.preferred) score += 15
      if (sub.incumbent_status === 'known') score += 10
      if (sub.incumbent_status === 'suspected') score += 5
      score = Math.min(score, 100)

      matches.push({
        subcontractor_id: sub.id,
        company_name: sub.company_name,
        matched_categories: matchedCats,
        location_match: locationMatch,
        incumbent_status: sub.incumbent_status,
        preferred: sub.preferred,
        match_score: score,
      })
    }
  }

  return matches.sort((a, b) => b.match_score - a.match_score)
}

export async function compareTaskOrders(
  currentTexts: string[],
  currentTitle: string,
  priorTexts: string[],
  priorTitle: string,
) {
  const systemPrompt = `You are an expert government contract analyst comparing task orders.
Compare the current task order against the prior task order and identify differences.
Return a JSON object with:
- similar_requirements: array of {requirement, current_reference, prior_reference}
- changed_requirements: array of {requirement, current_version, prior_version, change_type}
- added_services: array of {service, details, current_reference}
- removed_services: array of {service, details, prior_reference}
- staffing_changes: array of {role, current, prior, change}
- reporting_changes: array of {requirement, current, prior}
- pricing_structure_changes: array of {item, current, prior}
- repeated_language: array of {section, language_summary}
- prior_questions_relevant: array of {question, still_relevant, notes}
- prior_risks_relevant: array of {risk, still_relevant, notes}
- summary: overall comparison summary paragraph`

  const currentText = currentTexts.map(t => truncateText(t, MAX_CHARS_PER_DOC)).join('\n\n')
  const priorText = priorTexts.map(t => truncateText(t, MAX_CHARS_PER_DOC)).join('\n\n')
  const userPrompt = `CURRENT TASK ORDER: ${currentTitle}\n${currentText}\n\nPRIOR TASK ORDER: ${priorTitle}\n${priorText}`

  return callOpenAI(systemPrompt, userPrompt)
}
