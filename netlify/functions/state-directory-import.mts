import type { Context } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
import { descriptionToTrades } from "./_shared/tradeMatching.ts"

/**
 * State DBE/HUB/MBE/WBE Directory Import
 * 
 * Downloads and imports contractor data from state government directories.
 * Supports two modes:
 *   1. Auto-download: Fetches CSV directly from state websites (Texas HUB, Texas CMBL)
 *   2. File upload: Admin downloads CSV from state site, uploads here with format identifier
 * 
 * POST body (auto-download): { source: string, dryRun?: boolean, maxRecords?: number }
 * POST body (file upload): { format: string, csvData: string, dryRun?: boolean, maxRecords?: number }
 * 
 * GET ?action=sources  → list available sources (auto-download + upload formats)
 * GET ?action=status   → show last import stats per source
 */

const SUPABASE_URL = process.env.TASKORDER_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ""
const SUPABASE_SERVICE_KEY = process.env.TASKORDER_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ""

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-user-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
}

// ─── Source Definitions ─────────────────────────────────────────────────────

interface SourceConfig {
  name: string
  description: string
  url: string
  state: string
  dataSource: string
  recordCount?: string
  parseRow: (row: string[], headers: string[]) => Record<string, any> | null
}

// Upload format: requires admin to download CSV from state site and upload
interface UploadFormatConfig {
  name: string
  description: string
  state: string
  dataSource: string
  downloadUrl: string // Where admin should download from
  recordCount?: string
  instructions: string
  parseRow: (row: string[], headers: string[]) => Record<string, any> | null
}

const SOURCES: Record<string, SourceConfig> = {
  texas_hub: {
    name: "Texas HUB Directory",
    description: "Historically Underutilized Businesses certified by Texas Comptroller. Includes minority, women, veteran-owned firms.",
    url: "https://comptroller.texas.gov/auto-data/purchasing/hub_name.csv",
    state: "TX",
    dataSource: "texas_hub",
    recordCount: "~15,000",
    parseRow: parseTexasHubRow,
  },
  texas_cmbl: {
    name: "Texas CMBL Directory",
    description: "Centralized Master Bidders List — all active vendors registered to bid on Texas state contracts.",
    url: "https://comptroller.texas.gov/auto-data/purchasing/web_name.csv",
    state: "TX",
    dataSource: "texas_cmbl",
    recordCount: "~12,000",
    parseRow: parseTexasCmblRow,
  },
}

// Upload formats: admin downloads file from state site, then uploads CSV here
const UPLOAD_FORMATS: Record<string, UploadFormatConfig> = {
  ohio_mbe: {
    name: "Ohio MBE Directory",
    description: "Ohio Minority Business Enterprise certified firms. Export full list from state site.",
    state: "OH",
    dataSource: "state_dbe",
    downloadUrl: "https://eodreporting.oit.ohio.gov/mbe-certification",
    recordCount: "~1,300",
    instructions: "Go to site → leave search blank → click Search → click 'Export to Excel' → save as CSV → upload here",
    parseRow: parseOhioMbeRow,
  },
  ohio_edge: {
    name: "Ohio EDGE Directory",
    description: "Ohio EDGE (Encouraging Diversity Growth & Equity) certified firms.",
    state: "OH",
    dataSource: "state_dbe",
    downloadUrl: "https://eodreporting.oit.ohio.gov/edge-certification",
    recordCount: "~800",
    instructions: "Go to site → leave search blank → click Search → click 'Export to Excel' → save as CSV → upload here",
    parseRow: parseOhioEdgeRow,
  },
  illinois_bep: {
    name: "Illinois BEP Directory",
    description: "Illinois Business Enterprise Program — MBE/WBE certified firms.",
    state: "IL",
    dataSource: "state_dbe",
    downloadUrl: "https://ceibep.diversitysoftware.com/FrontEnd/SearchCertifiedDirectory.asp",
    recordCount: "~4,000",
    instructions: "Go to site → select MBE and/or WBE → scroll to bottom → click 'Download Entire Directory to Excel' → save as CSV → upload here",
    parseRow: parseIllinoisBepRow,
  },
  new_york_mwbe: {
    name: "New York MWBE Directory",
    description: "New York State certified Minority and Women-owned Business Enterprises.",
    state: "NY",
    dataSource: "state_dbe",
    downloadUrl: "https://ny.newnycontracts.com/FrontEnd/SearchCertifiedDirectory.asp",
    recordCount: "~12,000",
    instructions: "Go to site → select M/WBE → complete CAPTCHA → click 'Download Directory to Excel' → save as CSV → upload here",
    parseRow: parseNewYorkMwbeRow,
  },
  florida_dbe: {
    name: "Florida DOT DBE Directory",
    description: "Florida Department of Transportation Disadvantaged Business Enterprise directory.",
    state: "FL",
    dataSource: "state_dbe",
    downloadUrl: "https://fdotxwp02.dot.state.fl.us/EqualOpportunityOfficeBusinessDirectory/CustomSearch",
    recordCount: "~8,000",
    instructions: "Go to site → select Report Format: Excel → click Search (no criteria = all) → download Excel → save as CSV → upload here",
    parseRow: parseFloridaDbRow,
  },
  virginia_swam: {
    name: "Virginia SWaM Directory",
    description: "Virginia Small, Women-owned, and Minority-owned business directory.",
    state: "VA",
    dataSource: "state_dbe",
    downloadUrl: "https://directory.sbsd.virginia.gov/",
    recordCount: "~10,000",
    instructions: "Go to site → search with no filters → export results to CSV → upload here",
    parseRow: parseVirginiaSWaMRow,
  },
  georgia_dbe: {
    name: "Georgia DOT DBE Directory",
    description: "Georgia Unified Certification Program — DBE certified firms.",
    state: "GA",
    dataSource: "state_dbe",
    downloadUrl: "https://www.dot.ga.gov/GDOT/pages/DBE.aspx",
    recordCount: "~3,000",
    instructions: "Go to UCP Directory link → export all results → save as CSV → upload here",
    parseRow: parseGeorgiaDbRow,
  },
  pennsylvania_sdb: {
    name: "Pennsylvania Small Diverse Business",
    description: "PA Department of General Services Bureau of Diversity certified firms.",
    state: "PA",
    dataSource: "state_dbe",
    downloadUrl: "https://www.dgs.pa.gov/Small%20Diverse%20Business%20Program/",
    recordCount: "~5,000",
    instructions: "Go to site → search with no filters → export results to CSV/Excel → save as CSV → upload here",
    parseRow: parseGenericStateRow,
  },
  generic_state: {
    name: "Generic State Directory (Auto-detect columns)",
    description: "Upload any state directory CSV — columns will be auto-detected by header names.",
    state: "",
    dataSource: "state_dbe",
    downloadUrl: "",
    recordCount: "Varies",
    instructions: "Download CSV from any state directory site. Headers should include company name, email, phone, city, state, zip columns.",
    parseRow: parseGenericStateRow,
  },
}

