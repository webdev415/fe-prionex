import { useQuery } from '@tanstack/react-query'
import { legalApi } from '../api/legalApi'
import type { LegalInboxParams } from '../api/types'

export const legalWorkplaceKeys = {
  all: ['lawyer-workplace'] as const,
  inbox: () => [...legalWorkplaceKeys.all, 'inbox'] as const,
  inboxList: (params: LegalInboxParams) => [...legalWorkplaceKeys.inbox(), params] as const,
  messages: () => [...legalWorkplaceKeys.all, 'messages'] as const,
  message: (messageId: string) => [...legalWorkplaceKeys.messages(), messageId] as const,
  threads: () => [...legalWorkplaceKeys.all, 'threads'] as const,
  thread: (threadId: string, includeQuarantined?: boolean) =>
    [...legalWorkplaceKeys.threads(), threadId, { includeQuarantined }] as const,
  settings: () => [...legalWorkplaceKeys.all, 'settings'] as const,
  letterTypes: (includeInactive?: boolean) =>
    [...legalWorkplaceKeys.settings(), 'letter-types', { includeInactive }] as const,
  letterType: (letterTypeId: string) =>
    [...legalWorkplaceKeys.settings(), 'letter-type', letterTypeId] as const,
  lawyers: (includeInactive?: boolean) =>
    [...legalWorkplaceKeys.settings(), 'lawyers', { includeInactive }] as const,
  lawyer: (lawyerId: string) => [...legalWorkplaceKeys.settings(), 'lawyer', lawyerId] as const,
  trainingExamples: (letterTypeId: string) =>
    [...legalWorkplaceKeys.settings(), 'training-examples', letterTypeId] as const,
} as const

export function useLegalInbox(params: LegalInboxParams = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: legalWorkplaceKeys.inboxList(params),
    queryFn: () => legalApi.listInbox(params),
    enabled: options?.enabled !== false,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  })
}

export function useLegalMessage(messageId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: legalWorkplaceKeys.message(messageId ?? ''),
    queryFn: () => legalApi.getMessage(messageId!),
    enabled: options?.enabled !== false && Boolean(messageId),
    staleTime: 10_000,
  })
}

export function useLegalThread(
  threadId: string | null,
  options?: { enabled?: boolean; includeQuarantined?: boolean }
) {
  const includeQuarantined = options?.includeQuarantined ?? false
  return useQuery({
    queryKey: legalWorkplaceKeys.thread(threadId ?? '', includeQuarantined),
    queryFn: () =>
      legalApi.getThread(threadId!, {
        include_quarantined: includeQuarantined,
      }),
    enabled: options?.enabled !== false && Boolean(threadId),
    staleTime: 10_000,
  })
}

export function useLegalLetterTypes(options?: { enabled?: boolean; includeInactive?: boolean }) {
  const includeInactive = options?.includeInactive ?? false
  return useQuery({
    queryKey: legalWorkplaceKeys.letterTypes(includeInactive),
    queryFn: () => legalApi.listLetterTypes({ include_inactive: includeInactive }),
    enabled: options?.enabled !== false,
    staleTime: 60_000,
  })
}

export function useLegalLetterType(letterTypeId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: legalWorkplaceKeys.letterType(letterTypeId ?? ''),
    queryFn: () => legalApi.getLetterType(letterTypeId!),
    enabled: options?.enabled !== false && Boolean(letterTypeId),
    staleTime: 60_000,
  })
}

export function useLegalLawyers(options?: { enabled?: boolean; includeInactive?: boolean }) {
  const includeInactive = options?.includeInactive ?? false
  return useQuery({
    queryKey: legalWorkplaceKeys.lawyers(includeInactive),
    queryFn: () => legalApi.listLawyers({ include_inactive: includeInactive }),
    enabled: options?.enabled !== false,
    staleTime: 60_000,
  })
}

export function useLegalLawyer(lawyerId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: legalWorkplaceKeys.lawyer(lawyerId ?? ''),
    queryFn: () => legalApi.getLawyer(lawyerId!),
    enabled: options?.enabled !== false && Boolean(lawyerId),
    staleTime: 60_000,
  })
}

export function useLegalTrainingExamples(
  letterTypeId: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: legalWorkplaceKeys.trainingExamples(letterTypeId ?? ''),
    queryFn: () => legalApi.listTrainingExamples(letterTypeId!),
    enabled: options?.enabled !== false && Boolean(letterTypeId),
    staleTime: 60_000,
  })
}
