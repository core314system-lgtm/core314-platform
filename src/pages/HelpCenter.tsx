import { useState } from 'react'
import { Search, ChevronDown, ChevronUp, BookOpen, Upload, Brain, Users, BarChart3, Download, MessageCircle, HelpCircle, ClipboardList, Shield } from 'lucide-react'

interface FaqItem {
  question: string
  answer: string
}

interface HelpSection {
  id: string
  title: string
  icon: React.ElementType
  description: string
  steps?: string[]
  faqs: FaqItem[]
}

const helpSections: HelpSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: BookOpen,
    description: 'Learn the basics of the Procuvex platform and how to navigate the system.',
    steps: [
      'Log in with your credentials at the login page.',
      'Set up your Subcontractor Database first — go to "Subcontractors" in the sidebar and add your vendors manually or import from an Excel/CSV file.',
      'Create a new project — go to "Projects" and click "New Project".',
      'Upload all project documents (SOWs, pricing sheets, exhibits, amendments, etc.).',
      'Run AI Analysis to extract requirements, identify service categories, and generate outputs.',
      'Review the generated outputs: Compliance Matrix, RFQ Packages, Clarification Questions, Pricing Risks, Executive Summary.',
      'Use the SOW Bid Management system to track subcontractor quotes and bids.',
      'Export reports for your team (Excel, PDF, PowerPoint).',
    ],
    faqs: [
      {
        question: 'What is the overall workflow?',
        answer: 'The platform follows this workflow: (1) Build your subcontractor database, (2) Create procurement projects, (3) Upload all associated documents, (4) Run AI analysis to extract requirements and generate outputs, (5) Match subcontractors to SOWs, (6) Track quotes and bids, (7) Export reports. Each step builds on the previous one.',
      },
      {
        question: 'Do I need to set up anything before uploading projects?',
        answer: 'Yes — we recommend building your Subcontractor Database first. Go to "Subcontractors" in the sidebar and either add vendors manually or bulk import from an Excel/CSV file. This allows the system to automatically match subcontractors to project requirements after AI analysis.',
      },
      {
        question: 'Who is this platform designed for?',
        answer: 'Business Development Managers, Capture Managers, and Proposal Managers who evaluate incoming projects, coordinate subcontractor bids, and assemble proposals. The platform streamlines document analysis, compliance tracking, subcontractor management, and report generation.',
      },
    ],
  },
  {
    id: 'subcontractors',
    title: 'Subcontractor Database',
    icon: Users,
    description: 'Manage your vendor database — add, import, edit, and organize subcontractors.',
    steps: [
      'Navigate to "Subcontractors" in the left sidebar.',
      'Click "+ Add Subcontractor" to add one manually, or "Import Excel/CSV" to bulk import.',
      'For each subcontractor, enter: company name, contact info, service categories, geographic coverage, incumbent status, and certifications.',
      'Use the "Nationwide Coverage" toggle to quickly select all 50 states, or click region buttons (Northeast, Southeast, etc.) to select by region.',
      'Set incumbent status: Incumbent, Suspected Incumbent, Not Incumbent, or Unknown.',
      'Use search and filters to find subcontractors by name, category, or status.',
    ],
    faqs: [
      {
        question: 'How do I import my existing subcontractor list from Excel?',
        answer: 'Click the green "Import Excel/CSV" button on the Subcontractors page. Select your file — the system auto-detects columns by matching header names (Company Name, Contact Email, Service Categories, State, Incumbent Status, etc.). You\'ll see a preview before confirming the import. Duplicates are automatically skipped.',
      },
      {
        question: 'What happens if I import duplicates?',
        answer: 'The system automatically detects duplicates by matching company name (case-insensitive) and email address. During import, duplicates are skipped and you\'ll see a summary showing how many were added vs. skipped. When adding manually, the system blocks the save and tells you which existing entry matched.',
      },
      {
        question: 'How do I set geographic coverage quickly?',
        answer: 'Use the "Nationwide Coverage" checkbox to select all 50 states at once. Or use the region buttons (Northeast, Southeast, Midwest, Southwest, West, Pacific, Mid-Atlantic) to select all states in a region with one click. You can also click individual state buttons for fine-tuning.',
      },
      {
        question: 'Can I delete all subcontractors at once?',
        answer: 'Yes — click the red "Clear All" button at the top of the Subcontractors page. This requires double confirmation to prevent accidental deletion. You can also delete individual subcontractors using the trash icon on each card.',
      },
      {
        question: 'What format should my Excel file be in?',
        answer: 'The system auto-detects common column names. Best results come from headers like: Company Name, Contact Name, Email, Phone, Service Categories (comma-separated), State/Region, Incumbent Status. The importer is flexible and will try to match your columns to the closest field.',
      },
    ],
  },
  {
    id: 'task-orders',
    title: 'Creating Projects',
    icon: ClipboardList,
    description: 'How to create new procurement projects in the system.',
    steps: [
      'Go to "Projects" in the sidebar.',
      'Click "New Project" in the top right.',
      'Enter the project details: title, solicitation number, site name, location, due date, etc.',
      'Click "Create project" to save it.',
      'You\'ll be taken to the project detail page where you can upload documents.',
    ],
    faqs: [
      {
        question: 'How do I create a new project?',
        answer: 'No — you\'re creating a project record that was sent to you for bid evaluation. Think of it as logging the RFQ into the system so you can upload documents, run analysis, and track your bid process. The project itself comes from the government or prime contractor.',
      },
      {
        question: 'Can I delete a project?',
        answer: 'Yes — open the project and click the red "Delete project" button in the top right. This permanently removes the project and all associated data (documents, AI outputs, SOW items, quotes, communications). It requires double confirmation.',
      },
      {
        question: 'What information should I enter when creating a project?',
        answer: 'At minimum, enter a title (e.g., "N. Texas P&DX"). Optionally add: solicitation number, project number, site name, city/state, due date, and notes. The AI analysis will extract additional details (contract number, period of performance, contracting officer info) from your uploaded documents.',
      },
    ],
  },
  {
    id: 'documents',
    title: 'Uploading Documents',
    icon: Upload,
    description: 'Upload project documents for AI analysis — SOWs, pricing sheets, exhibits, amendments, and more.',
    steps: [
      'Open a project from the "Projects" list.',
      'In Step 1 (Upload Documents), select a document category from the dropdown.',
      'Drag and drop files onto the upload area, or click "Select Files" to browse.',
      'Supported formats: PDF, Word (.doc/.docx), Excel (.xlsx/.xls), text files.',
      'Repeat for all document types — SOWs, pricing sheets, exhibits, amendments, wage determinations, etc.',
      'Documents are organized by category for easy reference.',
    ],
    faqs: [
      {
        question: 'What document categories are available?',
        answer: 'Statement of Work, Pricing Sheet, Exhibit/Attachment, Amendment, Q&A Response, Wage Determination, Site Information, Subcontractor Quote, Internal Notes, and Other.',
      },
      {
        question: 'Is there a file size limit?',
        answer: 'The system supports files up to 50MB each. For very large documents, consider splitting them into smaller parts.',
      },
      {
        question: 'Can I delete uploaded documents?',
        answer: 'Yes — click the trash icon next to any document in the file list to remove it.',
      },
      {
        question: 'Do I need to upload all documents before running AI analysis?',
        answer: 'We recommend uploading all relevant documents first so the AI has the complete picture. However, you can run analysis with whatever documents are available and re-run it later after adding more.',
      },
    ],
  },
  {
    id: 'ai-analysis',
    title: 'AI Document Analysis',
    icon: Brain,
    description: 'How the AI analyzes your documents and generates outputs.',
    steps: [
      'After uploading documents, expand Step 2 (AI Document Analysis) on the project page.',
      'Click "Run Document Analysis" to start the AI extraction.',
      'The AI reads all uploaded documents and extracts: requirements, service categories, unclear items, pricing issues, and project metadata.',
      'After analysis completes, click "Generate All AI Outputs" to create all 6 output types at once.',
      'Review each output in Step 3 (Review Generated Outputs).',
    ],
    faqs: [
      {
        question: 'What does the AI extract from documents?',
        answer: 'The AI identifies: (1) Requirements and their sources, (2) Service categories (HVAC, FLS, Janitorial, etc.), (3) Unclear items needing clarification, (4) Pricing alignment issues, (5) project metadata (contract number, period of performance, contracting officer info, NAICS code).',
      },
      {
        question: 'What are the 6 AI output types?',
        answer: '(1) Compliance Matrix — requirements mapped to compliance status. (2) RFQ Packages — ready-to-send packages per service category. (3) Clarification Questions — questions a subcontractor would need answered to quote accurately. (4) Pricing Risks — categorized risks with severity and recommended actions. (5) Executive Summary — bid confidence, strategy, and action items. (6) Resource Matching — subcontractors matched to requirements.',
      },
      {
        question: 'Does the AI make assumptions?',
        answer: 'No. The AI is configured with strict truth enforcement: it only states what is explicitly in the documents. If information is missing or unclear, it will say "Not specified in documents" rather than guessing. Every claim includes a document citation.',
      },
      {
        question: 'Can I re-run the analysis?',
        answer: 'Yes — click "Generate All AI Outputs" again to regenerate all outputs with the latest documents and prompts. This overwrites previous outputs.',
      },
    ],
  },
  {
    id: 'compliance',
    title: 'Compliance Matrix',
    icon: Shield,
    description: 'Track compliance requirements and their status.',
    faqs: [
      {
        question: 'What is the Compliance Matrix?',
        answer: 'It lists every requirement identified from the project documents, showing: the requirement text, its source document, category, responsible party, risk level (High/Medium/Low), and compliance status (Covered, Missing, Needs Review).',
      },
      {
        question: 'How do I use it?',
        answer: 'Review each requirement to ensure your bid addresses it. Filter by status to focus on "Missing" items first, then "Needs Review". Export to Excel for team collaboration.',
      },
    ],
  },
  {
    id: 'sow-tracking',
    title: 'SOW Bid Management',
    icon: BarChart3,
    description: 'Track subcontractor bids for each Statement of Work.',
    steps: [
      'Open a project and go to Step 3 → SOW Bid Management.',
      'Click "Sync from AI Analysis" to auto-create SOW items from the AI analysis.',
      'The system auto-matches subcontractors from your database to each SOW by service category, location, and qualifications.',
      'Expand any SOW to see matched subcontractors. You can also manually add subcontractors.',
      'Track outreach status for each sub: Identified → RFQ Sent → Reviewing → Quote Submitted → Awarded.',
      'Record quotes with full cost breakdowns (total, monthly, annual, labor, materials, equipment).',
      'Upload quote documents (PDF, Excel, Word) by clicking "Upload quote document" or dragging files onto the subcontractor card.',
      'The dashboard shows real-time metrics: quotes received, coverage by SOW, estimated totals.',
    ],
    faqs: [
      {
        question: 'How do I record a subcontractor\'s quote?',
        answer: 'Expand a SOW → expand a subcontractor → click "Add Quote". Enter the quote amounts and optionally upload the quote document. When you save, the system automatically: (1) updates the sub\'s status to "Quote Submitted", (2) updates the SOW status to "Quotes Received", (3) logs a communication entry, and (4) recalculates dashboard metrics.',
      },
      {
        question: 'Can I upload quote documents?',
        answer: 'Yes — in the Add Quote form, click "Upload quote document" to select a file (PDF, Excel, Word, CSV), or drag and drop a file directly onto the subcontractor card. The file is stored and linked to the quote. You can view it later by clicking "View Document".',
      },
      {
        question: 'What do the coverage colors mean?',
        answer: 'Green = 3+ quotes received (good coverage). Yellow = 1-2 quotes (low coverage). Red = 0 quotes (no coverage). The goal is to get all SOWs to green before finalizing your bid.',
      },
      {
        question: 'How does auto-matching work?',
        answer: 'When you click "Sync from AI Analysis", the system matches subcontractors from your database to each SOW based on: service category overlap (25 points each), location match (20 points), preferred vendor status (15 points), and incumbent status (5-10 points). Higher scores indicate better matches.',
      },
    ],
  },
  {
    id: 'exports',
    title: 'Exporting Reports',
    icon: Download,
    description: 'Download reports in Excel, PDF, and PowerPoint formats.',
    steps: [
      'Open a project and expand Step 4 (Export & Submit).',
      'Choose from 8 export options: Compliance Matrix (Excel), Executive Summary (PDF), RFQ Packages (PDF), Clarification Questions (Excel), Pricing Risks (Excel), Quote Comparison (Excel), Presentation Deck (PowerPoint), Complete Analysis Workbook (Excel).',
      'Click the download button for each report type.',
    ],
    faqs: [
      {
        question: 'What export formats are available?',
        answer: 'Excel (.xlsx) for data-heavy reports (compliance matrix, questions, pricing risks, quotes). PDF for narrative reports (executive summary, RFQ packages). PowerPoint (.pptx) for presentation decks. The Complete Analysis Workbook combines everything into one multi-sheet Excel file.',
      },
      {
        question: 'Can I create a PowerPoint presentation?',
        answer: 'Yes — the "Presentation Deck" export generates a 5-slide PowerPoint with: Title slide, Overview, Scope Categories, Risks, and Bid Strategy. It\'s designed for internal bid review meetings.',
      },
    ],
  },
  {
    id: 'integrations',
    title: 'Integrations & API',
    icon: MessageCircle,
    description: 'Connect external data sources and automate project creation.',
    faqs: [
      {
        question: 'How do I search for federal opportunities on SAM.gov?',
        answer: 'Go to Integrations → SAM.gov Search tab. Enter keywords like "facility maintenance" or "HVAC" and click Search. Filter by opportunity type, NAICS code, or set-aside. Click "Import" next to any opportunity to create a project from it — the solicitation number, location, deadline, and description are automatically populated.',
      },
      {
        question: 'Can I import projects from a spreadsheet?',
        answer: 'Yes — go to Integrations → Bulk Import tab. Upload a CSV file with columns like Title, Solicitation Number, Site Name, City, State, Due Date, Notes, and Project Type. The system auto-detects column names. You\'ll see a preview before importing. Each row becomes a new project in draft status.',
      },
      {
        question: 'How do I use the Procuvex API?',
        answer: 'Go to Integrations → API Access tab and generate an API key. Use this key to create projects programmatically: POST to https://procuvex.com/api/projects with an X-API-Key header and a JSON body containing at minimum a "title" field. You can also GET /api/projects to list all projects. This enables integration with CRMs, ERPs, or custom scripts.',
      },
      {
        question: 'What project types can I specify in the API?',
        answer: 'Supported project_type values: government_task_order, government_rfp, construction, it_services, commercial. If omitted, defaults to government_task_order.',
      },
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics & Intelligence',
    icon: MessageCircle,
    description: 'Track performance metrics and get AI-powered insights.',
    faqs: [
      {
        question: 'What does the Analytics page show?',
        answer: 'The Analytics page provides cross-project metrics: total projects, active bids, pipeline value, win rate, project distribution by type/stage/state, monthly creation trends, upcoming deadlines, and competitor landscape (from debrief data).',
      },
      {
        question: 'What is the Bid Readiness checklist?',
        answer: 'Each active project shows a Bid Readiness panel tracking preparation steps: documents uploaded, AI analysis completed, compliance matrix generated, RFQ packages created, executive summary prepared, team assigned, and subcontractors aligned. This is a factual status tracker — not a prediction.',
      },
      {
        question: 'How do Smart Recommendations work?',
        answer: 'The AI reviews your project\'s current state (documents, analysis status, team, timeline) and suggests specific next actions to improve bid quality. Recommendations are prioritized by impact and can be dismissed as you complete them.',
      },
      {
        question: 'How does the Intelligence Library work?',
        answer: 'After a project is awarded or not awarded, complete a Debrief (available on the project detail page). The Intelligence Library aggregates all debriefs to show win/loss rates, top loss reasons, competitor profiles, pricing insights, and lessons learned by service category.',
      },
    ],
  },
  {
    id: 'tips',
    title: 'Tips & Best Practices',
    icon: MessageCircle,
    description: 'Get the most out of the platform.',
    faqs: [
      {
        question: 'What\'s the recommended order for setting up a new bid?',
        answer: '(1) Make sure your subcontractor database is up to date. (2) Create the project. (3) Upload ALL documents at once — the more complete the document set, the better the AI analysis. (4) Run AI analysis and generate all outputs. (5) Review the compliance matrix and clarification questions first. (6) Use SOW Bid Management to track quotes. (7) Export reports when ready.',
      },
      {
        question: 'How should I organize my documents?',
        answer: 'Categorize documents when uploading: use "Statement of Work" for SOWs, "Pricing Sheet" for pricing templates, "Exhibit/Attachment" for exhibits, "Amendment" for modifications. This helps the AI understand the document context.',
      },
      {
        question: 'Can multiple people use the platform at the same time?',
        answer: 'Yes — multiple users can log in and work simultaneously. Data is stored centrally in the database, so changes are immediately visible to all users.',
      },
      {
        question: 'How do I clean up test data before a demo?',
        answer: 'Use the delete features: (1) "Delete project" on the project detail page removes the project and all associated data. (2) "Clear All" on the Subcontractors page removes all subcontractors. Both require double confirmation.',
      },
    ],
  },
]

