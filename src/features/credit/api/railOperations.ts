/**
 * Операции рельса кредита — разбор ответа модуля для вкладки «Платежі» (17-6f).
 *
 * Своих правил о деньгах здесь нет: передал ли модуль операцию, принял ли её
 * Zūm и каким ключом связан колбэк, модуль уже посчитал и назвал полями
 * (`submission`, `provider_accepted`, `matched_by`). Здесь только то, как это
 * прочитать оператору: какой ячейке что сказать и чей это код или статус.
 *
 * Порядок операций, колбэков и шагов — как отдал модуль. Пересортировка
 * спрятала бы поздний отказ EFT: `Completed` сменяется на `Failed` до 90 дней
 * спустя, и такой колбэк обязан стоять после первого, а не рядом с ним.
 *
 * Время в этом модуле не форматируется: момент возвращается как есть, пояс
 * юрисдикции подставляет экран.
 */
import {
  CREDIT_MODULE_RAIL_FAILURE_CODES,
  CREDIT_MODULE_RAIL_FAILURE_PATTERNS,
  CREDIT_RAIL_MODULE_STATUSES,
  CREDIT_RAIL_STAND_FAILURE_CODES,
  CREDIT_ZUM_EVENTS,
  CREDIT_ZUM_FAILURE_CODES,
  CREDIT_ZUM_STATUSES,
} from './enums'
import type {
  CreditPayment,
  CreditRailCallback,
  CreditRailEvent,
  CreditRailOperation,
} from './types'

/**
 * `t` принимаем структурным типом, а не `TFunction` (как `idle.ts`): нужен
 * только вызов с ключом и параметрами.
 */
type Translate = (key: string, options?: Record<string, unknown>) => string

/** Провайдер боевого рельса. Всё прочее (`mock`, `demo`) — синтетика стенда. */
const ZUM_PROVIDER = 'zum'

const isIn = (list: readonly string[], value: string): boolean => list.includes(value)

/* ─── «Передано в Zūm» ──────────────────────────────────────────────────── */

export type Submission =
  | { kind: 'sent'; at: string; acknowledged: boolean }
  | { kind: 'notRecorded' }
  | { kind: 'notSent' }
  | { kind: 'notYet' }
  | { kind: 'unknown' }

/**
 * Передана ли операция Zūm — по признаку модуля, без выдуманного времени.
 *
 * 1. Модуль сказал «остановлено до отправки», и Zūm операцию не назвал →
 *    «не відправлялась», даже если момент вызова записан: проба ANR идёт
 *    внутри вызова, предпроверка суммы адаптера — до сети. Своего списка
 *    кодов «до отправки» у экрана нет: правило одно, у модуля.
 * 2. Модуль вызвал рельс → время начала вызова. Zūm операцию не назвал —
 *    строка «Zūm не підтвердив прийом» (потерянный ответ, `no_token`,
 *    `no_user_id`, отказ без id).
 * 3. Zūm операцию назвал, а момента нет (строка старше учёта, обрыв между
 *    вызовом и фиксацией, противоречивая пара) → «передано, час не записано»:
 *    id от Zūm значит «принял», и никакой код этого не отменит.
 * 4. В пути → «ще не передано»; 5. иначе → «невідомо, чи передано».
 *
 * `created_at` не подставляется никогда: строка заводится до проверок отказа.
 * `rail_call_returned_at` — тоже: это «вызов вернулся», а не «передано».
 */
export function submissionOf(op: CreditRailOperation): Submission {
  if (op.submission === 'stopped_before_send' && !op.provider_accepted) return { kind: 'notSent' }
  if (op.submission === 'rail_called' && op.rail_call_started_at) {
    return { kind: 'sent', at: op.rail_call_started_at, acknowledged: op.provider_accepted }
  }
  if (op.provider_accepted) return { kind: 'notRecorded' }
  if (op.state === 'pending') return { kind: 'notYet' }
  return { kind: 'unknown' }
}

/* ─── Код отказа ────────────────────────────────────────────────────────── */

type CodeClass = 'module' | 'transportHttp' | 'zum' | 'stand' | 'unknown'

/**
 * Чей код. Порядок: модуль → семейство модуля → Zūm → стенд → незнакомый.
 * Семейство распознаётся шаблоном контракта ЦЕЛИКОМ: `zum_http_50` ему не
 * принадлежит и остаётся незнакомым кодом.
 */
function codeClass(code: string): CodeClass {
  if (isIn(CREDIT_MODULE_RAIL_FAILURE_CODES, code)) return 'module'
  if (CREDIT_MODULE_RAIL_FAILURE_PATTERNS.some((pattern) => new RegExp(pattern).test(code))) {
    return 'transportHttp'
  }
  if (isIn(CREDIT_ZUM_FAILURE_CODES, code)) return 'zum'
  if (isIn(CREDIT_RAIL_STAND_FAILURE_CODES, code)) return 'stand'
  return 'unknown'
}

