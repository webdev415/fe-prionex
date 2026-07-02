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
import { useClients } from '@/features/clients/hooks/useClients'
import {
  useConfirmLetter,
  useLegalLawyers,
  useLegalLetterTypes,
  usePatchMessageSuggestions,
} from '@/features/lawyerWorkplace'
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

function formatClientOption(client: {
  id: number
  first_name: string
  last_name: string
  legacy_id?: string | null
}): { id: string; name: string } {
  const code = client.legacy_id?.trim() || `CL-${String(client.id).padStart(5, '0')}`
  const name = [client.first_name, client.last_name].filter(Boolean).join(' ')
  return { id: String(client.id), name: name ? `${code} · ${name}` : code }
}

function computeDueDateFromReceived(receivedAt: string, slaDays: number): Date {
  const base = new Date(receivedAt)
  const due = new Date(base)
  due.setDate(due.getDate() + (slaDays > 0 ? slaDays : 14))
  return due
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
  setDueDateOverride: (value: Date | null) => void
) {
  setLawyerOverride(
    result.suggested_lawyer_user_id != null ? String(result.suggested_lawyer_user_id) : ''
  )
  setDueDateOverride(computeDueDateFromReceived(receivedAt, result.sla_days))
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
}

function LetterParametersPanelContent({
  letter,
  onClose,
  onConfirm,
}: {
  letter: LetterDetail
  onClose?: () => void
  onConfirm?: (letterId: string) => void
}) {
  const { t, i18n } = useTranslation('common')
  const confirmMutation = useConfirmLetter()
  const patchSuggestionsMutation = usePatchMessageSuggestions()
  const { data: letterTypesData } = useLegalLetterTypes()
  const { data: lawyersData } = useLegalLawyers()

  const letterTypes = useMemo(() => letterTypesData?.items ?? [], [letterTypesData?.items])
  const lawyers = useMemo(() => lawyersData?.items ?? [], [lawyersData?.items])

  const [typeOverride, setTypeOverride] = useState<string | null>(null)
  const [clientOverride, setClientOverride] = useState<string | null>(null)
  const [clientSearch, setClientSearch] = useState('')
  const [lawyerOverride, setLawyerOverride] = useState<string | null>(null)
  const [dueDateOverride, setDueDateOverride] = useState<Date | null>(null)
  const [lawyerManuallyOverridden, setLawyerManuallyOverridden] = useState(false)
  const lastPrioritySignatureRef = useRef<string | null>(null)

  const { parameters: p, status } = letter

  const isReadOnly =
    status === 'sent_to_kanban' || status === 'on_board' || status === 'auto_processed'

  const defaultTypeId = useMemo(
    () => resolveLetterTypeId(letterTypes, p.letterType),
    [letterTypes, p.letterType]
  )
  const defaultClientId = p.clientId && p.clientId !== 'not_identified' ? p.clientId : ''
  const defaultLawyerUserId = useMemo(() => {
    const resolved = resolveLawyerUserId(lawyers, p.lawyerId)
    return resolved != null ? String(resolved) : ''
  }, [lawyers, p.lawyerId])
  const defaultDueDate = p.dueDate ? new Date(p.dueDate) : null

  const effectiveTypeId = typeOverride ?? defaultTypeId

  const applyTypeSuggestion = useCallback(
    async (typeId: string) => {
      const result = await patchSuggestionsMutation.mutateAsync({
        messageId: letter.id,
        payload: { letter_type_id: typeId },
      })
      applySuggestionResult(result, letter.receivedAt, setLawyerOverride, setDueDateOverride)
      return result
    },
    [letter.id, letter.receivedAt, patchSuggestionsMutation]
  )

  useEffect(() => {
    if (isReadOnly || !effectiveTypeId || lawyerManuallyOverridden) {
      return
    }

    const signature = buildPrioritySignature(letterTypes, effectiveTypeId)
    const shouldSync =
      lastPrioritySignatureRef.current === null || lastPrioritySignatureRef.current !== signature

    if (!shouldSync) {
      return
    }

    lastPrioritySignatureRef.current = signature
    void applyTypeSuggestion(effectiveTypeId).catch(() => {
      lastPrioritySignatureRef.current = null
    })
  }, [applyTypeSuggestion, effectiveTypeId, isReadOnly, lawyerManuallyOverridden, letterTypes])

  const handleTypeSelect = (typeId: string) => {
    setLawyerManuallyOverridden(false)
    lastPrioritySignatureRef.current = null
    setTypeOverride(typeId)
    void applyTypeSuggestion(typeId).catch(() => {
      setTypeOverride(defaultTypeId || null)
    })
  }

  const handleLawyerSelect = (userId: string) => {
    setLawyerOverride(userId)
    setLawyerManuallyOverridden(true)
  }

  const effectiveClientId = clientOverride ?? defaultClientId
  const effectiveLawyerUserId = lawyerOverride ?? defaultLawyerUserId
  const effectiveDueDate = dueDateOverride ?? defaultDueDate

  const debouncedClientSearch = useDebounce(clientSearch, 300)
  const { data: clientsData, isFetching: clientsLoading } = useClients(
    { q: debouncedClientSearch, limit: 20 },
    { enabled: debouncedClientSearch.length >= 2 }
  )

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
    if (effectiveDueDate instanceof Date && !Number.isNaN(effectiveDueDate.getTime())) count += 1
    return count
  }, [effectiveClientId, effectiveDueDate, effectiveLawyerUserId, effectiveTypeId])

  const typeLabel = p.letterType
    ? getTypeLabel(resolveLetterTypeId(letterTypes, p.letterType))
    : null
  const lawyerDisplay =
    lawyerOptions.find((option) => option.userId === effectiveLawyerUserId)?.display ??
    p.lawyerLabel ??
    '—'

  const clientIdNumber = Number(effectiveClientId)
  const lawyerUserIdNumber = Number(effectiveLawyerUserId)

  const canConfirm =
    Boolean(effectiveTypeId) &&
    Number.isFinite(clientIdNumber) &&
    clientIdNumber > 0 &&
    effectiveDueDate instanceof Date &&
    !Number.isNaN(effectiveDueDate.getTime()) &&
    Number.isFinite(lawyerUserIdNumber) &&
    lawyerUserIdNumber > 0 &&
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
          due_date: effectiveDueDate.toISOString(),
          assigned_to_user_id: lawyerUserIdNumber,
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

  const activityLog: ActivityLogEntry[] = [
    {
      timestamp: letter.receivedAt,
      eventKey: 'pages.lawyerWorkplace.activityLog.letterReceived',
      fallback: 'Letter received',
    },
    ...(p.letterType
      ? [
          {
            timestamp: letter.receivedAt,
            eventKey: 'pages.lawyerWorkplace.activityLog.classified',
            fallback: 'Letter type suggested',
          },
        ]
      : []),
    ...(isReadOnly
      ? [
          {
            timestamp: new Date().toISOString(),
            eventKey: 'pages.lawyerWorkplace.activityLog.taskCreated',
            fallback: 'Task created on kanban board',
          },
        ]
      : []),
  ]

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
            {p.lawyerLabel || 'Auto'}
          </ReadonlyField>

          {/* Link to kanban task */}
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
              className="text-primary-700 text-[11px] font-medium hover:underline"
            >
              {t('pages.lawyerWorkplace.parameters.viewTask', 'View →')}
            </button>
          </div>

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
          <SearchableSelect
            options={clientOptions}
            value={effectiveClientId}
            onValueChange={(val) => {
              setClientOverride(val)
              setClientSearch('')
            }}
            onSearchChange={setClientSearch}
            isLoading={clientsLoading}
            emptySearchHint={t(
              'pages.lawyerWorkplace.parameters.clientSearchHint',
              'Type 2+ characters to search…'
            )}
            placeholder={t('pages.lawyerWorkplace.parameters.notIdentified', 'Not identified')}
          />
        </div>

        <div className="flex w-full flex-col gap-2">
          <Label className="text-dark-500 text-[12px] font-normal">
            {t('pages.lawyerWorkplace.parameters.dueDate', 'Due date')}
          </Label>
          <DateSelect
            id="params-due-date"
            value={effectiveDueDate}
            onChange={({ value }) => setDueDateOverride(value)}
            placeholder={t('pages.lawyerWorkplace.parameters.selectDueDate', 'Select date')}
            format="dd/MM/yyyy"
            min={new Date()}
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

        {p.contractLabel && (
          <ReadonlyField label={t('pages.lawyerWorkplace.parameters.contract', 'Contract')}>
            {p.contractLabel}
          </ReadonlyField>
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
          disabled={!canConfirm || patchSuggestionsMutation.isPending}
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

export function LetterParametersPanel({ letter, onClose, onConfirm }: LetterParametersPanelProps) {
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
    />
  )
}
