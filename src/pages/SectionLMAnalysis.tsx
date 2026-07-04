import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  BookOpen, ArrowLeft, Sparkles, FileText,
  CheckCircle, AlertTriangle, ChevronDown, ChevronUp,
} from 'lucide-react'
import FeatureGuidance from '../components/FeatureGuidance'

interface EvalFactor {
  id: string
  factor_name: string
  weight: string
  subfactors: string[]
  section_reference: string
  proposal_section: string
  requirements: string[]
  status: 'not_started' | 'in_progress' | 'complete'
}

interface AnalysisResult {
  evaluation_factors: EvalFactor[]
  proposal_outline: ProposalSection[]
  key_instructions: string[]
  page_limits: Record<string, string>
  submission_requirements: string[]
  warnings: string[]
}

interface ProposalSection {
  volume: string
  section: string
  description: string
  page_limit: string | null
  eval_factor_refs: string[]
}

export default function SectionLMAnalysis() {
  const { id: projectId } = useParams<{ id: string }>()
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [pastedText, setPastedText] = useState('')
  const [expandedFactor, setExpandedFactor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function analyzeDocument() {
    if (!pastedText.trim()) return
    setAnalyzing(true)
    setError(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch('/.netlify/functions/ai-section-lm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          task_order_id: projectId,
          section_text: pastedText,
        }),
      })

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`)
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/projects/${projectId}`} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} className="text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="text-blue-600" size={28} />
            Section L/M Analysis
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">AI-powered extraction of evaluation criteria and proposal structure from RFP Section L &amp; M</p>
        </div>
      </div>

      {!result ? (
        /* Input Phase */
        <div className="space-y-6">
          <FeatureGuidance
            title="Section L/M Analysis"
            description="Paste the text from your RFP's Section L (Instructions to Offerors) and Section M (Evaluation Criteria). The AI will extract and structure the evaluation factors, proposal requirements, and page limits."
            storageKey="section_lm"
            accentColor="blue"
            steps={[
              { title: 'Copy Section L & M from your RFP', description: 'Open your RFP document and copy the full text of Section L and/or Section M. Include all evaluation factors, subfactors, and instructions.' },
              { title: 'Paste into the text area below', description: 'Paste the copied text into the large text field. The more complete the text, the better the analysis.' },
              { title: 'Click "Analyze with AI"', description: 'The AI will parse the text and extract evaluation factors with relative weights, proposal outline, page limits, submission requirements, and compliance warnings.' },
              { title: 'Review the structured output', description: 'Use the extracted factors to build your compliance matrix, assign writing sections, and ensure your proposal addresses every evaluation criterion.' },
            ]}
          />
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Paste Section L/M Text</h2>
            <p className="text-sm text-gray-500 mb-4">
              Paste the text from Section L (Instructions to Offerors) and/or Section M (Evaluation Criteria) of your RFP.
              The AI will extract evaluation factors, generate a proposal outline, and map requirements.
            </p>

            <textarea
              value={pastedText}
              onChange={e => setPastedText(e.target.value)}
              rows={16}
              placeholder={`Paste Section L and/or Section M text here...\n\nExample:\nSECTION L - INSTRUCTIONS TO OFFERORS\n\nL.1 General Instructions\nOfferors shall submit proposals in the following volumes:\n  Volume I - Technical Approach (50 page limit)\n  Volume II - Management Approach (30 page limit)\n  Volume III - Past Performance (20 page limit)\n  Volume IV - Cost/Price (no page limit)\n\nSECTION M - EVALUATION CRITERIA\n\nM.1 Evaluation Factors\nThe following factors will be used to evaluate proposals:\n  Factor 1: Technical Approach (Most Important)\n  Factor 2: Management Approach (Important)\n  Factor 3: Past Performance (Important)\n  Factor 4: Cost/Price (Least Important)`}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none resize-none"
            />

            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-gray-400">
                {pastedText.length.toLocaleString()} characters
              </span>
              <button
                onClick={analyzeDocument}
                disabled={analyzing || !pastedText.trim()}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {analyzing ? (
                  <><Sparkles size={16} className="animate-pulse" /> Analyzing...</>
                ) : (
                  <><Sparkles size={16} /> Analyze with AI</>
                )}
              </button>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-500" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">What the AI extracts:</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li className="flex items-center gap-2"><CheckCircle size={14} /> Evaluation factors and subfactors with relative weights</li>
              <li className="flex items-center gap-2"><CheckCircle size={14} /> Proposal outline mapped to evaluation criteria</li>
              <li className="flex items-center gap-2"><CheckCircle size={14} /> Page limits and formatting requirements per volume</li>
              <li className="flex items-center gap-2"><CheckCircle size={14} /> Key instructions and submission requirements</li>
              <li className="flex items-center gap-2"><CheckCircle size={14} /> Warnings about common compliance traps</li>
            </ul>
          </div>
        </div>
      ) : (
        /* Results Phase */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Analysis Results</h2>
            <button
              onClick={() => { setResult(null); setPastedText('') }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Analyze Another Document
            </button>
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                <AlertTriangle size={16} /> Compliance Warnings
              </h3>
              <ul className="space-y-1">
                {result.warnings.map((w, i) => (
                  <li key={i} className="text-sm text-amber-700">&bull; {w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Evaluation Factors */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Evaluation Factors (Section M)</h3>
            <div className="space-y-2">
              {result.evaluation_factors.map(factor => (
                <div key={factor.id} className="border border-gray-200 rounded-lg">
                  <button
                    onClick={() => setExpandedFactor(expandedFactor === factor.id ? null : factor.id)}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-sm text-gray-900">{factor.factor_name}</span>
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">{factor.weight}</span>
                      <span className="text-xs text-gray-400">Section {factor.section_reference}</span>
                    </div>
                    {expandedFactor === factor.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {expandedFactor === factor.id && (
                    <div className="border-t border-gray-100 p-3 space-y-3">
                      {factor.subfactors.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Subfactors</h4>
                          <ul className="text-sm text-gray-700 space-y-0.5">
                            {factor.subfactors.map((sf, i) => <li key={i}>&bull; {sf}</li>)}
                          </ul>
                        </div>
                      )}
                      {factor.requirements.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Requirements</h4>
                          <ul className="text-sm text-gray-700 space-y-0.5">
                            {factor.requirements.map((r, i) => <li key={i}>&bull; {r}</li>)}
                          </ul>
                        </div>
                      )}
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Maps to Proposal Section</h4>
                        <p className="text-sm text-gray-700">{factor.proposal_section}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Proposal Outline */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Recommended Proposal Outline</h3>
            <div className="space-y-2">
              {result.proposal_outline.map((section, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <FileText size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-500">{section.volume}</span>
                      <span className="font-medium text-sm text-gray-900">{section.section}</span>
                      {section.page_limit && (
                        <span className="px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded text-[10px]">{section.page_limit}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">{section.description}</p>
                    {section.eval_factor_refs.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {section.eval_factor_refs.map((ref, j) => (
                          <span key={j} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px]">
                            Addresses: {ref}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Key Instructions */}
          {result.key_instructions.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Key Instructions (Section L)</h3>
              <ul className="space-y-1">
                {result.key_instructions.map((inst, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                    <CheckCircle size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                    {inst}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Submission Requirements */}
          {result.submission_requirements.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Submission Requirements</h3>
              <ul className="space-y-1">
                {result.submission_requirements.map((req, i) => (
                  <li key={i} className="text-sm text-gray-700">&bull; {req}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
