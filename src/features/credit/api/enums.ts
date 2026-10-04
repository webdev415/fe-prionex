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
  CreditChecklistAnswer,
  CreditConditionalStage,
  CreditDecisionCodeCategory,
  CreditDisbursement,
  CreditLoanStatus,
  CreditQueueStatus,
} from './types'
import { CREDIT_APPLICATION_STAGES, CREDIT_STAGE_STATES } from './applicationStages'
import {
  CREDIT_POSTBACK_LAST_ERRORS,
  CREDIT_POSTBACK_MACROS,
  CREDIT_POSTBACK_OUTCOMES,
  CREDIT_POSTBACK_RULE_REASONS,
  CREDIT_POSTBACK_SKIP_REASONS,
  CREDIT_POSTBACK_TRIGGERS,
} from './postbackEnums'

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

/*
 * ─── Словари операций рельса (Zūm) ─────────────────────────────────────────
 *
 * Перечни ниже — копия перечней контракта модуля (`contracts/openapi.yaml`,
 * схемы `Rail*`), а не наш список «что уже видели». Сам контракт держит поля
 * открытыми строками: провайдер расширяет словарь без нашего релиза, и
 * незнакомое значение приходит дословно. Поэтому экран называет незнакомое
 * нейтрально («Невідомий код», «Невідомий статус»), а не выдаёт за чужое.
 *
 * Равенство каждого перечня снимку контракта держит страж
 * `src/constants/__tests__/creditRailCodes.test.ts` (снимок —
 * `src/constants/__tests__/vendored/credit-rail-codes.json`). Правится перечень
 * только пересъёмкой снимка: список, переписанный руками из документации,
 * стареет молча.
 */

/** Коды отказа Zūm (`RailProviderFailureCode.x-known-values`, 44). */
export const CREDIT_ZUM_FAILURE_CODES = [
  'EftFailedAccountClosed',
  'EftFailedAgreementRevoked',
  'EftFailedCannotLocateAccount',
  'EftFailedCurrencyAccountMismatch',
  'EftFailedCustomerInitiatedReturnCreditOnly',
  'EftFailedDefaultByAFinancialInstitution',
  'EftFailedErrorPayorPayeeName',
  'EftFailedFrozenAccount',
  'EftFailedFundsNotFree',
  'EftFailedInsufficientFunds',
  'EftFailedInvalidErrorAccountNumber',
  'EftFailedNoDebitAllowed',
  'EftFailedNoPrenotificationP1',
  'EftFailedNoPrenotificationP2',
  'EftFailedNotInAccountAgreementE',
  'EftFailedNotInAccountAgreementP',
  'EftFailedPayorPayeeDeceased',
  'EftFailedRefusedNoAgreement',
  'EftFailedStopPayment',
  'EftFailedTransactionLimitExceeded',
  'EftFailedTransactionNotAllowed',
  'EftFailedValidationRejection',
  'InteracFailedANRNotSupported',
  'InteracFailedAPICancellation',
  'InteracFailedAmountGreaterThanMax',
  'InteracFailedAuthentication',
  'InteracFailedAutoDeposit',
  'InteracFailedBannedAccount',
  'InteracFailedDebtorRejected',
  'InteracFailedFundsDepositFailed',
  'InteracFailedGenericError',
  'InteracFailedInvalidEmailFormat',
  'InteracFailedInvalidPhoneNumber',
  'InteracFailedNameMismatch',
  'InteracFailedNotificationDeliveryFailure',
  'InteracFailedReachedCancellationCutOff',
  'InteracFailedRecipientContactInfoMissing',
  'InteracFailedRecipientRejected',
  'InteracFailedRequestBlockedByUser',
  'InteracFailedRevoked',
  'InteracFailedSameProfileConflict',
  'InteracFailedSecurityQuestionNeededForProvidedEmail',
  'InteracFraudAlertResponded',
  'InteracFundsHeldForValidation',
] as const

/**
 * Коды отказа, которые пишет сам модуль (`RailModuleFailureCode.x-known-values`, 9):
 * наша остановка выплаты, «провайдер операцию не знает» у сверки, ошибки
 * адаптера рельса. Это НАШ отказ, и экран подписывает его «код модуля».
 */
export const CREDIT_MODULE_RAIL_FAILURE_CODES = [
  'anr_probe_failed',
  'invalid_amount',
  'no_token',
  'no_transaction_id',
  'no_user_id',
  'payout_refused_pending_review',
  'provider_never_created',
  'rail_limit_exceeded',
  'transport_error',
] as const

/**
 * Семейства кодов модуля, которые перечнем не закрыть
 * (`RailModuleFailureCode.x-known-patterns`): Zūm ответил ошибкой HTTP.
 * Распознаётся шаблоном целиком — `zum_http_50` семейству не принадлежит.
 */
