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
import { RadioGroup, RadioItem } from '@/components/ui/Radio'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { canAssignLawyer } from '@/features/lawyerWorkplace'
import { useCreateLegalKanbanTask } from '@/features/lawyerWorkplace/hooks/useLegalMutations'
import { useLegalProfileTimezone } from '@/features/lawyerWorkplace/hooks/useLegalProfileTimezone'
import { legalDueDateToIso } from '@/features/lawyerWorkplace/utils/legalDueDate'
import {
  useLegalLawyers,
  useLegalLetterTypes,
} from '@/features/lawyerWorkplace/hooks/useLegalInbox'
import { useLegalClientSearch } from '@/features/lawyerWorkplace/hooks/useLegalClientSearch'
import type { SearchType } from '@/api/clientSearchApi'
import { useDebounce } from '@/hooks/useDebounce'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { LegalLetterType } from '@/features/lawyerWorkplace'
import { resolveKanbanTypeBadgeProps } from './constants'
import { KanbanTypeBadge } from './KanbanTypeBadge'

// Same client-search criteria as the "New outgoing letter" modal so a lawyer can
// look a client up by phone / name / email / TIN / contract — not only by name.
const CLIENT_SEARCH_TYPES: { value: SearchType; labelKey: string; fallback: string }[] = [
  { value: 'phone', labelKey: 'search.phoneNumber', fallback: 'Phone number' },
  { value: 'name', labelKey: 'search.fullName', fallback: 'Full name' },
  { value: 'email', labelKey: 'search.email', fallback: 'Email' },
  { value: 'tin', labelKey: 'search.tin', fallback: 'TIN' },
  { value: 'contract_number', labelKey: 'search.contractNumber', fallback: 'Contract number' },
]

interface CreateKanbanTaskModalProps {
  open: boolean
  onClose: () => void
}

type TaskPriority = 'high' | 'normal' | 'low'

const PRIORITIES: { value: TaskPriority; labelKey: string; fallback: string }[] = [
  { value: 'high', labelKey: 'pages.clients.tasks.priority.high', fallback: 'High' },
  { value: 'normal', labelKey: 'pages.clients.tasks.priority.normal', fallback: 'Normal' },
  { value: 'low', labelKey: 'pages.clients.tasks.priority.low', fallback: 'Low' },
]

const DUE_DATE_DEFAULT_TIME = '09:00'

function getTomorrowAtDefaultTime(): Date {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(9, 0, 0, 0)
  return date
}

function getTodayStart(): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

/** Same rule as Client Detail Add Task: block past times today only. */
const filterFromNow = (time: Date): boolean => {
  const now = new Date()
  const isSameDay =
    time.getFullYear() === now.getFullYear() &&
    time.getMonth() === now.getMonth() &&
    time.getDate() === now.getDate()
  return isSameDay ? time.getTime() >= now.getTime() : true
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
      <Label className="text-foreground text-[12px] font-normal">{label}</Label>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <button
            type="button"
            disabled={disabled}
            className="text-foreground focus:border-primary-500 border-border bg-input flex h-9 w-full items-center justify-between rounded-[8px] border px-3 py-2 text-[14px] font-light outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex min-w-0 flex-1 items-center gap-2 truncate text-left">
              {leftIcon}
              {value}
            </span>
            <Icons.ArrowDown
              size={16}
              className="text-muted-foreground ml-2 shrink-0"
              strokeWidth={1.5}
            />
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
                'focus:bg-muted rounded-md px-2 py-1.5 text-[13px]',
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
  const timezone = useLegalProfileTimezone()
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
  const [clientSearchType, setClientSearchType] = useState<SearchType>('phone')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [deadline, setDeadline] = useState<Date | null>(getTomorrowAtDefaultTime())

  const debouncedClientSearch = useDebounce(clientSearch, 300)
  const { data: clientsData, isFetching: clientsLoading } = useLegalClientSearch(
    debouncedClientSearch,
    { enabled: open && debouncedClientSearch.length >= 2, searchType: clientSearchType }
  )
  const activeClientSearchType = CLIENT_SEARCH_TYPES.find((o) => o.value === clientSearchType)

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
      setPriority('normal')
      setDeadline(getTomorrowAtDefaultTime())
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
        due_date: legalDueDateToIso(deadline, timezone),
        priority,
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
            <Icons.CheckmarkSquare03 size={18} className="text-foreground" strokeWidth={1.5} />
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
                      <span className="text-muted-foreground text-[11px]">
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
              <Label className="text-foreground text-[12px] font-normal">
                {t('pages.lawyerWorkplace.kanban.createTask.client', 'Client')}
              </Label>
              {clientId ? (
                <button
                  type="button"
                  onClick={() => setClientId('')}
                  className="text-muted-foreground hover:text-foreground text-[11px] font-light"
                >
                  {t('pages.lawyerWorkplace.kanban.createTask.clearClient', 'Clear')}
                </button>
              ) : (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="text-foreground border-border bg-input flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-[12px] font-light outline-none"
                    >
                      <Icons.Search size={12} strokeWidth={1.5} className="text-muted-foreground" />
                      {activeClientSearchType
                        ? t(activeClientSearchType.labelKey, activeClientSearchType.fallback)
                        : ''}
                      <Icons.ArrowDown
                        size={13}
                        strokeWidth={1.5}
                        className="text-muted-foreground"
                      />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[160px]">
                    {CLIENT_SEARCH_TYPES.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        className="cursor-pointer text-[13px]"
                        onClick={() => {
                          setClientSearchType(opt.value)
                          setClientSearch('')
                        }}
                      >
                        {t(opt.labelKey, opt.fallback)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
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

          <div className="flex w-full flex-col gap-2">
            <Label className="text-foreground text-[12px] font-normal">
              {t('pages.lawyerWorkplace.kanban.createTask.priority', 'Priority')}
            </Label>
            <RadioGroup value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
              <div className="flex flex-wrap gap-4">
                {PRIORITIES.map((p) => (
                  <div key={p.value} className="flex items-center gap-2">
                    <RadioItem value={p.value} id={`kanban-priority-${p.value}`} />
                    <Label
                      htmlFor={`kanban-priority-${p.value}`}
                      className="text-foreground cursor-pointer text-[13px] font-light"
                    >
                      {t(p.labelKey, p.fallback)}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>

          <div className="flex w-full flex-col items-start gap-2">
            <Label className="text-foreground text-[12px] font-normal">
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
              format="dd/MM/yyyy HH:mm"
              showTimeSelect
              timeFormat="HH:mm"
              timeIntervals={15}
              min={getTodayStart()}
              filterTime={filterFromNow}
              defaultTime={DUE_DATE_DEFAULT_TIME}
              defaultTimeSkipsToday
              className="border-border h-9 rounded-[8px] text-[14px] font-light"
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
