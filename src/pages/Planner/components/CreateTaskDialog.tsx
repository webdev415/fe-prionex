/**
 * «+ Задача» — the task and request form (planner stories 1.10, 5.7; UX-DR24,
 * UX-DR59, U-48; FR-10, FR-13, FR-15, NFR-10).
 *
 * Where the task goes is the server's answer to `GET /boards?can_create=true`:
 * a board in `items` takes a task of a member (type, assignees, priority,
 * fields, «Ще поля»), a board in `intake` takes a request (title, description,
 * files, required fields, deadline; «Тип, пріоритет і виконавця визначить
 * відділ»). The client does not decide who is a member. Until the list answers
 * (or when it failed) the board page's own board stands in as a member board
 * by its card's `create_task`, and «Створити» waits only while the list loads.
 *
 * One `Idempotency-Key` per form: it is minted when the form mounts and sent
 * with every «Створити» of this form, so a double click (or a network retry)
 * replays the first 201 instead of creating a second task. The dialog is
 * unmounted on close, so the next form gets a new key. A 409
 * `idempotency_key_reused` means the key is spent (the task was most likely
 * created by an earlier attempt): the dialog closes, the board is re-read and a
 * toast says so — staying open would answer every next «Створити» with 409.
 *
 * While «Створити» is in flight the form cannot be closed — not by «×», not by
 * «Скасувати», Escape or a click outside. A request's files upload inside that
 * same flight, and the «Створено КОД-n · Відкрити» toast, the «не завантажено
 * файлів» toast and the error at its field are said by this form's callbacks:
 * a form closed mid-flight would lose them, and the person, not knowing the
 * task exists, would create it again with a new key (AC1.4, NFR-10).
 *
 * Only what the person touched is sent. The contract reads a missing key as
 * «use the board's default»: no `description` — the board's description
 * template (shown in the field); no `assignee_ids` — the type's or the board's
 * default assignee (shown in the field); no `type_id` / `priority_id` — the
 * default type and level; no key of a board field — its default. A request
 * sends none of the triage keys at all (400 `triage_only` otherwise).
 *
 * Lengths are checked on submit, not by `maxLength`: a pasted text over the
 * limit must be reported, not cut off without a word. They are counted in
 * Unicode code points, as the planner counts runes (`MaxTitleRunes`,
 * `MaxDescriptionRunes`): an emoji is one character, not two UTF-16 units.
 * A 400 that names its field is said at that field.
 */
import { useId, useRef, useState } from 'react'
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
  PLANNER_ATTACHMENT_MAX_BYTES,
  PLANNER_DESCRIPTION_MAX,
  PLANNER_TITLE_MAX,
  PLANNER_WATCHERS_MAX,
  plannerTextLength,
  type PlannerBoardField,
  type PlannerPerson,
  type PlannerTaskCreate,
} from '@/api/planner/plannerApi'
import { usePlannerBoard, usePlannerCreatableBoards } from '@/api/planner/plannerQueries'
import { readPlannerError } from '@/api/planner/plannerErrors'
import {
  isFieldValidation,
  isIdempotencyReplayConflict,
  toastPlannerError,
  useCreatePlannerTask,
  type CreateTaskAttachment,
} from '../hooks/usePlannerMutations'
import { usableTimeZone } from '../plannerFormat'
import {
  boardCardOption,
  boardOptions,
  dueBody,
  fieldBodyValue,
  fieldDefaultDraft,
  fieldErrorKey,
  fieldOfError,
  memberAsPerson,
  requestTargetName,
  type BoardOption,
  type DueChoice,
  type FieldDraft,
  type FormFieldKey,
} from '../createTaskForm'
import { BoardFieldInput } from './BoardFieldInput'
import { BoardPicker } from './BoardPicker'
import { DueField } from './DueField'
import { FieldError, NativeSelect, RequiredLabel } from './FormParts'
import { PeoplePicker } from './PeoplePicker'

