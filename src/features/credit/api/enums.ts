/**
 * Перечисления контракта, ЗНАЧЕНИЯ которых нужны в рантайме.
 *
 * Зачем отдельный файл. Часть подписей раздела берётся динамически:
 * `t(`credit.entryType.${entry.entry_type}`)`. Такой ключ не виден статическому
 * анализу, и полноту словаря по нему нельзя мерить тем, что попалось на
 * стенде: приёмка 30.08.2026 показала, что `credit.entryType` покрывал 7
 * значений из 13 — остальные шесть рождаются командами кредита, а команды
 * отвечают 501. То есть они вылезли бы оператору машинными именами ровно в
 * день реализации команд, и ни один прогон по стенду этого бы не поймал.
 *
 * Списки — зеркало enum в `credit-module/contracts/openapi.yaml`. Связь с
 * union-типами сделана через `satisfies`: разойдутся — не соберётся.
 */
import type {
  CreditApplicationStatus,
  CreditDisbursement,
  CreditLoanStatus,
  CreditQueueStatus,
} from './types'
import { CREDIT_APPLICATION_STAGES, CREDIT_STAGE_STATES } from './applicationStages'

/**
 * Типы проводок журнала (JournalEntry.entry_type).
 *
 * Четыре DEPRECATED-синонима контракта v0.1.0 (`allocation`, `waive`,
 * `writeoff`, `adjustment`) сюда НЕ входят: сервис их больше не отдаёт, а
 * держать для них строки значит обещать оператору то, чего он не увидит.
 */
export const CREDIT_ENTRY_TYPES = [
  'disbursement',
  'accrual',
  'fee_charge',
  'payment_allocation',
  'waiver',
  'write_off',
  'reversal',
  'interest_stop_shadow',
  'interest_stop_catchup',
  'refund',
  'cancellation',
  'charge_off',
  'close',
] as const

/** Бакеты долга (LedgerBucket). */
export const CREDIT_BUCKETS = [
  'principal',
  'interest',
  'fee',
  'commission',
  'penalty',
  'fine',
  'overpayment',
] as const

/** Причины перестроения графика (ScheduleVersion.reason). */
export const CREDIT_SCHEDULE_REASONS = [
  'origination',
  'prolongation',
  'payment_holiday',
  'restructuring',
  'early_settlement',
  'prepayment',
  'reversal_replay',
  'interest_stop',
  'disbursement_reversed',
] as const

/** Виды документов, которые создаёт модуль (DocumentKind). */
export const CREDIT_DOCUMENT_KINDS = [
  'agreement_draft',
  'contract',
  'schedule',
  'pcci',
  'nosia',
  'early_settlement_quote',
  'settlement_statement',
  'initial_disclosure',
  'payment_receipt',
  'cancellation_notice',
  'regulatory_card_ua',
] as const

/** Виды документов, которые загружает клиент (UploadedDocumentKind). */
export const CREDIT_UPLOADED_DOCUMENT_KINDS = [
  'bank_statement_pdf',
  'id_photo',
  'void_cheque',
  'pad_form',
  'pay_stub',
  'utility_bill',
  'other',
] as const

/**
 * Всё, что приходит в `DocumentMeta.kind`: в контракте это oneOf двух перечней,
 * и список документов заявки несёт вперемешку договоры модуля и загрузки
 * клиента. Подпись есть у каждого значения отсюда; прочее экран называет
 * неизвестным видом с кодом — по одному `CREDIT_DOCUMENT_KINDS` выписка клиента
 * стала бы «неизвестной».
 */
export const CREDIT_DOCUMENT_META_KINDS: readonly string[] = [
  ...CREDIT_DOCUMENT_KINDS,
  ...CREDIT_UPLOADED_DOCUMENT_KINDS,
]

/** Статусы кредита — те же значения, что и в union `CreditLoanStatus`. */
export const CREDIT_LOAN_STATUSES = [
  'pending_disbursement',
  'active',
  'delinquent',
  'forbearance',
  'protected',
  'charged_off',
  'closed',
  'written_off',
  'withdrawn',
  'cancelled',
  'disbursement_failed',
  'funding_exception',
] as const satisfies readonly CreditLoanStatus[]

/** Статусы заявки — все, включая те, что в очередь не попадают. */
export const CREDIT_ALL_APPLICATION_STATUSES = [
  'draft',
  'in_progress',
  'abandoned',
  'identity_check',
  'data_collection',
  'scoring',
  'approved',
  'referred',
  'declined',
  'contracted',
  'expired',
  'disbursed',
] as const satisfies readonly CreditApplicationStatus[]

