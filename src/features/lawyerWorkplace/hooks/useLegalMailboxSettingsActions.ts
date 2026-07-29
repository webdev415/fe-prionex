import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { MailboxFormValues } from '@/pages/LawyerWorkplace/components/settings/mailboxes/MailboxModal'
import type {
  MailboxRoutingRule,
  SettingsMailbox,
  SyncInterval,
} from '@/pages/LawyerWorkplace/settings/types'
import { withReindexedPriority } from '@/pages/LawyerWorkplace/settings/utils/mailboxHelpers'
import {
  mapMailboxFormToConnectionTest,
  mapMailboxFormToCreate,
  mapMailboxFormToUpdate,
  mapRoutingRulesToUpdate,
} from '../api/settingsMappers'
import { mapMailboxConnectionError } from '@/pages/LawyerWorkplace/settings/utils/mailboxConnectionErrors'
import {
  useCreateLegalSettingsMailbox,
  usePollAllLegalMailboxes,
  useTestLegalSettingsMailboxConnection,
  useUpdateLegalSettingsMailbox,
  useUpdateLegalSyncSettings,
} from './useLegalMutations'

export function useLegalMailboxSettingsActions() {
  const { t } = useTranslation('common')
  const createMailbox = useCreateLegalSettingsMailbox()
  const updateMailbox = useUpdateLegalSettingsMailbox()
  const testMailboxConnectionMutation = useTestLegalSettingsMailboxConnection()
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
      if (nextStatus === 'disabled') {
        toast.info(
          t(
            'pages.lawyerWorkplace.settings.mailboxes.disabledHidden',
            'Mailbox disabled. Its messages are hidden from the inbox.'
          )
        )
      }
    },
    [updateMailbox, t]
  )

  const changeSyncInterval = useCallback(
    async (interval: SyncInterval) => {
      await updateSyncSettings.mutateAsync({ sync_interval: interval })
    },
    [updateSyncSettings]
  )

  const saveRoutingRules = useCallback(
    async (mailboxId: string, rules: MailboxRoutingRule[]) => {
      // Replace semantics: the backend receives the whole (re-ordered) list.
      const ordered = withReindexedPriority(rules)
      await updateMailbox.mutateAsync({
        mailboxId,
        payload: mapRoutingRulesToUpdate(ordered),
      })
    },
    [updateMailbox]
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
      ingested > 0
        ? t('pages.lawyerWorkplace.settings.mailboxes.testSyncSuccess', {
            ingested,
            defaultValue: `Sync complete. ${ingested} new message(s) ingested.`,
          })
        : t(
            'pages.lawyerWorkplace.settings.mailboxes.testSyncSuccessEmpty',
            'Sync complete. No new messages.'
          )
    )
  }, [pollAllMailboxes, t])

  const testMailboxConnection = useCallback(
    async (values: MailboxFormValues) => {
      try {
        await testMailboxConnectionMutation.mutateAsync(mapMailboxFormToConnectionTest(values))
      } catch (error) {
        const message = mapMailboxConnectionError(error, values.provider, t)
        toast.error(message)
        throw new Error(message)
      }
      toast.success(
        t('pages.lawyerWorkplace.settings.mailboxes.testConnectionSuccess', 'Connection successful')
      )
    },
    [t, testMailboxConnectionMutation]
  )

  return {
    saveMailbox,
    testMailboxConnection,
    toggleMailboxStatus,
    changeSyncInterval,
    saveRoutingRules,
    testSync,
    isSavingMailbox: createMailbox.isPending || updateMailbox.isPending,
    isTestingConnection: testMailboxConnectionMutation.isPending,
    isPolling: pollAllMailboxes.isPending,
    isSavingSync: updateSyncSettings.isPending,
    isSavingRoutingRules: updateMailbox.isPending,
  }
}
