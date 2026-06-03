import { supabase } from './supabase'

export interface AiAuditEntry {
  id?: string
  user_id: string
  org_id?: string | null
  request_type: string
  model: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  task_order_id?: string | null
  task_order_title?: string | null
  document_context?: string | null
  response_summary?: string | null
  latency_ms: number
  status: 'success' | 'error'
  error_message?: string | null
  created_at?: string
}

/**
 * Log an AI call to the audit log.
 * Falls back silently if the table doesn't exist yet.
 */
export async function logAiCall(entry: Omit<AiAuditEntry, 'id' | 'created_at'>): Promise<void> {
  try {
    await supabase.from('ai_audit_log').insert(entry)
  } catch {
    // Silently fail — audit logging should never block the AI call
    console.warn('Failed to log AI audit entry')
  }
}

/**
 * Fetch AI audit log entries with pagination.
 */
export async function fetchAiAuditLog(options: {
  page?: number
  pageSize?: number
  requestType?: string
  startDate?: string
  endDate?: string
}): Promise<{ data: AiAuditEntry[]; count: number }> {
  const { page = 1, pageSize = 25, requestType, startDate, endDate } = options
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('ai_audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (requestType && requestType !== 'all') {
    query = query.eq('request_type', requestType)
  }
  if (startDate) {
    query = query.gte('created_at', startDate)
  }
  if (endDate) {
    query = query.lte('created_at', endDate + 'T23:59:59.999Z')
  }

  const { data, count, error } = await query
  if (error) throw error
  return { data: data || [], count: count || 0 }
}

/**
 * Get AI usage statistics for the accuracy dashboard.
 */
export async function fetchAiStats(): Promise<{
  totalCalls: number
  totalTokens: number
  avgLatency: number
  errorRate: number
  byRequestType: Record<string, { count: number; tokens: number }>
  recentTrend: { date: string; calls: number; tokens: number }[]
}> {
  const { data, error } = await supabase
    .from('ai_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000)

  if (error || !data) {
    return { totalCalls: 0, totalTokens: 0, avgLatency: 0, errorRate: 0, byRequestType: {}, recentTrend: [] }
  }

  const totalCalls = data.length
  const totalTokens = data.reduce((s, e) => s + (e.total_tokens || 0), 0)
  const avgLatency = totalCalls > 0 ? Math.round(data.reduce((s, e) => s + (e.latency_ms || 0), 0) / totalCalls) : 0
  const errorCount = data.filter(e => e.status === 'error').length
  const errorRate = totalCalls > 0 ? Math.round((errorCount / totalCalls) * 100) : 0

  const byRequestType: Record<string, { count: number; tokens: number }> = {}
  for (const entry of data) {
    const type = entry.request_type || 'unknown'
    if (!byRequestType[type]) byRequestType[type] = { count: 0, tokens: 0 }
    byRequestType[type].count++
    byRequestType[type].tokens += entry.total_tokens || 0
  }

  // Group by date for trend
  const dateMap: Record<string, { calls: number; tokens: number }> = {}
  for (const entry of data) {
    const date = (entry.created_at || '').slice(0, 10)
    if (!date) continue
    if (!dateMap[date]) dateMap[date] = { calls: 0, tokens: 0 }
    dateMap[date].calls++
    dateMap[date].tokens += entry.total_tokens || 0
  }
  const recentTrend = Object.entries(dateMap)
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)

  return { totalCalls, totalTokens, avgLatency, errorRate, byRequestType, recentTrend }
}
