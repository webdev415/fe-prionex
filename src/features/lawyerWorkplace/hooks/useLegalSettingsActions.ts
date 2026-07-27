import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { LetterTypeConfig } from '@/pages/LawyerWorkplace/settings/types'
import { initialsFromName, slugifyLegalId, syncLetterTypeDraft } from '../api/settingsMappers'
import { legalWorkplaceKeys } from './useLegalInbox'
import {
  useArchiveLegalLawyer,
  useArchiveLegalLetterType,
  useCreateLegalLawyer,
  useCreateLegalLetterType,
  useUpdateLegalLawyer,
} from './useLegalMutations'

export function useLegalSettingsActions() {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const createLetterType = useCreateLegalLetterType()
  const archiveLetterType = useArchiveLegalLetterType()
  const createLawyer = useCreateLegalLawyer()
  const updateLawyer = useUpdateLegalLawyer()
  const archiveLawyer = useArchiveLegalLawyer()

  const addLetterType = useCallback(
    async (input: Pick<LetterTypeConfig, 'nameFallback' | 'colorId'>) => {
      const id = slugifyLegalId(input.nameFallback, `type_${Date.now()}`)
      const created = await createLetterType.mutateAsync({
        id,
        name: input.nameFallback,
        color_id: input.colorId,
        sla_days: 14,
        sla_day_type: 'calendar',
        description: '',
        keyword_hints: [],
        slug: id,
      })
      return created.id
    },
    [createLetterType]
  )

  const saveLetterType = useCallback(
    async (draft: LetterTypeConfig, original: LetterTypeConfig) => {
      await syncLetterTypeDraft(draft, original)
      await queryClient.invalidateQueries({
        queryKey: [...legalWorkplaceKeys.settings(), 'letter-types'],
      })
      await queryClient.invalidateQueries({
        queryKey: legalWorkplaceKeys.letterType(draft.id),
      })
      await queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.lawyersRoot() })
      await queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.inbox() })
      await queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.messages() })
      toast.success(t('pages.lawyerWorkplace.settings.saveSuccess', 'Changes saved'))
    },
    [queryClient, t]
  )

  const deleteLetterType = useCallback(
    async (letterTypeId: string) => {
      await archiveLetterType.mutateAsync(letterTypeId)
      await queryClient.invalidateQueries({
        queryKey: [...legalWorkplaceKeys.settings(), 'letter-types'],
      })
      await queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.lawyersRoot() })
      await queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.inbox() })
      await queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.messages() })
      toast.success(
        t('pages.lawyerWorkplace.settings.letterTypes.deleteTypeSuccess', 'Letter type deleted')
      )
    },
    [archiveLetterType, queryClient, t]
  )

  const addLawyer = useCallback(
    async (input: { userId: number; displayName: string; letterTypeIds: string[] }) => {
      const id = slugifyLegalId(input.displayName, `u${input.userId}`)
      await createLawyer.mutateAsync({
        id,
        user_id: input.userId,
        display_name: input.displayName,
        initials: initialsFromName(input.displayName),
        max_in_flight: 8,
        status: 'online',
        letter_type_ids: input.letterTypeIds,
      })
      toast.success(t('pages.lawyerWorkplace.settings.modals.addLawyer.success', 'Lawyer added'))
    },
    [createLawyer, t]
  )

  const updateLawyerMaxInFlight = useCallback(
    async (lawyerId: string, maxInFlight: number) => {
      await updateLawyer.mutateAsync({
        lawyerId,
        payload: { max_in_flight: maxInFlight },
      })
    },
    [updateLawyer]
  )

  const updateLawyerLetterTypes = useCallback(
    async (lawyerId: string, letterTypeIds: string[]) => {
      await updateLawyer.mutateAsync({
        lawyerId,
        payload: { letter_type_ids: letterTypeIds },
      })
    },
    [updateLawyer]
  )

  const removeLawyer = useCallback(
    async (lawyerId: string) => {
      await archiveLawyer.mutateAsync(lawyerId)
      toast.success(t('pages.lawyerWorkplace.settings.lawyers.removed', 'Lawyer removed'))
    },
    [archiveLawyer, t]
  )

  return {
    addLetterType,
    saveLetterType,
    deleteLetterType,
    addLawyer,
    updateLawyerMaxInFlight,
    updateLawyerLetterTypes,
    removeLawyer,
    isSavingLetterType: createLetterType.isPending,
    isDeletingLetterType: archiveLetterType.isPending,
    isSavingLawyer: createLawyer.isPending || updateLawyer.isPending,
  }
}