/**
 * Состояния выплаты (`disbursement.state`) — словарь журнала рельса.
 *
 * Снят из кода развёрнутого модуля, а не со стенда: на стенде живут только
 * три значения из шести (`settled`/`failed`/`reversed`), а `pending`,
 * `cancelled` и `unknown` появятся у оператора в тот день, когда рельс
 * ответит небыстро или противоречиво, — и без строк в словаре он увидит
 * машинные имена ровно в самый неудобный момент.
 */
export const CREDIT_DISBURSEMENT_STATES = [
  'pending',
  'settled',
  'failed',
  'cancelled',
  'reversed',
  'unknown',
] as const satisfies readonly CreditDisbursement['state'][]

/** Каналы выплаты. `pad` — только у списаний, у выдачи его не бывает. */
export const CREDIT_DISBURSEMENT_METHODS = [
  'interac',
  'eft',
] as const satisfies readonly CreditDisbursement['method'][]

/** Откуда взята дата зачисления (`provider_time_source`). */
export const CREDIT_PROVIDER_TIME_SOURCES = [
  'provider',
  'observed',
] as const satisfies readonly NonNullable<CreditDisbursement['provider_time_source']>[]

/**
 * Коды исхода выплаты, которые мы умеем назвать словами.
 *
 * Список ЗАВЕДОМО неполон и полным быть не может: `failure_code` приходит от
 * провайдера, чей словарь нам не принадлежит. Поэтому это не enum контракта,
 * а перечень «что мы уже видели и перевели»; всё остальное карточка честно
 * показывает как чужой код, а не как отсутствующий перевод.
 */
export const CREDIT_DISBURSEMENT_FAILURE_CODES = [
  'payout_refused_pending_review',
  'provider_never_created',
  'NSF',
] as const

/**
 * Причины ручного разбора операции рельса (`review_reason`).
 *
 * Двенадцать значений — все константы `REVIEW_*` развёрнутого модуля. Каждая
 * ведёт разбирающего в СВОЁ место, поэтому общей строки «нужен разбор» мало,
 * и каждая переводится отдельно.
 */
export const CREDIT_RAIL_REVIEW_REASONS = [
  'payout_account_not_pinned',
  'payout_details_changed_after_approval',
  'effective_time_corrected',
  'provider_amount_mismatch',
  'provider_amount_unconfirmed',
  'provider_contradiction',
  'provider_dishonour_unknown',
  'provider_foreign_operation',
  'provider_impossible_time',
  'provider_recipient_mismatch',
  'provider_unidentified_success',
  'provider_unknown_status',
] as const

/**
 * Вердикты «можно ли повторить отправку» — не поле контракта, а наш вывод.
 * Здесь ради того же, ради чего и остальные: чтобы каждый вердикт имел строку
 * в обоих словарях, а не только тот, что попался на стенде.
 */
export const CREDIT_DISBURSEMENT_RETRY_VERDICTS = [
  'available',
  'reviewOpen',
  'notFailed',
  'settled',
  'inFlight',
  'unknownState',
] as const

/**
 * Статусы позиции очереди ручного разбора — они же единственный серверный
 * фильтр очереди (`GET /underwriting/queue?status=`).
 *
 * `in_review` включён, хотя на стенде недостижим (механизма назначения на
 * андеррайтера до WS-20 нет, `assigned_to` пуст у всех строк): фильтр по нему
 * модуль принимает уже сегодня, и убрать значение из перечня значит спрятать
 * состояние, которое появится без единой правки фронта.
 */
export const CREDIT_QUEUE_STATUSES = [
  'pending',
  'in_review',
  'done',
] as const satisfies readonly CreditQueueStatus[]

/**
 * Причины ручного разбора (`UnderwritingQueueItem.review_reasons`).
 *
 * В контракте это голый `array of string` — перечня там нет вовсе, словарь
 * живёт только в коде модуля. Поэтому список собран по источникам, которые
 * `operator._review_reasons_of` опрашивает в этом порядке:
 *  1. `decision.decline_codes` — те же коды `RC-*`, что у отказа. Они попадают
 *     в очередь, когда разбор объявлен вместе с кодами, и поэтому лежат ЗДЕСЬ,
 *     а не только в `credit.declineCode`: ячейка одна, и второй проход по
 *     другому пространству ради трёх строк дал бы оператору машинное имя
 *     ровно в тот день, когда такое решение впервые появится.
 *  2. `input_snapshot.referral_reasons` — шесть машинных причин
 *     (`decision._REFERRAL_RATIONALE`, сверено с живым модулем 31.08.2026;
 *     на стенде встречаются только две первые).
 *  3. `manual` — заявку направил человек, обоснование лежит в карточке.
 *
 * Перечень нужен не коду страницы (она подставляет ключ динамически), а
 * стражу словарей: без него причина, не встреченная на стенде, доедет до
 * оператора машинным именем.
 */