/**
 * Текст кода — один на раздел: панель выплаты и список операций зовут эту
 * функцию. Незнакомый код — «Невідомий код: X» без приписки владельца: код
 * модуля появляется и без пересъёмки снимка (семейство `zum_http_*` так и
 * появилось), и «незнакомое — значит Zūm» было бы ложью оператору.
 */
export function railFailureText(t: Translate, code: string): string {
  switch (codeClass(code)) {
    case 'transportHttp':
      // Шаблон семейства — `^zum_http_[0-9]{3}$`: статус HTTP стоит после последнего `_`.
      return t('credit.railOps.code.transportHttp', {
        status: code.slice(code.lastIndexOf('_') + 1),
      })
    case 'unknown':
      return t('credit.railOps.code.unknown', { code })
    default:
      return t(`credit.railFailure.${code}`)
  }
}

/**
 * Мелкая подпись «чей это код» с самим кодом дословно. Код модуля и семейство
 * — «код модуля»: это НАШ отказ, а не `FailedTransactionEvent` Zūm. `NSF` —
 * слово харнесса стенда. У незнакомого подписи нет: его текст уже несёт код.
 */
export function railCodeLabel(t: Translate, code: string): string | null {
  switch (codeClass(code)) {
    case 'module':
    case 'transportHttp':
      return t('credit.railOps.code.module', { code })
    case 'zum':
      return t('credit.railOps.code.zum', { code })
    case 'stand':
      return t('credit.railOps.code.stand', { code })
    default:
      return null
  }
}

/* ─── Статус ────────────────────────────────────────────────────────────── */

/**
 * Статуса нет. Контракт обещает `null`, а живая дверь отдаёт и сохранённую
 * пустую строку — обе значат «Zūm статус не назвав».
 */
export function isBlankStatus(status: string | null): boolean {
  return status === null || status.trim() === ''
}

/**
 * Понятный текст статуса. Слово модуля (`NotFound` — сверка не нашла операцию у
 * Zūm) своим словарём: за слово провайдера оно не выдаётся.
 */
export function statusText(t: Translate, status: string | null): string {
  if (isBlankStatus(status)) return t('credit.railOps.status.empty')
  const word = status ?? ''
  if (isIn(CREDIT_RAIL_MODULE_STATUSES, word)) return t(`credit.railModuleStatus.${word}`)
  if (isIn(CREDIT_ZUM_STATUSES, word)) return t(`credit.zumStatus.${word}`)
  return t('credit.railOps.status.unknown', { status: word })
}

/**
 * Мелкая подпись со словом дословно — по нему сверяются с поддержкой Zūm. У
 * пустого статуса подписи нет («статус Zūm: » с пустым хвостом — бессмыслица),
 * у незнакомого тоже: его текст уже несёт слово.
 */
export function statusLabel(t: Translate, status: string | null): string | null {
  if (isBlankStatus(status)) return null
  const word = status ?? ''
  if (isIn(CREDIT_RAIL_MODULE_STATUSES, word)) {
    return t('credit.railOps.status.moduleLabel', { status: word })
  }
  if (isIn(CREDIT_ZUM_STATUSES, word)) return t('credit.railOps.status.label', { status: word })
  return null
}

/* ─── Колбэки ───────────────────────────────────────────────────────────── */

export interface CallbackLine {
  callback: CreditRailCallback
  /** Подпись не сошлась — к деньгам колбэк не применён. */
  signatureMismatch: boolean
  /** Модуль колбэк ещё не применил. */
  notProcessed: boolean
  /**
   * Связан нашим ключом операции: id Zūm в колбэке не совпал ни с одной
   * операцией, и в поддержке Zūm по id операции его не найти.
   */
  matchedByKey: boolean
}

/** Каждый колбэк своей строкой, в порядке прихода, — не только последний. */
export function callbackLines(op: CreditRailOperation): CallbackLine[] {
  return op.callbacks.map((callback) => ({
    callback,
    signatureMismatch: !callback.signature_ok,
    notProcessed: callback.processed_at === null,
    matchedByKey: callback.matched_by === 'client_transaction_id',
  }))
}

export type NoCallback =
  | { kind: 'notAsked' }
  | { kind: 'waiting' }
  | { kind: 'awaitingReconciliation' }
  | { kind: 'none' }
  | { kind: 'noneObserved'; at: string }

/**
 * Что сказать, когда колбэков нет. Пустая ячейка читалась бы как «ответа не
 * было, деньги не ушли», поэтому отсутствие называется словами:
 * - операция не отправлялась → «—»: спрашивать Zūm было не о чем;
 * - в пути → «чекаємо»; исход неизвестен → «з'ясовує звірка»: «стан модуль
 *   з'ясував» было бы утверждением об уже выясненном;
 * - итоговый исход → «модуль з'ясував без колбеку» и, если есть, когда
 *   узнал в последний раз (ответом, колбэком или сверкой).
 */
