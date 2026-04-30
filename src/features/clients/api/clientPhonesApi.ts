import api from '@/lib/api'

export interface ChainPhoneItem {
  id: number
  contact_value: string
  comment: string | null
  type_name: string | null
}

export type ContactSource = 'client' | 'recommender'

export async function getClientPhonesForChain(
  clientId: number,
  source: ContactSource
): Promise<ChainPhoneItem[]> {
  const r = await api.get<ChainPhoneItem[]>(`/api/v1/clients/${clientId}/phones`, {
    params: { source },
  })
  return r.data
}
