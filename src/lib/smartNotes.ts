import { supabase } from './supabase'

// Types for proposed changes from AI
export interface ProposedChange {
  action: 'update_subcontractor' | 'add_subcontractor' | 'update_sow' | 'add_note'
  description: string
  target?: string  // e.g., company name or SOW name
  data: Record<string, unknown>
}

export interface SmartNotesResult {
  summary: string
  changes: ProposedChange[]
}

// Try to parse a structured update block from AI response
export function parseSmartNotesResponse(response: string): SmartNotesResult | null {
  // Look for a JSON block wrapped in ```json ... ```
  const jsonMatch = response.match(/```json\s*([\s\S]*?)```/)
  if (!jsonMatch) return null

  try {
    const parsed = JSON.parse(jsonMatch[1].trim())
    if (parsed && parsed.changes && Array.isArray(parsed.changes)) {
      return parsed as SmartNotesResult
    }
  } catch {
    // Not valid JSON
  }
  return null
}

// Extract the human-readable part of the response (before the JSON block)
export function getHumanResponse(response: string): string {
  const jsonStart = response.indexOf('```json')
  if (jsonStart > 0) {
    return response.substring(0, jsonStart).trim()
  }
  return response
}

// Apply a set of confirmed changes to the database
export async function applyChanges(changes: ProposedChange[], taskOrderId?: string): Promise<{ success: number; errors: string[] }> {
  let success = 0
  const errors: string[] = []

  for (const change of changes) {
    try {
      switch (change.action) {
        case 'update_subcontractor': {
          const { company_name, ...updates } = change.data as Record<string, string>
          if (!company_name) { errors.push(`Missing company_name for update`); break }

          // Find the subcontractor by name (case-insensitive)
          const { data: existing } = await supabase
            .from('subcontractors')
            .select('id')
            .ilike('company_name', company_name)
            .limit(1)

          if (existing && existing.length > 0) {
            const updateData: Record<string, unknown> = { ...updates }
            // Handle service_categories as array
            if (typeof updateData.service_categories === 'string') {
              updateData.service_categories = (updateData.service_categories as string).split(',').map(s => s.trim())
            }
            if (typeof updateData.geographic_coverage === 'string') {
              updateData.geographic_coverage = (updateData.geographic_coverage as string).split(',').map(s => s.trim())
            }

            const { error } = await supabase
              .from('subcontractors')
              .update(updateData)
              .eq('id', existing[0].id)

            if (error) { errors.push(`Failed to update ${company_name}: ${error.message}`) }
            else { success++ }
          } else {
            errors.push(`Subcontractor "${company_name}" not found in database`)
          }
          break
        }

        case 'add_subcontractor': {
          const newSub = change.data as Record<string, unknown>
          if (!newSub.company_name) { errors.push('Missing company_name for new subcontractor'); break }

          // Check for duplicates
          const { data: dup } = await supabase
            .from('subcontractors')
            .select('id')
            .ilike('company_name', newSub.company_name as string)
            .limit(1)

          if (dup && dup.length > 0) {
            errors.push(`"${newSub.company_name}" already exists — skipping`)
            break
          }

          // Ensure arrays
          if (typeof newSub.service_categories === 'string') {
            newSub.service_categories = (newSub.service_categories as string).split(',').map(s => s.trim())
          }
          if (typeof newSub.geographic_coverage === 'string') {
            newSub.geographic_coverage = (newSub.geographic_coverage as string).split(',').map(s => s.trim())
          }
          if (!newSub.incumbent_status) newSub.incumbent_status = 'unknown'

          const { error } = await supabase
            .from('subcontractors')
            .insert(newSub)

          if (error) { errors.push(`Failed to add ${newSub.company_name}: ${error.message}`) }
          else { success++ }
          break
        }

        case 'update_sow': {
          const { sow_name, ...sowUpdates } = change.data as Record<string, string>
          if (!sow_name || !taskOrderId) { errors.push('Missing sow_name or task order context'); break }

          const { data: sow } = await supabase
            .from('sow_items')
            .select('id')
            .eq('task_order_id', taskOrderId)
            .ilike('sow_name', sow_name)
            .limit(1)

          if (sow && sow.length > 0) {
            const { error } = await supabase
              .from('sow_items')
              .update(sowUpdates)
              .eq('id', sow[0].id)

            if (error) { errors.push(`Failed to update SOW "${sow_name}": ${error.message}`) }
            else { success++ }
          } else {
            errors.push(`SOW "${sow_name}" not found`)
          }
          break
        }

        case 'add_note': {
          // Add a communication/note to a specific sow-subcontractor link
          const { sow_name, company_name, note_body, note_subject } = change.data as Record<string, string>
          if (!sow_name || !company_name || !taskOrderId) {
            errors.push('Missing context for adding note')
            break
          }

          // Find the sow_subcontractor link
          const { data: sowItem } = await supabase
            .from('sow_items')
            .select('id')
            .eq('task_order_id', taskOrderId)
            .ilike('sow_name', sow_name)
            .limit(1)

          if (!sowItem || sowItem.length === 0) { errors.push(`SOW "${sow_name}" not found`); break }

          const { data: sub } = await supabase
            .from('subcontractors')
            .select('id')
            .ilike('company_name', company_name)
            .limit(1)

          if (!sub || sub.length === 0) { errors.push(`Subcontractor "${company_name}" not found`); break }

          const { data: sowSub } = await supabase
            .from('sow_subcontractors')
            .select('id')
            .eq('sow_item_id', sowItem[0].id)
            .eq('subcontractor_id', sub[0].id)
            .limit(1)

          if (!sowSub || sowSub.length === 0) {
            errors.push(`No assignment found for "${company_name}" on "${sow_name}"`)
            break
          }

          const { error } = await supabase
            .from('sow_communications')
            .insert({
              sow_subcontractor_id: sowSub[0].id,
              comm_type: 'note',
              direction: 'internal',
              subject: note_subject || 'Site visit observation',
              body: note_body,
            })

          if (error) { errors.push(`Failed to add note: ${error.message}`) }
          else { success++ }
          break
        }
      }
    } catch (err) {
      errors.push(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown'}`)
    }
  }

  return { success, errors }
}

// System prompt addition for smart notes
export const SMART_NOTES_PROMPT = `

SMART NOTES MODE:
When the user shares notes, site visit observations, intelligence about subcontractors, or any information that should be stored in the system, you MUST:
1. First, provide a brief human-readable summary of what you understood from the notes.
2. Then, output a JSON block with proposed database changes.

The JSON block MUST be wrapped in \`\`\`json ... \`\`\` markers and follow this exact format:
\`\`\`json
{
  "summary": "Brief summary of all proposed changes",
  "changes": [
    {
      "action": "update_subcontractor",
      "description": "Human-readable description of this change",
      "target": "Company Name",
      "data": {
        "company_name": "Exact Company Name to match",
        "incumbent_status": "known",
        "performance_notes": "New notes to set"
      }
    },
    {
      "action": "add_subcontractor",
      "description": "Add new subcontractor discovered during site visit",
      "data": {
        "company_name": "New Company Name",
        "contact_name": "Contact Person",
        "contact_email": "email@example.com",
        "contact_phone": "(555) 123-4567",
        "service_categories": "HVAC, Plumbing",
        "geographic_coverage": "TX, OK",
        "incumbent_status": "known",
        "performance_notes": "Observations from site visit"
      }
    },
    {
      "action": "update_sow",
      "description": "Update SOW details",
      "target": "HVAC Services",
      "data": {
        "sow_name": "HVAC Services",
        "notes": "Updated notes"
      }
    },
    {
      "action": "add_note",
      "description": "Add site visit observation for specific sub on specific SOW",
      "data": {
        "sow_name": "HVAC Services",
        "company_name": "Johnson Controls",
        "note_subject": "Site Visit Observation",
        "note_body": "Detailed observation text"
      }
    }
  ]
}
\`\`\`

IMPORTANT RULES FOR SMART NOTES:
- ONLY propose changes based on information the user explicitly provided. Do NOT fabricate or assume any data.
- For "update_subcontractor", the "company_name" in data MUST match an existing subcontractor from the data below. If the user mentions a company that doesn't exist in the database, use "add_subcontractor" instead.
- For incumbent_status, valid values are: "known", "suspected", "not_incumbent", "unknown"
- For service_categories, use comma-separated values matching the standard categories.
- Always include a clear "description" for each change so the user understands what will happen.
- If the user's notes don't contain actionable data to update, just respond normally without the JSON block.
- When the user asks questions (even after sharing notes), respond normally without the JSON block.`
