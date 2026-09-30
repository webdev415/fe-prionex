/**
 * React Query хуки кредитного модуля.
 *
 * Ключи кэша строятся так же, как у клиентов (`clientKeys`): общий корень →
 * списки → детали, чтобы инвалидация после решения била точечно.
 */
import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CreditApiError, creditApi, newIdempotencyKey } from '../api/creditApi'
import { indexDecisionCodes } from '../api/decisionCodes'
import type {
  CreditApplicationsParams,
  CreditConditionalConfirmationPayload,
  CreditJournalParams,
  CreditLoansParams,
  CreditQueueStatus,
  CreditSwitchName,
  CreditSwitchPayload,
  ManualDecisionPayload,
} from '../api/types'

export const creditKeys = {
  all: ['credit'] as const,
  overview: () => [...creditKeys.all, 'overview'] as const,
  applications: () => [...creditKeys.all, 'applications'] as const,
  applicationList: (params: CreditApplicationsParams) =>
    [...creditKeys.applications(), 'list', params] as const,
  application: (id: string) => [...creditKeys.applications(), 'detail', id] as const,
  /**
   * Все статусы очереди разбора — префикс для сброса после решения. Сам ключ
   * статуса строится от него же: иначе сброс и чтение разошлись бы молча.
   */
  queues: () => [...creditKeys.all, 'queue'] as const,
  queue: (status?: string) => [...creditKeys.queues(), status ?? 'all'] as const,
  loans: () => [...creditKeys.all, 'loans'] as const,
  loanList: (params: CreditLoansParams) => [...creditKeys.loans(), 'list', params] as const,
  loan: (id: string) => [...creditKeys.loans(), 'detail', id] as const,
  loanState: (id: string) => [...creditKeys.loans(), 'state', id] as const,
  loanSchedule: (id: string) => [...creditKeys.loans(), 'schedule', id] as const,
  /**
   * Журнал кредита. Параметры отбора входят в ключ: без них смена корзины
   * получала бы кэш прежней и на сервер не ходила вовсе.
   *
   * `params ?? {}` — чтобы «все корзины» и «параметров не передали» были ОДНИМ
   * ключом: у одного и того же ответа не должно быть двух кэшей.
   */
  loanJournal: (id: string, params?: CreditJournalParams) =>
    [...creditKeys.loans(), 'journal', id, params ?? {}] as const,
  /** Операции рельса кредита. Под `loans()`: инвалидация кредитов достаёт и их. */
  loanRailOperations: (id: string) => [...creditKeys.loans(), 'railOperations', id] as const,
  /**
   * Кредиты одного клиента CRM. Корень — `credit`, а не `clients`: владелец
   * данных модуль, а у клиентов ключ `loans` УЖЕ занят купленными долгами
   * (`clientKeys.loans`), и две разные `queryFn` на одном ключе — это
   * перезапись кэша, а не общий кэш.
   */
  clientLoans: (clientId: number) => [...creditKeys.loans(), 'byClient', clientId] as const,
  switches: () => [...creditKeys.all, 'switches'] as const,
  /** Справочник кодов решения: один на книгу правил, от проекта и заявки не зависит. */
  decisionCodes: () => [...creditKeys.all, 'decisionCodes'] as const,
}

/** Доступность модуля и права роли; молчит об ошибке — раздел просто пуст. */
export function useCreditOverview(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: creditKeys.overview(),
    queryFn: () => creditApi.overview(),
    staleTime: 60_000,
    retry: false,
    enabled: options?.enabled ?? true,
  })
}

export function useCreditApplications(params: CreditApplicationsParams) {
  return useQuery({
    queryKey: creditKeys.applicationList(params),
    queryFn: () => creditApi.applications(params),
    placeholderData: (previous) => previous,
  })
}

export function useCreditApplication(applicationId: string | undefined) {
  return useQuery({
    queryKey: creditKeys.application(applicationId ?? ''),
    queryFn: () => creditApi.application(applicationId as string),
    enabled: Boolean(applicationId),
  })
}