export const CREDIT_MODULE_RAIL_FAILURE_PATTERNS = ['^zum_http_[0-9]{3}$'] as const

/**
 * Слово e2e-харнесса стенда (`NSF`), а не код Zūm: у Zūm этот смысл носят
 * `EftFailedInsufficientFunds` и `EftFailedFundsNotFree`. Оставлено известным
 * словом (решение куратора В-2 story 17-6f) с подписью «код стенду».
 */
export const CREDIT_RAIL_STAND_FAILURE_CODES = ['NSF'] as const

/**
 * Все коды, у которых есть текст в `credit.railFailure`: модуля, Zūm и стенда.
 * Один словарь на раздел — панель выплаты и список операций называют код одним
 * текстом.
 */
export const CREDIT_RAIL_FAILURE_CODES: readonly string[] = [
  ...CREDIT_MODULE_RAIL_FAILURE_CODES,
  ...CREDIT_ZUM_FAILURE_CODES,
  ...CREDIT_RAIL_STAND_FAILURE_CODES,
]

/** Статусы операции словами Zūm (`RailProviderStatus.x-known-values`, 7). */
export const CREDIT_ZUM_STATUSES = [
  'Cancelled',
  'Completed',
  'Failed',
  'InProgress',
  'InReview',
  // Пробел — часть слова Zūm. Ключ словаря тот же: разделитель ключей — точка.
  'Pending Cancellation',
  'Scheduled',
] as const

/**
 * Слова модуля в графе статуса провайдера (`RailModuleStatus.x-known-values`):
 * `NotFound` пишет сверка, а не Zūm, — за слово провайдера его не выдаём.
 */
export const CREDIT_RAIL_MODULE_STATUSES = ['NotFound'] as const

/**
 * Шаги истории операции Zūm (`EventHistory`), 15 имён из описания
 * `RailOperationEvent.event`. События отказа носят имена кодов Zūm и живут в
 * `CREDIT_ZUM_FAILURE_CODES` — у одного кода один текст.
 */
export const CREDIT_ZUM_EVENTS = [
  'Started',
  'Succeeded',
  'WalletFunded',
  'WalletWithdrawn',
  'NotEnoughBalanceInWalletError',
  'EFTFileCreated',
  'EFTFileUploaded',
  'EFTAnswerReceived',
  'EFTAnswerProcessed',
  'InteracSent',
  'InteracAcknowledgedCredit',
  'InteracAcknowledgedDebit',
  'InteracWaitingSettlementIntoWallet',
  'InteracSettledIntoWallet',
  'InteracCreditorExternalFinancialInfo',
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
 *  2. `input_snapshot.referral_reasons` — четырнадцать машинных причин:
 *     тринадцать ключей `_REFERRAL_RATIONALE` в `decision.py` модуля (сверено
 *     по `main` модуля `47d2e51c` 29.09.2026; на стенде 31.08 встречались
 *     только две первые) и `class_b_installments_unattainable` — её вводит
 *     19-4, на 29.09 только в story, не в коде.
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
  // Три причины, которые модуль добавил после 31.08 (слабое совпадение
  // владельца счёта, телефон должника старой CRM, возврат дебета PAD по
  // непогашенному кредиту): без строк очередь показывала их машинным именем.
  'low_identity_match',
  'legacy_obligation_phone_only',
  'first_pad_return_not_repaid',
  // Причины разбора скоринга книги (19-3): их же пишет `scorecard.gate.review`,
  // поэтому словарь один на разбор скоринга и очередь. Четвёртую вводит 19-4 —
  // строка словаря безвредна до её выката, а без неё очередь показала бы
  // машинное имя в первый же день.
  'employment_status_unknown',
  'income_class_b_not_confirmed',
  'scorecard_input_missing',
  'class_b_installments_unattainable',
  'manual',
  'RC-04',
  'RC-08',
  'RC-11',
] as const

/**
 * Разделы книги правил для кодов решения (`DecisionCodeEntry.category`).
 *
 * Порядок — порядок enum контракта, он же порядок книги: в этом порядке форма
 * ручного решения раскладывает коды отказа по группам. Подпись группы
 * подставляется динамически (`credit.decisionCodeCategory.<раздел>`), поэтому
 * перечень нужен стражу словарей.
 */
export const CREDIT_DECISION_CODE_CATEGORIES = [
  'loan_terms',
  'identity',
  'bank_account',
  'conduct',
  'financial_hardship',
  'digital_verification',
  'income',
  'bank_statement',
  'employment',
  'service',
] as const satisfies readonly CreditDecisionCodeCategory[]

