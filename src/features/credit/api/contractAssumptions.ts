/**
 * На что раздел «Кредитный модуль» ОПИРАЕТСЯ в контракте — проверкой сборки.
 *
 * Приём взят у команды сайта (`web-credit/packages/api-client/src/contract-assumptions.ts`)
 * и решает дыру, которую мой собственный страж не видит. Страж ключей
 * (`__tests__/i18nKeys.test.ts`) сверяет словари с перечислениями в
 * `enums.ts` — но сам `enums.ts` я написал ЗЕРКАЛОМ контракта вручную. Если
 * модуль сменит набор значений, зеркало останется прежним, страж промолчит, и
 * экран будет сравнивать со строками, которых больше нет.
 *
 * У сайта это уже случилось: набор состояний выдачи сменился молча — одно
 * значение исчезло, два появились. Наличие самого поля не изменилось, поэтому
 * проверки полей прошли, а ветки решения продолжали сравнивать со старым.
 *
 * Здесь — утверждения о полях и ЗНАЧЕНИЯХ, на которых стоят ветки кода.
 * Ничего не исполняется: проверяет `tsc`. Пропадёт поле или значение —
 * красная сборка с именем утверждения, а не молча неверный экран.
 *
 * Как добавлять: появилась ветка, сравнивающая поле контракта с конкретной
 * строкой, — допиши утверждение и назови в комментарии, ЧТО сломается без
 * него. Утверждение без объяснения бесполезно: следующий не поймёт, можно ли
 * его удалить.
 */
import type { CreditApplicationStage } from './applicationStages'
import type {
  CreditApplicantApplication,
  CreditApplicantApplications,
  CreditApplicationDetail,
  CreditApplicationStatus,
  CreditDecision,
  CreditDocumentMeta,
  CreditIdentityKey,
  CreditJournalEntry,
  CreditLoanDetail,
  CreditLoanRailOperations,
  CreditLoanStatus,
  CreditPayment,
  CreditPortalEventRecord,
  CreditRailCallback,
  CreditRailEvent,
  CreditRailOperation,
  CreditTimelineClient,
  CreditTimelineRow,
  CreditTimelineTransition,
} from './types'

/** Утверждение: `true` проходит, `false` роняет сборку именем строки. */
type Assert<T extends true> = T
/** Есть ли у типа такое поле (в том числе необязательное). */
type Has<T, K extends string> = K extends keyof T ? true : false
/** Поле обязательно (объявлено без `?:`). `Has` этого не различает. */
type IsRequired<T, K extends keyof T> = Record<never, never> extends Pick<T, K> ? false : true
/** Есть ли значение в объединении. */
type Includes<Union, V extends string> = V extends Union ? true : false

/* ─── Состояние платежа ─────────────────────────────────────────────────
   `CreditLoanDetailPage` рисует сторнированный платёж иначе обычного:
   зачёркивает сумму и подписывает датой возврата. Ветка стоит на значении
   'reversed'. Если модуль переименует состояние, экран покажет сторно как
   обычный платёж — то самое расхождение «плитка 70,00, таблица 154,00»,
   ради которого различение и заводилось. */
export type _payment_has_state = Assert<Has<CreditPayment, 'state'>>
export type _payment_state_reversed = Assert<Includes<CreditPayment['state'], 'reversed'>>
export type _payment_state_accepted = Assert<Includes<CreditPayment['state'], 'accepted'>>
/** Дата возврата — учётная из журнала, не дата платежа. Ветка подписи read'ёт её. */
export type _payment_has_reversed_on = Assert<Has<CreditPayment, 'reversed_on'>>

/* ─── Тип проводки ──────────────────────────────────────────────────────
   Журнал не дублирует слово «сторно», если тип проводки уже 'reversal'
   (иначе выходило «Сторнування (сторно)»). Ветка сравнивает entry_type
   именно с этой строкой; переименование вернёт тавтологию. */
export type _entry_has_type = Assert<Has<CreditJournalEntry, 'entry_type'>>
/**
 * Значение, на котором стоит ветка. До 31.08 поле было объявлено как
 * произвольная строка — компилятор молчал бы при любом переименовании, и
 * тавтология «Сторнування (сторно)» вернулась бы незамеченной. Теперь тип
 * выводится из перечисления контракта, и утверждение это стережёт.
 */
