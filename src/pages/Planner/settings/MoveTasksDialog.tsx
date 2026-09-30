/**
 * «Перенести N задач у…» (planner story 5.10, AC2; UX C-08, FR-8): a status
 * that holds tasks is removed only together with a place for its tasks. The
 * number is the server's (`used_count` of `status_in_use`); the targets are the
 * statuses of the new configuration without «Потребує причини» — a move must
 * not skip a required reason (the server refuses `target_requires_reason`).
 */
import { useState } from 'react'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { StatusInput } from './boardSettingsModel'
import { useSettingsText } from './settingsText'
import { SettingsSelect } from './settingsUi'

interface MoveTasksDialogProps {
  status: StatusInput
  count: number
  targets: StatusInput[]
  onConfirm: (targetId: string) => void
  onClose: () => void
}

export function MoveTasksDialog({
  status,
  count,
  targets,
  onConfirm,
  onClose,
}: MoveTasksDialogProps) {
  const { t, withCount } = useSettingsText()
  const [target, setTarget] = useState(targets[0]?.id ?? '')

  return (
    <Modal open onClose={onClose} maxWidth="md">
      <ModalHeader title={withCount('settings.move.title', count)} />
      <ModalContent className="space-y-3">
        <p className="text-foreground text-sm">
          {t('settings.move.message', { status: status.name })}
        </p>
        {targets.length > 0 ? (
          <label className="text-foreground flex items-center gap-2 text-sm">
            {t('settings.move.target')}
            <SettingsSelect value={target} onChange={(event) => setTarget(event.target.value)}>
              {targets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </SettingsSelect>
          </label>
        ) : (
          <p className="text-error-700 text-sm">{t('settings.move.noTarget')}</p>
        )}
      </ModalContent>
      <ModalFooter>
        <Button variant="outline" size="sm" onClick={onClose}>
          {t('settings.saveBar.cancel')}
        </Button>
        <Button size="sm" disabled={!target} onClick={() => onConfirm(target)}>
          {t('settings.move.confirm')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default MoveTasksDialog
