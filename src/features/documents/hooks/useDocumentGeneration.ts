import { useMutation, useQuery } from '@tanstack/react-query'
import { generateDocument, getGenerationOptions } from '../api/generationApi'
import type { GenerateDocumentPayload } from '../api/types'

export const documentGenerationKeys = {
  all: ['document-generation'] as const,
  options: (clientId: number) => [...documentGenerationKeys.all, 'options', clientId] as const,
}

/**
 * Which templates can be generated for each of a client's debts.
 * Kept fresh (staleTime 0) — availability tracks debt/RR/promise state that
 * an operator may have just changed elsewhere on the card.
 */
export function useGenerationOptions(clientId: number, enabled = true) {
  return useQuery({
    queryKey: documentGenerationKeys.options(clientId),
    queryFn: () => getGenerationOptions(clientId),
    enabled: enabled && Number.isFinite(clientId) && clientId > 0,
    staleTime: 0,
  })
}

export function useGenerateDocument() {
  return useMutation({
    mutationFn: ({
      templateId,
      payload,
    }: {
      templateId: number
      payload: GenerateDocumentPayload
    }) => generateDocument(templateId, payload),
  })
}
