/**
 * Hook for related tags from linked clients that share phone numbers.
 */

import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { tagsApi } from '../api/tagsApi'
import { useAuthStore } from '@/stores/authStore'
import { filterTagsForRole } from '../utils/visibility'
import { compareRelatedTagEntries, sortTagsByOrder } from '../utils/sortTags'
import type { TagDefinition } from '../types'

export interface LinkedContactInfo {
  id: number
  fullName: string
  clientNumber: string
}

export interface RelatedTagPhoneEntry {
  normalizedPhone: string
  displayPhone: string
  contactTypeId: number | null
  spamAllowed: boolean
  blocking: {
    blocks_calls: boolean
    blocks_sms: boolean
    blocks_spam: boolean
    reasons: string[]
  }
}

export interface RelatedTagEntry {
  key: string
  tag: TagDefinition
  linkedClient: LinkedContactInfo
  phones: RelatedTagPhoneEntry[]
}

export interface PhoneMeta {
  displayPhone: string
  contactTypeId: number | null
  spamAllowed: boolean
  blocking: RelatedTagPhoneEntry['blocking']
}

const EMPTY_BLOCKING: RelatedTagPhoneEntry['blocking'] = {
  blocks_calls: false,
  blocks_sms: false,
  blocks_spam: false,
  reasons: [],
}

function getSharedPhonesForClient(
  linkedClientId: number,
  linkedContactsByPhone: Map<string, LinkedContactInfo[]>
): string[] {
  const phones: string[] = []
  linkedContactsByPhone.forEach((contacts, phone) => {
    if (contacts.some((contact) => contact.id === linkedClientId)) {
      phones.push(phone)
    }
  })
  return phones
}

export function useLinkedClientsRelatedTags(
  clientId: number,
  linkedContactsByPhone: Map<string, LinkedContactInfo[]>,
  phoneMetaByNormalized: Map<string, PhoneMeta>,
  options?: { includeHidden?: boolean; enabled?: boolean }
) {
  const roleName = useAuthStore((state) => state.user?.active_role_name)
  const includeHidden = options?.includeHidden ?? false
  const enabled = options?.enabled ?? true

  const linkedClientIds = useMemo(() => {
    const ids = new Set<number>()
    linkedContactsByPhone.forEach((contacts) => {
      contacts.forEach((contact) => ids.add(contact.id))
    })
    return Array.from(ids).sort((a, b) => a - b)
  }, [linkedContactsByPhone])

  const linkedClientInfoById = useMemo(() => {
    const map = new Map<number, LinkedContactInfo>()
    linkedContactsByPhone.forEach((contacts) => {
      contacts.forEach((contact) => {
        if (!map.has(contact.id)) {
          map.set(contact.id, contact)
        }
      })
    })
    return map
  }, [linkedContactsByPhone])

  const tagQueries = useQueries({
    queries: linkedClientIds.map((linkedClientId) => ({
      queryKey: ['clients', linkedClientId, 'tags', { includeHidden, roleName }] as const,
      queryFn: () => tagsApi.getClientTags(linkedClientId),
      enabled: enabled && !!clientId && linkedClientIds.length > 0,
      staleTime: 0,
      refetchInterval: 60_000,
      refetchIntervalInBackground: false,
    })),
  })

  const isLoading =
    linkedClientIds.length > 0 && tagQueries.some((query) => query.isLoading || query.isFetching)

  const entries = useMemo(() => {
    const result: RelatedTagEntry[] = []

    linkedClientIds.forEach((linkedClientId, index) => {
      const linkedClient = linkedClientInfoById.get(linkedClientId)
      if (!linkedClient) return

      const sharedPhones = getSharedPhonesForClient(linkedClientId, linkedContactsByPhone)
      if (sharedPhones.length === 0) return

      const tags = sortTagsByOrder(
        filterTagsForRole(tagQueries[index]?.data ?? [], roleName, includeHidden)
      ).filter((tag) => tag.is_related_tag === true)
      if (tags.length === 0) return

      const phoneEntries: RelatedTagPhoneEntry[] = sharedPhones.map((normalizedPhone) => {
        const meta = phoneMetaByNormalized.get(normalizedPhone)
        return {
          normalizedPhone,
          displayPhone: meta?.displayPhone ?? normalizedPhone,
          contactTypeId: meta?.contactTypeId ?? null,
          spamAllowed: meta?.spamAllowed ?? true,
          blocking: meta?.blocking ?? EMPTY_BLOCKING,
        }
      })

      tags.forEach((tag) => {
        result.push({
          key: `${linkedClientId}-${tag.id}`,
          tag,
          linkedClient,
          phones: phoneEntries,
        })
      })
    })

    result.sort((a, b) =>
      compareRelatedTagEntries(
        { tag: a.tag, linkedClientId: a.linkedClient.id },
        { tag: b.tag, linkedClientId: b.linkedClient.id }
      )
    )

    return result
  }, [
    includeHidden,
    linkedClientIds,
    linkedClientInfoById,
    linkedContactsByPhone,
    phoneMetaByNormalized,
    roleName,
    tagQueries,
  ])

  return { entries, isLoading, linkedClientIds }
}
