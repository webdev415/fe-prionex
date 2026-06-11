import { Button } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Label } from '@/components/ui/Label'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { LetterDetail } from '../../types'

const TYPE_COLOURS: Record<string, string> = {
  complaint: 'bg-error-100 text-error-700',
  nbu_inquiry: 'bg-secondary-100 text-secondary-800',
  court_claim: 'bg-warning-100 text-warning-700',
  attorney_request: 'bg-[#EDE9FE] text-[#6D28D9]',
  inquiry: 'bg-success-100 text-success-700',
}

const TYPE_LABELS: Record<string, string> = {
  complaint: 'Complaint',
  nbu_inquiry: 'NBU inquiry',
  court_claim: 'Court claim',
  attorney_request: 'Attorney request',
  inquiry: 'Inquiry',
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

const CLIENT_OPTIONS = [
  { value: 'not_identified', label: 'Not identified' },
  { value: 'cl-08114', label: 'CL-08114 · I. Petrenko' },
  { value: 'cl-12409', label: 'CL-12409 · O. Kovalenko' },
  { value: 'cl-06441', label: 'CL-06441 · P. Melnyk' },
  { value: 'cl-09908', label: 'CL-09908 · V. Khomenko' },
  { value: 'cl-03305', label: 'CL-03305 · M. Bondarenko' },
  { value: 'cl-07750', label: 'CL-07750 · L. Savchenko' },
  { value: 'cl-04412', label: 'CL-04412 · T. Romaniuk' },
  { value: 'cl-05588', label: 'CL-05588 · H. Tkachenko' },
  { value: 'cl-02211', label: 'CL-02211 · O. Vasylenko' },
] as const

const CONTRACT_OPTIONS = [
  { value: 'cr-2024-00518', label: 'CR-2024-00518' },
  { value: 'cr-12409', label: 'CR-12409' },
  { value: 'cr-09908', label: 'CR-09908' },
  { value: 'cr-03305', label: 'CR-03305' },
] as const

const LAWYER_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'lawyer-1', label: 'Volodymyr Doroshenko (3)' },
  { value: 'lawyer-2', label: 'Maria Ivanenko (1)' },
  { value: 'lawyer-3', label: 'D. Kovalchuk (2)' },
  { value: 'lawyer-4', label: 'O. Hrytsenko (4)' },
] as const

function formatClientLabel(clientId: string, clientLabel: string): string {
  const match = CLIENT_OPTIONS.find((option) => option.value === clientId)
  if (match) return match.label
  if (!clientLabel || clientLabel === 'Not identified') return 'Not identified'
  return clientLabel.replace(/^(\S+)\s+/, '$1 · ')
}

function formatDueDate(iso: string): string {
  return new Date(iso).toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

interface ParameterDropdownProps {
  label: string
  children: React.ReactNode
  items: readonly { key: string; label: string; content?: React.ReactNode }[]
  placeholder?: string
}

function ParameterDropdown({ label, children, items, placeholder = '—' }: ParameterDropdownProps) {
  const hasValue = children !== null && children !== undefined && children !== false

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
              {hasValue ? children : <span className="text-gray-400">{placeholder}</span>}
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
            >
              {item.content ?? item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export interface LetterParametersPanelProps {
  letter: LetterDetail | null
}

export function LetterParametersPanel({ letter }: LetterParametersPanelProps) {
  if (!letter) {
    return (
      <div className="flex h-full w-[22%] shrink-0 items-center justify-center border-l border-gray-200 bg-white">
        <p className="px-4 text-center text-sm text-gray-400">Select a letter to view parameters</p>
      </div>
    )
  }

  const { parameters: p } = letter
  const allConfirmed = p.confirmedCount >= p.totalParameters
  const typeLabel = p.letterType ? TYPE_LABELS[p.letterType] : null
  const clientLabel = formatClientLabel(p.clientId || 'not_identified', p.clientLabel)
  const contractLabel =
    CONTRACT_OPTIONS.find((option) => option.value === p.contractId)?.label ?? p.contractLabel ?? ''
  const lawyerLabel =
    LAWYER_OPTIONS.find((option) => option.value === p.lawyerId)?.label ?? p.lawyerLabel ?? 'Auto'

  return (
    <div className="flex h-full w-[22%] shrink-0 flex-col justify-between border-l border-gray-100 bg-white/50">
      <div className="flex w-full flex-col items-start gap-4 px-[18px] py-[16px]">
        <div className="flex w-full items-center justify-between self-stretch">
          <span className="text-dark-500 text-[14px] font-medium">Letter parameters</span>
          {p.autoConfidence > 0 && (
            <span className="bg-primary-300 text-secondary-800 rounded-full px-[9px] py-[2px] text-[9.5px] font-normal">
              AUTO · {p.autoConfidence}%
            </span>
          )}
        </div>

        <ParameterDropdown
          label="Type"
          placeholder="Select type"
          items={Object.entries(TYPE_LABELS).map(([type, label]) => ({
            key: type,
            label,
            content: <TypeBadge type={type} label={label} />,
          }))}
        >
          {typeLabel && p.letterType && <TypeBadge type={p.letterType} label={typeLabel} />}
        </ParameterDropdown>

        <ParameterDropdown
          label="Client"
          items={CLIENT_OPTIONS.map((option) => ({ key: option.value, label: option.label }))}
        >
          {clientLabel}
        </ParameterDropdown>

        <ParameterDropdown
          label="Contract"
          items={CONTRACT_OPTIONS.map((option) => ({ key: option.value, label: option.label }))}
        >
          {contractLabel}
        </ParameterDropdown>

        <ParameterDropdown
          label="Due date"
          items={
            p.dueDate
              ? [{ key: p.dueDate, label: formatDueDate(p.dueDate) }]
              : [{ key: '2026-05-26', label: '26.05.2026' }]
          }
        >
          {p.dueDate && (
            <>
              <span className="text-dark-500">{formatDueDate(p.dueDate)}</span>
              {p.dueDateHint && (
                <>
                  <span className="text-light-700"> · </span>
                  <span className="text-error-500">{p.dueDateHint}</span>
                </>
              )}
            </>
          )}
        </ParameterDropdown>

        <ParameterDropdown
          label="Lawyer"
          items={LAWYER_OPTIONS.map((option) => ({ key: option.value, label: option.label }))}
        >
          {lawyerLabel}
        </ParameterDropdown>
      </div>

      {/* ── Footer: confirm button ─────────────────────── */}
      <div className="bg-light-50 flex w-full flex-col items-center justify-center gap-2 border-t border-gray-200 px-[18px] py-[16px]">
        <div className="flex flex-row items-center justify-between self-stretch">
          <span className="text-light-700 text-[12px] font-normal">Manager confirmation</span>
          <span className="text-secondary-900 text-[12px] font-normal">
            {p.confirmedCount}/{p.totalParameters} parameters
          </span>
        </div>
        <Button
          type="button"
          variant="primary"
          size="md"
          className="w-full px-10 py-7"
          disabled={!allConfirmed && letter.isUnprocessed}
        >
          <Icons.AddCircle size={24} strokeWidth={1.5} />
          <span className="text-[14px] font-medium">Confirm &amp; create task</span>
        </Button>
      </div>
    </div>
  )
}
