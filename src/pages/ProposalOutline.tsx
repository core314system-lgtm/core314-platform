import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { saveAiOutput, loadAiOutput } from '../lib/aiStorage'
import { fetchAIProxy } from '../lib/api'
import {
  BookOpen, ArrowLeft, Sparkles, FileText, ChevronDown, ChevronUp,
  GripVertical, Plus, Trash2, Edit2, Check, AlertTriangle, Wand2, Copy,
  Eye, EyeOff,
} from 'lucide-react'
import FeatureGuidance from '../components/FeatureGuidance'
import { useTier } from '../hooks/useTier'

interface VolumeSection {
  id: string
  title: string
  description: string
  page_limit: string | null
  eval_factors: string[]
  status: 'not_started' | 'drafting' | 'review' | 'complete'
  assigned_to: string
  notes: string
  draft_content?: string
}

interface ProposalVolume {
  id: string
  name: string
  sections: VolumeSection[]
}

interface SavedOutline {
  volumes: ProposalVolume[]
  generated_at: string
}

export default function ProposalOutline() {
  const { id: projectId } = useParams<{ id: string }>()
  const [projectTitle, setProjectTitle] = useState('')
  const [volumes, setVolumes] = useState<ProposalVolume[]>([])
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedVolume, setExpandedVolume] = useState<string | null>(null)
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<VolumeSection>>({})
  const [draftingSection, setDraftingSection] = useState<string | null>(null)
  const [expandedDraft, setExpandedDraft] = useState<string | null>(null)
  const { canAccess } = useTier()
  const canDraft = canAccess('proposal_draft_generation')

  useEffect(() => {
    if (!projectId) return
    Promise.all([
      supabase.from('task_orders').select('title').eq('id', projectId).single(),
      loadAiOutput<SavedOutline>(projectId, 'proposal_outline'),
    ]).then(([{ data: proj }, saved]) => {
      if (proj) setProjectTitle(proj.title)
      if (saved?.volumes) {
        setVolumes(saved.volumes)
        if (saved.volumes.length > 0) setExpandedVolume(saved.volumes[0].id)
      }
      setLoading(false)
    })
  }, [projectId])

  async function generateOutline() {
    if (!projectId) return
    setGenerating(true)
    setError(null)

    try {
      const analysis = await loadAiOutput<{ requirements: { text: string; category: string }[]; summary: string }>(projectId, 'analysis')
      const sectionLM = await loadAiOutput<{ evaluation_factors: { factor_name: string; weight: string }[]; proposal_outline: { volume: string; section: string }[] }>(projectId, 'section_lm_analysis')

      const context = [
        analysis?.summary ? `Project Summary: ${analysis.summary}` : '',
        analysis?.requirements ? `Key Requirements:\n${analysis.requirements.map(r => `- ${r.text}`).join('\n')}` : '',
        sectionLM?.evaluation_factors ? `Evaluation Factors:\n${sectionLM.evaluation_factors.map(f => `- ${f.factor_name} (${f.weight})`).join('\n')}` : '',
      ].filter(Boolean).join('\n\n')

      const res = await fetchAIProxy({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert GovCon proposal manager. Generate a comprehensive proposal outline organized by volumes. Return valid JSON with this structure:
{"volumes":[{"id":"vol1","name":"Volume I - Technical Approach","sections":[{"id":"s1","title":"Section Title","description":"What to cover","page_limit":"10 pages","eval_factors":["Technical Approach"],"status":"not_started","assigned_to":"","notes":""}]}]}
Include standard GovCon proposal volumes: Technical, Management, Past Performance, Cost/Price, and any additional volumes suggested by the RFP. Each section should map to evaluation factors.`,
          },
          {
            role: 'user',
            content: context || 'Generate a standard GovCon proposal outline for a federal services contract. Include Technical Approach, Management Approach, Past Performance, and Cost/Price volumes.',
          },
        ],
        temperature: 0.3,
      })

      const content = res.choices[0].message.content
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Failed to parse AI response')
      const parsed = JSON.parse(jsonMatch[0]) as SavedOutline
      setVolumes(parsed.volumes)
      if (parsed.volumes.length > 0) setExpandedVolume(parsed.volumes[0].id)
      await saveAiOutput(projectId, 'proposal_outline', { ...parsed, generated_at: new Date().toISOString() })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  function updateSection(volumeId: string, sectionId: string, updates: Partial<VolumeSection>) {
    setVolumes(prev => {
      const next = prev.map(v => v.id === volumeId ? {
        ...v,
        sections: v.sections.map(s => s.id === sectionId ? { ...s, ...updates } : s),
      } : v)
      if (projectId) saveAiOutput(projectId, 'proposal_outline', { volumes: next, generated_at: new Date().toISOString() })
      return next
    })
  }

  function addSection(volumeId: string) {
    const newSection: VolumeSection = {
      id: `s_${Date.now()}`,
      title: 'New Section',
      description: '',
      page_limit: null,
      eval_factors: [],
      status: 'not_started',
      assigned_to: '',
      notes: '',
    }
    setVolumes(prev => {
      const next = prev.map(v => v.id === volumeId ? { ...v, sections: [...v.sections, newSection] } : v)
      if (projectId) saveAiOutput(projectId, 'proposal_outline', { volumes: next, generated_at: new Date().toISOString() })
      return next
    })
    setEditingSection(newSection.id)
    setEditForm(newSection)
  }

  function removeSection(volumeId: string, sectionId: string) {
    setVolumes(prev => {
      const next = prev.map(v => v.id === volumeId ? { ...v, sections: v.sections.filter(s => s.id !== sectionId) } : v)
      if (projectId) saveAiOutput(projectId, 'proposal_outline', { volumes: next, generated_at: new Date().toISOString() })
      return next
    })
  }

  async function generateDraft(volumeId: string, section: VolumeSection) {
    if (!projectId) return
    setDraftingSection(section.id)

    try {
      const analysis = await loadAiOutput<{ requirements: { text: string; category: string }[]; summary: string }>(projectId, 'analysis')
      const winThemes = await loadAiOutput<{ themes: { theme: string; evidence: string }[] }>(projectId, 'win_themes')
      const pastPerf = await loadAiOutput<{ citations: { title: string; relevance: string }[] }>(projectId, 'past_performance_match')

      const context = [
        `Project: ${projectTitle}`,
        analysis?.summary ? `Project Summary: ${analysis.summary}` : '',
        `Section: ${section.title}`,
        `Description: ${section.description}`,
        section.eval_factors.length > 0 ? `Evaluation Factors: ${section.eval_factors.join(', ')}` : '',
        section.page_limit ? `Page Limit: ${section.page_limit}` : '',
        winThemes?.themes ? `Win Themes:\n${winThemes.themes.map(t => `- ${t.theme}: ${t.evidence}`).join('\n')}` : '',
        pastPerf?.citations ? `Relevant Past Performance:\n${pastPerf.citations.slice(0, 3).map(c => `- ${c.title}: ${c.relevance}`).join('\n')}` : '',
        analysis?.requirements ? `Key Requirements:\n${analysis.requirements.slice(0, 10).map(r => `- ${r.text}`).join('\n')}` : '',
      ].filter(Boolean).join('\n\n')

      const res = await fetchAIProxy({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert GovCon proposal writer. Generate a professional proposal draft for the specified section. Write in formal proposal language suitable for federal government evaluation. Include specific, substantive content — not placeholder text. Reference win themes and past performance where relevant. Structure with clear headings, paragraphs, and bullet points where appropriate. Return ONLY the proposal text content, no JSON wrapper.`,
          },
          { role: 'user', content: context },
        ],
        temperature: 0.4,
      })

      const draft = res.choices[0].message.content
      updateSection(volumeId, section.id, { draft_content: draft, status: 'drafting' })
      setExpandedDraft(section.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Draft generation failed')
    } finally {
      setDraftingSection(null)
    }
  }

  const totalSections = volumes.reduce((sum, v) => sum + v.sections.length, 0)
  const completeSections = volumes.reduce((sum, v) => sum + v.sections.filter(s => s.status === 'complete').length, 0)

  const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
    not_started: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Not Started' },
    drafting: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Drafting' },
    review: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'In Review' },
    complete: { bg: 'bg-green-100', text: 'text-green-700', label: 'Complete' },
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/projects/${projectId}`} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} className="text-gray-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="text-indigo-600" size={28} />
            Proposal Outline
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{projectTitle || 'Volume structure and section assignments'}</p>
        </div>
        {totalSections > 0 && (
          <div className="text-right">
            <p className="text-sm font-medium text-gray-700">{completeSections}/{totalSections} sections</p>
            <div className="w-32 h-2 bg-gray-200 rounded-full mt-1">
              <div className="h-2 bg-green-500 rounded-full" style={{ width: `${(completeSections / totalSections) * 100}%` }} />
            </div>
          </div>
        )}
      </div>

      <FeatureGuidance
        title="Proposal Outline & Volume Builder"
        description="Organize your proposal response into volumes and sections mapped to RFP evaluation criteria. AI generates the structure and drafts proposal content based on your project analysis, win themes, and past performance."
        storageKey="proposal_outline"
        accentColor="indigo"
        steps={[
          { title: 'Generate outline from AI', description: 'Click "Generate with AI" to create a proposal outline based on your project analysis and Section L/M results.' },
          { title: 'Generate section drafts', description: 'Click the wand icon on any section to generate an AI proposal draft using your win themes, past performance, and requirements.' },
          { title: 'Customize and assign', description: 'Edit drafts inline, assign team members to each section, and track progress from Not Started → Complete.' },
        ]}
      />

      {volumes.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <BookOpen className="mx-auto text-gray-400 mb-3" size={48} />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">No Proposal Outline Yet</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            Generate an AI-powered proposal outline based on your project analysis and RFP evaluation criteria, or create one manually.
          </p>
          <button
            onClick={generateOutline}
            disabled={generating}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {generating ? <><Sparkles size={18} className="animate-pulse" /> Generating...</> : <><Sparkles size={18} /> Generate with AI</>}
          </button>
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg inline-flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={generateOutline}
              disabled={generating}
              className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <Sparkles size={14} /> {generating ? 'Regenerating...' : 'Regenerate Outline'}
            </button>
          </div>

          {volumes.map(volume => (
            <div key={volume.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedVolume(expandedVolume === volume.id ? null : volume.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <FileText size={18} className="text-indigo-500" />
                  <span className="font-semibold text-gray-900">{volume.name}</span>
                  <span className="text-xs text-gray-400">{volume.sections.length} sections</span>
                </div>
                {expandedVolume === volume.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {expandedVolume === volume.id && (
                <div className="border-t border-gray-100">
                  {volume.sections.map(section => {
                    const style = STATUS_STYLES[section.status]
                    const isEditing = editingSection === section.id
                    return (
                      <div key={section.id} className="border-b border-gray-50 last:border-0 px-5 py-3 hover:bg-gray-50/50">
                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              value={editForm.title || ''}
                              onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                              className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                              placeholder="Section title"
                            />
                            <textarea
                              value={editForm.description || ''}
                              onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                              className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                              rows={2}
                              placeholder="Section description"
                            />
                            <div className="flex gap-2">
                              <input
                                value={editForm.page_limit || ''}
                                onChange={e => setEditForm({ ...editForm, page_limit: e.target.value })}
                                className="w-32 px-3 py-1.5 border border-gray-300 rounded text-sm"
                                placeholder="Page limit"
                              />
                              <input
                                value={editForm.assigned_to || ''}
                                onChange={e => setEditForm({ ...editForm, assigned_to: e.target.value })}
                                className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm"
                                placeholder="Assigned to"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  updateSection(volume.id, section.id, editForm)
                                  setEditingSection(null)
                                }}
                                className="px-3 py-1 bg-indigo-600 text-white rounded text-xs flex items-center gap-1"
                              >
                                <Check size={12} /> Save
                              </button>
                              <button
                                onClick={() => setEditingSection(null)}
                                className="px-3 py-1 text-gray-500 hover:text-gray-700 text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                          <div className="flex items-start gap-3">
                            <GripVertical size={14} className="text-gray-300 mt-1 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm text-gray-900">{section.title}</span>
                                {section.page_limit && (
                                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">{section.page_limit}</span>
                                )}
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${style.bg} ${style.text}`}>{style.label}</span>
                                {section.assigned_to && (
                                  <span className="text-[10px] text-gray-400">→ {section.assigned_to}</span>
                                )}
                              </div>
                              {section.description && (
                                <p className="text-xs text-gray-500 mt-0.5">{section.description}</p>
                              )}
                              {section.eval_factors.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {section.eval_factors.map((f, i) => (
                                    <span key={i} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px]">{f}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => generateDraft(volume.id, section)}
                                disabled={draftingSection === section.id || !canDraft}
                                className={`p-1 ${canDraft ? 'text-purple-400 hover:text-purple-600' : 'text-gray-300 cursor-not-allowed'} disabled:animate-pulse`}
                                title={canDraft ? 'Generate AI Draft' : 'Enterprise feature — upgrade to unlock'}
                              >
                                <Wand2 size={12} />
                              </button>
                              {section.draft_content && (
                                <button
                                  onClick={() => setExpandedDraft(expandedDraft === section.id ? null : section.id)}
                                  className="p-1 text-blue-400 hover:text-blue-600"
                                  title={expandedDraft === section.id ? 'Hide draft' : 'View draft'}
                                >
                                  {expandedDraft === section.id ? <EyeOff size={12} /> : <Eye size={12} />}
                                </button>
                              )}
                              <select
                                value={section.status}
                                onChange={e => updateSection(volume.id, section.id, { status: e.target.value as VolumeSection['status'] })}
                                className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white"
                              >
                                <option value="not_started">Not Started</option>
                                <option value="drafting">Drafting</option>
                                <option value="review">In Review</option>
                                <option value="complete">Complete</option>
                              </select>
                              <button
                                onClick={() => { setEditingSection(section.id); setEditForm(section) }}
                                className="p-1 text-gray-400 hover:text-gray-600"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={() => removeSection(volume.id, section.id)}
                                className="p-1 text-gray-400 hover:text-red-500"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                          {draftingSection === section.id && (
                            <div className="mt-2 p-3 bg-purple-50 rounded-lg text-sm text-purple-700 flex items-center gap-2">
                              <Sparkles size={14} className="animate-pulse" />
                              Generating proposal draft for "{section.title}"...
                            </div>
                          )}
                          {expandedDraft === section.id && section.draft_content && (
                            <div className="mt-2 border border-gray-200 rounded-lg">
                              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200 rounded-t-lg">
                                <span className="text-xs font-medium text-gray-600">AI-Generated Draft</span>
                                <button
                                  onClick={() => { navigator.clipboard.writeText(section.draft_content || '') }}
                                  className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                                >
                                  <Copy size={10} /> Copy
                                </button>
                              </div>
                              <textarea
                                value={section.draft_content}
                                onChange={e => updateSection(volume.id, section.id, { draft_content: e.target.value })}
                                className="w-full px-3 py-2 text-sm text-gray-700 min-h-[200px] resize-y border-0 focus:ring-0 rounded-b-lg"
                              />
                            </div>
                          )}
                          </>
                        )}
                      </div>
                    )
                  })}
                  <button
                    onClick={() => addSection(volume.id)}
                    className="w-full px-5 py-2.5 text-sm text-indigo-600 hover:bg-indigo-50 flex items-center gap-2 justify-center"
                  >
                    <Plus size={14} /> Add Section
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