// ─── Trade Category Mapping ─────────────────────────────────────────────────
// Trade classification lives in ./_shared/tradeMatching.ts (word-boundary
// matched to avoid the substring false positives that previously polluted the
// master subcontractor database).

// ─── Texas HUB Eligibility Codes ────────────────────────────────────────────

const TX_ELIGIBILITY_MAP: Record<string, string[]> = {
  'BL': ['African American'],
  'HI': ['Hispanic'],
  'AI': ['Native American'],
  'AS': ['Asian Pacific American'],
  'WO': ['Women-Owned'],
  'DV': ['Disabled Veteran'],
  'NP': ['Non-Profit'],
}

function texasEligibilityToTypes(code: string, gender: string): string[] {
  const types: string[] = ['HUB']
  const eligTypes = TX_ELIGIBILITY_MAP[code.trim().toUpperCase()] || []
  types.push(...eligTypes)
  if (gender === 'F') types.push('Women-Owned')
  return [...new Set(types)]
}

// ─── Row Parsers ────────────────────────────────────────────────────────────

/**
 * Texas HUB CSV columns:
 * VENDOR ID NUMBER, VENDOR NAME, VENDOR ADDRESS LINE 1, VENDOR ADDRESS LINE 2,
 * CITY, STATE, ZIP CODE, FOREIGN ADDRESS, PHONE NUMBER, FAX NUMBER, GENDER,
 * ELIGIBILITY CODE, STATUS CODE, COUNTY, BUSINESS DESCRIPTION, VENDOR NUMBER,
 * EXPIRATION DATE, CONTACT NAME, TEXAS OFFICE FLAG, INTERNET ADDRESS,
 * QISV FLAG, SDV FLAG, SMALL BUSINESS FLAG
 */
