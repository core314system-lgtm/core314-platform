import type { Context } from "@netlify/functions"

/**
 * Netlify Function: AI Smart Recommendations
 * 
 * Generates actionable recommendations for a project based on its current
 * state, historical patterns, and best practices.
 * 
 * POST /api/smart-recommendations
 * Body: { project, documentCount, analysisComplete, subAssignments, debriefInsights }
 */

const OPENAI_KEY = process.env.OPENAI_API_KEY || ""

export default async (req: Request, _context: Context) => {
  if (req.method === "OPTIONS") {
    return new Response("", {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    const { project, documentCount, analysisComplete, subAssignments, debriefInsights } = await req.json()

    if (!OPENAI_KEY) {
      return new Response(JSON.stringify(getStaticRecommendations(project, documentCount, analysisComplete, subAssignments)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    const systemPrompt = `You are Procuvex Intelligence, an AI procurement advisor. Generate 3-5 specific, actionable recommendations for improving this project's bid quality and win probability.

Return JSON: { recommendations: Array<{ title: string, description: string, priority: "high" | "medium" | "low", category: "documents" | "analysis" | "pricing" | "compliance" | "team" | "timeline" | "strategy" }> }

Each recommendation should be:
- Specific to this project (not generic advice)
- Actionable (the user can do it right now)
- Prioritized by impact on win probability
- Short (title: 5-10 words, description: 1-2 sentences)

Consider: project stage, document completeness, analysis status, team composition, deadline pressure, historical win/loss patterns, project type, and parent contract context (if contract_id is present, the project belongs to a larger contract vehicle).`

    const userPrompt = `Project: ${JSON.stringify(project)}
Documents: ${documentCount || 0}
AI analysis done: ${analysisComplete ? 'Yes' : 'No'}
Team members assigned: ${subAssignments || 0}
Historical insights: ${JSON.stringify(debriefInsights || 'No historical data available')}`

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 1024,
      }),
    })

    if (!res.ok) {
      return new Response(JSON.stringify(getStaticRecommendations(project, documentCount, analysisComplete, subAssignments)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || "{}"
    const result = JSON.parse(content)

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

function getStaticRecommendations(
  project: Record<string, unknown>,
  documentCount: number,
  analysisComplete: boolean,
  subAssignments: number
) {
  const recommendations: Array<{
    title: string
    description: string
    priority: string
    category: string
  }> = []

  if (documentCount === 0) {
    recommendations.push({
      title: "Upload project documents",
      description: "Upload the SOW, pricing sheets, and any exhibits to enable AI-powered analysis.",
      priority: "high",
      category: "documents",
    })
  }

  if (documentCount > 0 && !analysisComplete) {
    recommendations.push({
      title: "Run AI analysis",
      description: "Your documents are ready — run the AI analysis to extract requirements, compliance items, and pricing risks.",
      priority: "high",
      category: "analysis",
    })
  }

  if (analysisComplete && subAssignments === 0) {
    recommendations.push({
      title: "Assign subcontractors to SOWs",
      description: "Match your subcontractor database to the extracted service categories for a stronger bid.",
      priority: "high",
      category: "team",
    })
  }

  if (project.due_date) {
    const daysLeft = Math.ceil((new Date(project.due_date as string).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (daysLeft <= 7 && daysLeft > 0) {
      recommendations.push({
        title: "Deadline approaching — prioritize submission",
        description: `Only ${daysLeft} days until the response deadline. Focus on completing the compliance matrix and pricing.`,
        priority: "high",
        category: "timeline",
      })
    }
  }

  if (analysisComplete) {
    recommendations.push({
      title: "Review compliance matrix",
      description: "Check for gaps in the compliance matrix and address any 'Missing' or 'Needs Review' items.",
      priority: "medium",
      category: "compliance",
    })
    recommendations.push({
      title: "Generate executive summary",
      description: "Create an executive summary for internal review before final submission.",
      priority: "low",
      category: "strategy",
    })
  }

  return { recommendations: recommendations.slice(0, 5) }
}

export const config = {
  path: "/api/smart-recommendations",
}