/**
 * Очередь ручного разбора.
 *
 * `status` уходит В ЗАПРОС, а не режет уже полученный список: очередь — это
 * все referred-решения за всё время, без окна и без границы, и локальный
 * фильтр показывал бы андеррайтеру подмножество того, что модуль уже успел
 * прислать. Ручка отдаёт всё одним ответом (`next_cursor` захардкожен `null`),
 * так что страницы здесь не подключаются — нечего листать.
 *
 * `placeholderData` намеренно нет: между «в очереди» и «разобрано» состав
 * меняется целиком, и придержанный прежний список выглядел бы как ответ на
 * новый фильтр.
 */
export function useCreditUnderwritingQueue(status?: CreditQueueStatus) {
  return useQuery({
    queryKey: creditKeys.queue(status),
    queryFn: () => creditApi.underwritingQueue(status),
  })
}

/**
 * Кредиты клиента для блока «Кредит (наш)» карточки CRM.
 *
 * 🔴 `retry: false` — не стиль. Глобальное правило (`main.tsx`) читает
 * `error.response?.status` у `AxiosError`; наш клиент бросает `CreditApiError`,
 * у которого `response` нет вовсе, значит статус читается как `undefined`,
 * значит «повторять можно» — и на 403 и на 404 ушёл бы ВТОРОЙ запрос в шлюз, у
 * которого маршрута нет.
 *
 * `enabled` приходит извне: карточка включает запрос только при открытой
 * вкладке (KAN-610 — открытие карточки перестало стрелять двадцатью
 * параллельными запросами, и седьмой хук без гейта вернул бы их).
 *
 * Поллинга нет: суммы двигаются закрытием дня, то есть раз в сутки, а свежесть
 * выражена на экране пометкой «станом на», а не частотой опроса.
 */
export function useClientCreditLoans(clientId: number, enabled: boolean) {
  return useQuery({
    queryKey: creditKeys.clientLoans(clientId),
    queryFn: () => creditApi.clientLoans(clientId),
    enabled: enabled && clientId > 0,
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnMount: false,
  })
}

export function useCreditLoans(params: CreditLoansParams) {
  return useQuery({
    queryKey: creditKeys.loanList(params),
    queryFn: () => creditApi.loans(params),
    placeholderData: (previous) => previous,
  })
}

export function useCreditLoan(loanId: string | undefined) {
  return useQuery({
    queryKey: creditKeys.loan(loanId ?? ''),
    queryFn: () => creditApi.loan(loanId as string),
    enabled: Boolean(loanId),
  })
}

/** Состояние кредита as-of — истина ядра; карточка обязана брать цифры отсюда. */
export function useCreditLoanState(loanId: string | undefined) {
  return useQuery({
    queryKey: creditKeys.loanState(loanId ?? ''),
    queryFn: () => creditApi.loanState(loanId as string),
    enabled: Boolean(loanId),
  })
}

export function useCreditLoanSchedule(loanId: string | undefined) {
  // retry не отключаем: раньше отказ молча превращался в «графіка ще немає».
  // Теперь ошибка показывается честно, и обычный ретрай уместен.
  return useQuery({
    queryKey: creditKeys.loanSchedule(loanId ?? ''),
    queryFn: () => creditApi.loanSchedule(loanId as string),
    enabled: Boolean(loanId),
  })
}

/** Версии графика: селектор нужен, только когда версий больше одной. */
export function useCreditLoanScheduleVersions(loanId: string | undefined) {
  return useQuery({
    queryKey: [...creditKeys.loans(), 'scheduleVersions', loanId ?? ''] as const,
    queryFn: () => creditApi.loanScheduleVersions(loanId as string),
    enabled: Boolean(loanId),
  })
}

