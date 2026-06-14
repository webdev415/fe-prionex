import { useEffect, useState, type ReactNode } from 'react'
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
import { Icons } from '@/lib/icons'
import type { KanbanTaskType } from '../../kanban/kanbanData'
import {
  CREATE_TASK_LAWYER_OPTIONS,
  CREATE_TASK_PRIORITIES,
  CREATE_TASK_TYPES,
  type CreateTaskLawyerId,
  type KanbanTaskPriority,
} from './constants'
import { KanbanTypeBadge } from './KanbanTypeBadge'
import { KanbanPriorityOption } from './KanbanPriorityOption'

interface CreateKanbanTaskModalProps {
  open: boolean
  onClose: () => void
}

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

interface FormSelectProps {
  label: string
  value: ReactNode
  onSelect: (key: string) => void
  items: { key: string; content: ReactNode }[]
  leftIcon?: ReactNode
}

function FormSelect({ label, value, onSelect, items, leftIcon }: FormSelectProps) {
  return (
    <div className="flex w-full flex-col items-start gap-2">
      <Label className="text-dark-500 text-[12px] font-normal">{label}</Label>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="text-dark-500 focus:border-primary-500 flex h-9 w-full items-center justify-between rounded-[8px] border border-gray-200 bg-white px-3 py-2 text-[14px] font-light outline-none"
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

  const [lawyer, setLawyer] = useState<CreateTaskLawyerId>(CREATE_TASK_LAWYER_OPTIONS[0]!.id)
  const [taskType, setTaskType] = useState<KanbanTaskType>('complaint')
  const [deadline, setDeadline] = useState<Date | null>(getTomorrowDate())
  const [priority, setPriority] = useState<KanbanTaskPriority>('high')
  const [description, setDescription] = useState('')

  const defaultDescription = t(
    'pages.lawyerWorkplace.kanban.createTask.defaultDescription',
    'Letter in Russian — needs translation'
  )

  const selectedLawyer = CREATE_TASK_LAWYER_OPTIONS.find((item) => item.id === lawyer)

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      setLawyer(CREATE_TASK_LAWYER_OPTIONS[0]!.id)
      setTaskType('complaint')
      setDeadline(getTomorrowDate())
      setPriority('high')
      setDescription(defaultDescription)
    })
  }, [defaultDescription, open])

  const selectedPriority = CREATE_TASK_PRIORITIES.find((item) => item.id === priority)

  const handleCreate = () => {
    onClose()
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
            value={
              selectedLawyer
                ? t(selectedLawyer.key, selectedLawyer.fallback)
                : t(CREATE_TASK_LAWYER_OPTIONS[0]!.key, CREATE_TASK_LAWYER_OPTIONS[0]!.fallback)
            }
            onSelect={(key) => setLawyer(key as CreateTaskLawyerId)}
            items={CREATE_TASK_LAWYER_OPTIONS.map((option) => ({
              key: option.id,
              content: t(option.key, option.fallback),
            }))}
          />

          <FormSelect
            label={t('pages.lawyerWorkplace.kanban.createTask.type', 'Type')}
            value={<KanbanTypeBadge type={taskType} />}
            onSelect={(key) => setTaskType(key as KanbanTaskType)}
            items={CREATE_TASK_TYPES.map((type) => ({
              key: type,
              content: <KanbanTypeBadge type={type} />,
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
        <Button type="button" variant="primary" onClick={handleCreate} className="flex-1">
          {t('pages.lawyerWorkplace.kanban.createTask.submit', 'Create')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