export type _entry_type_reversal = Assert<Includes<CreditJournalEntry['entry_type'], 'reversal'>>
export type _entry_has_reversal_ref = Assert<Has<CreditJournalEntry, 'reversal_of_entry_id'>>

/* ─── Статусы кредита ───────────────────────────────────────────────────
   Метрики списка считают кредиты по статусам, а `CreditStatusBadge` красит
   их по имени. Значения ниже — те, на которых стоит поведение: пропажа
   любого означает пустую метрику или бейдж без цвета. */
export type _loan_status_active = Assert<Includes<CreditLoanStatus, 'active'>>
export type _loan_status_delinquent = Assert<Includes<CreditLoanStatus, 'delinquent'>>
export type _loan_status_closed = Assert<Includes<CreditLoanStatus, 'closed'>>
export type _loan_status_pending = Assert<Includes<CreditLoanStatus, 'pending_disbursement'>>
/** Отменённая выдача. Если модуль заведёт для неё отдельное состояние —
    здесь станет видно раньше, чем на экране (см. Д-12 хребта). */
export type _loan_status_cancelled = Assert<Includes<CreditLoanStatus, 'cancelled'>>

/* ─── Статусы заявки ────────────────────────────────────────────────────
   Очередь оператора фильтрует по этим значениям; из 'declined' возврата
   нет (ФТ-14), и на этом стоит поведение карточки. */
export type _app_status_referred = Assert<Includes<CreditApplicationStatus, 'referred'>>
export type _app_status_declined = Assert<Includes<CreditApplicationStatus, 'declined'>>
export type _app_status_disbursed = Assert<Includes<CreditApplicationStatus, 'disbursed'>>
export type _app_status_scoring = Assert<Includes<CreditApplicationStatus, 'scoring'>>

/* ─── Этап заявки ───────────────────────────────────────────────────────
   Позиция ленты в карточке читается из ответа модуля. Эти три утверждения
   стерегут СОСТАВ ТИПА, и только его: удалит кто-нибудь поле из
   `CreditApplicationDetail` — красная сборка с именем строки. Чего они НЕ
   стерегут, надо знать: ответ приходит неконтролируемым приведением типа, без
   разбора схемы, и объект уходит в компонент целиком, а компонент объявляет
   нужные поля в СВОЁМ структурном типе. Поэтому сцену «страница передала ленте
   обрезанный объект» эти строки не поймают — её стережёт отдельный тест
   уровня страницы (`CreditApplicationDetailPage.test.tsx`, «передаёт ленте три
   поля этапа»). `Has` ловит локальное удаление и ничего не говорит о
   контракте (см. шапку про два класса утверждений). */
export type _app_has_stage = Assert<Has<CreditApplicationDetail, 'stage'>>
export type _app_has_stage_index = Assert<Has<CreditApplicationDetail, 'stage_index'>>
export type _app_has_stage_total = Assert<Has<CreditApplicationDetail, 'stage_total'>>
/* А это — второй класс: утверждение о СОДЕРЖИМОМ перечня. Переименуют этап
   обратно в `bank` — красная сборка с именем строки, а не молча неверный
   экран: имя этапа уезжает в ключ словаря и на экран оператора. */
export type _app_stage_income_check = Assert<Includes<CreditApplicationStage, 'income_check'>>

/* ─── Статусы, на которых стоит состояние строки ленты ──────────────────
   `serverStepState` (`applicationStages.ts`) сравнивает статус заявки с этими
   строками поимённо: 'contracted'/'disbursed' → шаг пройден, 'expired'/
   'abandoned' → у мёртвой заявки текущего шага нет, 'declined' → сбой.
   'declined' и 'disbursed' уже утверждены выше; ниже — три недостающие.
   Переименует модуль любую из них — без этих строк сборка останется зелёной,
   а на экране строка индекса молча станет «поточний крок»: ровно тот класс
   отказа, ради которого файл и заведён. */
export type _app_status_contracted = Assert<Includes<CreditApplicationStatus, 'contracted'>>
export type _app_status_expired = Assert<Includes<CreditApplicationStatus, 'expired'>>
export type _app_status_abandoned = Assert<Includes<CreditApplicationStatus, 'abandoned'>>