/**
 * Документы кредита. Модуль отдаёт ТОЛЬКО актуальные версии: заменённые
 * отфильтрованы на сервере, и истории замен фронту взять неоткуда — правка
 * заказана в модуль. Поэтому вкладка честно показывает текущие документы и
 * не изображает историю.
 */
export function useCreditLoanDocuments(loanId: string | undefined) {
  return useQuery({
    queryKey: [...creditKeys.loans(), 'documents', loanId ?? ''] as const,
    queryFn: () => creditApi.loanDocuments(loanId as string),
    enabled: Boolean(loanId),
  })
}

/**
 * Журнал проводок с СЕРВЕРНЫМ отбором.
 *
 * Параметры уходят и в запрос, и в КЛЮЧ: ключ без них означал бы «сменил
 * корзину — получил кэш прежней и на сервер не сходил вовсе».
 *
 * `placeholderData` здесь сознательно НЕ ставится, в отличие от
 * `useCreditApplications` и `useCreditLoans`: держать строки прежней корзины
 * под подписью новой — ложь того же класса, против которой написана пометка о
 * сторно под фильтром.
 *
 * `retry: false` — по доводу `useClientCreditLoans`: `CreditApiError` без
 * `response`, глобальное правило считает повторяемым любой отказ, а
 * параметризованный ключ заводит свою цепочку на каждую корзину.
 */
export function useCreditLoanJournal(loanId: string | undefined, params?: CreditJournalParams) {
  return useQuery({
    queryKey: creditKeys.loanJournal(loanId ?? '', params),
    queryFn: () => creditApi.loanJournal(loanId as string, params),
    enabled: Boolean(loanId),
    retry: false,
  })
}

/**
 * Операции рельса кредита — вкладка «Платежі» (17-6f).
 *
 * Зовётся одним местом — вкладкой платежей карточки, поэтому запрос уходит,
 * когда оператор её открыл, а не с открытием карточки.
 *
 * `retry: false` — по доводу `useClientCreditLoans`: `CreditApiError` без
 * `response`, глобальное правило считает повторяемым любой отказ, а ключ с
 * `loanId` заводит свою цепочку повторов на каждый кредит. Модуль старше двери
 * отвечает 404, и повторять его бессмысленно.
 */
export function useCreditLoanRailOperations(loanId: string | undefined) {
  return useQuery({
    queryKey: creditKeys.loanRailOperations(loanId ?? ''),
    queryFn: () => creditApi.loanRailOperations(loanId as string),
    enabled: Boolean(loanId),
    retry: false,
  })
}

/**
 * Каталог продуктов и реестр параметров — экраны настроек модуля.
 *
 * Оба доступны только риск-менеджеру: 403 здесь — не поломка, а рабочее
 * состояние для остальных ролей, поэтому не ретраим и показываем причину.
 */
export function useCreditProducts(enabled = true) {
  return useQuery({
    queryKey: [...creditKeys.all, 'products'] as const,
    queryFn: () => creditApi.products(),
    enabled,
    retry: false,
  })
}

export function useCreditParameters(enabled = true) {
  return useQuery({
    queryKey: [...creditKeys.all, 'parameters'] as const,
    queryFn: () => creditApi.parameters(),
    enabled,
    retry: false,
  })
}

/**
 * Справочник кодов решения для формы ручного решения и карточки решения.
 *
 * `enabled` — право `credit.decisions.decide`: без него дверь отвечает 403, и
 * запрос не уходит вовсе. `retry: false` — раздел переживает недоступность
 * модуля плашкой с «Повторити», а не висит на повторах. `select` отдаёт индекс,
 * закэшированный по самому объекту ответа: перезапрос с тем же содержимым
 * React Query отдаёт прежним объектом, и индекс остаётся тем же.
 */
export function useCreditDecisionCodes(enabled: boolean) {
  return useQuery({
    queryKey: creditKeys.decisionCodes(),
    queryFn: () => creditApi.decisionCodes(),
    select: indexDecisionCodes,
    staleTime: 30 * 60_000,
    retry: false,
    enabled,
  })
}

