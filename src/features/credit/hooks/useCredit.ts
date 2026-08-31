/**
 * React Query хуки кредитного модуля.
 *
 * Ключи кэша строятся так же, как у клиентов (`clientKeys`): общий корень →
 * списки → детали, чтобы инвалидация после решения била точечно.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { creditApi } from '../api/creditApi'
import type {
  CreditApplicationsParams,
  CreditLoansParams,
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
  queue: (status?: string) => [...creditKeys.all, 'queue', status ?? 'all'] as const,
  loans: () => [...creditKeys.all, 'loans'] as const,
  loanList: (params: CreditLoansParams) => [...creditKeys.loans(), 'list', params] as const,
  loan: (id: string) => [...creditKeys.loans(), 'detail', id] as const,
  loanState: (id: string) => [...creditKeys.loans(), 'state', id] as const,
  loanSchedule: (id: string) => [...creditKeys.loans(), 'schedule', id] as const,
  loanJournal: (id: string) => [...creditKeys.loans(), 'journal', id] as const,
  switches: () => [...creditKeys.all, 'switches'] as const,
}

/** Доступность модуля и права роли; молчит об ошибке — раздел просто пуст. */
export function useCreditOverview() {
  return useQuery({
    queryKey: creditKeys.overview(),
    queryFn: () => creditApi.overview(),
    staleTime: 60_000,
    retry: false,
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

export function useCreditLoanJournal(loanId: string | undefined) {
  return useQuery({
    queryKey: creditKeys.loanJournal(loanId ?? ''),
    queryFn: () => creditApi.loanJournal(loanId as string),
    enabled: Boolean(loanId),
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
  return useMutation({
    mutationFn: ({ name, payload }: { name: CreditSwitchName; payload: CreditSwitchPayload }) =>
      creditApi.setSwitch(name, payload),
    onSuccess: (state) => {
      // Ответ уже содержит новое положение обоих рубильников — кладём его в
      // кэш, чтобы экран не мигал старым значением до перезапроса.
      queryClient.setQueryData(creditKeys.switches(), state)
    },
  })
}