/**
 * Пункты чек-листа ручного решения — enum `DecisionChecklistItem.key` контракта
 * модуля 0.1.30/0.1.31 (19-5), сверено с `main` модуля 0852c782 — `openapi.yaml`
 * `DecisionChecklistItem`. Порядок — порядок листа книги и enum контракта: в нём
 * форма рисует пункты и в нём же они уходят в теле решения. Текстов пунктов у
 * модуля нет (двери-справочника у чек-листа нет), они живут в словаре CRM
 * `credit.checklistItem.*`.
 */
export const CREDIT_CHECKLIST_KEYS = [
  'ibv_all_accounts',
  'statement_two_months',
  'salary_regular',
  'nsf_isolated',
  'loan_repayments_on_payday_max6',
  'salary_account_connected',
  'id_photo_only',
  'id_valid_on_apply',
  'id_alberta_only',
  'pay_document',
  'residence_proof',
] as const

/** Пункты, у которых в форме есть подсказка оператору (`credit.checklistHint.*`). */
export const CREDIT_CHECKLIST_HINTED = [
  'ibv_all_accounts',
  'statement_two_months',
  'salary_regular',
  'nsf_isolated',
  'loan_repayments_on_payday_max6',
  'residence_proof',
] as const satisfies readonly (typeof CREDIT_CHECKLIST_KEYS)[number][]

/** Ответ на пункт: `n_a` — «не застосовно», модуль не считает его невыполненным. */
export const CREDIT_CHECKLIST_ANSWERS = [
  'yes',
  'no',
  'n_a',
] as const satisfies readonly CreditChecklistAnswer[]

/** Ступень условного одобрения (`Decision.conditional_stage`, 19-5). */
export const CREDIT_CONDITIONAL_STAGES = [
  'proposed',
  'confirmed',
] as const satisfies readonly CreditConditionalStage[]

/**
 * Скоринг книги правил проверки клиента в снимке решения (`input_snapshot.scorecard`).
 *
 * Перечни — зеркала ядра модуля, а не контракта: в контракте 0.1.28 ключ
 * `scorecard` не объявлен. Сверено по `main` модуля `47d2e51c`:
 * `underwriting/scorecard.py` (`POINT_PARAMETERS`, поля `ScorecardInputs`) и
 * `underwriting/income_class.py` (`IncomeClassSource`, `EMPLOYMENT_STATUS_CLASS`).
 *
 * Восемь параметров — в порядке формул C13…C20 листа «Калькулятор скоринга»:
 * в этом порядке разбор рисует таблицу, и андеррайтер идёт по листу сверху вниз.
 */
export const CREDIT_SCORECARD_PARAMETERS = [
  'nsf_90d',
  'free_cash_flow_monthly',
  'micro_lenders',
  'negative_balance_days_90d',
  'overdraft',
  'active_days_trend',
  'history_days',
  'income_trend',
] as const

/**
 * Семь сумм пособий Lending, которые модуль кладёт в `ibv.risk.extra` снимка и из
 * которых выводит класс дохода: модуль `decision.py` (`_BASIS_AMOUNTS` — «семь
 * сумм Lending как есть», `income_class_basis.amounts`), источник имён —
 * `UNDERWRITING_LENDING_ATTRIBUTES` в `flinks_mapping.py` (сверено по `main`
 * модуля `86b22fed`). Сырой снимок на экране оператора их не показывает.
 *
 * Перечнем, а не префиксом `sum_`: пространство ключей `extra` — провайдерское,
 * у провайдера есть и несоциальные суммы (например, дохода от работодателя), и
 * префикс спрятал бы их, назвав «суммами пособий».
 */
export const CREDIT_SNAPSHOT_BENEFIT_AMOUNT_KEYS = [
  'sum_pension_income',
  'sum_disability_income',
  'sum_government_income_total',
  'sum_employment_insurance_income',
  'sum_social_assistance_income',
  'sum_wsib_income',
  'sum_child_support_income_government',
] as const

/**
 * Признаки класса и гейта: три сигнала гейта из `scorecard.inputs` и два
 * признака класса из `income_class_basis.evidence` (у них общий словарь).
 */
export const CREDIT_SCORECARD_SIGNALS = [
  'employer_income_30d',
  'employment_loss',
  'government_income_30d',
  'b_income',
  'c_income',
] as const

/** Классы дохода книги. */
export const CREDIT_INCOME_CLASSES = ['A', 'B', 'C'] as const

/** Откуда взят класс дохода (`IncomeClassSource` ядра). */
export const CREDIT_INCOME_CLASS_SOURCES = ['questionnaire', 'flinks', 'both', 'default'] as const

/**
 * Статусы занятости анкеты, которые ядро знает (`EMPLOYMENT_STATUS_CLASS`, девять
 * значений формы витрины). Статус вне списка модуль пишет как есть с
 * `employment_status_known = false`: такой разбор показывает его сырым и с
 * припиской, а не пустой строкой.
 */
