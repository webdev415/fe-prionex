import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { DateSelect } from '@/components/ui/DateSelect'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Label } from '@/components/ui/Label'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import {
  useConfirmLetter,
  useLegalClientContracts,
  useLegalClientSearch,
  useLegalLawyers,
  useLegalLetterTypes,
  usePatchMessageContract,
  usePatchMessageSuggestions,
} from '@/features/lawyerWorkplace'
import { legalDueDateToIso } from '@/features/lawyerWorkplace/utils/legalDueDate'
import {
  buildLetterActivityLog,
  clientLookupFromLegalSearchItem,
  isLetterParametersReadOnly,
} from '@/features/lawyerWorkplace/api/mappers'
import type { LegalMessageSuggestionsPatchResponse } from '@/features/lawyerWorkplace/api/types'
import { useDebounce } from '@/hooks/useDebounce'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { formatDueDate } from '../../utils/formatters'
import type { LetterDetail } from '../../types'

// ─── Colour maps ──────────────────────────────────────────────────────────────

const TYPE_COLOURS: Record<string, string> = {
  complaint: 'bg-error-100 text-error-700',
  nbu_inquiry: 'bg-secondary-100 text-secondary-800',
  court_claim: 'bg-warning-100 text-warning-700',
  attorney_request: 'bg-[#EDE9FE] text-[#6D28D9]',
  inquiry: 'bg-success-100 text-success-700',
}

function TypeBadge({ type, label }: { type: string; label: string }) {
  const colour = TYPE_COLOURS[type] ?? 'bg-gray-100 text-gray-600'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 text-[12px] font-medium',
        colour
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {label}
    </span>
  )
}

function resolveLetterTypeId(
  letterTypes: { id: string; slug: string }[],
  value: string | null | undefined
): string {
  if (!value) return ''
  const byId = letterTypes.find((item) => item.id === value)
  if (byId) return byId.id
  const bySlug = letterTypes.find((item) => item.slug === value)
  return bySlug?.id ?? value
}

function resolveLawyerUserId(
  lawyers: { id: string; user_id: number }[],
  lawyerValue: string | null | undefined
): number | null {
  if (!lawyerValue) return null
  const byRecord = lawyers.find((item) => item.id === lawyerValue)
  if (byRecord) return byRecord.user_id
  const asNumber = Number(lawyerValue)
  return Number.isFinite(asNumber) && asNumber > 0 ? asNumber : null
}

function formatClientOption(client: { id: number; first_name: string; last_name: string }): {
  id: string
  name: string
} {
  const lookup = clientLookupFromLegalSearchItem(client)
  return { id: String(client.id), name: lookup.label }
}

function computeDueDateFromReceived(receivedAt: string, slaDays: number): Date | null {
  if (!Number.isFinite(slaDays) || slaDays <= 0) {
    return null
  }
  const base = new Date(receivedAt)
  const due = new Date(base)
  due.setDate(due.getDate() + slaDays)
  due.setHours(0, 0, 0, 0)
  return due
}

function startOfToday(): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

function isBeforeStartOfDay(date: Date): boolean {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  return normalized < startOfToday()
}

function buildPrioritySignature(
  letterTypes: { id: string; priorities: { lawyer_id: string; stars: number; role: string }[] }[],
  typeId: string
): string {
  const letterType = letterTypes.find((item) => item.id === typeId)
  if (!letterType) return ''
  return [...letterType.priorities]
    .map((item) => `${item.lawyer_id}:${item.stars}:${item.role}`)
    .sort()
    .join('|')
}