/* ─── Излишек возврата и указатель на заменённое решение ───────────────
   Оба поля объявлены БЕЗ `?:`, чтобы каждая фикстура и каждый новый читатель
   назвали значение. Что сломается, если вернуть `?:`: фикстура без поля снова
   соберётся, а карточка кредита на отстающем модуле станет прятать излишек
   как «излишка нет» — без единого слова компилятора. `Has` здесь бесполезен:
   необязательное поле он тоже засчитывает.
   Стерегут ЛОКАЛЬНЫЙ тип, не контракт (см. шапку про `Has` у этапа заявки):
   у `supersedes_decision_id` required строже контракта намеренно — модуль
   кладёт ключ всегда. Третья строка стережёт `null`: без него «ничего не
   заменяло» некуда положить, и фикстуры начали бы выдумывать id. */
export type _loan_excess_required = Assert<
  IsRequired<CreditLoanDetail, 'advance_refund_excess_minor'>
>
export type _decision_supersedes_required = Assert<
  IsRequired<CreditDecision, 'supersedes_decision_id'>
>
export type _decision_supersedes_nullable = Assert<
  null extends CreditDecision['supersedes_decision_id'] ? true : false
>

/* ─── Признак «содержимое откроется» у документа ───────────────────────
   Кнопка документа читает его ДО нажатия: `false` — по записям модуля
   выдавать нечего, и кнопка говорит это вместо запроса. Что сломается, если
   поле станет необязательным или пропадёт: кнопка перестанет заранее говорить
   «не откроется», а фикстуры забудут значение молча — компилятор промолчит.
   Стережёт ЛОКАЛЬНЫЙ тип, не контракт (см. шапку про `Has` у этапа заявки):
   в контракте поле не required, здесь required намеренно — модуль кладёт
   ключ всегда. */
export type _document_content_available_required = Assert<
  IsRequired<CreditDocumentMeta, 'content_available'>
>

/* ─── Хронология, события сайта и другие заявки клиента ───────────────
   Три поля карточки заявки, на которых стоят блок «Клієнт» и вкладка «Історія».
   Что сломается, если поле пропадёт из типа: страница перестанет его читать, и
   вместо хронологии или счёта заявок оператор увидит маркер «модуль не передав»
   на модуле, который всё отдаёт, — без единого слова компилятора. */
export type _app_has_timeline = Assert<Has<CreditApplicationDetail, 'timeline'>>
export type _app_has_portal_events_total = Assert<
  Has<CreditApplicationDetail, 'portal_events_total'>
>
export type _app_has_applicant_applications = Assert<
  Has<CreditApplicationDetail, 'applicant_applications'>
>

/* Дорожка строки выбирает метку и разбор: 'status' — переход, 'client' — событие
   сайта. Переименует модуль значение — строка хронологии уйдёт в чужую ветку
   или не нарисуется вовсе. */
export type _timeline_track_client = Assert<Includes<CreditTimelineRow['track'], 'client'>>
export type _timeline_track_status = Assert<Includes<CreditTimelineRow['track'], 'status'>>

/* Область события: на 'client' стоит пометка «не прив'язана до цієї заявки».
   Пропадёт значение — событие адреса клиента прочтётся как действие по этой
   заявке, а это ложный факт в карточке. */
export type _timeline_scope_client = Assert<Includes<CreditTimelineClient['scope'], 'client'>>
export type _timeline_scope_application = Assert<
  Includes<CreditTimelineClient['scope'], 'application'>
>

/* Свёртка «×N, до …» читает оба поля; станут необязательными — второй край
   свёрнутой строки молча пропадёт, и строка соврёт о последней активности. */
export type _timeline_row_count_required = Assert<IsRequired<CreditTimelineRow, 'count'>>
export type _timeline_row_last_at_required = Assert<IsRequired<CreditTimelineRow, 'last_at'>>

/* У кредита без связи карточка ищет клиента по телефону заявки. Потеряет
   `client_id` тип `null` — ветка поиска станет недостижимой для компилятора, и
   ложная строка «створюється при укладенні договору» вернётся незамеченной. */
export type _loan_client_id_nullable = Assert<
  null extends CreditLoanDetail['client_id'] ? true : false
>

/* ─── Письма сайта в паспорте кредита ──────────────────────────────────
   Панель «Листи сайту» читает ленту кредита, полное число её событий и вид
   письма из `details`. Что сломается, если поле пропадёт из типа: панель
   перестанет его читать и скажет «модуль не передав» о ленте, которую модуль
   отдаёт, промолчит об усечении или назовёт каждое письмо «привід не названо» —
   без единого слова компилятора. */
