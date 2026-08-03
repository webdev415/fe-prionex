import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Cyrillic → Latin transliteration for deriving human-readable API codes/ids
// (tags, letter types). Follows the Ukrainian national romanization (KMU №55):
// г→h, ґ→g, и→y, і→i, ї→i, є→ie, й→i, х→kh, ц→ts, ч→ch, ш→sh, щ→shch, ю→iu,
// я→ia, ь→''. Russian-only letters (ё, ы, э, ъ) are kept for mixed-language input.
const TRANSLIT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'h',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'zh',
  з: 'z',
  и: 'y',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'iu',
  я: 'ia',
  є: 'ie',
  і: 'i',
  ї: 'i',
  ґ: 'g',
}

/**
 * Generate a slug code from a name string (Cyrillic → Latin transliteration).
 *
 * The result always satisfies the backend id pattern `[a-z][a-z0-9_-]*` — or is
 * empty when the name has no transliterable letters. Non-alphanumerics collapse
 * to `_`, and a leading `n` is prepended when the slug would otherwise start with
 * a digit (backend ids must begin with a letter).
 */
export function generateCode(name: string): string {
  const slug = name
    .toLowerCase()
    .split('')
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 50)
  if (slug && !/^[a-z]/.test(slug)) {
    return `n${slug}`.slice(0, 50)
  }
  return slug
}
