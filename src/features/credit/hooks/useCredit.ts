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
