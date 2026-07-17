import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { saveAiOutput, loadAiOutput } from '../lib/aiStorage'
import { fetchAIProxy } from '../lib/api'
import {
  BookOpen, ArrowLeft, Sparkles, FileText, ChevronDown, ChevronUp,
  GripVertical, Plus, Trash2, Edit2, Check, AlertTriangle, Wand2, Copy,
  Eye, EyeOff, Download,
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
  const [draftingAll, setDraftingAll] = useState(false)
  const [draftProgress, setDraftProgress] = useState({ done: 0, total: 0 })
  const [compiling, setCompiling] = useState(false)
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
      const [analysis, winThemes, pastPerf, sectionLM, complianceData, compIntel] = await Promise.all([
        loadAiOutput<{ requirements: { text: string; category: string }[]; summary: string }>(projectId, 'analysis'),
        loadAiOutput<{ themes: { theme: string; evidence: string }[] }>(projectId, 'win_themes'),
        loadAiOutput<{ citations: { title: string; relevance: string; agency?: string; contract_value?: string }[] }>(projectId, 'past_performance_match'),
        loadAiOutput<{ evaluation_factors: { factor_name: string; weight: string; description?: string }[]; proposal_outline: { volume: string; section: string }[] }>(projectId, 'section_lm_analysis'),
        loadAiOutput<{ items: { requirement: string; source: string; compliance_status: string; risk_level: string }[] }>(projectId, 'compliance_matrix'),
        loadAiOutput<{ competitors: { name: string; strengths: string[]; weaknesses: string[] }[] }>(projectId, 'competitive_intel'),
      ])

      const relevantRequirements = complianceData?.items
        ?.filter(item => item.requirement && (item.risk_level === 'High' || item.risk_level === 'Medium'))
        ?.slice(0, 8)

      const volumeName = volumes.find(v => v.id === volumeId)?.name || ''

      const context = [
        `# PROPOSAL SECTION TO DRAFT`,
        `Project: ${projectTitle}`,
        `Volume: ${volumeName}`,
        `Section Title: ${section.title}`,
        `Section Description: ${section.description}`,
        section.page_limit ? `Page Limit: ${section.page_limit} pages` : '',
        section.eval_factors.length > 0 ? `\n# EVALUATION FACTORS FOR THIS SECTION\n${section.eval_factors.map(f => `- ${f}`).join('\n')}` : '',
        sectionLM?.evaluation_factors ? `\n# RFP EVALUATION CRITERIA (from Section M)\n${sectionLM.evaluation_factors.map(f => `- ${f.factor_name} (Weight: ${f.weight})${f.description ? ` — ${f.description}` : ''}`).join('\n')}` : '',
        analysis?.summary ? `\n# PROJECT CONTEXT\n${analysis.summary}` : '',
        winThemes?.themes ? `\n# WIN THEMES (must be reinforced in this section)\n${winThemes.themes.map(t => `- THEME: ${t.theme}\n  EVIDENCE: ${t.evidence}`).join('\n')}` : '',
        pastPerf?.citations && pastPerf.citations.length > 0
          ? `\n# PAST PERFORMANCE CITATIONS (weave naturally into narrative)\n${pastPerf.citations.slice(0, 4).map(c => `- ${c.title}${c.agency ? ` (${c.agency})` : ''}${c.contract_value ? ` — $${c.contract_value}` : ''}: ${c.relevance}`).join('\n')}`
          : `\n# PAST PERFORMANCE DATA STATUS\nNO past performance citations are available for this project. You MUST NOT invent, name, or describe any specific past contract, agency, client, dollar value, date, personnel name, or performance metric (e.g. satisfaction ratings, cost/time reductions, response times, award counts). This applies even if the Section Title or Section Description asks for "examples", "references", or "metrics" — the absence of data overrides any such instruction. If this is a past performance section, write ONLY about the organization's methodology for identifying and presenting relevant past performance, and use explicit bracketed placeholders such as [Contract Title], [Agency], [Period of Performance], [Metric] for any specifics the user must supply. Never substitute a fabricated value for a placeholder.`,
        relevantRequirements && relevantRequirements.length > 0 ? `\n# KEY COMPLIANCE REQUIREMENTS (from Compliance Matrix — must address)\n${relevantRequirements.map(r => `- [${r.risk_level}] ${r.requirement} (Source: ${r.source})`).join('\n')}` : '',
        analysis?.requirements ? `\n# SOW/PWS REQUIREMENTS\n${analysis.requirements.slice(0, 12).map(r => `- [${r.category}] ${r.text}`).join('\n')}` : '',
        compIntel?.competitors ? `\n# COMPETITIVE LANDSCAPE (ghost weaknesses, emphasize our differentiators)\n${compIntel.competitors.slice(0, 3).map(c => `- ${c.name}: Strengths=[${c.strengths?.slice(0, 2).join(', ')}] Weaknesses=[${c.weaknesses?.slice(0, 2).join(', ')}]`).join('\n')}` : '',
      ].filter(Boolean).join('\n')

      const shipleySystemPrompt = `You are a senior GovCon proposal writer trained in the Shipley Business Development Lifecycle and APMP (Association of Proposal Management Professionals) best practices.

## ABSOLUTE RULE — ZERO FABRICATION

**You must NEVER invent, fabricate, or assume ANY information that is not explicitly provided in the context below.** This includes:
- Statistics, percentages, metrics, or numbers (e.g., "20% reduction", "99% uptime")
- Contract names, agency names, dates, dollar values
- Past performance claims or results not provided in the PAST PERFORMANCE CITATIONS section
- Personnel names, qualifications, or certifications not provided
- Timelines, schedules, or milestones not stated in the requirements

If specific evidence, metrics, or past performance data is NOT provided in the context, do NOT reference it at all. Instead, describe your approach, methodology, and how the requirement will be fulfilled. The absence of data means you write about your plan and process — never invent proof.

## WRITING METHODOLOGY — SHIPLEY PROPOSAL STANDARDS

### 1. COMPLIANCE FIRST — ANSWER EVERY REQUIREMENT
Your primary job is to ensure EVERY requirement from the SOW/PWS is addressed. For each requirement:
- State exactly **how** it will be executed (specific approach/methodology)
- State **who** will perform it (if personnel/roles are provided in context)
- State **when** it will occur (if timelines are provided in context)
- State **where** it will be performed (if location details are in context)
- If who/when/where are not in the provided data, focus on the HOW with enough detail that evaluators see a credible plan

### 2. THEME STATEMENT (Required — First Element)
Open EVERY section with a **bolded theme statement** (1-2 sentences) that:
- Directly ties your approach to the government's evaluation criteria
- Uses the exact terminology from the RFP/SOW (mirror their language)
- States a clear discriminator drawn from the WIN THEMES provided (if available)

### 3. FEATURES → BENEFITS STRUCTURE
For each major point:
- **Feature**: What you will do — your specific approach to meeting the requirement
- **Benefit**: Why it matters to the government — mission impact, risk reduction, operational improvement

Only add a **Proof** element if specific past performance data is provided in the PAST PERFORMANCE CITATIONS context. If citations exist, reference them by their exact title and agency as provided. If no citations are provided, omit the proof element entirely — do NOT fabricate one.

### 4. EVALUATION CRITERIA ALIGNMENT
- Structure your response to DIRECTLY map to the evaluation factors listed
- Use **headers that mirror evaluation criteria labels** so evaluators can easily find and score content
- Bold key compliance phrases that demonstrate you meet requirements
- Every "shall" from the SOW must be explicitly addressed

### 5. PAST PERFORMANCE THREADING (ONLY from provided data)
- ONLY reference past performance if citations are provided in the PAST PERFORMANCE CITATIONS section below
- Use the EXACT title, agency, and contract details as given — do not embellish or add metrics not stated
- If relevance descriptions are provided, paraphrase them naturally into the narrative
- If NO past performance citations are provided, do NOT fabricate example contracts, agencies, clients, or metrics — even if the section asks for "examples" or "metrics". Instead describe the organization's approach to presenting relevant past performance and use explicit bracketed placeholders (e.g. [Contract Title], [Agency], [Metric]) for details the user must supply

### 6. COMPETITIVE POSITIONING (ONLY from provided data)
- Only reference competitive positioning if COMPETITIVE LANDSCAPE data is provided below
- Highlight differentiators based on actual weaknesses listed for competitors
- Never name competitors directly
- If no competitive data is provided, skip ghosting entirely

### 7. WIN THEME REINFORCEMENT
- Reinforce win themes ONLY if they are provided in the WIN THEMES section below
- Use the exact theme language and evidence as provided
- Do not invent additional themes

### 8. GOVERNMENT EVALUATOR PSYCHOLOGY
- **Make it easy to score**: Use clear headers, numbered lists for multi-part requirements
- **Reduce evaluator workload**: Bold key compliance language
- **Show risk mitigation**: Describe specific mitigation approaches for identified risks
- Write with substance and specificity about your approach — but only cite facts that are provided

### 9. PAGE LIMIT AWARENESS
- If a page limit is specified, calibrate content length accordingly (~400 words per page)
- Prioritize quality over quantity — every sentence must earn its place
- Use tables and bullet points to maximize information density within constraints

### 10. FORMATTING STANDARDS
- Use **bold** for theme statements, key terms, and compliance phrases
- Use numbered lists for sequential processes or multi-step approaches
- Use bullet points for capabilities, qualifications, and feature lists
- Use headers (## or ###) to organize by evaluation criteria

## OUTPUT FORMAT
Return ONLY the proposal section text in Markdown. Do not include JSON, metadata, or instructions. Every claim must be traceable to data provided in the context. Write a thorough, compliant response that addresses every stated requirement.`

      const res = await fetchAIProxy({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: shipleySystemPrompt },
          { role: 'user', content: context },
        ],
        temperature: 0.35,
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

  async function generateAllDrafts() {
    if (!projectId || !canDraft) return
    setDraftingAll(true)
    const allSections = volumes.flatMap(v => v.sections.map(s => ({ volumeId: v.id, section: s })))
    const undrafted = allSections.filter(({ section }) => !section.draft_content)
    setDraftProgress({ done: 0, total: undrafted.length })

    for (let i = 0; i < undrafted.length; i++) {
      const { volumeId, section } = undrafted[i]
      await generateDraft(volumeId, section)
      setDraftProgress({ done: i + 1, total: undrafted.length })
    }
    setDraftingAll(false)
  }

  async function compileProposal() {
    if (draftedSections === 0) { alert('No drafted sections to compile. Generate drafts first.'); return }
    setCompiling(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'pt', format: 'letter' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const margin = 72
      const contentWidth = pageWidth - margin * 2
      let y = margin

      const addPageIfNeeded = (needed: number) => {
        if (y + needed > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage()
          y = margin
        }
      }

      // Title page
      doc.setFontSize(24)
      doc.setFont('helvetica', 'bold')
      y = 200
      const titleLines = doc.splitTextToSize(projectTitle || 'Proposal', contentWidth)
      doc.text(titleLines, pageWidth / 2, y, { align: 'center' })
      y += titleLines.length * 30 + 20
      doc.setFontSize(14)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 100, 100)
      doc.text('Proposal Document', pageWidth / 2, y, { align: 'center' })
      y += 30
      doc.setFontSize(11)
      doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth / 2, y, { align: 'center' })
      doc.setTextColor(0, 0, 0)

      // Table of Contents
      doc.addPage()
      y = margin
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('Table of Contents', margin, y)
      y += 30
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      for (const volume of volumes) {
        doc.setFont('helvetica', 'bold')
        doc.text(volume.name, margin, y)
        y += 18
        doc.setFont('helvetica', 'normal')
        for (const section of volume.sections) {
          doc.text(`    ${section.title}${section.draft_content ? '' : ' (no draft)'}`, margin, y)
          y += 15
          addPageIfNeeded(15)
        }
        y += 6
      }

      // Volume content
      for (const volume of volumes) {
        doc.addPage()
        y = margin

        // Volume heading
        doc.setFontSize(18)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(30, 58, 95)
        const volLines = doc.splitTextToSize(volume.name, contentWidth)
        doc.text(volLines, margin, y)
        y += volLines.length * 22 + 10
        doc.setDrawColor(30, 58, 95)
        doc.setLineWidth(2)
        doc.line(margin, y, pageWidth - margin, y)
        y += 20
        doc.setTextColor(0, 0, 0)

        for (const section of volume.sections) {
          addPageIfNeeded(60)

          // Section heading
          doc.setFontSize(14)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(45, 85, 140)
          doc.text(section.title, margin, y)
          y += 20
          doc.setTextColor(0, 0, 0)

          if (section.page_limit) {
            doc.setFontSize(9)
            doc.setFont('helvetica', 'italic')
            doc.setTextColor(120, 120, 120)
            doc.text(`Page Limit: ${section.page_limit}`, margin, y)
            y += 14
            doc.setTextColor(0, 0, 0)
          }

          if (section.draft_content) {
            doc.setFontSize(11)
            doc.setFont('helvetica', 'normal')
            const paragraphs = section.draft_content.split('\n')
            for (const para of paragraphs) {
              if (!para.trim()) { y += 6; continue }
              const isBullet = para.trim().startsWith('- ') || para.trim().startsWith('• ')
              const isHeading = para.trim().startsWith('#')
              if (isHeading) {
                addPageIfNeeded(24)
                doc.setFontSize(12)
                doc.setFont('helvetica', 'bold')
                doc.text(para.replace(/^#+\s*/, ''), margin, y)
                y += 18
                doc.setFontSize(11)
                doc.setFont('helvetica', 'normal')
              } else if (isBullet) {
                const bulletText = para.trim().replace(/^[-•]\s*/, '')
                const bulletLines = doc.splitTextToSize(bulletText, contentWidth - 20)
                addPageIfNeeded(bulletLines.length * 14 + 4)
                doc.text('•', margin + 10, y)
                doc.text(bulletLines, margin + 22, y)
                y += bulletLines.length * 14 + 4
              } else {
                const paraLines = doc.splitTextToSize(para, contentWidth)
                addPageIfNeeded(paraLines.length * 14 + 4)
                doc.text(paraLines, margin, y)
                y += paraLines.length * 14 + 8
              }
            }
          } else {
            doc.setFontSize(10)
            doc.setFont('helvetica', 'italic')
            doc.setTextColor(150, 150, 150)
            doc.text('[Draft not yet generated for this section]', margin, y)
            y += 16
            doc.setTextColor(0, 0, 0)
          }
          y += 16
        }
      }

      doc.save(`Proposal_${projectTitle?.replace(/\s+/g, '_') || 'export'}.pdf`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Compile failed')
    } finally {
      setCompiling(false)
    }
  }

  async function compileProposalWord() {
    if (draftedSections === 0) { alert('No drafted sections to compile. Generate drafts first.'); return }
    setCompiling(true)
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak, TableOfContents, BorderStyle } = await import('docx')
      const { saveAs } = await import('file-saver')

      const titlePage = [
        new Paragraph({ spacing: { before: 3000 } }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [new TextRun({ text: projectTitle || 'Proposal', bold: true, size: 56, font: 'Calibri' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: 'Proposal Document', size: 28, color: '666666', font: 'Calibri' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, size: 22, color: '999999', font: 'Calibri' })],
        }),
        new Paragraph({ children: [new PageBreak()] }),
      ]

      const tocSection = [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'Table of Contents', bold: true })] }),
        new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-3' }),
        new Paragraph({ children: [new PageBreak()] }),
      ]

      const contentSections: (typeof Paragraph extends new (...args: infer _) => infer R ? R : never)[] = []
      for (const volume of volumes) {
        contentSections.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
            children: [new TextRun({ text: volume.name, bold: true, size: 32, font: 'Calibri' })],
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1E3A5F' } },
          })
        )

        for (const section of volume.sections) {
          contentSections.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 100 },
              children: [new TextRun({ text: section.title, bold: true, size: 26, font: 'Calibri', color: '2D558C' })],
            })
          )

          if (section.page_limit) {
            contentSections.push(
              new Paragraph({
                spacing: { after: 100 },
                children: [new TextRun({ text: `Page Limit: ${section.page_limit}`, italics: true, size: 18, color: '888888' })],
              })
            )
          }

          if (section.draft_content) {
            const paragraphs = section.draft_content.split('\n')
            for (const para of paragraphs) {
              if (!para.trim()) { contentSections.push(new Paragraph({ spacing: { after: 100 } })); continue }
              const trimmed = para.trim()
              if (trimmed.startsWith('### ')) {
                contentSections.push(new Paragraph({
                  heading: HeadingLevel.HEADING_3,
                  spacing: { before: 200, after: 80 },
                  children: [new TextRun({ text: trimmed.replace(/^###\s*/, ''), bold: true, size: 22 })],
                }))
              } else if (trimmed.startsWith('## ')) {
                contentSections.push(new Paragraph({
                  heading: HeadingLevel.HEADING_2,
                  spacing: { before: 240, after: 100 },
                  children: [new TextRun({ text: trimmed.replace(/^##\s*/, ''), bold: true, size: 24 })],
                }))
              } else if (trimmed.startsWith('# ')) {
                contentSections.push(new Paragraph({
                  heading: HeadingLevel.HEADING_1,
                  spacing: { before: 280, after: 120 },
                  children: [new TextRun({ text: trimmed.replace(/^#\s*/, ''), bold: true, size: 28 })],
                }))
              } else if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
                const bulletText = trimmed.replace(/^[-•]\s*/, '')
                const runs: InstanceType<typeof TextRun>[] = []
                const boldParts = bulletText.split(/\*\*(.*?)\*\*/)
                for (let i = 0; i < boldParts.length; i++) {
                  if (boldParts[i]) runs.push(new TextRun({ text: boldParts[i], bold: i % 2 === 1, size: 22 }))
                }
                contentSections.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: runs }))
              } else if (/^\d+\.\s/.test(trimmed)) {
                const numText = trimmed.replace(/^\d+\.\s*/, '')
                const runs: InstanceType<typeof TextRun>[] = []
                const boldParts = numText.split(/\*\*(.*?)\*\*/)
                for (let i = 0; i < boldParts.length; i++) {
                  if (boldParts[i]) runs.push(new TextRun({ text: boldParts[i], bold: i % 2 === 1, size: 22 }))
                }
                contentSections.push(new Paragraph({ numbering: { reference: 'proposal-numbering', level: 0 }, spacing: { after: 60 }, children: runs }))
              } else {
                const runs: InstanceType<typeof TextRun>[] = []
                const boldParts = trimmed.split(/\*\*(.*?)\*\*/)
                for (let i = 0; i < boldParts.length; i++) {
                  if (boldParts[i]) runs.push(new TextRun({ text: boldParts[i], bold: i % 2 === 1, size: 22 }))
                }
                contentSections.push(new Paragraph({ spacing: { after: 120 }, children: runs }))
              }
            }
          } else {
            contentSections.push(
              new Paragraph({
                spacing: { after: 200 },
                children: [new TextRun({ text: '[Draft not yet generated for this section]', italics: true, size: 20, color: 'AAAAAA' })],
              })
            )
          }
        }
      }

      const doc = new Document({
        features: { updateFields: true },
        numbering: {
          config: [{
            reference: 'proposal-numbering',
            levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.LEFT }],
          }],
        },
        sections: [{
          properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
          children: [...titlePage, ...tocSection, ...contentSections],
        }],
      })

      const blob = await Packer.toBlob(doc)
      saveAs(blob, `Proposal_${projectTitle?.replace(/\s+/g, '_') || 'export'}.docx`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Word export failed')
    } finally {
      setCompiling(false)
    }
  }

  const totalSections = volumes.reduce((sum, v) => sum + v.sections.length, 0)
  const completeSections = volumes.reduce((sum, v) => sum + v.sections.filter(s => s.status === 'complete').length, 0)
  const draftedSections = volumes.reduce((sum, v) => sum + v.sections.filter(s => s.draft_content).length, 0)

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
          { title: 'Generate section drafts', description: 'Click "Generate All Drafts" to draft every section at once, or click the "Draft" button on individual sections. AI uses your win themes, past performance, and requirements.' },
          { title: 'Customize and assign', description: 'Edit drafts inline, assign team members to each section, and track progress from Not Started → Complete.' },
          { title: 'Compile & download', description: 'Click "Compile Proposal PDF" to assemble all drafted sections into a formatted, downloadable proposal document with title page and table of contents.' },
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {canDraft ? (
                <button
                  onClick={generateAllDrafts}
                  disabled={draftingAll || draftingSection !== null}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium text-sm hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 shadow-sm"
                >
                  <Wand2 size={16} />
                  {draftingAll ? `Generating ${draftProgress.done}/${draftProgress.total}...` : 'Generate All Drafts'}
                </button>
              ) : (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-400 rounded-lg text-sm">
                  <Wand2 size={16} />
                  Draft Generation — <Link to="/billing" className="text-purple-600 underline">Enterprise Feature</Link>
                </div>
              )}
              {draftedSections > 0 && (
                <span className="text-xs text-gray-500">{draftedSections}/{totalSections} sections drafted</span>
              )}
              {draftedSections > 0 && (
                <div className="inline-flex items-center gap-1 bg-emerald-600 rounded-lg shadow-sm overflow-hidden">
                  <button
                    onClick={compileProposal}
                    disabled={compiling}
                    className="inline-flex items-center gap-2 px-4 py-2 text-white font-medium text-sm hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Download size={16} />
                    {compiling ? 'Compiling...' : 'PDF'}
                  </button>
                  <div className="w-px h-6 bg-emerald-500" />
                  <button
                    onClick={compileProposalWord}
                    disabled={compiling}
                    className="inline-flex items-center gap-2 px-4 py-2 text-white font-medium text-sm hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <FileText size={16} />
                    Word
                  </button>
                </div>
              )}
            </div>
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
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {canDraft ? (
                                <button
                                  onClick={() => generateDraft(volume.id, section)}
                                  disabled={draftingSection === section.id || draftingAll}
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                                    section.draft_content
                                      ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                                      : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                                  } disabled:opacity-50`}
                                  title={section.draft_content ? 'Regenerate AI Draft' : 'Generate AI Draft'}
                                >
                                  <Wand2 size={12} />
                                  {section.draft_content ? 'Redraft' : 'Draft'}
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold text-purple-500 bg-purple-50 border border-purple-100" title="Enterprise feature — upgrade to unlock">
                                  <Wand2 size={10} /> ENT
                                </span>
                              )}
                              {section.draft_content && (
                                <button
                                  onClick={() => setExpandedDraft(expandedDraft === section.id ? null : section.id)}
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs border transition-colors ${
                                    expandedDraft === section.id
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                                  }`}
                                  title={expandedDraft === section.id ? 'Hide draft' : 'View draft'}
                                >
                                  {expandedDraft === section.id ? <><EyeOff size={12} /> Hide</> : <><Eye size={12} /> View</>}
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
                              <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 flex items-start gap-2">
                                <AlertTriangle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                                <span className="text-[11px] text-amber-800">
                                  AI-generated content — review and verify all statements before submission. Ensure claims align with your actual past performance and capabilities.
                                </span>
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