function parseTexasHubRow(fields: string[], _headers: string[]): Record<string, any> | null {
  if (fields.length < 20) return null
  
  const vendorId = cleanField(fields[0])
  const companyName = cleanField(fields[1])
  const address1 = cleanField(fields[2])
  const address2 = cleanField(fields[3])
  const city = cleanField(fields[4])
  const state = cleanField(fields[5])
  const zip = cleanField(fields[6])
  const phone = cleanField(fields[8])
  const gender = cleanField(fields[10])
  const eligibilityCode = cleanField(fields[11])
  const statusCode = cleanField(fields[12])
  const county = cleanField(fields[13])
  const description = cleanField(fields[14])
  const expirationDate = cleanField(fields[16])
  const contactName = cleanField(fields[17])
  const email = cleanField(fields[19])
  const sdvFlag = cleanField(fields[21])

  // Skip inactive records
  if (statusCode && statusCode !== 'A') return null
  
  // Must have company name
  if (!companyName) return null

  const trades = descriptionToTrades(description)
  const smallBizTypes = texasEligibilityToTypes(eligibilityCode, gender)
  if (sdvFlag === 'Y' && !smallBizTypes.includes('Disabled Veteran')) {
    smallBizTypes.push('Service-Disabled Veteran')
  }

  return {
    company_name: companyName,
    contact_email: email || null,
    contact_phone: formatPhone(phone),
    contact_name: contactName || null,
    address: [address1, address2].filter(Boolean).join(', ') || null,
    city: city || null,
    state: state || 'TX',
    zip_code: zip || null,
    county: county || null,
    description: description || null,
    trade_categories: trades.length > 0 ? trades : null,
    small_business_types: smallBizTypes,
    data_source: 'texas_hub',
    external_id: vendorId || null,
    expiration_date: parseDate(expirationDate),
  }
}

/**
 * Texas CMBL uses the same format as HUB
 */
function parseTexasCmblRow(fields: string[], headers: string[]): Record<string, any> | null {
  const record = parseTexasHubRow(fields, headers)
  if (record) {
    record.data_source = 'texas_cmbl'
    // CMBL vendors aren't necessarily HUBs
    record.small_business_types = record.small_business_types?.filter((t: string) => t !== 'HUB') || []
  }
  return record
}

// ─── Upload Format Parsers ──────────────────────────────────────────────────

/**
 * Generic header-based column finder. Matches headers case-insensitively.
 */
function findCol(headers: string[], ...candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.findIndex(h => h.toLowerCase().trim() === candidate.toLowerCase())
    if (idx >= 0) return idx
  }
  // Partial match fallback
  for (const candidate of candidates) {
    const idx = headers.findIndex(h => h.toLowerCase().trim().includes(candidate.toLowerCase()))
    if (idx >= 0) return idx
  }
  return -1
}

function getField(fields: string[], idx: number): string {
  if (idx < 0 || idx >= fields.length) return ''
  return cleanField(fields[idx])
}

/**
 * Ohio MBE Export columns (typical):
 * Company Name, FTID#, Contact, Address, City, State, Zip, Phone, Email, 
 * Certification#, Business Type, Region, Procurement Type, County
 */
function parseOhioMbeRow(fields: string[], headers: string[]): Record<string, any> | null {
  const companyName = getField(fields, findCol(headers, 'Company Name', 'company name', 'Vendor Name'))
  const contact = getField(fields, findCol(headers, 'Contact', 'Contact Person', 'Owner'))
  const address = getField(fields, findCol(headers, 'Address', 'Street'))
  const city = getField(fields, findCol(headers, 'City'))
  const state = getField(fields, findCol(headers, 'State')) || 'OH'
  const zip = getField(fields, findCol(headers, 'Zip', 'Zip Code', 'Zipcode'))
  const phone = getField(fields, findCol(headers, 'Phone', 'Telephone'))
  const email = getField(fields, findCol(headers, 'Email', 'E-mail', 'E-Mail'))
  const certNum = getField(fields, findCol(headers, 'Certification#', 'Cert #', 'MBE Certification'))
  const bizType = getField(fields, findCol(headers, 'Business Type', 'Type'))
  const description = getField(fields, findCol(headers, 'Descriptor', 'Description', 'Services'))

  if (!companyName) return null

  const smallBizTypes = ['MBE']
  if (bizType) {
    if (bizType.toLowerCase().includes('women') || bizType.toLowerCase().includes('female')) smallBizTypes.push('Women-Owned')
    if (bizType.toLowerCase().includes('african') || bizType.toLowerCase().includes('black')) smallBizTypes.push('African American')
    if (bizType.toLowerCase().includes('hispanic') || bizType.toLowerCase().includes('latino')) smallBizTypes.push('Hispanic')
    if (bizType.toLowerCase().includes('asian')) smallBizTypes.push('Asian Pacific American')
  }

  return {
    company_name: companyName,
    contact_email: email || null,
    contact_phone: formatPhone(phone),
    contact_name: contact || null,
    address: address || null,
    city: city || null,
    state,
    zip_code: zip || null,
    description: description || null,
    trade_categories: descriptionToTrades(description),
    small_business_types: smallBizTypes,
    data_source: 'state_dbe',
    external_id: certNum || null,
  }
}

/**
 * Ohio EDGE uses similar format to MBE
 */
function parseOhioEdgeRow(fields: string[], headers: string[]): Record<string, any> | null {
  const record = parseOhioMbeRow(fields, headers)
  if (record) {
    record.small_business_types = ['EDGE', 'Small Business']
  }
  return record
}