export type _loan_has_portal_events = Assert<Has<CreditLoanDetail, 'portal_events'>>
export type _loan_has_portal_events_total = Assert<Has<CreditLoanDetail, 'portal_events_total'>>
export type _portal_event_has_details = Assert<Has<CreditPortalEventRecord, 'details'>>

/* Переход в хронологии: `null` у актора рисуется «—», у прежнего статуса — без
   стрелки. Сузят поля до `string` — код начнёт звать `credit.actor.null` и
   `credit.status.null`, ключей, которых не бывает. */
export type _timeline_transition_actor_nullable = Assert<
  null extends CreditTimelineTransition['actor'] ? true : false
>
export type _timeline_transition_from_nullable = Assert<
  null extends CreditTimelineTransition['from_status'] ? true : false
>

/* Счёт заявок берётся из `total`, а не из длины списка, и `noIdentity` — из
   пустого `identity_keys`. Станут необязательными — фикстура без них соберётся,
   а экран покажет «0» там, где модуль ничего не сравнивал. */
export type _applicant_total_required = Assert<IsRequired<CreditApplicantApplications, 'total'>>
export type _applicant_identity_keys_required = Assert<
  IsRequired<CreditApplicantApplications, 'identity_keys'>
>
/* Исход прошлой заявки `null` рисуется «—»; без `null` в типе «решения нет»
   некуда положить, и фикстуры начали бы выдумывать исход. */
export type _applicant_decision_outcome_nullable = Assert<
  null extends CreditApplicantApplication['decision_outcome'] ? true : false
>
/* Признаки сравнения: подпись правила «за email або SIN» опирается на оба
   значения. Переименует модуль признак — подпись станет ложью о правиле. */
export type _identity_key_email = Assert<Includes<CreditIdentityKey, 'email'>>
export type _identity_key_national_id = Assert<Includes<CreditIdentityKey, 'national_id'>>

/* ─── Операции рельса: «Передано в Zūm» (17-6f) ──────────────────────────
   Ячейка «Передано в Zūm» (`railOperations.submissionOf`) читает признак
   модуля `submission`, `provider_accepted`, момент вызова и `state`. Пропадёт
   поле — ветка правила станет недостижимой, и строка скажет «невідомо» там,
   где модуль всё назвал. Своего списка кодов «до отправки» у фронта нет:
   правило считает модуль, фронт читает только его итог. */
export type _rail_op_has_submission = Assert<Has<CreditRailOperation, 'submission'>>
export type _rail_op_has_provider_accepted = Assert<Has<CreditRailOperation, 'provider_accepted'>>
export type _rail_op_has_rail_call_started_at = Assert<
  Has<CreditRailOperation, 'rail_call_started_at'>
>
/** Без `provider_tx_id` в строке операции пропадёт ключ, по которому её ищут у Zūm. */
export type _rail_op_has_provider_tx_id = Assert<Has<CreditRailOperation, 'provider_tx_id'>>
/** `state` различает «ще не передано» (`pending`) и «невідомо, чи передано». */
export type _rail_op_has_state = Assert<Has<CreditRailOperation, 'state'>>
/* Три значения признака модуля — ветки 1 и 2 правила сравнивают с ними
   поимённо. Переименует модуль `stopped_before_send` — остановленная выплата
   прочтётся как «невідомо, чи передано», а её момент вызова — как отправка. */
export type _rail_submission_stopped = Assert<
  Includes<CreditRailOperation['submission'], 'stopped_before_send'>
>
export type _rail_submission_called = Assert<
  Includes<CreditRailOperation['submission'], 'rail_called'>
>
export type _rail_submission_not_recorded = Assert<
  Includes<CreditRailOperation['submission'], 'not_recorded'>
>

/* ─── Операции рельса: состояние и направление ──────────────────────────
   Бейдж состояния берёт текст `credit.railOperationState.<state>`, ячейка
   «Колбек» без колбэков различает `pending` («чекаємо»), `unknown` («з'ясовує
   звірка») и итоговые исходы, ячейка «Платіж» — неудавшееся списание
   (`failed`/`cancelled`) и сторно (`reversed`). Пропадёт значение — строка
   молча уйдёт в чужую ветку. */