function applySuggestionResult(
  result: LegalMessageSuggestionsPatchResponse,
  receivedAt: string,
  setLawyerOverride: (value: string | null) => void,
  setDueDateOverride: (value: Date | null) => void,
  options?: {
    dueDateManuallyOverridden?: boolean
    onDueDateAutoApplied?: () => void
  }
) {
  setLawyerOverride(
    result.suggested_lawyer_user_id != null ? String(result.suggested_lawyer_user_id) : ''
  )
  // Never overwrite a due date the lawyer already chose.
  if (options?.dueDateManuallyOverridden) {
    return
  }
  const dueDate = computeDueDateFromReceived(receivedAt, result.sla_days)
  if (dueDate) {
    setDueDateOverride(dueDate)
    options?.onDueDateAutoApplied?.()
  }
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function ReadonlyField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col items-start gap-1.5">
      <Label className="text-dark-500 text-[12px] font-normal">{label}</Label>
      <div className="text-dark-500 text-[13px] font-light">{children}</div>
    </div>
  )
}

function ParameterDropdown({
  label,
  value,
  placeholder = '—',
  items,
  onSelect,
}: {
  label: string
  value: React.ReactNode
  placeholder?: string
  items: { key: string; content: React.ReactNode }[]
  onSelect?: (key: string) => void
}) {
  const hasValue = value !== null && value !== undefined && value !== false
  return (
    <div className="flex w-full flex-col items-start gap-2">
      <Label className="text-dark-500 text-[12px] font-normal">{label}</Label>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="text-dark-500 focus:border-primary-500 flex h-9 w-full items-center justify-between rounded-[8px] border border-gray-200 bg-white px-3 py-2 text-[14px] font-light outline-none"
          >
            <span className="min-w-0 flex-1 truncate text-left">
              {hasValue ? value : <span className="text-gray-400">{placeholder}</span>}
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
              onClick={() => onSelect?.(item.key)}
            >
              {item.content}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// ─── Activity log ─────────────────────────────────────────────────────────────

interface ActivityLogEntry {
  timestamp: string
  eventKey: string
  fallback: string
}

function ActivityLog({ entries }: { entries: ActivityLogEntry[] }) {
  const { t, i18n } = useTranslation('common')
  return (
    <div className="flex w-full flex-col gap-0">
      {entries.map((entry, idx) => (
        <div key={idx} className="flex items-start gap-2.5 py-1.5">
          <div className="flex flex-col items-center">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
            {idx < entries.length - 1 && <span className="mt-1 h-full w-px flex-1 bg-gray-100" />}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="text-dark-500 text-[11px] leading-snug">
              {t(entry.eventKey, entry.fallback)}
            </span>
            <span className="text-light-500 text-[10px]">
              {new Date(entry.timestamp).toLocaleString(i18n.language, {
                hour: '2-digit',
                minute: '2-digit',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface LetterParametersPanelProps {
  letter: LetterDetail | null
  onClose?: () => void
  onConfirm?: (letterId: string) => void
  onViewKanbanTask?: (taskId: number) => void
}

function LetterParametersPanelContent({
  letter,
  onClose,
  onConfirm,
  onViewKanbanTask,
}: {
  letter: LetterDetail
  onClose?: () => void
  onConfirm?: (letterId: string) => void
  onViewKanbanTask?: (taskId: number) => void
}) {
  const { t, i18n } = useTranslation('common')
  const confirmMutation = useConfirmLetter()
  const patchSuggestionsMutation = usePatchMessageSuggestions()
  const patchContractMutation = usePatchMessageContract()
  const { data: letterTypesData } = useLegalLetterTypes()

  const [typeOverride, setTypeOverride] = useState<string | null>(null)
  const [clientOverride, setClientOverride] = useState<string | null>(null)
  const [clientProjectOverride, setClientProjectOverride] = useState<number | null>(null)
  const [clientSearch, setClientSearch] = useState('')
  const [lawyerOverride, setLawyerOverride] = useState<string | null>(null)
  const [contractOverride, setContractOverride] = useState<string | null>(null)
  const [dueDateOverride, setDueDateOverride] = useState<Date | null>(null)
  const [dueDateManuallyOverridden, setDueDateManuallyOverridden] = useState(false)
  const [lawyerManuallyOverridden, setLawyerManuallyOverridden] = useState(false)
  const lastPrioritySignatureRef = useRef<string | null>(null)

  const { parameters: p, status } = letter

  const defaultTypeId = useMemo(
    () => resolveLetterTypeId(letterTypesData?.items ?? [], p.letterType),
    [letterTypesData?.items, p.letterType]
  )
  const defaultClientId = p.clientId && p.clientId !== 'not_identified' ? p.clientId : ''
  const defaultDueDate = p.dueDate ? new Date(p.dueDate) : null
  const minDueDate = useMemo(() => startOfToday(), [])
  const applyDueDateFromLetterType = useCallback(
    (typeId: string) => {
      if (dueDateManuallyOverridden) return
      const letterType = letterTypesData?.items?.find((item) => item.id === typeId)
      if (!letterType) return
      const dueDate = computeDueDateFromReceived(letter.receivedAt, letterType.sla_days)
      if (!dueDate) return
      setDueDateOverride(dueDate)
      setDueDateManuallyOverridden(false)
    },
    [dueDateManuallyOverridden, letter.receivedAt, letterTypesData?.items]
  )
  const effectiveTypeId = typeOverride ?? defaultTypeId
  const effectiveClientId = clientOverride ?? defaultClientId

  const debouncedClientSearch = useDebounce(clientSearch, 300)
  const { data: clientsData, isFetching: clientsLoading } = useLegalClientSearch(
    debouncedClientSearch,
    { enabled: !p.clientLockedByEmail && debouncedClientSearch.length >= 2 }
  )

  const resolvedClientProjectId = useMemo(() => {
    if (clientProjectOverride != null && clientProjectOverride > 0) {
      return clientProjectOverride
    }
    if (p.clientProjectId != null && p.clientProjectId > 0) {
      return p.clientProjectId
    }
    const parsedClientId = Number(effectiveClientId)
    if (!Number.isFinite(parsedClientId) || parsedClientId <= 0) {
      return null
    }
    const selectedClient = (clientsData?.items ?? []).find((item) => item.id === parsedClientId)
    return selectedClient?.project_id ?? null
  }, [clientProjectOverride, p.clientProjectId, effectiveClientId, clientsData?.items])

  const { data: lawyersData } = useLegalLawyers(
    resolvedClientProjectId != null && resolvedClientProjectId > 0
      ? { projectId: resolvedClientProjectId }
      : {}
  )

  const letterTypes = useMemo(() => letterTypesData?.items ?? [], [letterTypesData?.items])
  const lawyers = useMemo(() => lawyersData?.items ?? [], [lawyersData?.items])

  const contractsClientId = useMemo(() => {
    const parsed = Number(effectiveClientId)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [effectiveClientId])
  const { data: contractsData, isFetching: contractsLoading } =
    useLegalClientContracts(contractsClientId)
  const contracts = useMemo(() => contractsData?.items ?? [], [contractsData?.items])
  const storedContract = p.contractLabel?.trim() ?? ''
  // Auto-select when the client has exactly one contract; otherwise the lawyer picks.
  const effectiveContract =
    contractOverride ??
    (storedContract || (contracts.length === 1 ? (contracts[0].contract_number ?? '') : ''))

  const contractRequired = contracts.length > 1
  const contractIsValid = !contractRequired || Boolean(effectiveContract.trim())

  const isReadOnly = isLetterParametersReadOnly(letter)

  useEffect(() => {
    if (isReadOnly || contractsLoading || contractsClientId == null) return
    if (contracts.length !== 1) return
    const autoContract = contracts[0]?.contract_number?.trim()
    if (!autoContract || autoContract === storedContract) return
    if (contractOverride != null) return

    void patchContractMutation
      .mutateAsync({
        messageId: letter.id,
        payload: { contract_number: autoContract },
      })
      .catch(() => {
        // Local selection still works if persistence fails.
      })
  }, [
    contractOverride,
    contracts,
    contractsClientId,
    contractsLoading,
    isReadOnly,
    letter.id,
    patchContractMutation,
    storedContract,
  ])

  const defaultLawyerUserId = useMemo(() => {
    const resolved = resolveLawyerUserId(lawyers, p.lawyerId)
    return resolved != null ? String(resolved) : ''
  }, [lawyers, p.lawyerId])

  const applyTypeSuggestion = useCallback(
    async (typeId: string, options?: { refreshLawyer?: boolean }) => {
      const result = await patchSuggestionsMutation.mutateAsync({
        messageId: letter.id,
        payload: {
          letter_type_id: typeId,
          ...(options?.refreshLawyer ? { refresh_lawyer: true } : {}),
        },
      })
      applySuggestionResult(result, letter.receivedAt, setLawyerOverride, setDueDateOverride, {
        dueDateManuallyOverridden,
        onDueDateAutoApplied: () => setDueDateManuallyOverridden(false),
      })
      return result
    },
    [dueDateManuallyOverridden, letter.id, letter.receivedAt, patchSuggestionsMutation]
  )

  useEffect(() => {
    if (isReadOnly || !effectiveTypeId || lawyerManuallyOverridden) {
      return
    }

    const signature = buildPrioritySignature(letterTypes, effectiveTypeId)

    // Opening a letter must not re-assign lawyer. Seed the signature on mount and
    // only PATCH when lawyer priorities for this type change while the panel is open.
    if (lastPrioritySignatureRef.current === null) {
      lastPrioritySignatureRef.current = signature
      return
    }

    if (lastPrioritySignatureRef.current === signature) {
      return
    }

    lastPrioritySignatureRef.current = signature
    void applyTypeSuggestion(effectiveTypeId, { refreshLawyer: true }).catch(() => {
      // Keep the signature so permanent failures (e.g. outbound rows) do not retry in a loop.
      lastPrioritySignatureRef.current = signature
    })
  }, [applyTypeSuggestion, effectiveTypeId, isReadOnly, lawyerManuallyOverridden, letterTypes])

  const handleTypeSelect = (typeId: string) => {
    setLawyerManuallyOverridden(false)
    // Pre-seed the signature to the type we're about to sync so the auto-sync
    // effect sees no change and does NOT fire a second, redundant suggestions
    // PATCH for the same type.
    lastPrioritySignatureRef.current = buildPrioritySignature(letterTypes, typeId)
    setTypeOverride(typeId)
    if (!dueDateManuallyOverridden) {
      applyDueDateFromLetterType(typeId)
    }
    void applyTypeSuggestion(typeId).catch(() => {
      lastPrioritySignatureRef.current = null
      setTypeOverride(defaultTypeId || null)
    })
  }

  const handleDueDateChange = (value: Date | null) => {
    if (value && isBeforeStartOfDay(value)) {
      return
    }
    setDueDateOverride(value)
    setDueDateManuallyOverridden(true)
  }

  const handleLawyerSelect = (userId: string) => {
    setLawyerOverride(userId)
    setLawyerManuallyOverridden(true)
  }

  const handleContractSelect = (contractNumber: string) => {
    setContractOverride(contractNumber)
    void patchContractMutation
      .mutateAsync({
        messageId: letter.id,
        payload: { contract_number: contractNumber },
      })
      .catch(() => {
        // Keep local selection visible even if persistence fails.
      })
  }

  const handleClientSelect = (clientId: string) => {
    if (p.clientLockedByEmail) {
      return
    }

    setClientOverride(clientId)
    setClientSearch('')
    setLawyerManuallyOverridden(false)
    setContractOverride(null)

    if (!effectiveTypeId || isReadOnly) {
      return
    }

    const parsedClientId = Number(clientId)
    if (!Number.isFinite(parsedClientId) || parsedClientId <= 0) {
      return
    }

    const selectedClient = (clientsData?.items ?? []).find((item) => String(item.id) === clientId)
    if (selectedClient?.project_id) {
      setClientProjectOverride(selectedClient.project_id)
    }

    void patchSuggestionsMutation
      .mutateAsync({
        messageId: letter.id,
        payload: {
          letter_type_id: effectiveTypeId,
          client_id: parsedClientId,
        },
      })
      .then((result) => {
        applySuggestionResult(result, letter.receivedAt, setLawyerOverride, setDueDateOverride, {
          dueDateManuallyOverridden,
          onDueDateAutoApplied: () => setDueDateManuallyOverridden(false),
        })
      })
      .catch(() => {
        // Keep local selection; user can still pick lawyer manually.
      })
  }

  const effectiveLawyerUserId = lawyerOverride ?? defaultLawyerUserId
  const effectiveDueDate = dueDateOverride ?? defaultDueDate

  const clientOptions = useMemo(() => {
    const searchResults = (clientsData?.items ?? []).map(formatClientOption)

    if (debouncedClientSearch.length < 2) {
      // No active search: show only the pre-existing client so SearchableSelect can display its name
      if (effectiveClientId && p.clientLabel) {
        return [{ id: effectiveClientId, name: p.clientLabel }]
      }
      return []
    }

    // Active search: prepend current client if not in results
    if (
      effectiveClientId &&
      !searchResults.some((o) => o.id === effectiveClientId) &&
      p.clientLabel
    ) {
      return [{ id: effectiveClientId, name: p.clientLabel }, ...searchResults]
    }
    return searchResults
  }, [clientsData?.items, debouncedClientSearch, effectiveClientId, p.clientLabel])

  const lawyerOptions = useMemo(
    () =>
      lawyers.map((lawyer) => ({
        userId: String(lawyer.user_id),
        display: `${lawyer.display_name} (${lawyer.current_active})`,
      })),
    [lawyers]
  )

  const getTypeLabel = (typeId: string) =>
    letterTypes.find((item) => item.id === typeId)?.name ??
    letterTypes.find((item) => item.slug === typeId)?.name ??
    typeId

  const getTypeSlug = (typeId: string) =>
    letterTypes.find((item) => item.id === typeId)?.slug ?? typeId

  const effectiveConfirmedCount = useMemo(() => {
    let count = 0
    if (effectiveTypeId) count += 1
    if (effectiveClientId && Number(effectiveClientId) > 0) count += 1
    if (effectiveLawyerUserId && Number(effectiveLawyerUserId) > 0) count += 1
    const dueDateOk =
      effectiveDueDate instanceof Date &&
      !Number.isNaN(effectiveDueDate.getTime()) &&
      (!dueDateManuallyOverridden || !isBeforeStartOfDay(effectiveDueDate))
    if (dueDateOk) count += 1
    return count
  }, [
    dueDateManuallyOverridden,
    effectiveClientId,
    effectiveDueDate,
    effectiveLawyerUserId,
    effectiveTypeId,
  ])

  const typeLabel = p.letterType
    ? getTypeLabel(resolveLetterTypeId(letterTypes, p.letterType))
    : null
  const lawyerDisplay =
    lawyerOptions.find((option) => option.userId === effectiveLawyerUserId)?.display ??
    p.lawyerLabel ??
    '—'

  const readonlyLawyerDisplay =
    lawyerOptions.find((option) => option.userId === p.lawyerId)?.display ??
    p.lawyerLabel ??
    (letter.legalTaskId != null
      ? t('pages.lawyerWorkplace.parameters.lawyerAssigned', 'Assigned on kanban')
      : t('pages.lawyerWorkplace.parameters.auto', 'Auto'))

  const clientIdNumber = Number(effectiveClientId)
  const lawyerUserIdNumber = Number(effectiveLawyerUserId)

  const dueDateIsValid =
    effectiveDueDate instanceof Date &&
    !Number.isNaN(effectiveDueDate.getTime()) &&
    (!dueDateManuallyOverridden || !isBeforeStartOfDay(effectiveDueDate))

  const canConfirm =
    Boolean(effectiveTypeId) &&
    Number.isFinite(clientIdNumber) &&
    clientIdNumber > 0 &&
    dueDateIsValid &&
    Number.isFinite(lawyerUserIdNumber) &&
    lawyerUserIdNumber > 0 &&
    contractIsValid &&
    !isReadOnly &&
    !confirmMutation.isPending

  const handleConfirm = () => {
    if (!canConfirm || !effectiveDueDate) return
    confirmMutation.mutate(
      {
        messageId: letter.id,
        payload: {
          letter_type_id: effectiveTypeId,
          client_id: clientIdNumber,
          due_date: legalDueDateToIso(effectiveDueDate),
          assigned_to_user_id: lawyerUserIdNumber,
          contract_number: effectiveContract.trim() || null,
        },
      },
      {
        onSuccess: () => {
          toast.success(
            t('pages.lawyerWorkplace.parameters.confirmSuccess', 'Task created on kanban board')
          )
          onConfirm?.(letter.id)
        },
      }
    )
  }

  const activityLog = useMemo(
    () =>
      buildLetterActivityLog({
        receivedAt: letter.receivedAt,
        updatedAt: letter.updatedAt,
        processingStatus: letter.processingStatus ?? status,
        suggestedLetterTypeId: letter.suggestedLetterTypeId,
        confirmedLetterTypeId: letter.confirmedLetterTypeId,
        legalTaskId: letter.legalTaskId,
      }),
    [
      letter.confirmedLetterTypeId,
      letter.legalTaskId,
      letter.processingStatus,
      letter.receivedAt,
      letter.suggestedLetterTypeId,
      letter.updatedAt,
      status,
    ]
  )

  if (isReadOnly) {
    // ── MODE B: Read-only view ─────────────────────────────────────────────────
    return (
      <div className="flex h-full w-full min-w-0 shrink-0 flex-col overflow-hidden border-l border-gray-100 bg-white">
        <div className="flex w-full flex-col items-start gap-4 overflow-y-auto px-[18px] py-[16px]">
          <div className="flex w-full items-center justify-between gap-2">
            <span className="text-dark-500 text-[14px] font-medium">
              {t('pages.lawyerWorkplace.parameters.title', 'Letter parameters')}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              {status === 'auto_processed' && (
                <span className="bg-success-100 text-success-700 rounded-full px-[9px] py-[2px] text-[9.5px] font-medium">
                  {t('pages.lawyerWorkplace.parameters.autoProcessed', 'AUTO')}
                </span>
              )}
              {status === 'done' && (
                <span className="rounded-full bg-blue-100 px-[9px] py-[2px] text-[9.5px] font-medium text-blue-500">
                  {t('pages.lawyerWorkplace.letterItem.status.done', 'DONE')}
                </span>
              )}
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t('pages.lawyerWorkplace.parameters.close', 'Close parameters')}
                  className="text-light-700 hover:text-dark-500 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-gray-100"
                >
                  <Icons.Cancel01 size={18} strokeWidth={1.5} />
                </button>
              )}
            </div>
          </div>

          {typeLabel && p.letterType && (
            <ReadonlyField label={t('pages.lawyerWorkplace.parameters.type', 'Type')}>
              <TypeBadge type={getTypeSlug(p.letterType)} label={typeLabel} />
            </ReadonlyField>
          )}

          <ReadonlyField label={t('pages.lawyerWorkplace.parameters.client', 'Client')}>
            {p.clientLabel || t('pages.lawyerWorkplace.parameters.notIdentified', 'Not identified')}
          </ReadonlyField>

          {p.dueDate && (
            <ReadonlyField label={t('pages.lawyerWorkplace.parameters.dueDate', 'Due date')}>
              <span className="text-dark-500">{formatDueDate(p.dueDate, i18n.language)}</span>
              {p.dueDateHint && (
                <span className="text-error-500 ml-2 text-[11px]">{p.dueDateHint}</span>
              )}
            </ReadonlyField>
          )}

          <ReadonlyField label={t('pages.lawyerWorkplace.parameters.lawyer', 'Lawyer')}>
            {readonlyLawyerDisplay}
          </ReadonlyField>

          {/* Link to kanban task */}
          {letter.legalTaskId != null && (
            <div className="border-primary-200 bg-primary-50 flex w-full items-center justify-between rounded-lg border px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Icons.CheckmarkSquare03
                  size={16}
                  strokeWidth={1.5}
                  className="text-primary-600 shrink-0"
                />
                <span className="text-primary-900 text-[12px] font-medium">
                  {t('pages.lawyerWorkplace.parameters.taskOnBoard', 'Task created on kanban')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onViewKanbanTask?.(letter.legalTaskId!)}
                className="text-primary-700 text-[11px] font-medium hover:underline"
              >
                {t('pages.lawyerWorkplace.parameters.viewTask', 'View →')}
              </button>
            </div>
          )}

          {/* Activity log */}
          <div className="flex w-full flex-col gap-2">
            <span className="text-light-600 text-[11px] font-medium tracking-wider uppercase">
              {t('pages.lawyerWorkplace.activityLog.title', 'Activity')}
            </span>
            <ActivityLog entries={activityLog} />
          </div>
        </div>
      </div>
    )
  }

  // ── MODE A: Editable ─────────────────────────────────────────────────────────
  return (
    <div className="flex h-full w-full min-w-0 shrink-0 flex-col justify-between overflow-x-hidden overflow-y-auto border-l border-gray-100 bg-white">
      <div className="flex w-full flex-col items-start gap-4 px-[18px] py-[16px]">
        <div className="flex w-full items-center justify-between gap-2 self-stretch">
          <span className="text-dark-500 text-[14px] font-medium">
            {t('pages.lawyerWorkplace.parameters.title', 'Letter parameters')}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label={t('pages.lawyerWorkplace.parameters.close', 'Close parameters')}
                className="text-light-700 hover:text-dark-500 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-gray-100"
              >
                <Icons.Cancel01 size={18} strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>

        {/* Type */}
        <ParameterDropdown
          label={t('pages.lawyerWorkplace.parameters.type', 'Type')}
          placeholder={t('pages.lawyerWorkplace.parameters.selectType', 'Select type')}
          value={
            effectiveTypeId ? (
              <TypeBadge
                type={getTypeSlug(effectiveTypeId)}
                label={getTypeLabel(effectiveTypeId)}
              />
            ) : null
          }
          onSelect={handleTypeSelect}
          items={letterTypes.map((letterType) => ({
            key: letterType.id,
            content: <TypeBadge type={letterType.slug} label={letterType.name} />,
          }))}
        />

        <div className="flex w-full flex-col gap-2">
          <Label className="text-dark-500 text-[12px] font-normal">
            {t('pages.lawyerWorkplace.parameters.client', 'Client')}
          </Label>
          {p.clientLockedByEmail ? (
            <div className="text-dark-500 flex h-9 w-full items-center rounded-[8px] border border-gray-200 bg-gray-50 px-3 py-2 text-[13px] font-light">
              {p.clientLabel ||
                t('pages.lawyerWorkplace.parameters.notIdentified', 'Not identified')}
            </div>
          ) : (
            <SearchableSelect
              options={clientOptions}
              value={effectiveClientId}
              onValueChange={handleClientSelect}
              onSearchChange={setClientSearch}
              isLoading={clientsLoading}
              emptySearchHint={t(
                'pages.lawyerWorkplace.parameters.clientSearchHint',
                'Type 2+ characters to search…'
              )}
              placeholder={t('pages.lawyerWorkplace.parameters.notIdentified', 'Not identified')}
            />
          )}
        </div>

        <div className="flex w-full flex-col gap-2">
          <Label className="text-dark-500 text-[12px] font-normal">
            {t('pages.lawyerWorkplace.parameters.dueDate', 'Due date')}
          </Label>
          <DateSelect
            id="params-due-date"
            value={effectiveDueDate}
            onChange={({ value }) => handleDueDateChange(value)}
            placeholder={t('pages.lawyerWorkplace.parameters.selectDueDate', 'Select date')}
            format="dd/MM/yyyy"
            min={minDueDate}
            className="h-9 rounded-[8px] border-gray-200 text-[14px] font-light"
          />
        </div>

        <ParameterDropdown
          label={t('pages.lawyerWorkplace.parameters.lawyer', 'Lawyer')}
          value={lawyerDisplay}
          onSelect={handleLawyerSelect}
          items={lawyerOptions.map((option) => ({
            key: option.userId,
            content: <span className="text-dark-500 text-[13px] font-light">{option.display}</span>,
          }))}
        />

        {/* Contract — real debts fetched from the selected client */}
        {contractsClientId != null && (
          <ParameterDropdown
            label={t('pages.lawyerWorkplace.parameters.contract', 'Contract')}
            placeholder={
              contractsLoading
                ? t('pages.lawyerWorkplace.parameters.contractLoading', 'Loading contracts…')
                : contracts.length === 0
                  ? t('pages.lawyerWorkplace.parameters.noContracts', 'No contracts')
                  : t('pages.lawyerWorkplace.parameters.selectContract', 'Select contract')
            }
            value={
              effectiveContract ? (
                <span className="text-dark-500 text-[13px] font-light">{effectiveContract}</span>
              ) : null
            }
            onSelect={handleContractSelect}
            items={contracts.map((contract) => {
              const key = contract.contract_number ?? `debt-${contract.debt_id}`
              const primary = contract.contract_number ?? `#${contract.debt_id}`
              return {
                key,
                content: (
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="text-dark-500 truncate text-[13px]">{primary}</span>
                    {contract.status && (
                      <span className="text-light-500 shrink-0 text-[11px] capitalize">
                        {contract.status}
                      </span>
                    )}
                  </span>
                ),
              }
            })}
          />
        )}
      </div>

      <div className="bg-light-50 flex w-full flex-col items-center justify-center gap-2 border-t border-gray-200 px-[18px] py-[16px]">
        <div className="flex flex-row items-center justify-between self-stretch">
          <span className="text-light-700 text-[12px] font-normal">
            {t('pages.lawyerWorkplace.parameters.managerConfirmation', 'Manager confirmation')}
          </span>
          <span className="text-secondary-900 text-[12px] font-normal">
            {t('pages.lawyerWorkplace.parameters.parametersCount', {
              confirmed: effectiveConfirmedCount,
              total: p.totalParameters,
              defaultValue: `${effectiveConfirmedCount}/${p.totalParameters} parameters`,
            })}
          </span>
        </div>
        <Button
          type="button"
          variant="primary"
          size="md"
          className="w-full px-10 py-7"
          disabled={!canConfirm}
          onClick={handleConfirm}
        >
          <Icons.AddCircle size={24} strokeWidth={1.5} />
          <span className="text-[14px] font-medium">
            {confirmMutation.isPending
              ? t('pages.lawyerWorkplace.parameters.confirming', 'Confirming…')
              : t('pages.lawyerWorkplace.parameters.confirmAndCreate', 'Confirm & create task')}
          </span>
        </Button>
      </div>
    </div>
  )
}

export function LetterParametersPanel({
  letter,
  onClose,
  onConfirm,
  onViewKanbanTask,
}: LetterParametersPanelProps) {
  const { t } = useTranslation('common')

  if (!letter) {
    return (
      <div className="flex h-full w-full min-w-0 shrink-0 items-center justify-center overflow-hidden border-l border-gray-200 bg-white">
        <p className="px-4 text-center text-sm text-gray-400">
          {t('pages.lawyerWorkplace.parameters.selectLetter', 'Select a letter to view parameters')}
        </p>
      </div>
    )
  }

  return (
    <LetterParametersPanelContent
      key={letter.id}
      letter={letter}
      onClose={onClose}
      onConfirm={onConfirm}
      onViewKanbanTask={onViewKanbanTask}
    />
  )
}
