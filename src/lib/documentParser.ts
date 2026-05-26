import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export async function parseFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''

  if (ext === 'pdf') {
    return parsePdf(file)
  }
  if (ext === 'xlsx' || ext === 'xls') {
    return parseExcelAsText(file)
  }
  if (ext === 'txt' || ext === 'csv' || ext === 'md') {
    return file.text()
  }
  if (ext === 'json') {
    return file.text()
  }
  // For Word docs and other formats, read as text (best effort)
  try {
    const text = await file.text()
    if (text && text.length > 50 && !text.includes('\x00')) return text
  } catch {
    // ignore
  }
  return `[File: ${file.name} - content could not be extracted. Upload as PDF for best results.]`
}

async function parsePdf(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const pages: string[] = []
    const maxPages = Math.min(pdf.numPages, 30)

    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item: unknown) => {
          const textItem = item as { str?: string }
          return textItem.str || ''
        })
        .join(' ')
      if (pageText.trim()) {
        pages.push(`[Page ${i}]\n${pageText}`)
      }
    }

    if (pages.length === 0) {
      return `[PDF: ${file.name} - no extractable text. This may be a scanned document.]`
    }

    return pages.join('\n\n')
  } catch (err) {
    console.error('PDF parsing error:', err)
    return `[Error parsing PDF: ${file.name}. The file may be corrupted or password-protected.]`
  }
}

async function parseExcelAsText(file: File): Promise<string> {
  try {
    const XLSX = await import('xlsx')
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const sheets: string[] = []

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const csv = XLSX.utils.sheet_to_csv(sheet)
      if (csv.trim()) {
        sheets.push(`[Sheet: ${sheetName}]\n${csv}`)
      }
    }

    return sheets.join('\n\n') || `[Excel: ${file.name} - no data found]`
  } catch (err) {
    console.error('Excel parsing error:', err)
    return `[Error parsing Excel: ${file.name}]`
  }
}

export async function parseExcelForSubcontractors(file: File): Promise<Array<Record<string, string>>> {
  const XLSX = await import('xlsx')
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(firstSheet, { defval: '' })
  return rows
}
