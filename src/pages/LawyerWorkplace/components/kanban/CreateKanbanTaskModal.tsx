import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { DateSelect } from '@/components/ui/DateSelect'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Label } from '@/components/ui/Label'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { KANBAN_PRIORITY_TO_TASK } from '@/features/lawyerWorkplace/api/kanbanMappers'
import { useCreateLegalKanbanTask } from '@/features/lawyerWorkplace/hooks/useLegalMutations'
import {
  useLegalLawyers,
  useLegalLetterTypes,
} from '@/features/lawyerWorkplace/hooks/useLegalInbox'
import { Icons } from '@/lib/icons'
import type { KanbanTaskType } from '../../kanban/kanbanData'
import { CREATE_TASK_PRIORITIES, type KanbanTaskPriority } from './constants'
import { KanbanTypeBadge } from './KanbanTypeBadge'
import { KanbanPriorityOption } from './KanbanPriorityOption'

interface CreateKanbanTaskModalProps {
  open: boolean
  onClose: () => void
}

const KNOWN_KANBAN_TYPES = new Set<KanbanTaskType>([
  'complaint',
  'nbu_inquiry',
  'court_claim',
  'attorney_request',
  'inquiry',
])

function getTomorrowDate(): Date {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(0, 0, 0, 0)
  return date
}

function getTodayStart(): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function deadlineToIso(date: Date): string {
  const next = new Date(date)
  next.setHours(12, 0, 0, 0)
  return next.toISOString()
}

function renderLetterTypeOption(letterTypeId: string, name: string) {
  if (KNOWN_KANBAN_TYPES.has(letterTypeId as KanbanTaskType)) {
    return <KanbanTypeBadge type={letterTypeId as KanbanTaskType} />
  }
  return <span className="text-dark-500 text-[13px]">{name}</span>
}

interface FormSelectProps {
  label: string
  value: ReactNode
  onSelect: (key: string) => void
  items: { key: string; content: ReactNode }[]
  leftIcon?: ReactNode
  disabled?: boolean
}