/**
 * Ручное решение андеррайтера. После успеха инвалидируем карточку, списки и
 * сводку: статус заявки изменился, и счётчики в шапке обязаны это показать.
 */
export function useCreditManualDecision(applicationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ManualDecisionPayload) => creditApi.decide(applicationId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: creditKeys.application(applicationId) })
      void queryClient.invalidateQueries({ queryKey: creditKeys.applications() })
      void queryClient.invalidateQueries({ queryKey: creditKeys.overview() })
      // Очередь не лежит под `applications()`: без сброса предложение условного
      // одобрения встало бы в очередь с бейджем только через `staleTime` (19-5f).
      void queryClient.invalidateQueries({ queryKey: creditKeys.queues() })
    },
  })
}

/**
 * Отказ, после которого действие точно не выполнено: ответ `4xx`, кроме `408`
 * (таймаут запроса) и `429` (ограничение частоты), — их, как и `5xx`, повторяют
 * тем же ключом.
 */
function isSettledRefusal(error: unknown): boolean {
  if (!(error instanceof CreditApiError) || error.status === undefined) return false
  return error.status < 500 && error.status !== 408 && error.status !== 429
}

/**
 * Подтверждение условного одобрения руководителем (19-5f, право
 * `credit.decisions.confirm_conditional`).
 *
 * Ключ идемпотентности живёт на ДЕЙСТВИЕ, а не на вызов (образец —
 * `useSetCreditSwitch`): подпись действия — `proposal_decision_id`. Действие
 * завершает только ОПРЕДЕЛЁННЫЙ исход: успех или отказ `4xx`, кроме `408` и
 * `429`, — следующий клик тогда новое действие и новый ключ. Исход не определён
 * (сетевой сбой без ответа, `5xx` шлюза или модуля, `408`, `429`) — договор мог
 * уже выйти, и повтор идёт с ТЕМ ЖЕ ключом: модуль отдаст реплей, а не выпустит
 * второй договор.
 */
export function useCreditConfirmConditional(applicationId: string) {
  const queryClient = useQueryClient()
  const attempt = useRef<{ proposal: string; key: string } | null>(null)

  return useMutation({
    mutationFn: (payload: CreditConditionalConfirmationPayload) => {
      const previous = attempt.current
      const current =
        previous?.proposal === payload.proposal_decision_id
          ? previous
          : {
              proposal: payload.proposal_decision_id,
              key: newIdempotencyKey(`fe-confirm:${applicationId}`),
            }
      attempt.current = current
      return creditApi.confirmConditional(applicationId, payload, current.key)
    },
    onError: (error) => {
      if (isSettledRefusal(error)) attempt.current = null
    },
    onSuccess: () => {
      attempt.current = null
      void queryClient.invalidateQueries({ queryKey: creditKeys.application(applicationId) })
      void queryClient.invalidateQueries({ queryKey: creditKeys.applications() })
      void queryClient.invalidateQueries({ queryKey: creditKeys.overview() })
      // Префиксом — все статусы очереди разом: бейдж «Чекає підтвердження» не
      // должен держаться до `staleTime` в той же SPA-сессии.
      void queryClient.invalidateQueries({ queryKey: creditKeys.queues() })
    },
  })
}

/**
 * Положение рубильников продукта.
 *
 * `retry: false` и короткий `staleTime`: рубильник дёргает риск-менеджер в
 * рабочее время, и раздел должен узнать об этом в пределах минуты, а не после
 * перезагрузки страницы. Повторов нет намеренно — раздел обязан пережить
 * недоступность модуля, а не висеть на ретраях.
 */
export function useCreditSwitches(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: creditKeys.switches(),
    queryFn: () => creditApi.switches(),
    staleTime: 30_000,
    retry: false,
    enabled: options?.enabled ?? true,
  })
}

