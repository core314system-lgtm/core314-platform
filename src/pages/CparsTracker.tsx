import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../contexts/OrgContext'
import {
  Award, Plus, Trash2, Edit2, TrendingUp, TrendingDown,
  Minus, BarChart3, X, Save,
} from 'lucide-react'
import FeatureGuidance from '../components/FeatureGuidance'

interface CparsEntry {
  id: string
  contract_title: string
  contract_number: string
  agency: string
  period: string
  quality: number | null
  schedule: number | null
  cost_control: number | null
  management: number | null
  small_business: number | null
  overall: number | null
  narrative_summary: string
  created_at: string
}

const RATING_LABELS: Record<number, { label: string; color: string }> = {
  5: { label: 'Exceptional', color: 'text-green-600' },
  4: { label: 'Very Good', color: 'text-blue-600' },
  3: { label: 'Satisfactory', color: 'text-gray-600' },
  2: { label: 'Marginal', color: 'text-amber-600' },
  1: { label: 'Unsatisfactory', color: 'text-red-600' },
}

const RATING_FIELDS = [
  { key: 'quality', label: 'Quality' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'cost_control', label: 'Cost Control' },
  { key: 'management', label: 'Management' },
  { key: 'small_business', label: 'Small Business' },
] as const

export default function CparsTracker() {
  const { currentOrg } = useOrg()
  const [entries, setEntries] = useState<CparsEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<CparsEntry>>({})

  useEffect(() => {
    if (currentOrg?.id) loadEntries()
  }, [currentOrg?.id])

  async function loadEntries() {
    const { data } = await supabase
      .from('cpars_ratings')
      .select('*')
      .eq('org_id', currentOrg!.id)
      .order('created_at', { ascending: false })

    if (data) setEntries(data)
    setLoading(false)
  }

  async function handleSave() {
    if (!currentOrg?.id) return
    setSaving(true)
    const overall = RATING_FIELDS
      .map(f => form[f.key] as number | null)
      .filter((v): v is number => v !== null && v !== undefined)
    const avg = overall.length > 0 ? Math.round((overall.reduce((a, b) => a + b, 0) / overall.length) * 10) / 10 : null

    if (editingId) {
      await supabase.from('cpars_ratings').update({ ...form, overall: avg }).eq('id', editingId)
    } else {
      await supabase.from('cpars_ratings').insert({ ...form, overall: avg, org_id: currentOrg.id })
    }
    setSaving(false)
    setShowForm(false)
    setEditingId(null)
    setForm({})
    loadEntries()
  }

  async function deleteEntry(id: string) {
    await supabase.from('cpars_ratings').delete().eq('id', id)
    loadEntries()
  }

  function averageRating(field: keyof CparsEntry): number | null {
    const vals = entries.map(e => e[field]).filter((v): v is number => typeof v === 'number')
    if (vals.length === 0) return null
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
  }

  function trend(field: keyof CparsEntry): 'up' | 'down' | 'flat' {
    const vals = entries.map(e => e[field]).filter((v): v is number => typeof v === 'number')
    if (vals.length < 2) return 'flat'
    return vals[0] > vals[vals.length - 1] ? 'up' : vals[0] < vals[vals.length - 1] ? 'down' : 'flat'
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Award className="text-amber-600" size={28} />
            CPARS Score Tracker
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Track CPARS ratings across contracts with trend analysis</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm({}) }}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
        >
          <Plus size={16} /> Add Rating
        </button>
      </div>

      <FeatureGuidance
        title="CPARS Score Tracker"
        description="Track your Contractor Performance Assessment Reporting System (CPARS) ratings across all contracts. Monitor trends in Quality, Schedule, Cost Control, Management, and Small Business performance areas."
        storageKey="cpars_tracker"
        accentColor="amber"
        steps={[
          { title: 'Enter CPARS ratings', description: 'Add ratings from each CPARS evaluation period. Rate each area 1-5 (Unsatisfactory to Exceptional).' },
          { title: 'Monitor trends', description: 'The dashboard shows average scores and trends (improving, declining, or stable) across all contracts.' },
          { title: 'Use for proposals', description: 'Reference strong CPARS scores in your Past Performance volumes. Address any declining areas proactively.' },
        ]}
      />

      {/* Trend Dashboard */}
      {entries.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {RATING_FIELDS.map(field => {
            const avg = averageRating(field.key)
            const t = trend(field.key)
            return (
              <div key={field.key} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">{field.label}</p>
                <div className="flex items-center justify-center gap-1">
                  <span className="text-2xl font-bold text-gray-900">{avg ?? '—'}</span>
                  {t === 'up' && <TrendingUp size={14} className="text-green-500" />}
                  {t === 'down' && <TrendingDown size={14} className="text-red-500" />}
                  {t === 'flat' && <Minus size={14} className="text-gray-400" />}
                </div>
                {avg !== null && (
                  <p className={`text-[10px] font-medium ${RATING_LABELS[Math.round(avg)]?.color || 'text-gray-500'}`}>
                    {RATING_LABELS[Math.round(avg)]?.label || ''}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Entry Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">{editingId ? 'Edit' : 'Add'} CPARS Rating</h2>
            <button onClick={() => { setShowForm(false); setEditingId(null) }} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={form.contract_title || ''}
              onChange={e => setForm({ ...form, contract_title: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Contract title"
            />
            <input
              value={form.contract_number || ''}
              onChange={e => setForm({ ...form, contract_number: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Contract number"
            />
            <input
              value={form.agency || ''}
              onChange={e => setForm({ ...form, agency: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Agency"
            />
            <input
              value={form.period || ''}
              onChange={e => setForm({ ...form, period: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Evaluation period (e.g., FY2024 Q3)"
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
            {RATING_FIELDS.map(field => (
              <div key={field.key}>
                <label className="text-xs text-gray-500 mb-1 block">{field.label}</label>
                <select
                  value={form[field.key] ?? ''}
                  onChange={e => setForm({ ...form, [field.key]: e.target.value ? Number(e.target.value) : null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">—</option>
                  {[5, 4, 3, 2, 1].map(v => (
                    <option key={v} value={v}>{v} — {RATING_LABELS[v].label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <textarea
            value={form.narrative_summary || ''}
            onChange={e => setForm({ ...form, narrative_summary: e.target.value })}
            className="w-full mt-3 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            rows={2}
            placeholder="Narrative summary (optional)"
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={handleSave}
              disabled={saving || !form.contract_title}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              <Save size={14} /> {saving ? 'Saving...' : 'Save Rating'}
            </button>
          </div>
        </div>
      )}

      {/* Entries Table */}
      {entries.length === 0 && !showForm ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <BarChart3 className="mx-auto text-gray-400 mb-3" size={48} />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">No CPARS Ratings Yet</h2>
          <p className="text-sm text-gray-500 mb-4">Add your CPARS evaluation ratings to track performance trends across contracts.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Contract</th>
                  <th className="text-center px-2 py-3 font-medium text-gray-600">Qual</th>
                  <th className="text-center px-2 py-3 font-medium text-gray-600">Sched</th>
                  <th className="text-center px-2 py-3 font-medium text-gray-600">Cost</th>
                  <th className="text-center px-2 py-3 font-medium text-gray-600">Mgmt</th>
                  <th className="text-center px-2 py-3 font-medium text-gray-600">SB</th>
                  <th className="text-center px-2 py-3 font-medium text-gray-600">Avg</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map(entry => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{entry.contract_title}</p>
                      <p className="text-xs text-gray-500">{entry.agency} &bull; {entry.period}</p>
                    </td>
                    {RATING_FIELDS.map(f => {
                      const val = entry[f.key]
                      const rl = val !== null ? RATING_LABELS[val] : null
                      return (
                        <td key={f.key} className="text-center px-2 py-3">
                          {val !== null ? (
                            <span className={`font-bold ${rl?.color || ''}`}>{val}</span>
                          ) : '—'}
                        </td>
                      )
                    })}
                    <td className="text-center px-2 py-3">
                      {entry.overall !== null ? (
                        <span className="font-bold text-gray-900">{entry.overall}</span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setEditingId(entry.id); setForm(entry); setShowForm(true) }}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button onClick={() => deleteEntry(entry.id)} className="p-1 text-gray-400 hover:text-red-500">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
