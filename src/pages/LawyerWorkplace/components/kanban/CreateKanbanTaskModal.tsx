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
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { canAssignLawyer } from '@/features/lawyerWorkplace'
import { useCreateLegalKanbanTask } from '@/features/lawyerWorkplace/hooks/useLegalMutations'
import { legalDueDateToIso } from '@/features/lawyerWorkplace/utils/legalDueDate'
import {
  useLegalLawyers,
  useLegalLetterTypes,
} from '@/features/lawyerWorkplace/hooks/useLegalInbox'
import { useLegalClientSearch } from '@/features/lawyerWorkplace/hooks/useLegalClientSearch'
import { useDebounce } from '@/hooks/useDebounce'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { LegalLetterType } from '@/features/lawyerWorkplace'
import { resolveKanbanTypeBadgeProps } from './constants'
import { KanbanTypeBadge } from './KanbanTypeBadge'

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

function renderLetterTypeOption(letterType: LegalLetterType) {
  const badge = resolveKanbanTypeBadgeProps(letterType.id, [letterType], 'type_pending')
  return <KanbanTypeBadge type={badge.type} label={badge.label} colorId={badge.colorId} />
}

interface FormSelectProps {
  label: string
  value: ReactNode
  onSelect: (key: string) => void
  items: { key: string; content: ReactNode; disabled?: boolean }[]
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
              disabled={item.disabled}
              className={cn(
                'rounded-md px-2 py-1.5 text-[13px] focus:bg-gray-50',
                item.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
              )}
              onClick={() => {
                if (!item.disabled) onSelect(item.key)
              }}
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
  const { data: lawyersData, isLoading: lawyersLoading } = useLegalLawyers({
    enabled: open,
    scopedToActiveProject: true,
  })
  const { data: letterTypesData, isLoading: letterTypesLoading } = useLegalLetterTypes({
    enabled: open,
  })

  const [lawyerUserId, setLawyerUserId] = useState<number | null>(null)
  const [letterTypeId, setLetterTypeId] = useState<string | null>(null)
  const [clientId, setClientId] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [deadline, setDeadline] = useState<Date | null>(getTomorrowDate())

  const debouncedClientSearch = useDebounce(clientSearch, 300)
  const { data: clientsData, isFetching: clientsLoading } = useLegalClientSearch(
    debouncedClientSearch,
    { enabled: open && debouncedClientSearch.length >= 2 }
  )

  const lawyers = useMemo(() => lawyersData?.items ?? [], [lawyersData?.items])
  const letterTypes = useMemo(
    () => (letterTypesData?.items ?? []).filter((item) => item.is_active),
    [letterTypesData?.items]
  )
  const clientOptions = useMemo(
    () =>
      (clientsData?.items ?? []).map((client) => {
        const code = `CL-${String(client.id).padStart(5, '0')}`
        const name = [client.first_name, client.last_name].filter(Boolean).join(' ')
        return { id: String(client.id), name: name ? `${code} · ${name}` : code }
      }),
    [clientsData?.items]
  )

  const assignableLawyers = useMemo(
    () => lawyers.filter((lawyer) => canAssignLawyer(lawyer)),
    [lawyers]
  )

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      setLawyerUserId(assignableLawyers[0]?.user_id ?? null)
      setLetterTypeId(letterTypes[0]?.id ?? null)
      setClientId('')
      setClientSearch('')
      setDeadline(getTomorrowDate())
    })
  }, [assignableLawyers, letterTypes, open])

  const selectedLawyer = lawyers.find((item) => item.user_id === lawyerUserId)
  const selectedLetterType = letterTypes.find((item) => item.id === letterTypeId)

  const resolvedClientId = Number(clientId)
  const hasValidClient =
    clientId.length > 0 && Number.isFinite(resolvedClientId) && resolvedClientId > 0

  const optionsLoading = lawyersLoading || letterTypesLoading
  const canSubmit =
    !optionsLoading &&
    !createTask.isPending &&
    lawyerUserId != null &&
    letterTypeId != null &&
    deadline != null &&
    hasValidClient

  const handleCreate = () => {
    if (
      !canSubmit ||
      lawyerUserId == null ||
      letterTypeId == null ||
      deadline == null ||
      !hasValidClient
    ) {
      return
    }

    createTask.mutate(
      {
        letter_type_id: letterTypeId,
        client_id: resolvedClientId,
        assigned_to_user_id: lawyerUserId,
        due_date: legalDueDateToIso(deadline),
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
            disabled={optionsLoading || assignableLawyers.length === 0}
            value={
              selectedLawyer?.display_name ??
              (lawyers.length > 0 && assignableLawyers.length === 0
                ? t(
                    'pages.lawyerWorkplace.kanban.createTask.noAvailableLawyers',
                    'No lawyers with available capacity'
                  )
                : t('pages.lawyerWorkplace.kanban.createTask.selectLawyer', 'Select lawyer'))
            }
            onSelect={(key) => setLawyerUserId(Number(key))}
            items={lawyers.map((lawyer) => {
              const assignable = canAssignLawyer(lawyer)
              return {
                key: String(lawyer.user_id),
                disabled: !assignable,
                content: (
                  <span className="flex min-w-0 flex-col">
                    <span>{lawyer.display_name}</span>
                    {!assignable ? (
                      <span className="text-light-500 text-[11px]">
                        {t('pages.lawyerWorkplace.lawyers.atCapacity', {
                          current: lawyer.current_active,
                          max: lawyer.max_in_flight,
                          defaultValue: `At capacity (${lawyer.current_active}/${lawyer.max_in_flight})`,
                        })}
                      </span>
                    ) : null}
                  </span>
                ),
              }
            })}
          />

          <FormSelect
            label={t('pages.lawyerWorkplace.kanban.createTask.type', 'Type')}
            disabled={optionsLoading || letterTypes.length === 0}
            value={
              selectedLetterType
                ? renderLetterTypeOption(selectedLetterType)
                : t('pages.lawyerWorkplace.kanban.createTask.selectType', 'Select type')
            }
            onSelect={(key) => setLetterTypeId(key)}
            items={letterTypes.map((letterType) => ({
              key: letterType.id,
              content: renderLetterTypeOption(letterType),
            }))}
          />

          <div className="flex w-full flex-col items-start gap-2">
            <div className="flex w-full items-center justify-between gap-2">
              <Label className="text-dark-500 text-[12px] font-normal">
                {t('pages.lawyerWorkplace.kanban.createTask.client', 'Client')}
              </Label>
              {clientId ? (
                <button
                  type="button"
                  onClick={() => setClientId('')}
                  className="text-light-600 hover:text-dark-500 text-[11px] font-light"
                >
                  {t('pages.lawyerWorkplace.kanban.createTask.clearClient', 'Clear')}
                </button>
              ) : null}
            </div>
            <SearchableSelect
              options={clientOptions}
              value={clientId}
              onValueChange={(val) => {
                setClientId(val)
                setClientSearch('')
              }}
              onSearchChange={setClientSearch}
              isLoading={clientsLoading}
              emptySearchHint={t(
                'pages.lawyerWorkplace.kanban.createTask.clientSearchHint',
                'Type 2+ characters to search…'
              )}
              disabled={optionsLoading}
              placeholder={t(
                'pages.lawyerWorkplace.kanban.createTask.selectClient',
                'Search client...'
              )}
              searchPlaceholder={t(
                'pages.lawyerWorkplace.kanban.createTask.searchClient',
                'Search by name or contract...'
              )}
              className="[&_button]:h-9 [&_button]:rounded-[8px] [&_button]:text-[14px]"
            />
          </div>

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
