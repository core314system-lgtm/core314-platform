import { supabase } from './supabase'
import { aiOutputPath } from './types'

const BUCKET = 'task-order-documents'

export async function saveAiOutput(taskOrderId: string, outputType: string, data: unknown): Promise<void> {
  const path = aiOutputPath(taskOrderId, outputType)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })

  // Remove existing file first (upsert)
  await supabase.storage.from(BUCKET).remove([path])

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'application/json',
    upsert: true,
  })

  if (error) {
    console.error('Failed to save AI output:', error)
    throw error
  }
}

export async function loadAiOutput<T>(taskOrderId: string, outputType: string): Promise<T | null> {
  const path = aiOutputPath(taskOrderId, outputType)

  // Use createSignedUrl to bypass CDN cache
  const { data: urlData, error: urlError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60)

  if (urlError || !urlData?.signedUrl) {
    return null
  }

  try {
    const res = await fetch(urlData.signedUrl)
    if (!res.ok) return null
    const text = await res.text()
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export async function hasAiOutput(taskOrderId: string, outputType: string): Promise<boolean> {
  const { data } = await supabase.storage.from(BUCKET).list(`${taskOrderId}/ai_outputs`, {
    search: `${outputType}.json`,
  })
  return (data?.length ?? 0) > 0
}

export const AI_OUTPUT_TYPES = [
  'analysis',
  'compliance_matrix',
  'rfq_packages',
  'clarification_questions',
  'pricing_risks',
  'executive_summary',
  'post_award_checklist',
] as const
