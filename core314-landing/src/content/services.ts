export interface Service {
  slug: string;
  name: string;
  short: string;
  metaTitle: string;
  metaDescription: string;
  problem: string[];
  approach: string[];
  workflows: string[];
  benefits: string[];
  faq: { q: string; a: string }[];
}

export const services: Service[] = [
  {
    slug: 'custom-business-software',
    name: 'Custom Business Software',
    short: "Software built around your process, not a vendor's template. Replace spreadsheets, paper and patchwork tools with one system your team actually wants to use.",
    metaTitle: 'Custom Business Software Built Around Your Process | Core314',
    metaDescription: 'Replace spreadsheets and patchwork tools with custom business software designed around how your team works. Schedule a free consultation.',
    problem: [
      'Off-the-shelf software forces your team to change how it works, or to live with workarounds.',
      'Critical processes run on spreadsheets that only one or two people fully understand.',
      'Information lives in email threads, shared drives and paper forms, so nobody has the full picture.',
    ],
    approach: [
      'We start by learning how the work actually moves through your business today.',
      'We design a system around that process: the screens, records, approvals and reports your team needs, and nothing it does not.',
      'We build in short cycles so you see working software early and can steer it.',
    ],
    workflows: [
      'Job, project or case tracking from intake to close',
      'Customer, vendor or member portals',
      'Field and back-office apps that work on a phone',
      'Quoting, estimating and order management',
      'Compliance, inspection and certification tracking',
    ],
    benefits: [
      'One place for information that is currently scattered',
      'Fewer workarounds and less re-keying',
      'Software that fits your process instead of forcing a new one',
      'A system that can grow as your business changes',
    ],
    faq: [
      { q: 'How is this different from buying software off the shelf?', a: 'Off-the-shelf tools are built for the average customer. Custom software is built for your specific workflow, so your team does not have to adapt to the tool. We will also tell you honestly when an existing product is the better choice.' },
      { q: 'Can it work with the tools we already use?', a: 'Usually, yes. Most modern accounting, CRM, email and file-storage tools can be connected. We confirm what is possible during discovery.' },
    ],
  },
  {
    slug: 'workflow-automation',
    name: 'Workflow Automation',
    short: 'Let software handle the repetitive steps (data entry, routing, reminders, approvals and document generation) so your people can focus on work that needs judgment.',
    metaTitle: 'Business Process & Workflow Automation | Core314',
    metaDescription: 'Automate data entry, approvals, routing, reminders and reporting so your team can focus on higher-value work. Schedule a free consultation.',
    problem: [
      'Skilled people spend hours on copy-and-paste, status emails and chasing approvals.',
      'Requests get lost or stall because nobody knows whose turn it is.',
      'Routine documents are rebuilt by hand every time.',
    ],
    approach: [
      'We map the workflow step by step and identify which steps follow clear rules.',
      'We automate those steps and keep people in control of decisions that need judgment.',
      'We add visibility, so you can see where every request stands.',
    ],
    workflows: [
      'Approval routing with reminders and escalation',
      'Automatic document and report generation',
      'Intake forms that create records and notify the right person',
      'Scheduled reminders for renewals, expirations and follow-ups',
      'Exception alerts when something falls outside the normal range',
    ],
    benefits: [
      'Less time spent on repetitive tasks',
      'Fewer dropped handoffs and missed deadlines',
      'Consistent process every time',
      'Clear status on every request',
    ],
    faq: [
      { q: 'Do we need to replace our existing systems?', a: 'Not necessarily. Many automations work on top of the systems you already use.' },
      { q: 'What happens when the automation hits an unusual case?', a: 'We design automations to hand exceptions to a person, with the context they need, instead of guessing.' },
    ],
  },
  {
    slug: 'system-integration',
    name: 'System Integration',
    short: "Connect the tools you already pay for so information is entered once and shows up everywhere it's needed. Often the fastest return, because nothing new has to be adopted.",
    metaTitle: 'Connect Your Business Systems: System Integration | Core314',
    metaDescription: 'Integrate the business tools you already use so data is entered once and flows everywhere it is needed. Schedule a free consultation.',
    problem: [
      'The same information is typed into two or three different systems.',
      'Numbers do not match between accounting, operations and sales.',
      'Reports require exporting and stitching spreadsheets together.',
    ],
    approach: [
      'We identify where data is created and where it needs to go.',
      'We connect systems through their official interfaces wherever possible.',
      'We add monitoring so you know if a connection ever stops working.',
    ],
    workflows: [
      'Orders flowing to inventory and accounting automatically',
      'CRM and project or service systems kept in sync',
      'Timesheets feeding payroll and billing',
      'Website forms creating records in your business systems',
      'A single reporting database fed from several tools',
    ],
    benefits: [
      'Enter information once',
      'Fewer errors from re-keying',
      'Numbers that agree across systems',
      'No new tool for your team to learn',
    ],
    faq: [
      { q: 'What if a system has no integration option?', a: 'Many do through an API or export. When a system cannot be connected safely, we will tell you and suggest alternatives.' },
      { q: 'Who maintains the connections?', a: 'You choose: we can hand them over with documentation, or provide optional ongoing support.' },
    ],
  },
  {
    slug: 'dashboards-reporting',
    name: 'Dashboards & Reporting',
    short: "See what's happening across your business without chasing people for updates. Up-to-date numbers leadership can rely on.",
    metaTitle: 'Operational Dashboards & Reporting | Core314',
    metaDescription: 'Custom dashboards and automated reports that show what is happening across your business without manual spreadsheet work.',
    problem: [
      'Getting a simple status report takes days of collecting spreadsheets.',
      'Leaders make decisions on numbers that are already out of date.',
      'Different teams report the same metric differently.',
    ],
    approach: [
      'We agree on the handful of numbers that matter to you and how each one is defined.',
      'We connect the data sources and build dashboards that update automatically.',
      'We schedule reports and alerts so the right people see the right information.',
    ],
    workflows: [
      'Leadership dashboard across sales, operations and finance',
      'Job or project profitability tracking',
      'Service-level and response-time reporting',
      'Automated weekly summaries by email',
      'Alerts when a metric crosses a threshold',
    ],
    benefits: [
      'Current numbers without manual work',
      'One agreed definition for each metric',
      'Problems spotted earlier',
      'More time for decisions, less for collecting data',
    ],
    faq: [
      { q: 'Can you use the data we already have?', a: 'Yes. Dashboards are built on your existing systems wherever possible.' },
      { q: 'Is this the same as a BI tool?', a: 'It can use a BI tool, or be built into your own application. We recommend the simplest option that meets your needs.' },
    ],
  },
  {
    slug: 'applied-ai',
    name: 'Applied AI',
    short: 'AI where it pays for itself: reading documents, extracting data, drafting routine responses and flagging risks. Always with a person approving what matters.',
    metaTitle: 'Practical AI for Business Operations | Core314',
    metaDescription: 'Practical AI for document reading, data extraction, drafting and risk flagging, built into your workflow with human approval where it matters.',
    problem: [
      'Staff spend hours reading documents to pull out the same few facts.',
      'Routine responses and summaries are written from scratch every time.',
      'It is hard to tell where AI would actually help versus where it adds risk.',
    ],
    approach: [
      'We look for specific, repetitive tasks where AI can save time reliably.',
      'We build AI into the workflow with checks, citations to the source and human approval for decisions that matter.',
      'If a task does not need AI, we will say so and use simpler automation.',
    ],
    workflows: [
      'Extracting key fields from contracts, invoices or forms',
      'Summarizing long documents for review',
      'Drafting routine responses for a person to approve',
      'Checking submissions against a list of requirements',
      'Flagging items that need a closer look',
    ],
    benefits: [
      'Faster document-heavy work',
      'Consistent first drafts',
      'People stay in control of decisions',
      'AI used only where it adds value',
    ],
    faq: [
      { q: 'Is our data used to train public AI models?', a: 'We design solutions using providers and settings that do not use your business data to train their public models, and we explain the options during scoping.' },
      { q: 'Will AI replace our staff?', a: 'Our goal is to remove repetitive work so your people can focus on judgment, relationships and growth.' },
    ],
  },
];