export default function HelpCenter() {
  const [search, setSearch] = useState('')
  const [expandedSection, setExpandedSection] = useState<string | null>('getting-started')
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null)

  const searchLower = search.toLowerCase()
  const filteredSections = search
    ? helpSections.filter(s =>
        s.title.toLowerCase().includes(searchLower) ||
        s.description.toLowerCase().includes(searchLower) ||
        s.faqs.some(f => f.question.toLowerCase().includes(searchLower) || f.answer.toLowerCase().includes(searchLower)) ||
        (s.steps && s.steps.some(step => step.toLowerCase().includes(searchLower)))
      )
    : helpSections

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <HelpCircle className="text-blue-600" size={28} />
            Help Center
          </h1>
          <p className="text-sm text-gray-500 mt-1">Learn how to use the Procuvex platform</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search help topics, questions, or keywords..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
      </div>

      {/* Quick Start Banner */}
      {!search && (
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white">
          <h2 className="text-lg font-bold mb-2">Quick Start Guide</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-white/10 rounded-lg p-3">
              <div className="font-semibold mb-1">1. Build Your Database</div>
              <p className="text-blue-100 text-xs">Import your subcontractor list via Excel/CSV or add manually.</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <div className="font-semibold mb-1">2. Create Projects</div>
              <p className="text-blue-100 text-xs">Log incoming RFQs and upload all associated documents.</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <div className="font-semibold mb-1">3. Run AI Analysis</div>
              <p className="text-blue-100 text-xs">AI extracts requirements, identifies risks, and generates outputs.</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <div className="font-semibold mb-1">4. Track & Export</div>
              <p className="text-blue-100 text-xs">Manage subcontractor bids and export reports (Excel, PDF, PPT).</p>
            </div>
          </div>
        </div>
      )}

      {/* Help Sections */}
      {filteredSections.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Search className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-gray-500">No help topics match your search. Try different keywords.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSections.map(section => {
            const isExpanded = expandedSection === section.id
            const Icon = section.icon
            return (
              <div key={section.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-50 p-2 rounded-lg">
                      <Icon size={20} className="text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{section.title}</h3>
                      <p className="text-sm text-gray-500">{section.description}</p>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 space-y-4">
                    {/* Step-by-step guide */}
                    {section.steps && (
                      <div className="bg-blue-50 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-blue-800 mb-3">Step-by-Step Guide</h4>
                        <ol className="space-y-2">
                          {section.steps.map((step, i) => (
                            <li key={i} className="flex gap-3 text-sm text-blue-900">
                              <span className="flex-shrink-0 bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* FAQs */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Frequently Asked Questions</h4>
                      <div className="space-y-1">
                        {section.faqs.map((faq, i) => {
                          const faqKey = `${section.id}-${i}`
                          const faqExpanded = expandedFaq === faqKey
                          const isMatch = search && (faq.question.toLowerCase().includes(searchLower) || faq.answer.toLowerCase().includes(searchLower))
                          return (
                            <div key={i} className={`border rounded-lg overflow-hidden ${isMatch ? 'border-yellow-300 bg-yellow-50' : 'border-gray-100'}`}>
                              <button
                                onClick={() => setExpandedFaq(faqExpanded ? null : faqKey)}
                                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                              >
                                <span className="text-sm font-medium text-gray-800 flex items-center gap-2">
                                  <HelpCircle size={14} className="text-blue-400 flex-shrink-0" />
                                  {faq.question}
                                </span>
                                {faqExpanded ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
                              </button>
                              {faqExpanded && (
                                <div className="px-4 pb-3 pl-10 text-sm text-gray-600 leading-relaxed">
                                  {faq.answer}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Contact/Support */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
        <MessageCircle className="mx-auto text-gray-300 mb-3" size={32} />
        <h3 className="font-semibold text-gray-900 mb-1">Still need help?</h3>
        <p className="text-sm text-gray-500">Contact your system administrator or reach out to Procuvex support at Core314 Technologies.</p>
      </div>
    </div>
  )
}
