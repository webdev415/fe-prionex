import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { MailboxFormValues } from '@/pages/LawyerWorkplace/components/settings/mailboxes/MailboxModal'
import type { SettingsMailbox, SyncInterval } from '@/pages/LawyerWorkplace/settings/types'
import { mapMailboxFormToCreate, mapMailboxFormToUpdate } from '../api/settingsMappers'
import {
  useCreateLegalSettingsMailbox,
  usePollAllLegalMailboxes,
  useUpdateLegalSettingsMailbox,
  useUpdateLegalSyncSettings,
} from './useLegalMutations'

export function useLegalMailboxSettingsActions() {
  const { t } = useTranslation('common')
  const createMailbox = useCreateLegalSettingsMailbox()
  const updateMailbox = useUpdateLegalSettingsMailbox()
  const updateSyncSettings = useUpdateLegalSyncSettings()
  const pollAllMailboxes = usePollAllLegalMailboxes()

  const saveMailbox = useCallback(
    async (values: MailboxFormValues, editingMailbox: SettingsMailbox | null) => {
      if (editingMailbox) {
        await updateMailbox.mutateAsync({
          mailboxId: editingMailbox.id,
          payload: mapMailboxFormToUpdate(values),
        })
        toast.success(
          t('pages.lawyerWorkplace.settings.mailboxes.updateSuccess', 'Mailbox updated')
        )
        return
      }

      await createMailbox.mutateAsync(mapMailboxFormToCreate(values))
      toast.success(t('pages.lawyerWorkplace.settings.mailboxes.addSuccess', 'Mailbox added'))
    },
    [createMailbox, t, updateMailbox]
  )

  const toggleMailboxStatus = useCallback(
    async (mailbox: SettingsMailbox) => {
      const nextStatus = mailbox.status === 'disabled' ? 'connected' : 'disabled'
      await updateMailbox.mutateAsync({
        mailboxId: mailbox.id,
        payload: { status: nextStatus },
      })
    },
    [updateMailbox]
  )

  const changeSyncInterval = useCallback(
    async (interval: SyncInterval) => {
      await updateSyncSettings.mutateAsync({ sync_interval: interval })
    },
    [updateSyncSettings]
  )

  const testSync = useCallback(async () => {
    const result = await pollAllMailboxes.mutateAsync()
    const ingested = result.results.reduce((sum, item) => sum + item.ingested, 0)
    const errors = result.results.filter((item) => item.error).length

    if (errors > 0) {
      toast.warning(
        t('pages.lawyerWorkplace.settings.mailboxes.testSyncPartial', {
          ingested,
          errors,
          defaultValue: `Sync finished with ${errors} error(s). ${ingested} new message(s).`,
        })
      )
      return
    }

    toast.success(
      t('pages.lawyerWorkplace.settings.mailboxes.testSyncSuccess', {
        ingested,
        defaultValue:
          ingested > 0
            ? `Sync complete. ${ingested} new message(s) ingested.`
            : 'Sync complete. No new messages.',
      })
    )
  }, [pollAllMailboxes, t])

  return {
    saveMailbox,
    toggleMailboxStatus,
    changeSyncInterval,
    testSync,
    isSavingMailbox: createMailbox.isPending || updateMailbox.isPending,
    isPolling: pollAllMailboxes.isPending,
    isSavingSync: updateSyncSettings.isPending,
  }
}
