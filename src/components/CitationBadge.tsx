import { FileText, Table } from 'lucide-react'

interface CitationBadgeProps {
  sourceDocument: string
  pageSection?: string
  compact?: boolean
}

export default function CitationBadge({ sourceDocument, pageSection, compact = false }: CitationBadgeProps) {
  if (!sourceDocument) return null

  const isSpreadsheet = /\.(xlsx?|csv)$/i.test(sourceDocument) || /^Sheet:/i.test(pageSection || '')
  const Icon = isSpreadsheet ? Table : FileText

  const docName = sourceDocument.length > 40
    ? sourceDocument.slice(0, 37) + '...'
    : sourceDocument

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5 font-medium" title={`${sourceDocument}${pageSection ? ' — ' + pageSection : ''}`}>
        <Icon size={10} className="text-indigo-500 flex-shrink-0" />
        {pageSection || docName}
      </span>
    )
  }

  return (
    <div className="inline-flex flex-col gap-0.5">
      <span className="inline-flex items-center gap-1.5 text-xs text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-md px-2 py-1 font-medium">
        <Icon size={12} className="text-indigo-500 flex-shrink-0" />
        <span className="truncate max-w-[200px]" title={sourceDocument}>{docName}</span>
      </span>
      {pageSection && (
        <span className="text-[10px] text-indigo-600 font-medium pl-0.5 leading-tight" title={pageSection}>
          {pageSection}
        </span>
      )}
    </div>
  )
}
