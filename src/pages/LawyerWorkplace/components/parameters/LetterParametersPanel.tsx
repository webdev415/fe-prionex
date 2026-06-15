import { useState } from 'react'
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
import { SearchableSelect } from '@/components/ui/SearchableSelect'
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

const TYPE_KEYS = [
  'complaint',
  'nbu_inquiry',
  'court_claim',
  'attorney_request',
  'inquiry',
] as const

const TYPE_I18N: Record<(typeof TYPE_KEYS)[number], string> = {
  complaint: 'pages.lawyerWorkplace.parameters.types.complaint',
  nbu_inquiry: 'pages.lawyerWorkplace.parameters.types.nbuInquiry',
  court_claim: 'pages.lawyerWorkplace.parameters.types.courtClaim',
  attorney_request: 'pages.lawyerWorkplace.parameters.types.attorneyRequest',
  inquiry: 'pages.lawyerWorkplace.parameters.types.inquiry',
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

// ─── Mock data ────────────────────────────────────────────────────────────────

const CLIENT_OPTIONS_SEARCHABLE = [
  { id: 'not_identified', name: 'Not identified' },
  { id: 'cl-08114', name: 'CL-08114 · I. Petrenko' },
  { id: 'cl-12409', name: 'CL-12409 · O. Kovalenko' },
  { id: 'cl-06441', name: 'CL-06441 · P. Melnyk' },
  { id: 'cl-09908', name: 'CL-09908 · V. Khomenko' },
  { id: 'cl-03305', name: 'CL-03305 · M. Bondarenko' },
  { id: 'cl-07750', name: 'CL-07750 · L. Savchenko' },
  { id: 'cl-04412', name: 'CL-04412 · T. Romaniuk' },
  { id: 'cl-05588', name: 'CL-05588 · H. Tkachenko' },
  { id: 'cl-02211', name: 'CL-02211 · O. Vasylenko' },
]

const LAWYER_OPTIONS = [
  { value: 'auto', labelKey: 'pages.lawyerWorkplace.parameters.auto', display: 'Auto' },
  {
    value: 'lawyer-1',
    labelKey: 'pages.lawyerWorkplace.parameters.lawyers.lawyer1',
    display: 'V. Doroshenko (3)',
  },
  {
    value: 'lawyer-2',
    labelKey: 'pages.lawyerWorkplace.parameters.lawyers.lawyer2',
    display: 'M. Ivanenko (1)',
  },
  {
    value: 'lawyer-3',
    labelKey: 'pages.lawyerWorkplace.parameters.lawyers.lawyer3',
    display: 'D. Kovalchuk (2)',
  },
  {
    value: 'lawyer-4',
    labelKey: 'pages.lawyerWorkplace.parameters.lawyers.lawyer4',
    display: 'O. Hrytsenko (4)',
  },
] as const

const CONTRACT_OPTIONS = [
  { value: 'cr-2024-00518', label: 'CR-2024-00518' },
  { value: 'cr-12409', label: 'CR-12409' },
  { value: 'cr-09908', label: 'CR-09908' },
  { value: 'cr-03305', label: 'CR-03305' },
] as const

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

export function LetterParametersPanel({ letter, onClose, onConfirm }: LetterParametersPanelProps) {
  const { t, i18n } = useTranslation('common')

  // Editable state (Mode A)
  const [selectedType, setSelectedType] = useState<string>('')
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [selectedLawyerId, setSelectedLawyerId] = useState<string>('auto')
  const [selectedDueDate, setSelectedDueDate] = useState<Date | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  if (!letter) {
    return (
      <div className="flex h-full w-full shrink-0 items-center justify-center border-l border-gray-200 bg-white">
        <p className="px-4 text-center text-sm text-gray-400">
          {t('pages.lawyerWorkplace.parameters.selectLetter', 'Select a letter to view parameters')}
        </p>
      </div>
    )
  }

  const { parameters: p, status } = letter

  const getTypeLabel = (type: string) =>
    TYPE_I18N[type as (typeof TYPE_KEYS)[number]]
      ? t(TYPE_I18N[type as (typeof TYPE_KEYS)[number]])
      : type

  // ── Mode C: auto-processed — caller hides the panel, so nothing to render ──

  // ── Mode B: read-only (sent_to_kanban / on_board / auto_processed) ──────────
  const isReadOnly =
    status === 'sent_to_kanban' || status === 'on_board' || status === 'auto_processed'

  const typeLabel = p.letterType ? getTypeLabel(p.letterType) : null
  const lawyerDisplay =
    LAWYER_OPTIONS.find((o) => o.value === (selectedLawyerId || p.lawyerId))?.display ??
    p.lawyerLabel ??
    'Auto'

  const canConfirm =
    (selectedType || p.letterType) &&
    (selectedClientId || p.clientId) &&
    (selectedDueDate || p.dueDate) &&
    !confirmed

  const mockActivityLog: ActivityLogEntry[] = [
    {
      timestamp: letter.receivedAt,
      eventKey: 'pages.lawyerWorkplace.activityLog.letterReceived',
      fallback: 'Letter received',
    },
    ...(p.autoConfidence > 0
      ? [
          {
            timestamp: letter.receivedAt,
            eventKey: 'pages.lawyerWorkplace.activityLog.classified',
            fallback: `Auto-classified (${p.autoConfidence}% confidence)`,
          },
        ]
      : []),
    ...(isReadOnly || confirmed
      ? [
          {
            timestamp: new Date().toISOString(),
            eventKey: 'pages.lawyerWorkplace.activityLog.taskCreated',
            fallback: 'Task created on kanban board',
          },
        ]
      : []),
  ]

  if (isReadOnly && !confirmed) {
    // ── MODE B: Read-only view ─────────────────────────────────────────────────
    return (
      <div className="flex h-full w-full shrink-0 flex-col border-l border-gray-100 bg-white">
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
              {p.autoConfidence > 0 && (
                <span className="bg-primary-300 text-secondary-800 rounded-full px-[9px] py-[2px] text-[9.5px] font-normal">
                  {t('pages.lawyerWorkplace.parameters.autoBadge', {
                    percent: p.autoConfidence,
                    defaultValue: `AUTO · ${p.autoConfidence}%`,
                  })}
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
              <TypeBadge type={p.letterType} label={typeLabel} />
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
            <ActivityLog entries={mockActivityLog} />
          </div>
        </div>
      </div>
    )
  }

  // ── MODE A: Editable ─────────────────────────────────────────────────────────
  return (
    <div className="flex h-full w-full shrink-0 flex-col justify-between overflow-y-auto border-l border-gray-100 bg-white">
      <div className="flex w-full flex-col items-start gap-4 px-[18px] py-[16px]">
        <div className="flex w-full items-center justify-between gap-2 self-stretch">
          <span className="text-dark-500 text-[14px] font-medium">
            {t('pages.lawyerWorkplace.parameters.title', 'Letter parameters')}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {p.autoConfidence > 0 && (
              <span className="bg-primary-300 text-secondary-800 rounded-full px-[9px] py-[2px] text-[9.5px] font-normal">
                {t('pages.lawyerWorkplace.parameters.autoBadge', {
                  percent: p.autoConfidence,
                  defaultValue: `AUTO · ${p.autoConfidence}%`,
                })}
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

        {/* Type */}
        <ParameterDropdown
          label={t('pages.lawyerWorkplace.parameters.type', 'Type')}
          placeholder={t('pages.lawyerWorkplace.parameters.selectType', 'Select type')}
          value={
            selectedType || p.letterType ? (
              <TypeBadge
                type={selectedType || p.letterType}
                label={getTypeLabel(selectedType || p.letterType)}
              />
            ) : null
          }
          onSelect={setSelectedType}
          items={TYPE_KEYS.map((type) => {
            const label = getTypeLabel(type)
            return { key: type, content: <TypeBadge type={type} label={label} /> }
          })}
        />

        {/* Client — searchable */}
        <div className="flex w-full flex-col gap-2">
          <Label className="text-dark-500 text-[12px] font-normal">
            {t('pages.lawyerWorkplace.parameters.client', 'Client')}
          </Label>
          <SearchableSelect
            options={CLIENT_OPTIONS_SEARCHABLE}
            value={selectedClientId || p.clientId || ''}
            onValueChange={setSelectedClientId}
            placeholder={t('pages.lawyerWorkplace.parameters.notIdentified', 'Not identified')}
          />
        </div>

        {/* Due date — DateSelect */}
        <div className="flex w-full flex-col gap-2">
          <Label className="text-dark-500 text-[12px] font-normal">
            {t('pages.lawyerWorkplace.parameters.dueDate', 'Due date')}
          </Label>
          <DateSelect
            id="params-due-date"
            value={selectedDueDate ?? (p.dueDate ? new Date(p.dueDate) : null)}
            onChange={({ value }) => setSelectedDueDate(value)}
            placeholder={t('pages.lawyerWorkplace.parameters.selectDueDate', 'Select date')}
            format="dd/MM/yyyy"
            min={new Date()}
            className="h-9 rounded-[8px] border-gray-200 text-[14px] font-light"
          />
        </div>

        {/* Lawyer */}
        <ParameterDropdown
          label={t('pages.lawyerWorkplace.parameters.lawyer', 'Lawyer')}
          value={lawyerDisplay}
          onSelect={setSelectedLawyerId}
          items={LAWYER_OPTIONS.map((opt) => ({
            key: opt.value,
            content: <span className="text-dark-500 text-[13px] font-light">{opt.display}</span>,
          }))}
        />

        {/* Contract */}
        <ParameterDropdown
          label={t('pages.lawyerWorkplace.parameters.contract', 'Contract')}
          value={
            CONTRACT_OPTIONS.find((o) => o.value === p.contractId)?.label ?? p.contractLabel ?? null
          }
          items={CONTRACT_OPTIONS.map((opt) => ({ key: opt.value, content: opt.label }))}
        />
      </div>

      <div className="bg-light-50 flex w-full flex-col items-center justify-center gap-2 border-t border-gray-200 px-[18px] py-[16px]">
        <div className="flex flex-row items-center justify-between self-stretch">
          <span className="text-light-700 text-[12px] font-normal">
            {t('pages.lawyerWorkplace.parameters.managerConfirmation', 'Manager confirmation')}
          </span>
          <span className="text-secondary-900 text-[12px] font-normal">
            {t('pages.lawyerWorkplace.parameters.parametersCount', {
              confirmed: p.confirmedCount,
              total: p.totalParameters,
              defaultValue: `${p.confirmedCount}/${p.totalParameters} parameters`,
            })}
          </span>
        </div>
        <Button
          type="button"
          variant="primary"
          size="md"
          className="w-full px-10 py-7"
          disabled={!canConfirm}
          onClick={() => {
            if (!canConfirm) return
            setConfirmed(true)
            onConfirm?.(letter.id)
          }}
        >
          <Icons.AddCircle size={24} strokeWidth={1.5} />
          <span className="text-[14px] font-medium">
            {t('pages.lawyerWorkplace.parameters.confirmAndCreate', 'Confirm & create task')}
          </span>
        </Button>
      </div>
    </div>
  )
}