/**
 * Illinois BEP Directory columns (DiversitySoftware export):
 * Vendor Name, DBA, Address1, Address2, City, State, Zip, Phone, Fax,
 * Email, Website, Contact First, Contact Last, Certifications, NAICS, Description
 */
function parseIllinoisBepRow(fields: string[], headers: string[]): Record<string, any> | null {
  const companyName = getField(fields, findCol(headers, 'Vendor Name', 'Business Name', 'Company Name', 'Firm Name'))
  const dba = getField(fields, findCol(headers, 'DBA', 'Trade Name'))
  const address1 = getField(fields, findCol(headers, 'Address1', 'Address', 'Street Address'))
  const city = getField(fields, findCol(headers, 'City'))
  const state = getField(fields, findCol(headers, 'State')) || 'IL'
  const zip = getField(fields, findCol(headers, 'Zip', 'Zip Code'))
  const phone = getField(fields, findCol(headers, 'Phone', 'Telephone'))
  const email = getField(fields, findCol(headers, 'Email', 'E-mail'))
  const contactFirst = getField(fields, findCol(headers, 'Contact First', 'First Name'))
  const contactLast = getField(fields, findCol(headers, 'Contact Last', 'Last Name'))
  const certs = getField(fields, findCol(headers, 'Certifications', 'Certification Type', 'Cert Type'))
  const description = getField(fields, findCol(headers, 'Description', 'Services', 'Commodity', 'Work Description'))

  if (!companyName && !dba) return null

  const smallBizTypes: string[] = []
  if (certs) {
    if (certs.includes('MBE')) smallBizTypes.push('MBE')
    if (certs.includes('WBE')) smallBizTypes.push('Women-Owned')
    if (certs.includes('VBE') || certs.includes('Veteran')) smallBizTypes.push('Veteran-Owned')
    if (certs.includes('DBE')) smallBizTypes.push('DBE')
  }
  if (smallBizTypes.length === 0) smallBizTypes.push('Small Business')

  const contactName = [contactFirst, contactLast].filter(Boolean).join(' ') || null

  return {
    company_name: companyName || dba,
    contact_email: email || null,
    contact_phone: formatPhone(phone),
    contact_name: contactName,
    address: address1 || null,
    city: city || null,
    state,
    zip_code: zip || null,
    description: description || null,
    trade_categories: descriptionToTrades(description),
    small_business_types: smallBizTypes,
    data_source: 'state_dbe',
    external_id: null,
  }
}

/**
 * New York MWBE Directory (newnycontracts.com export):
 * Vendor Name, DBA, Address, City, State, Zip, Phone, Fax, Email, Website,
 * Contact, Certification Type, Ethnicity, NAICS Codes, Counties
 */
function parseNewYorkMwbeRow(fields: string[], headers: string[]): Record<string, any> | null {
  const companyName = getField(fields, findCol(headers, 'Vendor Name', 'Business Name', 'Company Name', 'Firm Name'))
  const address = getField(fields, findCol(headers, 'Address', 'Street', 'Address1'))
  const city = getField(fields, findCol(headers, 'City'))
  const state = getField(fields, findCol(headers, 'State')) || 'NY'
  const zip = getField(fields, findCol(headers, 'Zip', 'Zip Code', 'Zipcode'))
  const phone = getField(fields, findCol(headers, 'Phone', 'Telephone'))
  const email = getField(fields, findCol(headers, 'Email', 'E-mail'))
  const contact = getField(fields, findCol(headers, 'Contact', 'Contact Person', 'Owner'))
  const certType = getField(fields, findCol(headers, 'Certification Type', 'Cert Type', 'Certifications'))
  const ethnicity = getField(fields, findCol(headers, 'Ethnicity', 'Race'))
  const description = getField(fields, findCol(headers, 'Description', 'Services', 'NAICS Description'))

  if (!companyName) return null

  const smallBizTypes: string[] = []
  if (certType) {
    if (certType.includes('MBE')) smallBizTypes.push('MBE')
    if (certType.includes('WBE')) smallBizTypes.push('Women-Owned')
  }
  if (ethnicity) {
    if (ethnicity.includes('Black') || ethnicity.includes('African')) smallBizTypes.push('African American')
    if (ethnicity.includes('Hispanic')) smallBizTypes.push('Hispanic')
    if (ethnicity.includes('Asian')) smallBizTypes.push('Asian Pacific American')
  }
  if (smallBizTypes.length === 0) smallBizTypes.push('MWBE')

  return {
    company_name: companyName,
    contact_email: email || null,
    contact_phone: formatPhone(phone),
    contact_name: contact || null,
    address: address || null,
    city: city || null,
    state,
    zip_code: zip || null,
    description: description || null,
    trade_categories: descriptionToTrades(description),
    small_business_types: smallBizTypes,
    data_source: 'state_dbe',
    external_id: null,
  }
}

