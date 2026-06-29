import api from '@/lib/api'
import type { ChainPhoneItem, ContactSource } from '@/features/clients/api/clientPhonesApi'

export async function getClientEmailsForChain(
  clientId: number,
  source: ContactSource
): Promise<ChainPhoneItem[]> {
  const r = await api.get<ChainPhoneItem[]>(`/api/v1/clients/${clientId}/emails`, {
    params: { source },
  })
  return r.data
}