function FormSelect({ label, value, onSelect, items, leftIcon, disabled }: FormSelectProps) {
  return (
    <div className="flex w-full flex-col items-start gap-2">
      <Label className="text-dark-500 text-[12px] font-normal">{label}</Label>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <button
            type="button"
            disabled={disabled}
            className="text-dark-500 focus:border-primary-500 flex h-9 w-full items-center justify-between rounded-[8px] border border-gray-200 bg-white px-3 py-2 text-[14px] font-light outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex min-w-0 flex-1 items-center gap-2 truncate text-left">
              {leftIcon}
              {value}
            </span>
            <Icons.ArrowDown size={16} className="ml-2 shrink-0 text-gray-400" strokeWidth={1.5} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-h-60 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto p-1.5"
        >
          {items.map((item) => (
            <DropdownMenuItem
              key={item.key}
              className="cursor-pointer rounded-md px-2 py-1.5 text-[13px] focus:bg-gray-50"
              onClick={() => onSelect(item.key)}
            >
              {item.content}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function CreateKanbanTaskModal({ open, onClose }: CreateKanbanTaskModalProps) {
  const { t } = useTranslation('common')
  const createTask = useCreateLegalKanbanTask()
  const { data: lawyersData, isLoading: lawyersLoading } = useLegalLawyers({ enabled: open })
  const { data: letterTypesData, isLoading: letterTypesLoading } = useLegalLetterTypes({
    enabled: open,
  })

  const lawyers = useMemo(() => lawyersData?.items ?? [], [lawyersData?.items])
  const letterTypes = useMemo(
    () => (letterTypesData?.items ?? []).filter((item) => item.is_active),
    [letterTypesData?.items]
  )

  const [lawyerUserId, setLawyerUserId] = useState<number | null>(null)
  const [letterTypeId, setLetterTypeId] = useState<string | null>(null)
  const [deadline, setDeadline] = useState<Date | null>(getTomorrowDate())
  const [priority, setPriority] = useState<KanbanTaskPriority>('high')
  const [description, setDescription] = useState('')

  const defaultDescription = t(
    'pages.lawyerWorkplace.kanban.createTask.defaultDescription',
    'Letter in Russian — needs translation'
  )

  const selectedLawyer = lawyers.find((item) => item.user_id === lawyerUserId)
  const selectedLetterType = letterTypes.find((item) => item.id === letterTypeId)
  const selectedPriority = CREATE_TASK_PRIORITIES.find((item) => item.id === priority)

  const optionsLoading = lawyersLoading || letterTypesLoading
  const canSubmit =
    !optionsLoading &&
    !createTask.isPending &&
    lawyerUserId != null &&
    letterTypeId != null &&
    deadline != null

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      setLawyerUserId(lawyers[0]?.user_id ?? null)
      setLetterTypeId(letterTypes[0]?.id ?? null)
      setDeadline(getTomorrowDate())
      setPriority('high')
      setDescription(defaultDescription)
    })
  }, [defaultDescription, letterTypes, lawyers, open])

  const handleCreate = () => {
    if (!canSubmit || lawyerUserId == null || letterTypeId == null || deadline == null) {
      return
    }

    createTask.mutate(
      {
        letter_type_id: letterTypeId,
        assigned_to_user_id: lawyerUserId,
        due_date: deadlineToIso(deadline),
        priority: KANBAN_PRIORITY_TO_TASK[priority] ?? 'normal',
        description: description.trim() || null,
      },
      {
        onSuccess: () => onClose(),
      }
    )
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.CheckmarkSquare03 size={18} className="text-dark-500" strokeWidth={1.5} />
          </div>
        }
        title={t('pages.lawyerWorkplace.kanban.createTask.title', 'Create a Task')}
      />

      <ModalContent>
        <div className="flex flex-col gap-4">
          <FormSelect
            label={t('pages.lawyerWorkplace.kanban.createTask.lawyer', 'Lawyer')}
            disabled={optionsLoading || lawyers.length === 0}
            value={
              selectedLawyer?.display_name ??
              t('pages.lawyerWorkplace.kanban.createTask.selectLawyer', 'Select lawyer')
            }
            onSelect={(key) => setLawyerUserId(Number(key))}
            items={lawyers.map((lawyer) => ({
              key: String(lawyer.user_id),
              content: lawyer.display_name,
            }))}
          />

          <FormSelect
            label={t('pages.lawyerWorkplace.kanban.createTask.type', 'Type')}
            disabled={optionsLoading || letterTypes.length === 0}
            value={
              selectedLetterType
                ? renderLetterTypeOption(selectedLetterType.id, selectedLetterType.name)
                : t('pages.lawyerWorkplace.kanban.createTask.selectType', 'Select type')
            }
            onSelect={(key) => setLetterTypeId(key)}
            items={letterTypes.map((letterType) => ({
              key: letterType.id,
              content: renderLetterTypeOption(letterType.id, letterType.name),
            }))}
          />

          <div className="flex w-full flex-col items-start gap-2">
            <Label className="text-dark-500 text-[12px] font-normal">
              {t('pages.lawyerWorkplace.kanban.createTask.deadline', 'Deadline')}
            </Label>
            <DateSelect
              id="kanban-create-task-deadline"
              value={deadline}
              onChange={({ value }) => setDeadline(value)}
              placeholder={t(
                'pages.lawyerWorkplace.kanban.createTask.selectDeadline',
                'Select deadline'
              )}
              format="dd/MM/yyyy"
              min={getTodayStart()}
              className="h-9 rounded-[8px] border-gray-200 text-[14px] font-light"
            />
          </div>

          <FormSelect
            label={t('pages.lawyerWorkplace.kanban.createTask.priority', 'Priority')}
            value={
              selectedPriority ? (
                <KanbanPriorityOption priority={selectedPriority.id} />
              ) : (
                <KanbanPriorityOption priority="high" />
              )
            }
            onSelect={(key) => setPriority(key as KanbanTaskPriority)}
            items={CREATE_TASK_PRIORITIES.map((item) => ({
              key: item.id,
              content: <KanbanPriorityOption priority={item.id} />,
            }))}
          />

          <div className="flex w-full flex-col items-start gap-2">
            <Label className="text-dark-500 text-[12px] font-normal">
              {t('pages.lawyerWorkplace.kanban.createTask.description', 'Description')}
            </Label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t(
                'pages.lawyerWorkplace.kanban.createTask.descriptionPlaceholder',
                'Enter task description...'
              )}
              textareaSize="md"
              className="text-dark-500 min-h-[88px] w-full text-[14px] font-light"
            />
          </div>
        </div>
      </ModalContent>

      <ModalFooter>
        <Button type="button" variant="cancel" onClick={onClose} className="flex-1">
          {t('actions.cancel', 'Cancel')}
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleCreate}
          disabled={!canSubmit}
          className="flex-1"
        >
          {createTask.isPending
            ? t('pages.lawyerWorkplace.kanban.createTask.creating', 'Creating…')
            : t('pages.lawyerWorkplace.kanban.createTask.submit', 'Create')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
