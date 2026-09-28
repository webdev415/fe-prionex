/**
 * Звонки и SMS CRM для карточки кредитной заявки.
 *
 * Транспорт — тот же, что у карточки клиента CRM, но БЕЗ её хука: тот
 * превращает `403` и отказ сети в пустой список, а здесь «нет права» и «CRM не
 * ответила» обязаны отличаться от «звонков не было» (`communications.ts`).
 * Запросы уходят только при числовом `client_id`, который дал модуль, —
 * никогда по клиенту, найденному по телефону.
 */
import { useQuery } from '@tanstack/react-query'
import { callSmsApi } from '@/features/clients/api/callSmsApi'
import { crmChannelState } from '../api/communications'

/** Сколько последних звонков и SMS показывает карточка; полная история — в карточке клиента. */
export const CREDIT_CRM_HISTORY_LIMIT = 5

export function useCreditCrmCommunications(clientId: number | null | undefined) {
  const enabled = typeof clientId === 'number'
  const calls = useQuery({
    queryKey: ['credit', 'crmCalls', clientId],
    queryFn: () =>
      callSmsApi.getClientCalls(clientId as number, { limit: CREDIT_CRM_HISTORY_LIMIT }),
    enabled,
    retry: false,
    // Карточку перечитывают часто (переход между вкладками), а история звонков
    // за минуту не меняется — без этого каждый заход был бы двумя запросами в CRM.
    staleTime: 60_000,
  })
  const sms = useQuery({
    queryKey: ['credit', 'crmSms', clientId],
    queryFn: () => callSmsApi.getClientSms(clientId as number, { limit: CREDIT_CRM_HISTORY_LIMIT }),
    enabled,
    retry: false,
    staleTime: 60_000,
  })
  return {
    calls: crmChannelState({
      clientId,
      isSuccess: calls.isSuccess,
      error: calls.error,
      items: calls.data?.calls,
      total: calls.data?.total,
    }),
    sms: crmChannelState({
      clientId,
      isSuccess: sms.isSuccess,
      error: sms.error,
      items: sms.data?.messages,
      total: sms.data?.total,
    }),
  }
}
