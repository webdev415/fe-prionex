/**
 * The option lists the preset editor offers (#1100).
 *
 * Gathered in one hook, derived exactly as `ClientFiltersBar` derives them, so
 * the two screens cannot drift into offering different portfolios or a
 * different set of RR statuses. Where the filter bar builds a list inline, the
 * derivation is repeated here rather than imported, because the filter bar's
 * copies are entangled with its own render state — but the *sources* are the
 * same hooks and constants, which is what keeps the two honest.
 *
 * Called only from the editor, which mounts only while a preset is open, so a
 * settings page is not paying for these queries just by being visited.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { RR_STATUS_FILTER_OPTIONS, rrStatusMeta } from '@/features/clients/constants/rrStatus'
import { useSellers } from '@/features/sellers/hooks/useSellers'
import type { TAChain } from '@/features/taChains/api/types'
import { useTAChains } from '@/features/taChains'
import { useTags } from '@/features/tags/hooks/useTags'
import { useOperatorFilterOptions } from '@/pages/ClientManagement/hooks/useOperatorFilterOptions'

export interface PresetOption<T extends string | number> {
  value: T
  label: string
}

export interface PresetFilterOptions {
  portfolios: PresetOption<number>[]
  tags: PresetOption<number>[]
  rrStatuses: PresetOption<number>[]
  /** Whole chains, not options: the Step row needs their embedded steps. */
  chains: TAChain[]
  employees: Array<{ id: number; name: string }>
  interactionUsers: Array<{ id: number; name: string }>
  searchers: PresetOption<string>[]
}

export function usePresetFilterOptions(projectId: number | null): PresetFilterOptions {
  const { t } = useTranslation('common')

  const { data: sellersResponse } = useSellers({ is_active: true, limit: 1000 })
  const { data: tagsData } = useTags(projectId ?? undefined)
  const { data: chainsData } = useTAChains({ include_inactive: false })
  const { employeeOptions, interactionUserOptions, searcherOptions } =
    useOperatorFilterOptions(projectId)

  // The id is part of the label because seller names repeat across portfolios —
  // the client list does the same for the same reason.
  const portfolios = useMemo(
    () =>
      (sellersResponse?.sellers ?? []).map((seller) => ({
        value: seller.id,
        label: `${seller.seller_name} (${seller.id})`,
      })),
    [sellersResponse]
  )

  const tags = useMemo(
    () => (tagsData ?? []).map((tag) => ({ value: tag.id, label: tag.name })),
    [tagsData]
  )

  const rrStatuses = useMemo(
    () =>
      RR_STATUS_FILTER_OPTIONS.map((id) => {
        const meta = rrStatusMeta[id]
        return { value: id, label: t(meta.labelKey, meta.fallbackLabel) }
      }),
    [t]
  )

  const chains = useMemo(
    () => [...(chainsData?.items ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [chainsData]
  )

  const employees = useMemo(
    () => employeeOptions.map((o) => ({ id: o.id, name: o.name })),
    [employeeOptions]
  )
  const interactionUsers = useMemo(
    () => interactionUserOptions.map((o) => ({ id: o.id, name: o.name })),
    [interactionUserOptions]
  )
  const searchers = useMemo(
    () => searcherOptions.map((o) => ({ value: o.id, label: o.name })),
    [searcherOptions]
  )

  return { portfolios, tags, rrStatuses, chains, employees, interactionUsers, searchers }
}
