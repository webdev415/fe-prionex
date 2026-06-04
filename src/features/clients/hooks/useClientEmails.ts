import { useQuery } from '@tanstack/react-query'
import { getClientEmailsForChain } from '@/features/clients/api/clientEmailsApi'
import type { ContactSource } from '@/features/clients/api/clientPhonesApi'

export function useClientEmails(clientId: number | null, source: ContactSource | null) {
  return useQuery({
    queryKey: ['client-emails', clientId, source],
    queryFn: () => getClientEmailsForChain(clientId!, source!),
    enabled: clientId !== null && source !== null,
  })
}
