import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
import { resilientFetch } from "./_shared/resilience.ts"

/**
 * Netlify Function: SAM.gov Document Management
 *
 * GET  /api/sam-documents?opportunityId={id}           — list attachments
 * POST /api/sam-documents                              — download from SAM.gov + upload to Supabase
 *   Body: { opportunityId, projectId, userToken }
 */

interface SamAttachment {
  attachmentId: string
  resourceId: string
  name: string
  type: string
  mimeType: string
  size: number
  accessLevel: string
  postedDate: string
  uri?: string
  description?: string
}

function getMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || ""
  const map: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    zip: "application/zip",
    txt: "text/plain",
    csv: "text/csv",
  }
  return map[ext] || "application/octet-stream"
}

async function fetchAttachments(opportunityId: string) {
  const resUrl = `https://sam.gov/api/prod/opps/v3/opportunities/${opportunityId}/resources?responseType=json`
  const res = await resilientFetch(resUrl, {
    headers: { Accept: "application/hal+json, application/json" },
    signal: AbortSignal.timeout(10000),
  }, { maxRetries: 2, baseDelayMs: 1000 })

  if (!res.ok) return { files: [] as SamAttachment[], links: [] as SamAttachment[] }

  const data = await res.json()
  const lists = data?._embedded?.opportunityAttachmentList || []

  const files: SamAttachment[] = []
  const links: SamAttachment[] = []

  for (const list of lists) {
    for (const att of (list.attachments || []) as SamAttachment[]) {
      if (att.accessLevel !== "public") continue
      if (att.type === "file") files.push(att)
      else if (att.type === "link" && att.uri) links.push(att)
    }
  }

  return { files, links }
}

export default async (req: Request, _context: Context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }

  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders })
  }

  try {
    // POST: Server-side download from SAM.gov + upload to Supabase
    if (req.method === "POST") {
      const body = await req.json()
      const { opportunityId, projectId, userToken, userId } = body

      if (!opportunityId || !projectId) {
        return new Response(
          JSON.stringify({ error: "Missing opportunityId or projectId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      const anonKey = process.env.VITE_SUPABASE_ANON_KEY

      if (!supabaseUrl || (!serviceRoleKey && !anonKey)) {
        return new Response(
          JSON.stringify({ error: "Server misconfigured: missing Supabase env vars" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      // Verify user token if provided (multi-user security)
      if (userToken && anonKey) {
        const authClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${userToken}` } },
        })
        const { data: { user: authUser }, error: authErr } = await authClient.auth.getUser()
        if (authErr || !authUser) {
          return new Response(
            JSON.stringify({ error: "Unauthorized: invalid user token" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }
      }

      // Prefer service role key (bypasses RLS), fall back to user token
      const supabase = serviceRoleKey
        ? createClient(supabaseUrl, serviceRoleKey)
        : createClient(supabaseUrl, anonKey!, {
            global: { headers: { Authorization: `Bearer ${userToken}` } },
          })

      // Fetch attachment list
      const { files, links } = await fetchAttachments(opportunityId)

      const results: Array<{ name: string; status: string; error?: string }> = []

      // Download and upload each file attachment
      for (const att of files) {
        try {
          const dlUrl = `https://sam.gov/api/prod/opps/v3/opportunities/resources/files/${att.resourceId}/download`
          const dlRes = await fetch(dlUrl, { redirect: "follow" })

          if (!dlRes.ok) {
            results.push({ name: att.name, status: "download_failed", error: `HTTP ${dlRes.status}` })
            continue
          }

          const fileBuffer = await dlRes.arrayBuffer()
          const mimeType = getMimeType(att.name)
          const storagePath = `${projectId}/${Date.now()}_${att.name}`

          const { error: uploadErr } = await supabase.storage
            .from("task-order-documents")
            .upload(storagePath, fileBuffer, {
              contentType: mimeType,
              upsert: false,
            })

          if (uploadErr) {
            results.push({ name: att.name, status: "upload_failed", error: uploadErr.message })
            continue
          }

          const lowerName = att.name.toLowerCase()
          let category = "other"
          if (lowerName.includes("sow") || lowerName.includes("statement_of_work") || lowerName.includes("statement of work")) {
            category = "sow"
          } else if (lowerName.includes("amendment") || lowerName.includes("mod")) {
            category = "amendment"
          } else if (lowerName.includes("wage") || lowerName.includes("wd") || lowerName.includes("w.d.")) {
            category = "wage_determination"
          } else if (lowerName.includes("exhibit")) {
            category = "exhibit"
          } else if (lowerName.includes("pricing") || lowerName.includes("price")) {
            category = "pricing_sheet"
          }

          const insertRow: Record<string, unknown> = {
            task_order_id: projectId,
            file_name: att.name,
            file_path: storagePath,
            file_size: fileBuffer.byteLength,
            file_type: mimeType,
            category,
            version: 1,
          }
          if (userId) insertRow.uploaded_by = userId

          const { error: insertErr } = await supabase.from("documents").insert(insertRow)

          if (insertErr) {
            results.push({ name: att.name, status: "db_failed", error: insertErr.message })
          } else {
            results.push({ name: att.name, status: "success" })
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Unknown error"
          results.push({ name: att.name, status: "error", error: msg })
        }
      }

      // Build link notes
      const linkNotes = links.length > 0
        ? "\n\n--- SAM.gov Document Links ---\n" +
          links.map(l => `• ${l.description || l.uri}: ${l.uri}`).join("\n")
        : ""

      return new Response(
        JSON.stringify({
          results,
          linkNotes,
          totalFiles: files.length,
          totalLinks: links.length,
          successCount: results.filter(r => r.status === "success").length,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // GET: List attachments for an opportunity
    const url = new URL(req.url)
    const opportunityId = url.searchParams.get("opportunityId")

    if (opportunityId) {
      const { files, links } = await fetchAttachments(opportunityId)

      const attachments = [
        ...files.map(att => ({
          resourceId: att.resourceId,
          name: att.name,
          mimeType: att.mimeType,
          size: att.size,
          postedDate: att.postedDate,
          type: "file" as const,
        })),
        ...links.map(att => ({
          resourceId: att.resourceId,
          name: att.description || att.uri || "",
          mimeType: "",
          size: 0,
          postedDate: att.postedDate,
          type: "link" as const,
          uri: att.uri,
          description: att.description || "",
        })),
      ]

      return new Response(
        JSON.stringify({ attachments }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({ error: "Provide opportunityId param (GET) or POST body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    })
  }
}

export const config = {
  path: "/api/sam-documents",
}