export type _rail_state_pending = Assert<Includes<CreditRailOperation['state'], 'pending'>>
export type _rail_state_unknown = Assert<Includes<CreditRailOperation['state'], 'unknown'>>
export type _rail_state_settled = Assert<Includes<CreditRailOperation['state'], 'settled'>>
export type _rail_state_failed = Assert<Includes<CreditRailOperation['state'], 'failed'>>
export type _rail_state_cancelled = Assert<Includes<CreditRailOperation['state'], 'cancelled'>>
export type _rail_state_reversed = Assert<Includes<CreditRailOperation['state'], 'reversed'>>
/** Ячейка «Операція» подписывает направление, «Платіж» ищет платёж только у списания. */
export type _rail_op_has_direction = Assert<Has<CreditRailOperation, 'direction'>>
export type _rail_direction_collect = Assert<Includes<CreditRailOperation['direction'], 'collect'>>
/** Канал: словарь `disbursementMethod`, незнакомое — дословно. Пропадёт поле — канал исчезнет. */
export type _rail_op_has_method = Assert<Has<CreditRailOperation, 'method'>>
/** Предупреждение «дані синтетичні» ставится по `provider ≠ zum`; без поля его не будет. */
export type _rail_op_has_provider = Assert<Has<CreditRailOperation, 'provider'>>
/** Ключ строки панели и якорь ссылки из строки платежа. */
export type _rail_op_has_client_transaction_id = Assert<
  Has<CreditRailOperation, 'client_transaction_id'>
>

/* ─── Операции рельса: код, статус, платёж ──────────────────────────────
   «Розшифровка» читает код и статус операции, «Платіж» и метка в строке
   платежа — `payment_id`. Пропадёт поле — ячейка покажет текст состояния
   вместо кода, а связь платежа с операцией исчезнет без единой ошибки. */
export type _rail_op_has_failure_code = Assert<Has<CreditRailOperation, 'failure_code'>>
export type _rail_op_has_provider_status = Assert<Has<CreditRailOperation, 'provider_status'>>
export type _rail_op_has_payment_id = Assert<Has<CreditRailOperation, 'payment_id'>>
/** «Колбеку не було — …, востаннє <час>»: момент берётся отсюда. */
export type _rail_op_has_observed_at = Assert<Has<CreditRailOperation, 'observed_at'>>

/* ─── Операции рельса: колбэки и шаги ───────────────────────────────────
   Колонки «Колбек» и «Кроки Zūm» рисуют каждый элемент и говорят об обрезке
   по счётчикам. Пропадёт массив — колонка скажет «колбеку не було» о колбэке,
   который был; пропадёт счётчик — обрезка пройдёт молча. */
export type _rail_op_has_callbacks = Assert<Has<CreditRailOperation, 'callbacks'>>
export type _rail_op_has_callbacks_total = Assert<Has<CreditRailOperation, 'callbacks_total'>>
export type _rail_op_has_events = Assert<Has<CreditRailOperation, 'events'>>
export type _rail_op_has_events_dropped = Assert<Has<CreditRailOperation, 'events_dropped'>>
/* Строка колбэка: время, статус, код, подпись, применённость и способ связи.
   Без любого из полей строка потеряет свою пометку — «підпис не збігся»,
   «ще не оброблено», «зв'язано за нашим ключем» — и колбэк, не применённый к
   деньгам, будет выглядеть применённым. */
export type _rail_callback_has_received_at = Assert<Has<CreditRailCallback, 'received_at'>>
export type _rail_callback_has_status = Assert<Has<CreditRailCallback, 'status'>>
export type _rail_callback_has_failure_code = Assert<Has<CreditRailCallback, 'failure_code'>>
export type _rail_callback_has_signature_ok = Assert<Has<CreditRailCallback, 'signature_ok'>>
export type _rail_callback_has_processed_at = Assert<Has<CreditRailCallback, 'processed_at'>>
export type _rail_callback_has_matched_by = Assert<Has<CreditRailCallback, 'matched_by'>>
/** Пометка «зв'язано за нашим ключем операції» стоит на этом значении. */
export type _rail_callback_matched_by_key = Assert<
  Includes<CreditRailCallback['matched_by'], 'client_transaction_id'>
>
/** Шаг Zūm: имя даёт текст, момент — время в поясе юрисдикции. */
export type _rail_event_has_event = Assert<Has<CreditRailEvent, 'event'>>
export type _rail_event_has_occurred_at = Assert<Has<CreditRailEvent, 'occurred_at'>>
/** Панель рисует `items` и сравнивает их длину с `total` — строка «Показано N з M». */
export type _rail_page_has_items = Assert<Has<CreditLoanRailOperations, 'items'>>
export type _rail_page_has_total = Assert<Has<CreditLoanRailOperations, 'total'>>