interface CreateTaskDialogProps {
  /** The board the form starts on (the board page's own); none — the person picks. */
  boardCode?: string
  /**
   * `request` — the «Нова заявка» entry (U-48): only boards that take
   * requests, and the field is «Кому» from the start. No caller yet: the
   * entries are «Нова заявка» in «Мої задачі» (story 5.2) and `+ Заявка` of the
   * guest view (story 5.3); story 5.7 ships the form only.
   */
  intent?: 'task' | 'request'
  onClose: () => void
  /** Opens the created task (the «Відкрити» action of the toast). */
  onOpenTask: (key: string) => void
}

type Errors = Partial<Record<FormFieldKey, string>>

const MIB = 1024 * 1024

const byPosition = <T extends { position: number }>(items: readonly T[] | undefined): T[] =>
  [...(items ?? [])].sort((a, b) => a.position - b.position)

const chip =
  'border-border rounded-full border px-3 py-1 text-xs text-foreground hover:bg-muted aria-pressed:border-primary-500 aria-pressed:bg-muted aria-pressed:font-medium'

export function CreateTaskDialog({
  boardCode,
  intent = 'task',
  onClose,
  onOpenTask,
}: CreateTaskDialogProps) {
  const { t, i18n } = useTranslation('planner')
  const formatCount = (value: number) => formatNumber(value, i18n.language ?? 'uk')
  const [idempotencyKey] = useState(newIdempotencyKey)
  const requestOnly = intent === 'request'
  const creatable = usePlannerCreatableBoards()
  const listed = creatable.data ? boardOptions(creatable.data, requestOnly) : undefined
  const [code, setCode] = useState<string | undefined>(boardCode)
  const listedChoice = listed?.find((option) => option.code === code)
  // «+ Задача» of a board page does not wait on the list: until it answers, or
  // when it failed, the page's own board stands in as a member board — its card
  // is at hand (the page has read it) and allows `create_task`. «Створити»
  // still waits for the list while it loads: the list may say the task is a
  // request here. A request needs the list (the card has no intake fields).
  const standInCode = !listed && !requestOnly && code === boardCode ? code : undefined
  const board = usePlannerBoard(
    listedChoice ? (listedChoice.request ? undefined : listedChoice.code) : standInCode,
    true,
    { poll: false }
  )
  const standIn =
    standInCode && board.data?.code === standInCode ? boardCardOption(board.data) : undefined
  const options = listed ?? (standIn ? [standIn] : [])
  const selected = listedChoice ?? standIn
  const mode = selected ? (selected.request ? 'request' : 'task') : undefined
  const config = mode === 'task' ? board.data?.config : undefined
  const intakeBoard =
    mode === 'request' ? creatable.data?.intake?.find((b) => b.code === code) : undefined

  const [title, setTitle] = useState('')
  /** `undefined` — untouched: the field shows the board's template, nothing is sent. */
  const [description, setDescription] = useState<string | undefined>()
  const [due, setDue] = useState<DueChoice | null>(null)
  const [duePicking, setDuePicking] = useState(false)
  // Per board: a different board starts these over.
  const [typeId, setTypeId] = useState<string | null | undefined>()
  const [priorityId, setPriorityId] = useState<string | null | undefined>()
  const [assignees, setAssignees] = useState<PlannerPerson[] | undefined>()
  const [labelIds, setLabelIds] = useState<string[]>([])
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, FieldDraft>>({})
  const [watchers, setWatchers] = useState<PlannerPerson[]>([])
  const [files, setFiles] = useState<CreateTaskAttachment[]>([])
  /** The file being uploaded after the 201, while the form is locked. */
  const [upload, setUpload] = useState<{ index: number; count: number; percent: number } | null>(
    null
  )
  const [moreOpen, setMoreOpen] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  // A board that resolves late (the list or the card answered after a
  // «Створити») takes the «Оберіть дошку» said meanwhile with it.
  const [resolvedCode, setResolvedCode] = useState(selected?.code)
  if (resolvedCode !== selected?.code) {
    setResolvedCode(selected?.code)
    if (resolvedCode === undefined && errors.board) setErrors({ ...errors, board: undefined })
  }
  const formId = useId()
  const create = useCreatePlannerTask()
  // The button is disabled while the request is in flight, but a second click
  // in the same tick lands before React re-renders it. The ref closes that gap;
  // the shared key would make a duplicate harmless on the server anyway.
  const inFlight = useRef(false)
  // Every way out of the form but a finished «Створити» (see the header).
  const close = () => {
    if (inFlight.current || create.isPending) return
    onClose()
  }

  // ── what the chosen board offers ──────────────────────────────────────────
  const types = byPosition(config?.task_types)
  const defaultType = types.find((type) => type.default)
  const effectiveTypeId = typeId === undefined ? (defaultType?.id ?? null) : typeId
  const effectiveType = types.find((type) => type.id === effectiveTypeId)
  const members = board.data?.members ?? []
  // FR-10: the type's default assignee, else the board's.
  const defaultAssigneeId =
    effectiveType?.default_assignee_id ?? config?.defaults?.assignee_id ?? null
  const defaultAssignee = members.find((member) => member.user_id === defaultAssigneeId)
  const shownAssignees = assignees ?? (defaultAssignee ? [memberAsPerson(defaultAssignee)] : [])
  const priorities = byPosition(config?.priorities)
  const defaultPriority = priorities.find((level) => level.default)
  const labels = byPosition(config?.labels)
  const template = config?.defaults?.description_template ?? null
  const boardFields: PlannerBoardField[] =
    mode === 'task'
      ? byPosition(config?.fields)
      : mode === 'request'
        ? byPosition(intakeBoard?.required_fields)
        : []
  const requiredFields = boardFields.filter((field) => field.required)
  const optionalFields = mode === 'task' ? boardFields.filter((field) => !field.required) : []
  const fieldValue = (field: PlannerBoardField): FieldDraft =>
    field.id in fieldDrafts ? fieldDrafts[field.id] : fieldDefaultDraft(field, members)
  // The deadline's hour is the board's clock; a request board gives no zone
  // (IntakeBoard has none) — the person's own clock then.
  const timeZone = mode === 'task' ? usableTimeZone(board.data?.tzid) : undefined

  const moreKeys = new Set<FormFieldKey>([
    'labels',
    'watchers',
    ...optionalFields.map((field) => `field:${field.id}` as const),
  ])
  const shownKeys = new Set<FormFieldKey>([
    'board',
    'title',
    'description',
    'due',
    ...boardFields.map((field) => `field:${field.id}` as const),
    ...(mode === 'request' ? (['attachments'] as const) : []),
    ...(mode === 'task' ? (['assignees', 'watchers'] as const) : []),
    ...(mode === 'task' && types.length > 0 ? (['type'] as const) : []),
    ...(mode === 'task' && priorities.length > 0 ? (['priority'] as const) : []),
    ...(mode === 'task' && labels.length > 0 ? (['labels'] as const) : []),
  ])

  const clearError = (key: FormFieldKey) =>
    setErrors((was) => (was[key] ? { ...was, [key]: undefined } : was))

  const showErrors = (next: Errors) => {
    setErrors(next)
    if (Object.keys(next).some((key) => moreKeys.has(key as FormFieldKey))) setMoreOpen(true)
  }

  const pickBoard = (option: BoardOption) => {
    if (option.code === code) return
    setCode(option.code)
    setTypeId(undefined)
    setPriorityId(undefined)
    setAssignees(undefined)
    setLabelIds([])
    setFieldDrafts({})
    // Files belong to a request, like the title to the task: they stay from one
    // request board to another, but a member board's form has no files — they
    // go with the switch, visibly, not silently at «Створити».
    if (!option.request) setFiles([])
    setErrors({})
  }

  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return
    const added = Array.from(list, (file) => ({ file, idempotencyKey: newIdempotencyKey() }))
    setFiles((was) => [...was, ...added])
    clearError('attachments')
  }

  const submit = () => {
    if (inFlight.current || creatable.isPending) return
    const next: Errors = {}
    if (!selected) next.board = t('create.errors.boardRequired')
    const trimmed = title.trim()
    if (!trimmed) next.title = t('create.validation.titleRequired')
    else if (plannerTextLength(trimmed) > PLANNER_TITLE_MAX)
      next.title = t('create.validation.titleTooLong', { max: formatCount(PLANNER_TITLE_MAX) })
    if (
      description !== undefined &&
      plannerTextLength(description.trim()) > PLANNER_DESCRIPTION_MAX
    ) {
      next.description = t('create.validation.descriptionTooLong', {
        max: formatCount(PLANNER_DESCRIPTION_MAX),
      })
    }
    const deadline = dueBody(due, timeZone)
    if ('problem' in deadline) next.due = t(`create.errors.due.${deadline.problem}`)
    const fields: Record<string, unknown> = {}
    for (const field of boardFields) {
      if (!(field.id in fieldDrafts)) continue
      const value = fieldBodyValue(field, fieldDrafts[field.id])
      if (value === undefined) next[`field:${field.id}`] = t('create.errors.number')
      else fields[field.id] = value
    }
    if (mode === 'request') {
      if (files.some(({ file }) => file.size > PLANNER_ATTACHMENT_MAX_BYTES)) {
        next.attachments = t('create.errors.fileTooBig', {
          max: formatCount(PLANNER_ATTACHMENT_MAX_BYTES / MIB),
        })
      } else if (files.some(({ file }) => file.size === 0)) {
        next.attachments = t('create.errors.fileEmpty')
      }
    }
    showErrors(next)
    if (!selected || 'problem' in deadline || Object.values(next).some(Boolean)) return

    const body: PlannerTaskCreate = { title: trimmed, ...deadline.body }
    if (description !== undefined) {
      // Emptied on purpose: no description, not the board's template.
      if (description.trim()) body.description = description
      else if (template !== null) body.description = null
    }
    if (mode === 'task') {
      if (typeId !== undefined) body.type_id = typeId
      if (priorityId !== undefined) body.priority_id = priorityId
      if (assignees !== undefined) body.assignee_ids = assignees.map((person) => person.user_id)
      if (labelIds.length > 0) body.label_ids = labelIds
      if (watchers.length > 0) body.watcher_ids = watchers.map((person) => person.user_id)
    }
    if (Object.keys(fields).length > 0) body.fields = fields

    inFlight.current = true
    create.mutate(
      {
        boardCode: selected.code,
        idempotencyKey,
        body,
        attachments: mode === 'request' && files.length > 0 ? files : undefined,
        onAttachmentProgress: ({ index, count, fraction }) => {
          const percent = Math.floor(fraction * 100)
          setUpload((was) =>
            was?.index === index && was.percent === percent ? was : { index, count, percent }
          )
        },
      },
      {
        onSuccess: ({ task, failedAttachments }) => {
          toast.success(t('toast.created', { key: task.key }), {
            action: { label: t('toast.open'), onClick: () => onOpenTask(task.key) },
          })
          if (failedAttachments > 0) {
            toast.error(t('create.attachmentsFailed', { count: failedAttachments }))
          }
          onClose()
        },
        onError: (error) => {
          // The hook has re-read the board and said «maybe created».
          if (isIdempotencyReplayConflict(error)) {
            onClose()
            return
          }
          const { status, details } = readPlannerError(error)
          if (status === 404) {
            showErrors({ board: t('create.errors.boardGone') })
            return
          }
          if (!isFieldValidation(error)) return // the hook said it
          if (details.reason === 'triage_only') {
            // Not a member any more: the list is re-read and the form turns
            // into a request.
            showErrors({ board: t('create.errors.becameRequest') })
            return
          }
          const key = fieldOfError(details, boardFields)
          if (key && shownKeys.has(key)) {
            showErrors({ [key]: t(fieldErrorKey(details, key)) })
            return
          }
          toastPlannerError(t, error)
        },
        onSettled: () => {
          inFlight.current = false
          setUpload(null)
        },
      }
    )
  }

  const heading =
    mode === 'request' && selected
      ? t('create.requestTitle', { name: requestTargetName(selected) })
      : requestOnly
        ? t('create.requestTitleEmpty')
        : t('create.title')

  const renderField = (field: PlannerBoardField) => (
    <BoardFieldInput
      key={field.id}
      field={field}
      value={fieldValue(field)}
      onChange={(value) => {
        setFieldDrafts((was) => ({ ...was, [field.id]: value }))
        clearError(`field:${field.id}`)
      }}
      error={errors[`field:${field.id}`]}
    />
  )

  const dueField = (
    <DueField
      value={due}
      onChange={(value) => {
        setDue(value)
        clearError('due')
      }}
      picking={duePicking}
      onPickingChange={setDuePicking}
      timeZone={timeZone}
      error={errors.due}
    />
  )

  return (
    <Modal
      open
      onClose={close}
      maxWidth="lg"
      preventOutsideClose={create.isPending}
      showCloseButton={!create.isPending}
    >
      <ModalHeader title={heading} />
      <ModalContent className="space-y-4">
        {mode === 'request' && (
          <p className="text-muted-foreground text-sm">{t('create.requestNote')}</p>
        )}
        <BoardPicker
          options={options}
          value={selected}
          onChange={pickBoard}
          requestOnly={requestOnly}
          loading={creatable.isPending}
          failed={creatable.isError}
          onRetry={() => void creatable.refetch()}
          error={errors.board}
        />
        <Input
          label={<RequiredLabel>{t('create.fields.title')}</RequiredLabel>}
          aria-required
          value={title}
          error={errors.title}
          onChange={(event) => {
            setTitle(event.target.value)
            clearError('title')
          }}
          {...piiProps}
        />
        <Textarea
          label={t('create.fields.description')}
          value={description ?? template ?? ''}
          error={errors.description}
          onChange={(event) => {
            setDescription(event.target.value)
            clearError('description')
          }}
          {...piiProps}
        />

        {/* The form rebuilds itself after a board is picked: said, not only shown. */}
        <div role="status" aria-live="polite">
          {mode === 'task' && board.isPending && (
            <p className="text-muted-foreground text-xs">{t('create.boardConfigLoading')}</p>
          )}
          {mode === 'task' && board.isError && (
            <p className="text-foreground text-xs">{t('create.boardConfigError')}</p>
          )}
        </div>

        {mode === 'task' && (
          <>
            {types.length > 0 && (
              <NativeSelect
                label={t('create.fields.type')}
                value={effectiveTypeId ?? ''}
                onChange={(value) => {
                  setTypeId(value || null)
                  clearError('type')
                }}
                options={[
                  { value: '', label: t('create.noType') },
                  ...types.map((type) => ({ value: type.id, label: type.name })),
                ]}
                error={errors.type}
              />
            )}
            <PeoplePicker
              value={shownAssignees}
              onChange={(people) => {
                setAssignees(people)
                clearError('assignees')
              }}
              error={errors.assignees}
            />
            {dueField}
            {priorities.length > 0 && (
              <NativeSelect
                label={t('create.fields.priority')}
                value={priorityId === undefined ? (defaultPriority?.id ?? '') : (priorityId ?? '')}
                onChange={(value) => {
                  setPriorityId(value || null)
                  clearError('priority')
                }}
                options={[
                  { value: '', label: t('create.noPriority') },
                  ...priorities.map((level) => ({ value: level.id, label: level.name })),
                ]}
                error={errors.priority}
              />
            )}
            {requiredFields.map(renderField)}

            <div>
              <button
                type="button"
                aria-expanded={moreOpen}
                className="text-foreground text-sm font-medium underline-offset-2 hover:underline"
                onClick={() => setMoreOpen((was) => !was)}
              >
                <span aria-hidden="true">{moreOpen ? '▾ ' : '▸ '}</span>
                {t('create.more')}
              </button>
            </div>
            {moreOpen && (
              <div className="border-border space-y-4 border-l-2 pl-3">
                {labels.length > 0 && (
                  <fieldset
                    aria-describedby={errors.labels ? `${formId}-labels` : undefined}
                    aria-invalid={!!errors.labels}
                  >
                    <legend className="text-foreground mb-1.5 text-sm font-light">
                      {t('create.fields.labels')}
                    </legend>
                    <div className="flex flex-wrap gap-1.5">
                      {labels.map((label) => (
                        <button
                          key={label.id}
                          type="button"
                          className={chip}
                          aria-pressed={labelIds.includes(label.id)}
                          onClick={() => {
                            setLabelIds((was) =>
                              was.includes(label.id)
                                ? was.filter((id) => id !== label.id)
                                : [...was, label.id]
                            )
                            clearError('labels')
                          }}
                        >
                          {label.name}
                        </button>
                      ))}
                    </div>
                    <FieldError id={`${formId}-labels`} text={errors.labels} />
                  </fieldset>
                )}
                <PeoplePicker
                  value={watchers}
                  onChange={(people) => {
                    setWatchers(people)
                    clearError('watchers')
                  }}
                  max={PLANNER_WATCHERS_MAX}
                  label={t('create.fields.watchers')}
                  placeholder={t('create.fields.assigneesPlaceholder')}
                  error={errors.watchers}
                />
                {optionalFields.map(renderField)}
              </div>
            )}
          </>
        )}

        {mode === 'request' && (
          <>
            <div>
              <label
                htmlFor={`${formId}-files`}
                className="text-foreground mb-1.5 block text-sm font-light"
              >
                {t('create.fields.attachments')}
              </label>
              <input
                id={`${formId}-files`}
                type="file"
                multiple
                aria-invalid={!!errors.attachments}
                aria-describedby={errors.attachments ? `${formId}-files-error` : undefined}
                className="text-foreground text-sm"
                onChange={(event) => {
                  addFiles(event.target.files)
                  // The same file can be chosen again after it is removed.
                  event.target.value = ''
                }}
              />
              {files.length > 0 && (
                <ul className="mt-1.5 space-y-1" {...piiProps}>
                  {files.map((attachment) => (
                    <li
                      key={attachment.idempotencyKey}
                      className="text-foreground flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="min-w-0 truncate">{attachment.file.name}</span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          setFiles((was) =>
                            was.filter((f) => f.idempotencyKey !== attachment.idempotencyKey)
                          )
                        }
                      >
                        <span aria-hidden="true">×</span>
                        {/* The file name stays a text node under the mask, not an attribute. */}
                        <span className="sr-only">
                          {t('create.removeFile', { name: attachment.file.name })}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <FieldError id={`${formId}-files-error`} text={errors.attachments} />
              {upload && (
                <div className="mt-1.5">
                  <label
                    htmlFor={`${formId}-upload`}
                    className="text-muted-foreground block text-xs tabular-nums"
                  >
                    {t('create.uploadProgress', {
                      index: formatCount(upload.index + 1),
                      count: formatCount(upload.count),
                      percent: formatCount(upload.percent),
                    })}
                  </label>
                  <progress
                    id={`${formId}-upload`}
                    max={100}
                    value={upload.percent}
                    className="accent-primary-500 h-1.5 w-full"
                  />
                </div>
              )}
            </div>
            {requiredFields.map(renderField)}
            {dueField}
          </>
        )}

        {mode === undefined && dueField}
      </ModalContent>
      <ModalFooter>
        <Button variant="outline" size="sm" onClick={close} disabled={create.isPending}>
          {t('create.cancel')}
        </Button>
        {/* Waits for the list of boards: it says whether the task is a request. */}
        <Button
          size="sm"
          onClick={submit}
          isLoading={create.isPending}
          disabled={creatable.isPending}
        >
          {t('create.submit')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default CreateTaskDialog