export const CREDIT_EMPLOYMENT_STATUSES = [
  'employment_full_time',
  'employment_part_time',
  'pension',
  'disability',
  'self_employed',
  'social_assistance',
  'student',
  'none',
  'other',
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

/**
 * Виды согласия заявки — зеркало `Consent.kind` контракта модуля 0.1.48
 * (`openapi.yaml:7871`, `main` 45c4d6b2). Чужой список: подпись подставляется
 * динамически (`t(`credit.consent.${kind}`, kind)`), и вид без строки доезжает до
 * оператора машинным именем — так уже доехал `e_copy` (0.1.26).
 */
export const CREDIT_CONSENT_KINDS = [
  'terms',
  'personal_data',
  'e_signature',
  'credit_bureau',
  'marketing',
  'ibv_provider',
  'pad',
  'e_copy',
  'privacy_policy',
] as const

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
  // Операции рельса: коды, статусы и шаги Zūm — чужие перечни (снимок контракта
  // модуля, страж `creditRailCodes.test.ts`); состояние операции — свой словарь
  // на те же шесть значений, что у выплаты: тексты выплаты («Не відправлено»)
  // рядом с «Передано в Zūm» противоречили бы соседней ячейке.
  railFailure: CREDIT_RAIL_FAILURE_CODES,
  zumStatus: CREDIT_ZUM_STATUSES,
  railModuleStatus: CREDIT_RAIL_MODULE_STATUSES,
  zumEvent: CREDIT_ZUM_EVENTS,
  railOperationState: CREDIT_DISBURSEMENT_STATES,
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
  // Разделы книги правил — подписи групп кодов отказа в форме ручного решения и
  // раздела кода в карточке решения. Тексты самих кодов в словари не идут: они
  // приходят из двери справочника модуля (копия разошлась бы с книгой).
  decisionCodeCategory: CREDIT_DECISION_CODE_CATEGORIES,
  // Чек-лист ручного решения и ступень условного одобрения (19-5f): пункт,
  // подсказка, ответ и ступень подставляются динамически, а пункт без строки
  // доехал бы до андеррайтера машинным ключом.
  checklistItem: CREDIT_CHECKLIST_KEYS,
  checklistHint: CREDIT_CHECKLIST_HINTED,
  checklistAnswer: CREDIT_CHECKLIST_ANSWERS,
  conditionalStage: CREDIT_CONDITIONAL_STAGES,
  // Разбор скоринга книги на вкладке решения: имена параметров, признаки,
  // класс дохода и его источник, статус анкеты. Значения приходят из снимка
  // модуля, и параметр без строки доехал бы до андеррайтера машинным именем.
  scorecardParameter: CREDIT_SCORECARD_PARAMETERS,
  scorecardSignal: CREDIT_SCORECARD_SIGNALS,
  incomeClass: CREDIT_INCOME_CLASSES,
  incomeClassSource: CREDIT_INCOME_CLASS_SOURCES,
  employment: CREDIT_EMPLOYMENT_STATUSES,
  // Этапы пути клиента и их состояния. Ключи подставляются динамически
  // (`t(`credit.stage.${step.stage}`)`), поэтому статический страж их не
  // видит; а список — не наш, он снят с кабинета клиента, и потерять в нём
  // строку значит показать оператору машинное имя шага, номер которого клиент
  // называет вслух по телефону.
  stage: CREDIT_APPLICATION_STAGES,
  stageState: CREDIT_STAGE_STATES,
  // Виды согласия в карточке заявки (18-4e): без пространства страж не видел,
  // что `e_copy` и `privacy_policy` показываются машинным именем.
  consent: CREDIT_CONSENT_KINDS,
  // События сайта в хронологии карточки заявки — тоже чужой список (реестр
  // витрины): подпись подставляется динамически, и событие без строки в
  // словаре доехало бы до оператора машинным именем.
  portalEvent: CREDIT_PORTAL_EVENTS,
  // Триггеры постбеков партнерам (18-13d) — снимок контракта модуля, страж
  // `creditPostbackContract.test.ts`; строки — под `credit.postbacks.trigger`.
  'postbacks.trigger': CREDIT_POSTBACK_TRIGGERS,
  // Подсказка макросов формы правила (18-13d-a2) и уточнения отказа модуля
  // (`details.reason` 422) под полями формы — тоже коды контракта.
  'postbacks.macro': CREDIT_POSTBACK_MACROS,
  'postbacks.form.errors': CREDIT_POSTBACK_RULE_REASONS,
  // Лог отправок (18-13d-b): исходы, причины пропуска и коды ошибки модуля.
  'postbacks.outcome': CREDIT_POSTBACK_OUTCOMES,
  'postbacks.skipReason': CREDIT_POSTBACK_SKIP_REASONS,
  'postbacks.lastError': CREDIT_POSTBACK_LAST_ERRORS,
}
