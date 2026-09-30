/**
 * «Архівувати дошку» at the bottom of the settings (planner story 5.10, AC4;
 * UX C-08, UX-DR30, FR-14). Irreversible, so it asks first (UX-DR13):
 * - open tasks on the board — «На дошці 12 відкритих задач. Щоб архівувати,
 *   закрийте їх із причиною», a required reason and «Закрити 12 задач і
 *   архівувати»;
 * - none — a plain confirmation.
 * The page renders it only with `archive_board` allowed and a command to call
 * (`archiveCommand.ts`).
 */
import { useState } from 'react'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { formatNumber } from '@/lib/localeFormat'
import { PLANNER_REASON_MAX, plannerTextLength } from '@/api/planner/plannerApi'
import type { ArchiveBoardCommand } from './archiveCommand'
import { useSettingsText } from './settingsText'

export function ArchiveBoardSection({ command }: { command: ArchiveBoardCommand }) {
  const { t, language, withCount } = useSettingsText()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | undefined>()
  const count = command.openTasks
  const withTasks = count > 0

  const confirm = () => {
    if (!withTasks) {
      command.archive(null)
      setOpen(false)
      return
    }
    const trimmed = reason.trim()
    if (plannerTextLength(trimmed) > PLANNER_REASON_MAX) {
      setReasonError(
        t('settings.archive.reasonTooLong', { max: formatNumber(PLANNER_REASON_MAX, language) })
      )
      return
    }
    command.archive(trimmed)
    setOpen(false)
  }

  return (
    <div className="border-border space-y-2 border-t pt-4">
      <Button
        variant="danger"
        size="sm"
        disabled={command.pending}
        onClick={() => {
          setReason('')
          setReasonError(undefined)
          setOpen(true)
        }}
      >
        {t('settings.archive.button')}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} maxWidth="md">
        <ModalHeader
          title={withTasks ? t('settings.archive.button') : t('settings.archive.noOpenTitle')}
        />
        <ModalContent className="space-y-3">
          <p className="text-foreground text-sm">
            {withTasks ? withCount('settings.archive.open', count) : t('settings.archive.noOpen')}
          </p>
          {withTasks && (
            <Textarea
              label={t('settings.archive.reason')}
              value={reason}
              error={reasonError}
              onChange={(event) => setReason(event.target.value)}
            />
          )}
        </ModalContent>
        <ModalFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            {t('settings.saveBar.cancel')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={withTasks && reason.trim() === ''}
            onClick={confirm}
          >
            {withTasks
              ? withCount('settings.archive.confirm', count)
              : t('settings.archive.confirm')}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

export default ArchiveBoardSection
