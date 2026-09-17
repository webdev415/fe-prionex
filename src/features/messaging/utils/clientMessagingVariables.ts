import type { ClientDetail } from '@/features/clients/api/types'
import { formatDateDotDMY } from '@/lib/formatters'
import type { CurrentUserResponse } from '@/types/api'
import { resolveOperatorPhone } from './operatorPhone'

/** React-query may store either AxiosResponse or the unwrapped body. */
export function resolveCurrentUserFromQuery(data: unknown): CurrentUserResponse | undefined {
  if (!data || typeof data !== 'object') return undefined

  if ('username' in data && 'id' in data) {
    return data as CurrentUserResponse
  }

  if ('data' in data) {
    const inner = (data as { data: unknown }).data
    if (inner && typeof inner === 'object' && 'username' in inner) {
      return inner as CurrentUserResponse
    }
  }

  return undefined
}

export function buildClientMessagingVariables(options: {
  clientName: string
  clientDisplayName: string
  clientData?: ClientDetail | null
  currentUser?: CurrentUserResponse | null
  username?: string
  selectedLoan?: { loanNumber: string; totalToRepay: number } | null
  hasLoanContext?: boolean
}): Record<string, string> {
  const {
    clientName,
    clientDisplayName,
    clientData,
    currentUser,
    username,
    selectedLoan,
    hasLoanContext,
  } = options

  const debtFallback =
    !hasLoanContext && clientData?.debts && clientData.debts.length > 0
      ? clientData.debts[0].contract_number
      : ''

  const contractNumber = selectedLoan?.loanNumber ?? debtFallback

  const dueDate =
    formatDateDotDMY(clientData?.max_promise_to_pay_date ?? null) ||
    formatDateDotDMY(new Date().toISOString())

  const operatorPhone = resolveOperatorPhone(currentUser)

  return {
    client_name: clientDisplayName,
    debt_amount: selectedLoan ? Number(selectedLoan.totalToRepay).toFixed(2) : '',
    operator_name: username || currentUser?.username || '',
    operator_phone: operatorPhone,
    due_date: dueDate,
    contract_number: contractNumber,
    first_name: clientData?.first_name || '',
    last_name: clientData?.last_name || '',
    full_name: clientName,
  }
}
