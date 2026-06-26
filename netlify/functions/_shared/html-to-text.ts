/**
 * Converts HTML email content to a plain-text alternative.
 * Preserves links, headings, and list structure for readability.
 */
export function htmlToPlainText(html: string): string {
  let text = html
    // Replace <br> variants with newlines
    .replace(/<br\s*\/?>/gi, "\n")
    // Replace block-level closing tags with double newline
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n\n")
    // Replace <hr> with separator
    .replace(/<hr\s*\/?>/gi, "\n---\n")
    // Extract link text and URL
    .replace(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, "$2 ($1)")
    // Replace list items with bullet points
    .replace(/<li[^>]*>/gi, "  - ")
    // Strip remaining HTML tags
    .replace(/<[^>]+>/g, "")
    // Decode common HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&ndash;/g, "\u2013")
    .replace(/&bull;/g, "\u2022")
    .replace(/&#\d+;/g, "")
    // Collapse multiple blank lines
    .replace(/\n{3,}/g, "\n\n")
    // Trim whitespace from each line
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim()

  return text
}
