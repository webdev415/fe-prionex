/**
 * Add Task Modal
 *
 * Opens from the "Add Task" button on the Client Detail page.
 * Fields:
 *  - Task Subject (searchable select from task_subjects table)
 *  - Description (textarea)
 *  - Priority (radio: High / Normal / Low)
 *  - Due Date (datetime-local input)
 *  - Assigned To (operators, or Legal Workplace lawyers when subject is Legal letter)
 *  - Comment (textarea)
 *
 * Status is always set to "pending" on creation.
 */

import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { AxiosError } from 'axios'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { RadioGroup, RadioItem } from '@/components/ui/Radio'
import { Icons } from '@/lib/icons'
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/SearchableSelect'
import { DateSelect } from '@/components/ui/DateSelect'
import { getDateTimeStringInTimezone } from '@/lib/dateUtils'
import { useCreateTask, useTaskSubjects } from '@/features/clients/hooks/useClients'
import { canAssignLawyer } from '@/features/lawyerWorkplace'
import { useLegalLawyers } from '@/features/lawyerWorkplace/hooks/useLegalInbox'
import { useOperators } from '@/features/users/hooks/useUsers'
import { useAuthStore } from '@/stores/authStore'

interface AddTaskModalProps {
  open: boolean
  clientId: number
  onClose: () => void
}

const PRIORITIES = [
  { value: 'high', labelKey: 'pages.clients.tasks.priority.high', fallback: 'High' },
  { value: 'normal', labelKey: 'pages.clients.tasks.priority.normal', fallback: 'Normal' },
  { value: 'low', labelKey: 'pages.clients.tasks.priority.low', fallback: 'Low' },
]

const LEGAL_SUBJECT_CODE = 'legal'

// Auto-fill on first future-date pick; skipped for today so the result
// can't land in the past.
const DUE_DATE_DEFAULT_TIME = '09:00'

// Module-level so react-datepicker sees a stable filterTime identity
// across renders. Recomputes "now" itself, so the lack of a per-render
// closure doesn't make it stale.
//   • Future days: every slot allowed
//   • Today: only slots whose absolute instant is >= now are allowed
//
// We compare absolute instants via getTime() (KAN-608). The picker
// renders slots in browser local time, so for every operator the
// disabled boundary aligns with their own wall clock NOW — which IS
// the same absolute moment Europe/Kyiv is at. The BE validator
// compares the same absolute moment against ZoneInfo('Europe/Kyiv'),
// so FE and BE agree on past/future regardless of browser timezone.
const filterFromNow = (time: Date): boolean => {
  const now = new Date()
  const isSameDay =
    time.getFullYear() === now.getFullYear() &&
    time.getMonth() === now.getMonth() &&
    time.getDate() === now.getDate()
  return isSameDay ? time.getTime() >= now.getTime() : true
}

