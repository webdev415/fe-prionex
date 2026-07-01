export interface LegalLetterTemplateContext {
  clientName?: string | null
  contract?: string | null
  referenceId?: string | null
  dueDate?: string | null
  date?: string
}

export const LEGAL_LETTER_TEMPLATE_VARIABLES = [
  { name: 'clientName', labelKey: 'clientName' },
  { name: 'date', labelKey: 'date' },
  { name: 'dueDate', labelKey: 'dueDate' },
  { name: 'requestNo', labelKey: 'requestNo' },
  { name: 'contract', labelKey: 'contract' },
] as const

const FALLBACK_CLIENT = 'Client'
const FALLBACK_EMPTY = '—'

function formatTemplateDueDate(iso: string | null | undefined, language: string): string {
  if (!iso?.trim()) return FALLBACK_EMPTY
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return FALLBACK_EMPTY
  return parsed.toLocaleDateString(language, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function resolveRequestNo(context: LegalLetterTemplateContext): string {
  return context.referenceId?.trim() || FALLBACK_EMPTY
}

export function applyLetterTemplatePlaceholders(
  body: string,
  context: LegalLetterTemplateContext,
  options?: { language?: string }
): string {
  const language = options?.language ?? 'en'
  const today = context.date ?? new Date().toISOString().slice(0, 10)
  const requestNo = resolveRequestNo(context)

  const replacements: Record<string, string> = {
    clientName: context.clientName?.trim() || FALLBACK_CLIENT,
    date: today,
    dueDate: formatTemplateDueDate(context.dueDate, language),
    requestNo,
    referenceId: requestNo,
    contract: context.contract?.trim() || FALLBACK_EMPTY,
  }

  let result = body
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replaceAll(`{{${key}}}`, value)
  }
  return result
}

/** @deprecated Use applyLetterTemplatePlaceholders */
export function applyReplyTemplatePlaceholders(
  body: string,
  context: LegalLetterTemplateContext,
  options?: { language?: string }
): string {
  return applyLetterTemplatePlaceholders(body, context, options)
}
