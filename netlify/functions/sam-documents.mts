import type { Context } from "@netlify/functions"

/**
 * Netlify Function: SAM.gov Document Proxy
 *
 * Lists and downloads documents attached to SAM.gov opportunities.
 *
 * GET  /api/sam-documents?opportunityId={id}           — list attachments
 * GET  /api/sam-documents?resourceId={id}&download=1   — proxy download a file
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
}

export default async (req: Request, _context: Context) => {
  if (req.method === "OPTIONS") {
    return new Response("", {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    })
  }

  const url = new URL(req.url)
  const opportunityId = url.searchParams.get("opportunityId")
  const resourceId = url.searchParams.get("resourceId")
  const download = url.searchParams.get("download")

  try {
    // Proxy download a specific file
    if (resourceId && download) {
      const downloadUrl = `https://sam.gov/api/prod/opps/v3/opportunities/resources/files/${resourceId}/download`
      const dlRes = await fetch(downloadUrl, { redirect: "follow" })

      if (!dlRes.ok) {
        return new Response(
          JSON.stringify({ error: `Download failed: ${dlRes.status}` }),
          { status: 502, headers: { "Content-Type": "application/json" } }
        )
      }

      const blob = await dlRes.arrayBuffer()
      const contentType = dlRes.headers.get("content-type") || "application/octet-stream"

      return new Response(blob, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*",
        },
      })
    }

    // List attachments for an opportunity
    if (opportunityId) {
      const resUrl = `https://sam.gov/api/prod/opps/v3/opportunities/${opportunityId}/resources?responseType=json`
      const res = await fetch(resUrl, {
        headers: { Accept: "application/hal+json, application/json" },
      })

      if (!res.ok) {
        // Some opportunities have no attachments (404 is normal)
        if (res.status === 404) {
          return new Response(
            JSON.stringify({ attachments: [] }),
            { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
          )
        }
        return new Response(
          JSON.stringify({ error: `Failed to fetch resources: ${res.status}` }),
          { status: 502, headers: { "Content-Type": "application/json" } }
        )
      }

      const data = await res.json()
      const attachmentLists = data?._embedded?.opportunityAttachmentList || []

      const attachments: Array<{
        resourceId: string
        name: string
        mimeType: string
        size: number
        postedDate: string
      }> = []

      for (const list of attachmentLists) {
        for (const att of (list.attachments || []) as SamAttachment[]) {
          if (att.accessLevel === "public" && att.type === "file") {
            attachments.push({
              resourceId: att.resourceId,
              name: att.name,
              mimeType: att.mimeType,
              size: att.size,
              postedDate: att.postedDate,
            })
          }
        }
      }

      return new Response(
        JSON.stringify({ attachments }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      )
    }

    return new Response(
      JSON.stringify({ error: "Provide opportunityId or resourceId+download params" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

export const config = {
  path: "/api/sam-documents",
}
