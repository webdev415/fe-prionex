/**
 * «+ Задача» on a board (planner story 1.10, AC2).
 *
 * One `Idempotency-Key` per form: it is minted when the form mounts and sent
 * with every «Створити» of this form, so a double click (or a network retry)
 * replays the first 201 instead of creating a second task. The dialog is
 * unmounted on close, so the next form gets a new key.
 */
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { piiProps } from '@/lib/openreplay/pii'
import { newIdempotencyKey, type PlannerPerson } from '@/api/planner/plannerApi'
import { useCreatePlannerTask } from '../hooks/usePlannerMutations'
import { PeoplePicker } from './PeoplePicker'

const TITLE_MAX = 300
const DESCRIPTION_MAX = 20_000

interface CreateTaskDialogProps {
  boardCode: string
  onClose: () => void
  /** Opens the created task (the «Відкрити» action of the toast). */
  onOpenTask: (key: string) => void
}

export function CreateTaskDialog({ boardCode, onClose, onOpenTask }: CreateTaskDialogProps) {
  const { t } = useTranslation('planner')
  const [idempotencyKey] = useState(newIdempotencyKey)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignees, setAssignees] = useState<PlannerPerson[]>([])
  const [dueDate, setDueDate] = useState('')
  const [titleError, setTitleError] = useState<string | undefined>()
  const create = useCreatePlannerTask()
  // The button is disabled while the request is in flight, but a second click
  // in the same tick lands before React re-renders it. The ref closes that gap;
  // the shared key would make a duplicate harmless on the server anyway.
  const inFlight = useRef(false)

  const submit = () => {
    if (inFlight.current) return
    const trimmed = title.trim()
    if (!trimmed) {
      setTitleError(t('create.validation.titleRequired'))
      return
    }
    if (trimmed.length > TITLE_MAX) {
      setTitleError(t('create.validation.titleTooLong'))
      return
    }
    setTitleError(undefined)
    inFlight.current = true
    create.mutate(
      {
        boardCode,
        idempotencyKey,
        body: {
          title: trimmed,
          description: description.trim() ? description : null,
          assignee_ids: assignees.map((person) => person.user_id),
          due_date: dueDate || null,
        },
      },
      {
        onSuccess: (task) => {
          toast.success(t('toast.created', { key: task.key }), {
            action: { label: t('toast.open'), onClick: () => onOpenTask(task.key) },
          })
          onClose()
        },
        onSettled: () => {
          inFlight.current = false
        },
      }
    )
  }

  return (
    <Modal open onClose={onClose} maxWidth="lg" preventOutsideClose={create.isPending}>
      <ModalHeader title={t('create.title')} />
      <ModalContent className="space-y-4">
        <p className="text-muted-foreground text-xs">{t('create.board', { code: boardCode })}</p>
        <Input
          label={t('create.fields.title')}
          value={title}
          maxLength={TITLE_MAX}
          error={titleError}
          onChange={(event) => setTitle(event.target.value)}
          {...piiProps}
        />
        <Textarea
          label={t('create.fields.description')}
          value={description}
          maxLength={DESCRIPTION_MAX}
          onChange={(event) => setDescription(event.target.value)}
          {...piiProps}
        />
        <PeoplePicker value={assignees} onChange={setAssignees} />
        <Input
          type="date"
          label={t('create.fields.due')}
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
        />
      </ModalContent>
      <ModalFooter>
        <Button variant="outline" size="sm" onClick={onClose} disabled={create.isPending}>
          {t('create.cancel')}
        </Button>
        <Button size="sm" onClick={submit} isLoading={create.isPending}>
          {t('create.submit')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default CreateTaskDialog
