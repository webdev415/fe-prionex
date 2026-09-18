import i18n from '@/lib/i18n'

export type LegalLetterVariableGroup = 'client' | 'incoming' | 'reply' | 'company'

export interface LegalLetterTemplateVariable {
  name: string
  group: LegalLetterVariableGroup
}

/** Group render order for the variable palette. */
export const LEGAL_LETTER_VARIABLE_GROUP_ORDER: readonly LegalLetterVariableGroup[] = [
  'client',
  'incoming',
  'reply',
  'company',
] as const

/**
 * Every placeholder a legal letter template can carry, grouped for the palette.
 * Each `name` matches both the `{{name}}` token used in template bodies and a
 * field of `LegalTemplateFillContext`, so a palette entry and its prefill source
 * never drift apart. i18n labels/descriptions live under
 * `pages.lawyerWorkplace.settings.templates.variables[.Descriptions]` keyed by name.
 */
export const LEGAL_LETTER_TEMPLATE_VARIABLES: readonly LegalLetterTemplateVariable[] = [
  { name: 'clientName', group: 'client' },
  { name: 'clientTaxId', group: 'client' },
  { name: 'contract', group: 'client' },
  { name: 'debtAmount', group: 'client' },
  { name: 'senderName', group: 'incoming' },
  { name: 'incomingRef', group: 'incoming' },
  { name: 'incomingDate', group: 'incoming' },
  { name: 'caseNo', group: 'incoming' },
  { name: 'requestNo', group: 'incoming' },
  { name: 'outNo', group: 'reply' },
  { name: 'date', group: 'reply' },
  { name: 'dueDate', group: 'reply' },
  { name: 'lawyerName', group: 'reply' },
  { name: 'attachments', group: 'reply' },
  { name: 'companyName', group: 'company' },
  { name: 'companyPhone', group: 'company' },
] as const

/**
 * Company identity stamped into reply templates.
 * `phone` stays null until Finance confirms the public legal-department number —
 * a null value keeps `{{companyPhone}}` visible in the draft so it is not missed.
 */
export const LEGAL_COMPANY_INFO: { name: string; phone: string | null } = {
  name: 'ТОВ «ФК «ТЕХНОФІНАНС»',
  phone: null,
}

export function projectCompanyInfo(
  country: string,
  project: { full_company_name?: string | null; hotline_phone?: string | null } | null | undefined
): { name: string | null; phone: string | null } {
  const name = project?.full_company_name?.trim() || null
  const phone = project?.hotline_phone?.trim() || null
  return {
    name: name ?? (country === 'ES' ? null : LEGAL_COMPANY_INFO.name),
    phone: phone ?? LEGAL_COMPANY_INFO.phone,
  }
}

const FALLBACK_EMPTY = '—'

/**
 * Format an ISO date as a template value. Returns null when the source is
 * absent or unparseable so a prefill caller can leave the `{{placeholder}}`
 * intact instead of emitting a dash.
 */
export function formatTemplateDate(
  iso: string | null | undefined,
  language: string
): string | null {
  if (!iso?.trim()) return null
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString(language, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Best-effort incoming reference number lifted from a subject line
 * (e.g. "12-3456" or a bare "3456"). Null when nothing matches — the caller
 * then leaves `{{incomingRef}}` for the lawyer to fill in.
 */
export function extractIncomingRef(subject: string | null | undefined): string | null {
  if (!subject) return null
  const hyphenated = subject.match(/\b\d{1,4}-\d{2,6}\b/)
  if (hyphenated) return hyphenated[0]
  const plain = subject.match(/\b\d{4,8}\b/)
  return plain ? plain[0] : null
}

const CASE_TOKEN = '[0-9A-Za-zА-Яа-яІіЇїЄєҐґ]+(?:[-/][0-9A-Za-zА-Яа-яІіЇїЄєҐґ]+)*'
const CASE_NO_RE = new RegExp(`справ[аіи]?\\s*(?:№|N|#)?\\s*(${CASE_TOKEN})`, 'iu')

/**
 * Best-effort court case number lifted from a subject line
 * ("у справі №910/456/24" → "910/456/24"). Null when there is no "справ…"
 * marker, so the caller leaves `{{caseNo}}` intact.
 */
export function extractCaseNo(subject: string | null | undefined): string | null {
  if (!subject) return null
  const match = subject.match(CASE_NO_RE)
  return match?.[1] ?? null
}

/**
 * Prefill context for a reply/outgoing template. Every field is optional;
 * fields left undefined/empty keep their `{{placeholder}}` in the output
 * (see {@link fillTemplateVariables}).
 */
export interface LegalTemplateFillContext {
  clientName?: string | null
  clientTaxId?: string | null
  contract?: string | null
  debtAmount?: string | null
  senderName?: string | null
  incomingRef?: string | null
  incomingDate?: string | null
  caseNo?: string | null
  requestNo?: string | null
  outNo?: string | null
  date?: string | null
  dueDate?: string | null
  lawyerName?: string | null
  attachments?: string | null
  companyName?: string | null
  companyPhone?: string | null
}

/**
 * Substitute the `{{name}}` placeholders in `text` with the matching non-empty
 * values from `context`. Anything without a value — an omitted field, an empty
 * string, or a token unknown to the context such as `{{outNo}}` (assigned at
 * send time) — is left untouched as `{{name}}`. Pure and locale-agnostic:
 * callers pass already-formatted display strings.
 */
export function fillTemplateVariables(text: string, context: LegalTemplateFillContext): string {
  let result = text
  for (const [key, value] of Object.entries(context)) {
    if (typeof value === 'string' && value.trim().length > 0) {
      result = result.replaceAll(`{{${key}}}`, value)
    }
  }
  return result
}

export interface LegalLetterTemplateContext {
  clientName?: string | null
  contract?: string | null
  referenceId?: string | null
  dueDate?: string | null
  date?: string
}

function resolveRequestNo(context: LegalLetterTemplateContext): string {
  return context.referenceId?.trim() || FALLBACK_EMPTY
}

export function applyLetterTemplatePlaceholders(
  body: string,
  context: LegalLetterTemplateContext,
  options?: { language?: string }
): string {
  const language = options?.language ?? i18n.language
  const today = context.date ?? new Date().toISOString().slice(0, 10)
  const requestNo = resolveRequestNo(context)
  // Letter body language follows the recipient (options.language), not the UI —
  // resolve the client fallback in that language, not the operator's locale.
  const clientFallback = i18n.getFixedT(language)(
    'pages.lawyerWorkplace.letterTemplate.clientFallback',
    'Client'
  )

  const replacements: Record<string, string> = {
    clientName: context.clientName?.trim() || clientFallback,
    date: today,
    dueDate: formatTemplateDate(context.dueDate, language) ?? FALLBACK_EMPTY,
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