/**
 * Показывать ли раздел кредита в CRM.
 *
 * Спрашиваем модуль ТОЛЬКО у тех, кто раздел и так видит по правам: иначе
 * каждый пользователь CRM ходил бы за положением рубильника в чужой сервис,
 * которым не пользуется.
 *
 * **Отвечаем «показывать» на всё, кроме явного `false`.** Ошибка сети, недоступный
 * модуль, ещё не пришедший ответ — не повод убирать раздел из меню: пропавший
 * пункт читается как поломка CRM, а не как решение риск-менеджера. Скрываем
 * только тогда, когда модуль прямо сказал, что раздел выключен.
 */
export function useCreditSectionEnabled(canSeeSection: boolean): boolean {
  const { data } = useCreditSwitches({ enabled: canSeeSection })
  return data?.switches.crm_section !== false
}

/** Переключение рубильника. Право `credit.switches.write` — у риск-менеджера. */
export function useSetCreditSwitch() {
  const queryClient = useQueryClient()

  /**
   * Ключ идемпотентности живёт на ОДНО ДЕЙСТВИЕ пользователя, а не на один
   * вызов.
   *
   * Раньше ключ минтился внутри клиента при каждой отправке, и защита от
   * повтора не работала вообще: сеть моргнула на ответе, человек нажал ещё
   * раз — модуль видел новый ключ, выполнял переключение второй раз и писал в
   * append-only историю вторую запись. История и есть весь наш аудит
   * рубильников (отдельного журнала нет намеренно), так что дубль в ней —
   * навсегда, и разобрать потом, было переключение одно или два, уже нельзя.
   *
   * Границу действия задаёт его содержание: рубильник + новое положение +
   * причина. Ту же тройку модуль кладёт в отпечаток тела, поэтому повтор с
   * сохранённым ключом гарантированно совпадёт по отпечатку и получит реплей,
   * а не 409. Сменил причину — это уже другое действие, и ключ обязан быть
   * другим, иначе модуль ответил бы «ключ использован для другого запроса».
   *
   * После успеха ключ сбрасываем: следующее такое же переключение (выключил →
   * включил → снова выключил с той же причиной) — новое действие, и реплей
   * старого ответа сделал бы рубильник «залипшим».
   */
  // КАРТА по имени рубильника, а не одна ячейка. Один вызов хука обслуживает
  // все три переключателя сразу, и одной ячейки хватало ровно до такого
  // сценария: A отказал → человек тронул B → повторил A. Ячейка к этому
  // моменту принадлежит B, повтор A уходит с НОВЫМ ключом, и модуль пишет
  // вторую строку в append-only историю о переключении, которого не было.
  // История — весь наш аудит рубильников, дубли в ней и есть то, ради чего
  // ключ заводился.
  const attempts = useRef(new Map<CreditSwitchName, { signature: string; key: string }>())

  return useMutation({
    mutationFn: ({ name, payload }: { name: CreditSwitchName; payload: CreditSwitchPayload }) => {
      // `?? null`, а не `?? ''`: пустая причина и её отсутствие дают разные
      // тела запроса, значит и разные отпечатки на стороне модуля.
      const signature = JSON.stringify([name, payload.enabled, payload.reason ?? null])
      const previous = attempts.current.get(name)
      const attempt =
        previous?.signature === signature
          ? previous
          : { signature, key: newIdempotencyKey(`fe-switch:${name}`) }
      attempts.current.set(name, attempt)
      return creditApi.setSwitch(name, payload, attempt.key)
    },
    onSuccess: (state, variables) => {
      // Сбрасываем ключ ТОЛЬКО того рубильника, что переключили: соседний мог
      // в этот момент ждать своего повтора.
      attempts.current.delete(variables.name)
      // Ответ уже содержит новое положение обоих рубильников — кладём его в
      // кэш, чтобы экран не мигал старым значением до перезапроса.
      queryClient.setQueryData(creditKeys.switches(), state)
    },
  })
}
