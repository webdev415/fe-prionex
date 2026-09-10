/**
 * Read "English (B2), Polish (A2)" back into rows.
 *
 * The level is optional because people write both, and a language typed twice
 * is folded here rather than left for the table's unique constraint to refuse
 * with an error nobody can act on.
 */
export function parseLanguages(raw: string) {
  const seen = new Set<string>()
  const parsed: Array<{ language: string; level: string | null }> = []

  for (const piece of raw.split(',')) {
    const text = piece.trim()
    if (!text) continue
    const match = text.match(/^(.*?)\s*\(([^)]*)\)$/)
    const language = (match ? match[1] : text).trim()
    if (!language || seen.has(language.toLowerCase())) continue
    seen.add(language.toLowerCase())
    parsed.push({ language, level: match ? match[2].trim() || null : null })
  }

  return parsed
}