export const CREDIT_REVIEW_REASONS = [
  'income_not_verified',
  'income_mismatch',
  'income_frequency_unverified',
  'income_not_plausible',
  'login_attribution_unverified',
  'schedule_infeasible',
  // Седьмая причина, которую разведка не досчитала: приёмка нашла её в живом
  // модуле. Без строки в словаре оператор увидел бы машинное имя ровно там,
  // где решает судьбу заявки.
  'client_not_identifiable',
  'manual',
  'RC-04',
  'RC-08',
  'RC-11',
] as const

/**
 * События сайта, которые хронология карточки заявки умеет назвать словами.
 *
 * Это НАШ СНИМОК ЧУЖОГО СЛОВАРЯ: реестр витрины web-credit
 * `docs/40-события-сайта.md` на `10936ea0` (таблицы «События витрины» и «События
 * кабинета»; `code_requested` и `rate_limited` стоят в обеих — здесь по разу).
 * Словарь событий контракт держит открытым: незнакомое имя модуль принимает и
 * отдаёт как есть, поэтому расхождение с реестром не ломает экран, а
 * показывается подписью `credit.portalEvent.unknown` с именем события.
 */
export const CREDIT_PORTAL_EVENTS = [
  'code_requested',
  'code_sent',
  'code_verified',
  'code_rejected',
  'application_created',
  'application_blocked',
  'block_saved',
  'ibv_session_opened',
  'ibv_login',
  'ibv_mfa',
  'ibv_completed',
  'ibv_confirmed',
  'ibv_rejected',
  'document_uploaded',
  'signed',
  'quote_mismatch',
  'handoff_issued',
  'rate_limited',
  'antibot_rejected',
  'intake_closed',
  'signed_in',
  'sign_in_rejected',
  'signed_in_by_key',
  'cancellation_requested',
  'cancellation_failed',
  'payoff_quoted',
  'prepayment_mode_changed',
  'document_opened',
  'document_unavailable',
  'continue_to_apply',
  'notification_mailed',
] as const

/**
 * События сайта, которые означают письмо клиенту: письмо-уведомление и письмо с
 * кодом, принятые транспортом. Из них в блоке «Листи сайту» строятся строки —
 * это те же строки хронологии, без отдельного запроса.
 */
export const CREDIT_MAIL_EVENTS = [
  'notification_mailed',
  'code_sent',
] as const satisfies readonly (typeof CREDIT_PORTAL_EVENTS)[number][]

/** Пространство словаря → значения, которые в него подставляются. */
export const CREDIT_DYNAMIC_NAMESPACES: Record<string, readonly string[]> = {
  entryType: CREDIT_ENTRY_TYPES,
  bucket: CREDIT_BUCKETS,
  scheduleReason: CREDIT_SCHEDULE_REASONS,
  documentKind: CREDIT_DOCUMENT_META_KINDS,
  loanStatus: CREDIT_LOAN_STATUSES,
  status: CREDIT_ALL_APPLICATION_STATUSES,
  disbursementState: CREDIT_DISBURSEMENT_STATES,
  disbursementMethod: CREDIT_DISBURSEMENT_METHODS,
  disbursementFailure: CREDIT_DISBURSEMENT_FAILURE_CODES,
  disbursementRetry: CREDIT_DISBURSEMENT_RETRY_VERDICTS,
  providerTimeSource: CREDIT_PROVIDER_TIME_SOURCES,
  queueStatus: CREDIT_QUEUE_STATUSES,
  // ⚠️ Два РАЗНЫХ словаря чуть не заняли одно пространство `reviewReason`:
  // причины разбора ЗАЯВКИ (очередь андеррайтинга) и причины разбора ОПЕРАЦИИ
  // РЕЛЬСА (выплата). Обе ветки писались параллельно, каждая проверка прошла
  // по своей — столкновение видно только здесь, при слиянии. Слитые в одно
  // пространство, они молча смешали бы два набора строк: оператор увидел бы у
  // заявки причину отказа платёжного провайдера. Разведены по домену.
  referralReason: CREDIT_REVIEW_REASONS,
  railReviewReason: CREDIT_RAIL_REVIEW_REASONS,
  // Этапы пути клиента и их состояния. Ключи подставляются динамически
  // (`t(`credit.stage.${step.stage}`)`), поэтому статический страж их не
  // видит; а список — не наш, он снят с кабинета клиента, и потерять в нём
  // строку значит показать оператору машинное имя шага, номер которого клиент
  // называет вслух по телефону.
  stage: CREDIT_APPLICATION_STAGES,
  stageState: CREDIT_STAGE_STATES,
  // События сайта в хронологии карточки заявки — тоже чужой список (реестр
  // витрины): подпись подставляется динамически, и событие без строки в
  // словаре доехало бы до оператора машинным именем.
  portalEvent: CREDIT_PORTAL_EVENTS,
}