/**
 * Florida DOT DBE Directory (Excel export):
 * Vendor Name, DBA, Address, City, State, Zip, Phone, Fax, Email,
 * Contact, DBE Types, NAICS, Counties, District
 */
function parseFloridaDbRow(fields: string[], headers: string[]): Record<string, any> | null {
  const companyName = getField(fields, findCol(headers, 'Vendor Name', 'Business Name', 'Company Name', 'Firm Name'))
  const address = getField(fields, findCol(headers, 'Address', 'Street', 'Mailing Address'))
  const city = getField(fields, findCol(headers, 'City'))
  const state = getField(fields, findCol(headers, 'State')) || 'FL'
  const zip = getField(fields, findCol(headers, 'Zip', 'Zip Code'))
  const phone = getField(fields, findCol(headers, 'Phone', 'Telephone'))
  const email = getField(fields, findCol(headers, 'Email', 'E-mail'))
  const contact = getField(fields, findCol(headers, 'Contact', 'Contact Person'))
  const dbeTypes = getField(fields, findCol(headers, 'DBE Types', 'Certification', 'Designation'))
  const naics = getField(fields, findCol(headers, 'NAICS', 'NAICS Codes'))
  const description = getField(fields, findCol(headers, 'Description', 'Work Description', 'Services'))

  if (!companyName) return null

  const smallBizTypes: string[] = ['DBE']
  if (dbeTypes) {
    if (dbeTypes.includes('MBE')) smallBizTypes.push('MBE')
    if (dbeTypes.includes('WBE') || dbeTypes.toLowerCase().includes('women')) smallBizTypes.push('Women-Owned')
    if (dbeTypes.includes('ACDBE')) smallBizTypes.push('Airport Concession DBE')
  }

  return {
    company_name: companyName,
    contact_email: email || null,
    contact_phone: formatPhone(phone),
    contact_name: contact || null,
    address: address || null,
    city: city || null,
    state,
    zip_code: zip || null,
    description: description || null,
    trade_categories: descriptionToTrades(description || naics),
    small_business_types: smallBizTypes,
    data_source: 'state_dbe',
    external_id: null,
  }
}

/**
 * Virginia SWaM Directory export:
 * Company Name, DBA, Address, City, State, Zip, Phone, Email, Website,
 * Contact, Certification Type, NAICS, NIGP
 */
function parseVirginiaSWaMRow(fields: string[], headers: string[]): Record<string, any> | null {
  const companyName = getField(fields, findCol(headers, 'Company Name', 'Legal Name', 'Vendor Name', 'Business Name'))
  const address = getField(fields, findCol(headers, 'Address', 'Street'))
  const city = getField(fields, findCol(headers, 'City'))
  const state = getField(fields, findCol(headers, 'State')) || 'VA'
  const zip = getField(fields, findCol(headers, 'Zip', 'Zip Code'))
  const phone = getField(fields, findCol(headers, 'Phone', 'Telephone'))
  const email = getField(fields, findCol(headers, 'Email', 'E-mail'))
  const contact = getField(fields, findCol(headers, 'Contact', 'Contact Name', 'Contact Person'))
  const certType = getField(fields, findCol(headers, 'Certification Type', 'Certifications', 'SWaM Type'))
  const description = getField(fields, findCol(headers, 'Description', 'Services'))

  if (!companyName) return null

  const smallBizTypes: string[] = []
  if (certType) {
    if (certType.includes('Small')) smallBizTypes.push('Small Business')
    if (certType.includes('Women') || certType.includes('WO')) smallBizTypes.push('Women-Owned')
    if (certType.includes('Minority') || certType.includes('MO')) smallBizTypes.push('MBE')
    if (certType.includes('Micro')) smallBizTypes.push('Micro Business')
    if (certType.includes('Veteran') || certType.includes('SDV')) smallBizTypes.push('Service-Disabled Veteran')
  }
  if (smallBizTypes.length === 0) smallBizTypes.push('SWaM')

  return {
    company_name: companyName,
    contact_email: email || null,
    contact_phone: formatPhone(phone),
    contact_name: contact || null,
    address: address || null,
    city: city || null,
    state,
    zip_code: zip || null,
    description: description || null,
    trade_categories: descriptionToTrades(description),
    small_business_types: smallBizTypes,
    data_source: 'state_dbe',
    external_id: null,
  }
}

/**
 * Georgia DOT DBE Directory export:
 * Company Name, Address, City, State, Zip, Phone, Fax, Email, Contact,
 * NAICS, Work Description, County
 */