export function noCallbackText(op: CreditRailOperation): NoCallback {
  if (submissionOf(op).kind === 'notSent') return { kind: 'notAsked' }
  if (op.state === 'pending') return { kind: 'waiting' }
  if (op.state === 'unknown') return { kind: 'awaitingReconciliation' }
  return op.observed_at ? { kind: 'noneObserved', at: op.observed_at } : { kind: 'none' }
}

/* ─── Шаги Zūm ──────────────────────────────────────────────────────────── */

export interface EventLines {
  /** Шаги в порядке модуля. */
  events: CreditRailEvent[]
  /** Отброшено модулем: имя не прочитано. */
  dropped: number
  /**
   * Что сказать без шагов: `notAsked` — «—» (Zūm об операции не знал),
   * `none` — «Zūm не надсилав історію кроків», `null` — шаги есть или часть
   * отброшена (тогда «не надсилав» было бы неправдой).
   */
  empty: 'notAsked' | 'none' | null
}

export function eventLines(op: CreditRailOperation): EventLines {
  const nothing = op.events.length === 0 && op.events_dropped === 0
  return {
    events: op.events,
    dropped: op.events_dropped,
    empty: nothing ? (submissionOf(op).kind === 'notSent' ? 'notAsked' : 'none') : null,
  }
}

/**
 * Текст шага. Событие отказа носит имя кода Zūm и говорит тем же текстом, что
 * и код, — у одного кода один текст. Незнакомое имя — «Невідома подія (X)».
 */
export function eventText(t: Translate, name: string): string {
  if (isIn(CREDIT_ZUM_EVENTS, name)) return t(`credit.zumEvent.${name}`)
  if (isIn(CREDIT_ZUM_FAILURE_CODES, name)) return t(`credit.railFailure.${name}`)
  return t('credit.railOps.event.unknown', { event: name })
}

/** Мелкая подпись с именем шага дословно; у незнакомого её нет — имя уже в тексте. */
export function eventLabel(t: Translate, name: string): string | null {
  return isIn(CREDIT_ZUM_EVENTS, name) || isIn(CREDIT_ZUM_FAILURE_CODES, name)
    ? t('credit.railOps.event.label', { event: name })
    : null
}

/* ─── Платёж ────────────────────────────────────────────────────────────── */

export type PaymentCell =
  | { kind: 'none' }
  | { kind: 'noneFailedCollect' }
  | { kind: 'found'; payment: CreditPayment; reversed: boolean }
  | { kind: 'notFound' }

/**
 * Платёж операции — только по `payment_id`: по сумме и дате два одинаковых
 * взноса неразличимы. Правила по порядку:
 * 1. выплата → «—»: платежа у неё нет по построению;
 * 2. неудавшееся списание без платежа → «платежу немає»: строка есть, и отказ
 *    не прячется;
 * 3. платежи ещё не загружены или не пришли → «—», а не «не знайдено»;
 * 4. найден → дата и сумма, у сторнированной операции — пометка;
 * 5. не найден → «не знайдено у списку».
 */
export function paymentCellOf(
  op: CreditRailOperation,
  payments: readonly CreditPayment[],
  paymentsReady: boolean
): PaymentCell {
  if (op.direction !== 'collect') return { kind: 'none' }
  if (op.payment_id === null) {
    return op.state === 'failed' || op.state === 'cancelled'
      ? { kind: 'noneFailedCollect' }
      : { kind: 'none' }
  }
  if (!paymentsReady) return { kind: 'none' }
  const payment = payments.find((candidate) => candidate.payment_id === op.payment_id)
  return payment
    ? { kind: 'found', payment, reversed: op.state === 'reversed' }
    : { kind: 'notFound' }
}

/** Операция платежа для метки в его строке — только по `payment_id`. */
export function paymentMarkOf(
  payment: CreditPayment,
  operations?: readonly CreditRailOperation[]
): CreditRailOperation | null {
  return operations?.find((op) => op.payment_id === payment.payment_id) ?? null
}

/** `id` строки операции: на него ссылается метка из строки платежа. */
export function railOperationAnchor(op: CreditRailOperation): string {
  return `rail-op-${encodeURIComponent(op.client_transaction_id)}`
}

/**
 * Провайдеры не боевого рельса среди операций — по одному, в порядке первого
 * появления. Условие «не `zum`», а не «`mock`»: строка `demo` иначе была бы
 * подписана «статус Zūm» и «код Zūm» без оговорки.
 */
export function nonZumProviders(operations: readonly CreditRailOperation[]): string[] {
  const seen: string[] = []
  for (const op of operations) {
    if (op.provider !== ZUM_PROVIDER && !seen.includes(op.provider)) seen.push(op.provider)
  }
  return seen
}
