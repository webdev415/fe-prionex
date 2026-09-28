/**
 * «+ Задача» on a board (planner story 1.10, AC2).
 *
 * One `Idempotency-Key` per form: it is minted when the form mounts and sent
 * with every «Створити» of this form, so a double click (or a network retry)
 * replays the first 201 instead of creating a second task. The dialog is
 * unmounted on close, so the next form gets a new key. A 409
 * `idempotency_key_reused` means the key is spent (the task was most likely
 * created by an earlier attempt): the dialog closes, the board is re-read and a
 * toast says so — staying open would answer every next «Створити» with 409.
 *
 * Only what the person filled in is sent. The contract reads a missing key as
 * «use the board's default»: no `description` — the board's description
 * template; no `assignee_ids` — the board's (or the type's) default assignee.
 * Sending `null` / `[]` for an untouched field would silently switch both
 * defaults off.
 *
 * Lengths are checked on submit, not by `maxLength`: a pasted text over the
 * limit must be reported, not cut off without a word. They are counted in
 * Unicode code points, as the planner counts runes (`MaxTitleRunes`,
 * `MaxDescriptionRunes`): an emoji is one character, not two UTF-16 units.
 */
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { piiProps } from '@/lib/openreplay/pii'
import { formatNumber } from '@/lib/localeFormat'
import {
  newIdempotencyKey,
  PLANNER_DESCRIPTION_MAX,
  PLANNER_TITLE_MAX,
  plannerTextLength,
  type PlannerPerson,
  type PlannerTaskCreate,
} from '@/api/planner/plannerApi'
import { isIdempotencyReplayConflict, useCreatePlannerTask } from '../hooks/usePlannerMutations'
import { PeoplePicker } from './PeoplePicker'

interface CreateTaskDialogProps {
  boardCode: string
  onClose: () => void
  /** Opens the created task (the «Відкрити» action of the toast). */
  onOpenTask: (key: string) => void
}

export function CreateTaskDialog({ boardCode, onClose, onOpenTask }: CreateTaskDialogProps) {
  const { t, i18n } = useTranslation('planner')
  const formatCount = (value: number) => formatNumber(value, i18n.language ?? 'uk')
  const [idempotencyKey] = useState(newIdempotencyKey)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignees, setAssignees] = useState<PlannerPerson[]>([])
  const [dueDate, setDueDate] = useState('')
  const [titleError, setTitleError] = useState<string | undefined>()
  const [descriptionError, setDescriptionError] = useState<string | undefined>()
  const create = useCreatePlannerTask()
  // The button is disabled while the request is in flight, but a second click
  // in the same tick lands before React re-renders it. The ref closes that gap;
  // the shared key would make a duplicate harmless on the server anyway.
  const inFlight = useRef(false)

  const submit = () => {
    if (inFlight.current) return
    const trimmed = title.trim()
    const nextTitleError = !trimmed
      ? t('create.validation.titleRequired')
      : plannerTextLength(trimmed) > PLANNER_TITLE_MAX
        ? t('create.validation.titleTooLong', { max: formatCount(PLANNER_TITLE_MAX) })
        : undefined
    const nextDescriptionError =
      plannerTextLength(description.trim()) > PLANNER_DESCRIPTION_MAX
        ? t('create.validation.descriptionTooLong', { max: formatCount(PLANNER_DESCRIPTION_MAX) })
        : undefined
    setTitleError(nextTitleError)
    setDescriptionError(nextDescriptionError)
    if (nextTitleError || nextDescriptionError) return

    const body: PlannerTaskCreate = { title: trimmed, due_date: dueDate || null }
    if (description.trim()) body.description = description
    if (assignees.length > 0) body.assignee_ids = assignees.map((person) => person.user_id)
    inFlight.current = true
    create.mutate(
      { boardCode, idempotencyKey, body },
      {
        onSuccess: (task) => {
          toast.success(t('toast.created', { key: task.key }), {
            action: { label: t('toast.open'), onClick: () => onOpenTask(task.key) },
          })
          onClose()
        },
        onError: (error) => {
          // The hook has re-read the board and said «maybe created».
          if (isIdempotencyReplayConflict(error)) onClose()
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
          error={titleError}
          onChange={(event) => setTitle(event.target.value)}
          {...piiProps}
        />
        <Textarea
          label={t('create.fields.description')}
          value={description}
          error={descriptionError}
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