function parseGeorgiaDbRow(fields: string[], headers: string[]): Record<string, any> | null {
  const companyName = getField(fields, findCol(headers, 'Company Name', 'Vendor Name', 'Firm Name', 'Business Name'))
  const address = getField(fields, findCol(headers, 'Address', 'Street'))
  const city = getField(fields, findCol(headers, 'City'))
  const state = getField(fields, findCol(headers, 'State')) || 'GA'
  const zip = getField(fields, findCol(headers, 'Zip', 'Zip Code'))
  const phone = getField(fields, findCol(headers, 'Phone', 'Telephone'))
  const email = getField(fields, findCol(headers, 'Email', 'E-mail'))
  const contact = getField(fields, findCol(headers, 'Contact', 'Contact Person', 'Owner'))
  const description = getField(fields, findCol(headers, 'Work Description', 'Description', 'Services', 'NAICS Description'))

  if (!companyName) return null

  return {
    company_name: companyName,
    contact_email: email || null,
    contact_phone: formatPhone(phone),
    contact_name: contact || null,
    address: address || null,
    city: city || null,
    state,
    zip_code: zip || null,
    description: description || null,
    trade_categories: descriptionToTrades(description),
    small_business_types: ['DBE'],
    data_source: 'state_dbe',
    external_id: null,
  }
}

/**
 * Generic state directory parser — auto-detects columns by header name
 * Works for any CSV with standard column headers (Company Name, Email, Phone, etc.)
 */
function parseGenericStateRow(fields: string[], headers: string[]): Record<string, any> | null {
  const companyName = getField(fields, findCol(headers, 'Company Name', 'Vendor Name', 'Business Name', 'Firm Name', 'Legal Name', 'Name'))
  const address = getField(fields, findCol(headers, 'Address', 'Address1', 'Street Address', 'Street', 'Mailing Address'))
  const city = getField(fields, findCol(headers, 'City'))
  const state = getField(fields, findCol(headers, 'State'))
  const zip = getField(fields, findCol(headers, 'Zip', 'Zip Code', 'Zipcode', 'Postal Code'))
  const phone = getField(fields, findCol(headers, 'Phone', 'Telephone', 'Phone Number'))
  const email = getField(fields, findCol(headers, 'Email', 'E-mail', 'E-Mail', 'Email Address'))
  const contact = getField(fields, findCol(headers, 'Contact', 'Contact Name', 'Contact Person', 'Owner', 'Representative'))
  const description = getField(fields, findCol(headers, 'Description', 'Services', 'Work Description', 'Capabilities', 'Business Description'))
  const certType = getField(fields, findCol(headers, 'Certification', 'Certification Type', 'Cert Type', 'Certifications', 'Type'))

  if (!companyName) return null

  const smallBizTypes: string[] = []
  if (certType) {
    if (certType.includes('MBE')) smallBizTypes.push('MBE')
    if (certType.includes('WBE') || certType.toLowerCase().includes('women')) smallBizTypes.push('Women-Owned')
    if (certType.includes('DBE')) smallBizTypes.push('DBE')
    if (certType.includes('Veteran') || certType.includes('VBE') || certType.includes('SDV')) smallBizTypes.push('Veteran-Owned')
    if (certType.includes('HUB')) smallBizTypes.push('HUB')
    if (certType.includes('8(a)') || certType.includes('8a')) smallBizTypes.push('8(a)')
  }
  if (smallBizTypes.length === 0) smallBizTypes.push('Small Business')

  return {
    company_name: companyName,
    contact_email: email || null,
    contact_phone: formatPhone(phone),
    contact_name: contact || null,
    address: address || null,
    city: city || null,
    state: state || null,
    zip_code: zip || null,
    description: description || null,
    trade_categories: descriptionToTrades(description),
    small_business_types: smallBizTypes,
    data_source: 'state_dbe',
    external_id: null,
  }
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function cleanField(val: string | undefined): string {
  if (!val) return ''
  return val.replace(/^"|"$/g, '').trim()
}

function formatPhone(raw: string): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
  if (digits.length === 11 && digits[0] === '1') return `(${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`
  return raw
}

function parseDate(raw: string): string | null {
  if (!raw) return null
  // Handle "DD-MMM-YYYY" format (e.g., "17-JUL-2028")
  const months: Record<string, string> = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
  }
  const match = raw.match(/(\d{2})-([A-Z]{3})-(\d{4})/)
  if (match) {
    const [, day, mon, year] = match
    const monthNum = months[mon]
    if (monthNum) return `${year}-${monthNum}-${day}`
  }
  return null
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80)
}

function calculateCompleteness(fields: Record<string, any>): number {
  const weights: Record<string, number> = {
    company_name: 15, contact_email: 15, contact_phone: 10,
    city: 10, state: 10, trade_categories: 15, description: 15, contact_name: 10,
  }
  let score = 0
  for (const [key, weight] of Object.entries(weights)) {
    const val = fields[key]
    if (val && (Array.isArray(val) ? val.length > 0 : String(val).length > 0)) {
      score += weight
    }
  }
  return score
}

