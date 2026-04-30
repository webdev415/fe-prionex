import { useQuery } from '@tanstack/react-query'
import { getClientPhonesForChain, type ContactSource } from '@/features/clients/api/clientPhonesApi'

export function useClientPhones(clientId: number | null, source: ContactSource | null) {
  return useQuery({
    queryKey: ['client-phones', clientId, source],
    queryFn: () => getClientPhonesForChain(clientId!, source!),
    enabled: clientId !== null && source !== null,
  })
}
