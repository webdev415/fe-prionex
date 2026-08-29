/**
 * Нормализация анкеты заявки.
 *
 * Анкету ведёт сайт (`web-credit`, packages/application-flow) и присылает
 * блоками: `personal`, `phones`, `address`, `income`, `params`. Состав блоков
 * растёт, поэтому модуль хранит их как есть (JSONB) — и карточка обязана
 * читать боевой формат, а не тот, что удобен экрану.
 *
 * Отдельно поддержан демо-формат (`applicant`) старых сид-заявок стенда: они
 * ещё живут в базах чужих стендов, и показывать по ним пустую карточку —
 * значит уверять оператора, что данных нет, хотя они есть.
 *
 * TODO(после 01.10.2026): сид переведён на боевые блоки 29.08 — когда все
 * стенды пересоздадут демо-данные, legacy-ветку (`applicant`) удалить вместе
 * с её тестом.
 *
 * Вся развилка форматов живёт здесь; страницы работают с готовыми полями.
 */
import type { CreditApplicationDraft } from './types'

export interface NormalizedApplicant {
  fullName: string
  email: string | null
  phone: string | null
  birthDate: string | null
  address: string | null
  incomeMinor: number | null
  incomeFrequency: string | null
  employmentStatus: string | null
  receiptMethod: string | null
  paydays: string[]
  requestedMinor: number | null
  referralSource: string | null
  note: string | null
}

/**
 * Телефон заявителя.
 *
 * Блок `phones` не зафиксирован контрактом, и живые источники разошлись:
 * сайт (web-credit) присылает `{primary: {kind, number}}`, операторский и
 * скриптовый вход — `{items: [{number, is_primary}]}`. Обе формы лежат в базе
 * прямо сейчас (заявки CA-000910 и CA-000973, 29.08), поэтому читаем обе;
 * фиксация словаря блоков анкеты вынесена в WS-05.
 */
function pickPhone(draft: CreditApplicationDraft): string | null {
  const phones = draft.phones
  if (phones?.primary?.number) return phones.primary.number
  const items = phones?.items ?? []
  const primary = items.find((item) => item.is_primary) ?? items[0]
  if (primary?.number) return primary.number
  // Демо-формат стенда.
  return draft.applicant?.phone ?? null
}

export function normalizeDraft(
  draft: CreditApplicationDraft | undefined,
  fallbackEmail: string | null
): NormalizedApplicant {
  const source = draft ?? {}
  const personal = (source.personal ?? {}) as Record<string, string | undefined>
  const legacy = source.applicant ?? {}
  const address = (source.address ?? {}) as Record<string, string | undefined>
  const income = (source.income ?? {}) as Record<string, unknown>
  const params = (source.params ?? {}) as Record<string, unknown>

  const fullName = [
    personal.first_name ?? legacy.first_name,
    personal.last_name ?? legacy.last_name,
  ]
    .filter(Boolean)
    .join(' ')

  const paydays = Array.isArray(income.paydays)
    ? (income.paydays as string[])
    : income.next_payday
      ? [String(income.next_payday)]
      : []

  return {
    fullName,
    // Email в анкете нет: он фиксируется на самой заявке при создании.
    email: legacy.email ?? fallbackEmail,
    phone: pickPhone(source),
    birthDate: personal.birth_date ?? legacy.date_of_birth ?? null,
    address:
      [address.line1, address.city, address.province, address.postal_code]
        .filter(Boolean)
        .join(', ') || null,
    incomeMinor: typeof income.net_amount_minor === 'number' ? income.net_amount_minor : null,
    incomeFrequency: income.frequency ? String(income.frequency) : null,
    employmentStatus: income.employment_status
      ? String(income.employment_status)
      : income.employer
        ? String(income.employer)
        : null,
    receiptMethod: income.receipt_method ? String(income.receipt_method) : null,
    paydays,
    requestedMinor:
      typeof params.amount_minor === 'number'
        ? params.amount_minor
        : typeof params.requested_amount_minor === 'number'
          ? params.requested_amount_minor
          : null,
    referralSource: params.referral_source ? String(params.referral_source) : null,
    note: source.demo_note ? String(source.demo_note) : null,
  }
}