export function AddTaskModal({ open, clientId, onClose }: AddTaskModalProps) {
  const { t } = useTranslation('common')
  const createTask = useCreateTask()
  const { user } = useAuthStore()
  const projectId = user?.active_project_id ? Number(user.active_project_id) : null

  const { data: subjects = [] } = useTaskSubjects()
  const { data: operators = [] } = useOperators(projectId)

  const [subjectId, setSubjectId] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('normal')
  const [dueDate, setDueDate] = useState('')
  const [assignedUserId, setAssignedUserId] = useState('')
  const [comment, setComment] = useState('')
  const [dueDateError, setDueDateError] = useState<string | null>(null)

  const selectedSubject = useMemo(
    () => subjects.find((s) => s.id.toString() === subjectId) ?? null,
    [subjects, subjectId]
  )
  const isLegalSubject = selectedSubject?.code === LEGAL_SUBJECT_CODE

  const { data: lawyersData, isLoading: lawyersLoading } = useLegalLawyers({
    enabled: open && isLegalSubject,
    scopedToActiveProject: true,
  })
  const lawyers = useMemo(() => lawyersData?.items ?? [], [lawyersData?.items])

  const subjectOptions = useMemo(
    () => subjects.map((s) => ({ id: s.id.toString(), name: s.name })),
    [subjects]
  )

  const assigneeOptions = useMemo((): SearchableSelectOption[] => {
    if (isLegalSubject) {
      return lawyers.map((lawyer) => {
        const assignable = canAssignLawyer(lawyer)
        return {
          id: String(lawyer.user_id),
          name: lawyer.display_name,
          disabled: !assignable,
          description: assignable
            ? undefined
            : t('pages.lawyerWorkplace.lawyers.atCapacity', {
                current: lawyer.current_active,
                max: lawyer.max_in_flight,
                defaultValue: `At capacity (${lawyer.current_active}/${lawyer.max_in_flight})`,
              }),
        }
      })
    }
    return operators.map((u) => ({
      id: u.id.toString(),
      name: u.full_name,
    }))
  }, [isLegalSubject, lawyers, operators, t])

  // Picker day floor — computed once at mount. The BE validator is the
  // source of truth, so a stale floor on a long-open modal at worst
  // produces a 422 that lands here as an inline error (KAN-608).
  const minDate = useMemo(() => new Date(), [])

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        setSubjectId('')
        setDescription('')
        setPriority('normal')
        setDueDate('')
        setAssignedUserId('')
        setComment('')
        setDueDateError(null)
      })
    }
  }, [open])

  const selectedAssigneeOption = assigneeOptions.find((o) => o.id === assignedUserId)
  const hasValidAssignee =
    assignedUserId !== '' && selectedAssigneeOption != null && !selectedAssigneeOption.disabled

  const canSubmit = description.trim() !== '' && hasValidAssignee && !createTask.isPending

  const handleSubjectChange = (nextSubjectId: string) => {
    const nextSubject = subjects.find((s) => s.id.toString() === nextSubjectId) ?? null
    const nextIsLegal = nextSubject?.code === LEGAL_SUBJECT_CODE
    setSubjectId(nextSubjectId)
    // Drop assignee when subject flips between legal / non-legal pools.
    if (nextIsLegal !== isLegalSubject) {
      setAssignedUserId('')
    }
  }

  const handleSubmit = () => {
    if (!canSubmit) return
    setDueDateError(null)

    // FE pre-validation — same rule as the BE Pydantic validator. Comparing
    // absolute instants (getTime()) handles all browser timezones correctly:
    // a slot is "past" iff its absolute moment is <= current absolute moment.
    // This avoids a needless HTTP round-trip (and the 422 console noise) for
    // the common case. The BE validator remains the source of truth for
    // security/integrity (FE bypass via DevTools, mobile clients, etc.).
    if (dueDate) {
      const pickedMs = new Date(dueDate).getTime()
      if (!Number.isNaN(pickedMs) && pickedMs <= Date.now()) {
        setDueDateError(
          t(
            'pages.clients.tasks.dueDateMustBeFuture',
            'Due date must be in the future (Europe/Kyiv local time)'
          )
        )
        return
      }
    }

    createTask.mutate(
      {
        client_id: clientId,
        title: description.trim().slice(0, 100),
        description: description.trim(),
        priority,
        due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
        subject_id: subjectId ? parseInt(subjectId) : undefined,
        assigned_to_user_id: parseInt(assignedUserId),
        comment: comment.trim() || undefined,
      },
      {
        onSuccess: () => onClose(),
        onError: (error: AxiosError) => {
          const detail = (error?.response?.data as { detail?: unknown })?.detail
          if (Array.isArray(detail)) {
            for (const err of detail as Array<{ msg: string; loc?: string[] }>) {
              if (err.loc?.[1] === 'due_date') {
                setDueDateError(err.msg.replace(/^Value error,\s*/, ''))
                // Mark handled so the hook-level toast skips this one.
                ;(error as unknown as { __handled?: boolean }).__handled = true
                return
              }
            }
          }
          // Other errors fall through → hook-level toast catches them.
        },
      }
    )
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.Clock01 size={20} className="text-dark-500" strokeWidth={1.5} />
          </div>
        }
        title={t('pages.clients.tasks.addTask', 'Add Task')}
      />

      <ModalContent>
        <div className="flex flex-col gap-4">
          {/* Task Subject */}
          <div className="flex flex-col gap-1">
            <Label className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]">
              {t('pages.clients.tasks.subject', 'Task Subject')}
            </Label>
            <SearchableSelect
              options={subjectOptions}
              value={subjectId}
              onValueChange={handleSubjectChange}
              placeholder={t('pages.clients.tasks.selectSubject', 'Select subject...')}
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <Label className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]">
              {t('pages.clients.tasks.description', 'Description')}
              <span className="ml-1 text-red-500">*</span>
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t(
                'pages.clients.tasks.descriptionPlaceholder',
                'Enter task description...'
              )}
              textareaSize="md"
              className="text-dark-500 w-full text-xs leading-[140%] font-light tracking-[-0.24px]"
            />
          </div>

          {/* Priority */}
          <div className="flex flex-col gap-2">
            <Label className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]">
              {t('pages.clients.tasks.priority.label', 'Priority')}
            </Label>
            <RadioGroup value={priority} onValueChange={setPriority}>
              <div className="flex flex-row gap-6">
                {PRIORITIES.map((p) => (
                  <div key={p.value} className="flex items-center gap-2">
                    <RadioItem value={p.value} id={`task-priority-${p.value}`} />
                    <Label
                      htmlFor={`task-priority-${p.value}`}
                      className="text-dark-500 text-xs font-light tracking-[-0.24px]"
                    >
                      {t(p.labelKey, p.fallback)}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>

          {/* Due Date */}
          <DateSelect
            label={t('pages.clients.tasks.dueDate', 'Due Date')}
            id="task-due-date"
            value={dueDate || null}
            onChange={({ value }) => {
              setDueDate(value ? getDateTimeStringInTimezone(value) : '')
              setDueDateError(null)
            }}
            placeholder={t('pages.clients.tasks.selectDueDate', 'Select due date')}
            format="dd/MM/yyyy HH:mm"
            showTimeSelect
            timeFormat="HH:mm"
            timeIntervals={15}
            min={minDate}
            filterTime={filterFromNow}
            defaultTime={DUE_DATE_DEFAULT_TIME}
            defaultTimeSkipsToday
            error={dueDateError ?? undefined}
          />

          {/* Assigned To */}
          <div className="flex flex-col gap-1">
            <Label className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]">
              {t('pages.clients.tasks.assignedTo', 'Assigned To')}
              <span className="ml-1 text-red-500">*</span>
            </Label>
            <SearchableSelect
              options={assigneeOptions}
              value={assignedUserId}
              onValueChange={setAssignedUserId}
              isLoading={isLegalSubject && lawyersLoading}
              placeholder={
                isLegalSubject
                  ? t('pages.clients.tasks.selectLawyer', 'Select lawyer...')
                  : t('pages.clients.tasks.selectUser', 'Select user...')
              }
            />
            {isLegalSubject && !lawyersLoading && lawyers.length === 0 ? (
              <p className="text-light-600 text-[11px]">
                {t(
                  'pages.clients.tasks.noLawyersAvailable',
                  'No Legal Workplace lawyers are available for this project.'
                )}
              </p>
            ) : null}
          </div>

          {/* Comment */}
          <div className="flex flex-col gap-1">
            <Label className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]">
              {t('pages.clients.tasks.comment', 'Comment')}
            </Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('pages.clients.tasks.commentPlaceholder', 'Optional comment...')}
              textareaSize="md"
              className="text-dark-500 w-full text-xs leading-[140%] font-light tracking-[-0.24px]"
            />
          </div>
        </div>
      </ModalContent>

      <ModalFooter>
        <Button
          type="button"
          variant="cancel"
          onClick={onClose}
          className="h-10 flex-1 text-xs sm:h-[45px] sm:text-sm"
        >
          {t('actions.cancel', 'Cancel')}
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="h-10 flex-1 text-xs sm:h-[45px] sm:text-sm"
        >
          {createTask.isPending
            ? t('actions.saving', 'Saving...')
            : t('pages.clients.tasks.addTask', 'Add Task')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
