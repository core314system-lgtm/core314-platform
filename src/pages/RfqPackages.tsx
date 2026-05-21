import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { loadAiOutput } from '../lib/aiStorage'
import type { RfqPackage, TaskOrder } from '../lib/types'
import { Package, ArrowLeft, ChevronDown, ChevronUp, Copy } from 'lucide-react'
import CitationBadge from '../components/CitationBadge'

export default function RfqPackages() {
  const { id } = useParams<{ id: string }>()
  const [taskOrder, setTaskOrder] = useState<TaskOrder | null>(null)
  const [packages, setPackages] = useState<RfqPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedPkg, setExpandedPkg] = useState<number | null>(0)

  useEffect(() => {
    if (id) {
      supabase.from('task_orders').select('*').eq('id', id).single().then(({ data }) => setTaskOrder(data))
      loadAiOutput<{ packages: RfqPackage[] }>(id, 'rfq_packages').then(data => {
        setPackages(data?.packages || [])
        setLoading(false)
      })
    }
  }, [id])

  function copyToClipboard(pkg: RfqPackage) {
    const text = `SUBCONTRACTOR RFQ - ${pkg.service_category}
Task Order: ${taskOrder?.title || ''}

SCOPE SUMMARY:
${pkg.scope_summary}

REQUIRED FREQUENCY:
${pkg.required_frequency}

SITE ASSUMPTIONS:
${pkg.site_assumptions}

EQUIPMENT/AREA DETAILS:
${pkg.equipment_details}

REQUIRED LICENSES & CERTIFICATIONS:
${pkg.licenses_certifications}

QUESTIONS FOR SUBCONTRACTOR:
${pkg.questions_for_subcontractor?.map((q, i) => `${i + 1}. ${q}`).join('\n') || 'None'}

DUE DATE FOR QUOTES:
${pkg.due_date_note}

QUOTE FORMAT:
${pkg.quote_format}

SALES TAX TREATMENT:
${pkg.sales_tax_treatment}

${pkg.partnership_language}
`
    navigator.clipboard.writeText(text)
    alert('Copied to clipboard!')
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/projects/${id}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1 mb-1">
          <ArrowLeft size={14} /> Back to {taskOrder?.title || 'Project'}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="text-orange-600" size={24} /> Subcontractor RFQ Packages
        </h1>
        <p className="text-sm text-gray-500 mt-1">{packages.length} service categories identified</p>
      </div>

      {packages.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Package className="mx-auto text-gray-400 mb-3" size={40} />
          <p className="text-gray-500">No RFQ packages generated yet.</p>
          <Link to={`/projects/${id}`} className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            Go to Project
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {packages.map((pkg, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <button
                onClick={() => setExpandedPkg(expandedPkg === i ? null : i)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50"
              >
                <div>
                  <h3 className="font-semibold text-gray-900">{pkg.service_category}</h3>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-1">{pkg.scope_summary}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); copyToClipboard(pkg) }}
                    className="text-gray-400 hover:text-blue-600 p-1"
                    title="Copy to clipboard"
                  >
                    <Copy size={16} />
                  </button>
                  {expandedPkg === i ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                </div>
              </button>

              {expandedPkg === i && (
                <div className="px-6 pb-6 border-t border-gray-100 pt-4 space-y-4">
                  <Section title="Scope Summary" content={pkg.scope_summary} />
                  {pkg.source_references && pkg.source_references.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-gray-500">Source:</span>
                      {pkg.source_references.map((ref, ri) => (
                        <CitationBadge key={ri} sourceDocument={ref.document} pageSection={ref.page_section} compact />
                      ))}
                    </div>
                  )}
                  <Section title="Required Frequency" content={pkg.required_frequency} />
                  <Section title="Site Assumptions" content={pkg.site_assumptions} />
                  <Section title="Equipment / Area Details" content={pkg.equipment_details} />
                  <Section title="Required Licenses & Certifications" content={pkg.licenses_certifications} />

                  {pkg.questions_for_subcontractor?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Questions for Subcontractor</h4>
                      <ol className="list-decimal list-inside space-y-1">
                        {pkg.questions_for_subcontractor.map((q, qi) => (
                          <li key={qi} className="text-sm text-gray-600">{q}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  <Section title="Due Date for Quotes" content={pkg.due_date_note} />
                  <Section title="Quote Format" content={pkg.quote_format} />
                  <Section title="Sales Tax Treatment" content={pkg.sales_tax_treatment} />

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs text-blue-700">{pkg.partnership_language}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Section({ title, content }: { title: string; content: string }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-1">{title}</h4>
      <p className="text-sm text-gray-600">{content}</p>
    </div>
  )
}
