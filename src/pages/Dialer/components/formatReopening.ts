import { intlLocaleForUiLanguage } from '@/lib/i18n'

/**
 * The reopening instant in the window's own zone, e.g. "Mon 21 Sep, 09:00".
 * Rendered in the project's zone rather than the browser's: a supervisor in
 * another zone reading "resumes 08:00" when the rule says 09:00 would be
 * reading the right instant as the wrong promise.
 */
export function formatReopening(iso: string, timeZone: string, language: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }
  try {
    return new Intl.DateTimeFormat(intlLocaleForUiLanguage(language), {
      ...options,
      timeZone,
    }).format(date)
  } catch {
    // An unknown zone would silently fall back to the browser's, printing a
    // time that is not the one the rule uses. Better to print nothing.
    return ''
  }
}
