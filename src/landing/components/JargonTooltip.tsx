import { useState } from 'react'

const GLOSSARY: Record<string, string> = {
  FAR: 'Federal Acquisition Regulation — the rules governing how the federal government buys goods and services.',
  DFARS: 'Defense Federal Acquisition Regulation Supplement — additional rules for Department of Defense contracts.',
  SOW: 'Statement of Work — a document that describes the tasks, deliverables, and timeline required under a contract.',
  NAICS: 'North American Industry Classification System — a 6-digit code that classifies businesses by industry.',
  RFP: 'Request for Proposal — a solicitation asking vendors to submit a formal proposal for a project or service.',
  RFQ: 'Request for Quote — a solicitation asking vendors to submit pricing for specific goods or services.',
  'SAM.gov': 'System for Award Management — the federal database where contractors register and opportunities are posted.',
  CUI: 'Controlled Unclassified Information — sensitive but unclassified government data that requires safeguarding.',
  ITAR: 'International Traffic in Arms Regulations — controls the export and import of defense-related articles and services.',
  'FedRAMP': 'Federal Risk and Authorization Management Program — a government-wide program that provides a standardized approach to security assessment for cloud products.',
  'SOC 2': 'Service Organization Control 2 — a framework for managing customer data based on trust service criteria.',
}

export default function JargonTooltip({ term, children }: { term: string; children?: React.ReactNode }) {
  const [show, setShow] = useState(false)
  const definition = GLOSSARY[term]
  if (!definition) return <>{children || term}</>

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className="border-b border-dotted border-current cursor-help">
        {children || term}
      </span>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-slate-900 text-white text-xs leading-relaxed rounded-lg shadow-xl z-50 pointer-events-none">
          <span className="font-semibold text-blue-300">{term}</span>
          <br />
          {definition}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-900" />
        </span>
      )}
    </span>
  )
}