// ─── CSV Parser (handles quoted fields with commas) ─────────────────────────

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

// ─── Main Handler ───────────────────────────────────────────────────────────

export default async (req: Request, _context: Context) => {
  if (req.method === "OPTIONS") {
    return new Response("", { headers: corsHeaders })
  }

  // GET: list sources or check status
  if (req.method === "GET") {
    const url = new URL(req.url)
    const action = url.searchParams.get("action")

    if (action === "sources") {
      const sources = Object.entries(SOURCES).map(([key, src]) => ({
        key,
        name: src.name,
        description: src.description,
        state: src.state,
        recordCount: src.recordCount,
        mode: 'auto' as const,
      }))
      const uploadFormats = Object.entries(UPLOAD_FORMATS).map(([key, fmt]) => ({
        key,
        name: fmt.name,
        description: fmt.description,
        state: fmt.state,
        recordCount: fmt.recordCount,
        mode: 'upload' as const,
        downloadUrl: fmt.downloadUrl,
        instructions: fmt.instructions,
      }))
      return new Response(JSON.stringify({ sources, uploadFormats }), { headers: corsHeaders })
    }

    if (action === "status") {
      // Get last import stats per source
      const { data: logs } = await supabase
        .from("database_hygiene_log")
        .select("action, reason, performed_at")
        .like("action", "state_import_%")
        .order("performed_at", { ascending: false })
        .limit(20)
      return new Response(JSON.stringify({ logs: logs || [] }), { headers: corsHeaders })
    }

    return new Response(JSON.stringify({ error: "Use action=sources or action=status" }), { status: 400, headers: corsHeaders })
  }

  // POST: run import
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { source, format, csvData, dryRun = false, maxRecords } = body

    // Determine mode: auto-download (source) or file upload (format + csvData)
    let csvText: string
    let parseRow: (row: string[], headers: string[]) => Record<string, any> | null
    let sourceName: string
    let dataSourceValue: string

    if (format && csvData) {
      // FILE UPLOAD MODE
      const uploadConfig = UPLOAD_FORMATS[format]
      if (!uploadConfig) {
        return new Response(JSON.stringify({
          error: `Invalid format. Available: ${Object.keys(UPLOAD_FORMATS).join(', ')}`,
          formats: Object.keys(UPLOAD_FORMATS),
        }), { status: 400, headers: corsHeaders })
      }
      csvText = csvData
      parseRow = uploadConfig.parseRow
      sourceName = uploadConfig.name
      dataSourceValue = uploadConfig.dataSource
    } else if (source) {
      // AUTO-DOWNLOAD MODE
      if (!SOURCES[source]) {
        return new Response(JSON.stringify({
          error: `Invalid source. Available: ${Object.keys(SOURCES).join(', ')}`,
          sources: Object.keys(SOURCES),
        }), { status: 400, headers: corsHeaders })
      }
      const config = SOURCES[source]
      parseRow = config.parseRow
      sourceName = config.name
      dataSourceValue = config.dataSource

      // Download the CSV from state website
      const csvResponse = await fetch(config.url)
      if (!csvResponse.ok) {
        return new Response(JSON.stringify({
          error: `Failed to download from ${config.name}: ${csvResponse.status} ${csvResponse.statusText}`,
        }), { status: 502, headers: corsHeaders })
      }
      csvText = await csvResponse.text()
    } else {
      return new Response(JSON.stringify({
        error: "Provide either 'source' (auto-download) or 'format' + 'csvData' (file upload)",
      }), { status: 400, headers: corsHeaders })
    }

    const lines = csvText.split('\n').filter(l => l.trim().length > 0)
    
    if (lines.length < 2) {
      return new Response(JSON.stringify({ error: "CSV file is empty or has no data rows" }), { status: 400, headers: corsHeaders })
    }

    // Parse header
    const headers = parseCSVLine(lines[0])
    
    // 2. Parse all rows
    const records: Record<string, any>[] = []
    let parseErrors = 0
    const limit = maxRecords || lines.length

    for (let i = 1; i < Math.min(lines.length, limit + 1); i++) {
      try {
        const fields = parseCSVLine(lines[i])
        const record = parseRow(fields, headers)
        if (record) {
          records.push(record)
        }
      } catch {
        parseErrors++
      }
    }

    if (records.length === 0) {
      return new Response(JSON.stringify({ error: "No valid records found in CSV", parseErrors }), { status: 400, headers: corsHeaders })
    }

    // 3. Deduplicate against existing database
    // Check by email (most reliable) and by company_name + state (fallback)
    const emails = records
      .map(r => r.contact_email)
      .filter(Boolean)
      .map((e: string) => e.toLowerCase())
    
    // Batch check existing emails (in chunks of 500)
    const existingEmails = new Set<string>()
    for (let i = 0; i < emails.length; i += 500) {
      const chunk = emails.slice(i, i + 500)
      const { data } = await supabase
        .from("master_subcontractors")
        .select("contact_email")
        .in("contact_email", chunk)
      if (data) {
        data.forEach(r => {
          if (r.contact_email) existingEmails.add(r.contact_email.toLowerCase())
        })
      }
    }

    // Also check existing by data_source + external_id (avoid re-importing same record)
    const externalIds = records.map(r => r.external_id).filter(Boolean)
    const existingExternalIds = new Set<string>()
    for (let i = 0; i < externalIds.length; i += 500) {
      const chunk = externalIds.slice(i, i + 500)
      const { data } = await supabase
        .from("master_subcontractors")
        .select("external_id")
        .eq("data_source", dataSourceValue)
        .in("external_id", chunk)
      if (data) {
        data.forEach(r => {
          if (r.external_id) existingExternalIds.add(r.external_id)
        })
      }
    }

    // Check suppression list
    const emailsToCheck = records
      .map(r => r.contact_email?.toLowerCase())
      .filter(Boolean)
    const suppressedEmails = new Set<string>()
    for (let i = 0; i < emailsToCheck.length; i += 500) {
      const chunk = emailsToCheck.slice(i, i + 500)
      const { data } = await supabase
        .from("email_suppression_list")
        .select("email")
        .in("email", chunk)
      if (data) {
        data.forEach(r => suppressedEmails.add(r.email))
      }
    }

    // Filter to new records only
    const newRecords = records.filter(r => {
      // Skip if external_id already exists for this source
      if (r.external_id && existingExternalIds.has(r.external_id)) return false
      // Skip if email already in database
      if (r.contact_email && existingEmails.has(r.contact_email.toLowerCase())) return false
      // Skip if email is suppressed
      if (r.contact_email && suppressedEmails.has(r.contact_email.toLowerCase())) return false
      return true
    })

    const stats: Record<string, any> = {
      source: sourceName,
      totalInFile: lines.length - 1,
      parsed: records.length,
      parseErrors,
      duplicatesSkipped: records.length - newRecords.length,
      suppressedSkipped: records.filter(r => r.contact_email && suppressedEmails.has(r.contact_email.toLowerCase())).length,
      newRecords: newRecords.length,
      inserted: 0,
      errors: 0,
    }

    if (dryRun) {
      return new Response(JSON.stringify({
        dryRun: true,
        stats,
        sampleRecords: newRecords.slice(0, 5),
      }), { headers: corsHeaders })
    }

    // 4. Insert new records in batches (cap at 500 per invocation to stay within function timeout)
    const MAX_INSERT = 500
    const recordsToInsert = newRecords.slice(0, MAX_INSERT)
    stats.newRecords = newRecords.length
    if (newRecords.length > MAX_INSERT) {
      stats.remaining = newRecords.length - MAX_INSERT
    }

    const BATCH_SIZE = 100
    for (let i = 0; i < recordsToInsert.length; i += BATCH_SIZE) {
      const batch = recordsToInsert.slice(i, i + BATCH_SIZE).map(r => ({
        company_name: r.company_name,
        contact_email: r.contact_email?.toLowerCase() || null,
        contact_phone: r.contact_phone,
        contact_name: r.contact_name,
        address_line1: r.address || null,
        city: r.city,
        state: r.state,
        zip_code: r.zip_code,
        description: r.description,
        trade_categories: r.trade_categories,
        small_business_types: r.small_business_types,
        data_source: r.data_source,
        external_id: r.external_id,
        slug: generateSlug(r.company_name) + '-' + Math.random().toString(36).slice(2, 8),
        profile_completeness: calculateCompleteness(r),
        data_health_score: 50,
      }))

      const { error } = await supabase
        .from("master_subcontractors")
        .insert(batch)
      
      if (error) {
        // Try one by one on batch failure
        for (const record of batch) {
          const { error: singleError } = await supabase
            .from("master_subcontractors")
            .insert(record)
          if (singleError) {
            stats.errors++
          } else {
            stats.inserted++
          }
        }
      } else {
        stats.inserted += batch.length
      }
    }

    // Log the import
    await supabase.from("database_hygiene_log").insert({
      action: `state_import_${source || format}`,
      reason: `Imported ${stats.inserted} new records from ${sourceName} (${stats.duplicatesSkipped} duplicates skipped, ${stats.errors} errors)`,
      performed_at: new Date().toISOString(),
    })

    return new Response(JSON.stringify({ success: true, stats }), { headers: corsHeaders })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
}
