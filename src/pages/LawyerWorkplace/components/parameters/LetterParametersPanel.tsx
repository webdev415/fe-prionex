import { useTranslation } from 'react-i18next'
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
import { formatDueDate } from '../../utils/formatters'
import type { LetterDetail } from '../../types'

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

const CLIENT_OPTIONS = [
  { value: 'not_identified', labelKey: 'pages.lawyerWorkplace.parameters.notIdentified' },
  { value: 'cl-08114', labelKey: 'pages.lawyerWorkplace.parameters.clients.cl08114' },
  { value: 'cl-12409', labelKey: 'pages.lawyerWorkplace.parameters.clients.cl12409' },
  { value: 'cl-06441', labelKey: 'pages.lawyerWorkplace.parameters.clients.cl06441' },
  { value: 'cl-09908', labelKey: 'pages.lawyerWorkplace.parameters.clients.cl09908' },
  { value: 'cl-03305', labelKey: 'pages.lawyerWorkplace.parameters.clients.cl03305' },
  { value: 'cl-07750', labelKey: 'pages.lawyerWorkplace.parameters.clients.cl07750' },
  { value: 'cl-04412', labelKey: 'pages.lawyerWorkplace.parameters.clients.cl04412' },
  { value: 'cl-05588', labelKey: 'pages.lawyerWorkplace.parameters.clients.cl05588' },
  { value: 'cl-02211', labelKey: 'pages.lawyerWorkplace.parameters.clients.cl02211' },
] as const

const CONTRACT_OPTIONS = [
  { value: 'cr-2024-00518', label: 'CR-2024-00518' },
  { value: 'cr-12409', label: 'CR-12409' },
  { value: 'cr-09908', label: 'CR-09908' },
  { value: 'cr-03305', label: 'CR-03305' },
] as const

const LAWYER_OPTIONS = [
  { value: 'auto', labelKey: 'pages.lawyerWorkplace.parameters.auto' },
  { value: 'lawyer-1', labelKey: 'pages.lawyerWorkplace.parameters.lawyers.lawyer1' },
  { value: 'lawyer-2', labelKey: 'pages.lawyerWorkplace.parameters.lawyers.lawyer2' },
  { value: 'lawyer-3', labelKey: 'pages.lawyerWorkplace.parameters.lawyers.lawyer3' },
  { value: 'lawyer-4', labelKey: 'pages.lawyerWorkplace.parameters.lawyers.lawyer4' },
] as const

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
  onClose?: () => void
}

export function LetterParametersPanel({ letter, onClose }: LetterParametersPanelProps) {
  const { t, i18n } = useTranslation('common')

  if (!letter) {
    return (
      <div className="flex h-full w-full shrink-0 items-center justify-center border-l border-gray-200 bg-white">
        <p className="px-4 text-center text-sm text-gray-400">
          {t('pages.lawyerWorkplace.parameters.selectLetter', 'Select a letter to view parameters')}
        </p>
      </div>
    )
  }

  const { parameters: p } = letter
  const allConfirmed = p.confirmedCount >= p.totalParameters

  const getTypeLabel = (type: string) =>
    TYPE_I18N[type as (typeof TYPE_KEYS)[number]]
      ? t(TYPE_I18N[type as (typeof TYPE_KEYS)[number]])
      : type

  const getClientLabel = (clientId: string, clientLabel: string) => {
    const match = CLIENT_OPTIONS.find((option) => option.value === clientId)
    if (match) return t(match.labelKey)
    if (!clientLabel || clientLabel === 'Not identified') {
      return t('pages.lawyerWorkplace.parameters.notIdentified', 'Not identified')
    }
    return clientLabel.replace(/^(\S+)\s+/, '$1 · ')
  }

  const getLawyerLabel = (lawyerId: string, lawyerLabel: string) => {
    const match = LAWYER_OPTIONS.find((option) => option.value === lawyerId)
    if (match) return t(match.labelKey)
    return lawyerLabel || t('pages.lawyerWorkplace.parameters.auto', 'Auto')
  }

  const typeLabel = p.letterType ? getTypeLabel(p.letterType) : null
  const clientLabel = getClientLabel(p.clientId || 'not_identified', p.clientLabel)
  const contractLabel =
    CONTRACT_OPTIONS.find((option) => option.value === p.contractId)?.label ?? p.contractLabel ?? ''
  const lawyerLabel = getLawyerLabel(p.lawyerId || 'auto', p.lawyerLabel)

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
                className="text-light-700 hover:text-dark-500 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-gray-100 xl:hidden"
                aria-label={t('pages.lawyerWorkplace.parameters.close', 'Close parameters')}
              >
                <Icons.Cancel01 size={18} strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>

        <ParameterDropdown
          label={t('pages.lawyerWorkplace.parameters.type', 'Type')}
          placeholder={t('pages.lawyerWorkplace.parameters.selectType', 'Select type')}
          items={TYPE_KEYS.map((type) => {
            const label = getTypeLabel(type)
            return {
              key: type,
              label,
              content: <TypeBadge type={type} label={label} />,
            }
          })}
        >
          {typeLabel && p.letterType && <TypeBadge type={p.letterType} label={typeLabel} />}
        </ParameterDropdown>

        <ParameterDropdown
          label={t('pages.lawyerWorkplace.parameters.client', 'Client')}
          items={CLIENT_OPTIONS.map((option) => ({
            key: option.value,
            label: t(option.labelKey),
          }))}
        >
          {clientLabel}
        </ParameterDropdown>

        <ParameterDropdown
          label={t('pages.lawyerWorkplace.parameters.contract', 'Contract')}
          items={CONTRACT_OPTIONS.map((option) => ({ key: option.value, label: option.label }))}
        >
          {contractLabel}
        </ParameterDropdown>

        <ParameterDropdown
          label={t('pages.lawyerWorkplace.parameters.dueDate', 'Due date')}
          items={
            p.dueDate
              ? [
                  {
                    key: p.dueDate,
                    label: formatDueDate(p.dueDate, i18n.language),
                  },
                ]
              : [{ key: '2026-05-26', label: formatDueDate('2026-05-26', i18n.language) }]
          }
        >
          {p.dueDate && (
            <>
              <span className="text-dark-500">{formatDueDate(p.dueDate, i18n.language)}</span>
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
          label={t('pages.lawyerWorkplace.parameters.lawyer', 'Lawyer')}
          items={LAWYER_OPTIONS.map((option) => ({
            key: option.value,
            label: t(option.labelKey),
          }))}
        >
          {lawyerLabel}
        </ParameterDropdown>
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
          disabled={!allConfirmed && letter.isUnprocessed}
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
