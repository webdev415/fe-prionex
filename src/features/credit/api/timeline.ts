/**
 * Хронология карточки заявки — разбор ответа модуля без собственных правил.
 *
 * Порядок строк, свёртку однотипных событий и область `scope` решает модуль
 * (`InternalApplication.timeline`). Здесь только то, что нужно экрану: как
 * назвать событие сайта, какие строки — письма клиенту и честно ли показано
 * число событий. Пересортировать строки здесь нельзя: модуль уже упорядочил
 * их по времени источника, а сортировка по строке `at` поставила бы метки с
 * разными смещениями зоны не туда.
 */
import type { TFunction } from 'i18next'
import { CREDIT_MAIL_EVENTS, CREDIT_PORTAL_EVENTS } from './enums'
import type { CreditPortalEventRecord, CreditTimelineRow } from './types'

/** Известно ли имя события по нашему снимку реестра витрины. */
export function isKnownPortalEvent(event: string): boolean {
  return (CREDIT_PORTAL_EVENTS as readonly string[]).includes(event)
}

/**
 * Подпись события сайта. Незнакомое имя показывается КАК ЕСТЬ, но с пометкой
 * «подія сайту»: контракт держит словарь открытым, а голое машинное имя без
 * пометки оператор прочёл бы как поломку экрана.
 */
export function portalEventLabel(t: TFunction, event: string): string {
  return isKnownPortalEvent(event)
    ? t(`credit.portalEvent.${event}`)
    : t('credit.portalEvent.unknown', { name: event })
}

/** Строка хронологии — письмо клиенту (событие сайта из `CREDIT_MAIL_EVENTS`). */
export function isMailRow(row: CreditTimelineRow): boolean {
  const event = row.client?.event
  return (
    row.track === 'client' &&
    typeof event === 'string' &&
    (CREDIT_MAIL_EVENTS as readonly string[]).includes(event)
  )
}

/**
 * Хронология пришла и в ней есть строки. Пустой массив читается так же, как
 * отсутствие поля: модуль кладёт в хронологию хотя бы переход создания заявки,
 * и пустая лента значит «не передал», а не «ничего не было».
 */
export function hasTimeline(timeline: unknown): timeline is CreditTimelineRow[] {
  return Array.isArray(timeline) && timeline.length > 0
}

/** Есть ли в хронологии переходы статуса — иначе их показывает прежний список `audit`. */
export function hasStatusRows(timeline: CreditTimelineRow[]): boolean {
  return timeline.some((row) => row.track === 'status')
}

/**
 * Письма клиенту из хронологии — те же строки, в том же порядке. Читается
 * защитно: ответ приходит приведением типа без разбора схемы, и не-массив на
 * месте ленты не должен ронять карточку.
 */
export function mailRows(timeline: unknown): CreditTimelineRow[] {
  return (Array.isArray(timeline) ? (timeline as CreditTimelineRow[]) : []).filter(isMailRow)
}

/**
 * Честное число событий сайта: лента карточки ограничена потолком модуля, и
 * без этой строки усечение читалось бы как «событий больше не было». `null` —
 * показано всё, модуль числа не прислал или не прислал саму ленту: «показано 0
 * из N» без ленты было бы выдумкой — сколько показано, неизвестно.
 */
export function truncatedPortalEvents(
  portalEvents: CreditPortalEventRecord[] | undefined,
  total: number | undefined
): { shown: number; total: number } | null {
  if (typeof total !== 'number' || !Array.isArray(portalEvents)) return null
  const shown = portalEvents.length
  return total > shown ? { shown, total } : null
}

/* ─── Письма сайта в паспорте кредита ─────────────────────────────────── */

type PortalEventsTruncation = ReturnType<typeof truncatedPortalEvents>

/**
 * Что показывает панель «Листи сайту» карточки кредита. `notProvided` — ленты
 * нет, и числа об усечении здесь нет тоже: сколько показано, неизвестно.
 */
export type LoanSiteMailState =
  | { kind: 'notProvided' }
  | { kind: 'none'; truncated: PortalEventsTruncation }
  | { kind: 'rows'; rows: CreditPortalEventRecord[]; truncated: PortalEventsTruncation }

/** Элемент ленты — письмо клиенту: объект со строковым `event` из `CREDIT_MAIL_EVENTS`. */
function isMailRecord(record: unknown): record is CreditPortalEventRecord {
  if (!record || typeof record !== 'object') return false
  const event = (record as { event?: unknown }).event
  return typeof event === 'string' && (CREDIT_MAIL_EVENTS as readonly string[]).includes(event)
}

/**
 * Состояние ленты писем кредита — по ФОРМЕ поля, а не по числу строк. У ленты
 * кредита пустой массив законен: по кредиту, о котором сайт ничего не сообщал,
 * модуль отдаёт `[]`, и правило хронологии заявки «пустая = не передал» здесь
 * было бы ложью. Письма — в порядке модуля, без пересортировки. Строка об
 * усечении считает СОБЫТИЯ ленты, а не письма: потолок модуля режет все события
 * кредита, и письма могли остаться в обрезанной части.
 */
export function loanSiteMailState(portalEvents: unknown, total: unknown): LoanSiteMailState {
  if (!Array.isArray(portalEvents)) return { kind: 'notProvided' }
  const events = portalEvents as CreditPortalEventRecord[]
  const truncated = truncatedPortalEvents(events, typeof total === 'number' ? total : undefined)
  const rows = events.filter(isMailRecord)
  return rows.length === 0 ? { kind: 'none', truncated } : { kind: 'rows', rows, truncated }
}

/**
 * Вид письма-уведомления словами — по коду повода модуля (`details.type`).
 * `null` — у события вида письма нет (письмо с кодом, прочие события). Словарь
 * поводов чужой и открытый: незнакомый повод показывается как есть с пометкой,
 * а не выдаётся за «не названо». Ключи — статическими вызовами: код повода несёт
 * точку (`loan.issued`), и динамический ключ лёг бы в словаре вложенным путём.
 */
export function loanMailKind(t: TFunction, record: CreditPortalEventRecord): string | null {
  if (record.event !== ('notification_mailed' satisfies (typeof CREDIT_MAIL_EVENTS)[number])) {
    return null
  }
  const type = record.details?.type
  if (typeof type !== 'string' || type.trim() === '') return t('credit.loanMail.kindMissing')
  switch (type) {
    case 'loan.issued':
      return t('credit.loanMail.kind.issued')
    case 'loan.disbursement_reversed':
      return t('credit.loanMail.kind.disbursementReversed')
    case 'loan.payment.allocated':
      return t('credit.loanMail.kind.paymentAllocated')
    case 'loan.delinquency.changed':
      return t('credit.loanMail.kind.delinquencyChanged')
    case 'loan.closed':
      return t('credit.loanMail.kind.closed')
    default:
      return t('credit.loanMail.kindUnknown', { type })
  }
}
