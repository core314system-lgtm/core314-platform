import { supabase } from './supabase'

const BUCKET = 'task-order-documents'
const SOURCES_PATH = '_global/subcontractor_sources.json'

export type SubSource = 'user_database' | 'core314_capture'

interface SourceRegistry {
  [subcontractorId: string]: {
    source: SubSource
    captured_at?: string
    search_query?: string
  }
}

let cachedSources: SourceRegistry | null = null

export async function loadSourceRegistry(): Promise<SourceRegistry> {
  if (cachedSources) return cachedSources

  try {
    const { data: urlData } = await supabase.storage.from(BUCKET).createSignedUrl(SOURCES_PATH, 60)
    if (!urlData?.signedUrl) return {}
    const res = await fetch(urlData.signedUrl)
    if (!res.ok) return {}
    cachedSources = await res.json()
    return cachedSources || {}
  } catch {
    return {}
  }
}

export async function saveSourceRegistry(registry: SourceRegistry): Promise<void> {
  const blob = new Blob([JSON.stringify(registry, null, 2)], { type: 'application/json' })
  await supabase.storage.from(BUCKET).remove([SOURCES_PATH])
  await supabase.storage.from(BUCKET).upload(SOURCES_PATH, blob, {
    contentType: 'application/json',
    upsert: true,
  })
  cachedSources = registry
}

export async function markSource(subcontractorId: string, source: SubSource, metadata?: { search_query?: string }): Promise<void> {
  const registry = await loadSourceRegistry()
  registry[subcontractorId] = {
    source,
    captured_at: new Date().toISOString(),
    ...metadata,
  }
  await saveSourceRegistry(registry)
}

export async function markMultipleSources(ids: string[], source: SubSource, metadata?: { search_query?: string }): Promise<void> {
  const registry = await loadSourceRegistry()
  for (const id of ids) {
    registry[id] = {
      source,
      captured_at: new Date().toISOString(),
      ...metadata,
    }
  }
  await saveSourceRegistry(registry)
}

export function getSource(registry: SourceRegistry, subcontractorId: string): SubSource {
  return registry[subcontractorId]?.source || 'user_database'
}

export function invalidateCache(): void {
  cachedSources = null
}
