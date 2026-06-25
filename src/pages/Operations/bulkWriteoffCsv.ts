/**
 * CSV helpers for the bulk write-off import page.
 *
 * Kept in a standalone module (not the page component) so the helpers can
 * be exported and unit-tested without tripping the
 * `react-refresh/only-export-components` lint rule.
 */

/**
 * Detect the field delimiter from the header line.
 *
 * Excel exports in European / Cyrillic locales use ';' (the comma is the
 * decimal separator there); a plain export uses ','. We pick the candidate
 * that splits the header into the most fields, defaulting to ',' on ties so
 * existing comma files are unaffected. Mirrors the backend parser's
 * `_detect_delimiter`.
 */
export function detectDelimiter(headerLine: string): string {
  const candidates = [',', ';', '\t']
  let best = ','
  let bestCount = 0
  for (const d of candidates) {
    const count = headerLine.split(d).length - 1
    if (count > bestCount) {
      best = d
      bestCount = count
    }
  }
  return best
}
