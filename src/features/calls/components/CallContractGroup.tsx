import { useTranslation } from 'react-i18next'

import { RadioGroup, RadioItem } from '@/components/ui/Radio'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { Icons } from '@/lib/icons'
import { formatDate } from '@/lib/localeFormat'
import { formatMoneyUAHTwoDecimals } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export interface CallContract {
  id: string
  number: string
  /** Free-form: the backend records more dispositions than the UI enumerates. */
  status: string
  /** Short marker beside the status, e.g. RR (restructuring) or PP (payment plan). */
  marker?: string | null
  counterparty: string
  loanPrincipal: number
  debt: number
  saleDate?: string | null
  lastContact?: string | null
}

export interface CallContractGroupData {
  id: string
  /** Absent for the caller's own contracts; the third party's name otherwise. */
  thirdPartyName?: string | null
  clientId?: number | null
  contracts: CallContract[]
}

interface CallContractGroupProps {
  group: CallContractGroupData
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  /** The one contract, across every group, the interaction will be filed against. */
  selectedContractId: string | null
  onSelectContract: (contractId: string) => void
}

const CLOSED_STATUSES = new Set(['closed', 'paid', 'repaid'])

export function CallContractGroup({
  group,
  enabled,
  onEnabledChange,
  selectedContractId,
  onSelectContract,
}: CallContractGroupProps) {
  const { t } = useTranslation('common')
  const label = group.thirdPartyName
    ? `${t('pages.clients.modals.callDialog.contracts.thirdParty', 'Third party by contracts')}: ${group.thirdPartyName}`
    : t('pages.clients.modals.callDialog.contracts.client', 'Client by contracts')

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <ToggleSwitch checked={enabled} onChange={onEnabledChange} aria-label={label} />
        <Icons.Info
          size={14}
          className="text-muted-foreground shrink-0"
          strokeWidth={1.5}
          aria-hidden
        />
        <span className="text-foreground truncate text-xs font-medium sm:text-sm">{label}</span>
        {group.clientId != null && (
          <a
            href={`/dashboard/clients/${group.clientId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-700 ml-auto shrink-0 text-xs font-medium"
          >
            {t('pages.clients.modals.callDialog.contracts.view', 'View')} &gt;
          </a>
        )}
      </div>

      {/* Horizontal, because a client can hold more contracts than fit the modal
          and the operator scans them side by side rather than scrolling a list. */}
      <RadioGroup
        value={selectedContractId ?? ''}
        onValueChange={onSelectContract}
        className={cn(
          'flex gap-3 overflow-x-auto pb-1',
          !enabled && 'pointer-events-none opacity-50'
        )}
        aria-label={label}
      >
        {group.contracts.map((contract) => (
          <ContractCard
            key={contract.id}
            contract={contract}
            selected={contract.id === selectedContractId}
            disabled={!enabled}
          />
        ))}
      </RadioGroup>
    </div>
  )
}

function ContractCard({
  contract,
  selected,
  disabled,
}: {
  contract: CallContract
  selected: boolean
  disabled: boolean
}) {
  const { t, i18n } = useTranslation('common')
  const closed = CLOSED_STATUSES.has(contract.status.toLowerCase())
  const asDate = (value?: string | null) => (value ? formatDate(value, i18n.language) : '—')

  return (
    <label
      className={cn(
        'border-border bg-card flex w-64 shrink-0 cursor-pointer flex-col gap-2 rounded-lg border p-3 transition-colors',
        selected && 'border-primary ring-primary/30 ring-1',
        disabled && 'cursor-default'
      )}
    >
      <div className="flex items-center gap-2">
        <RadioItem value={contract.id} disabled={disabled} aria-label={contract.number} />
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            closed ? 'bg-success-50 text-success-700' : 'bg-error-50 text-error-500'
          )}
        >
          {contract.status}
        </span>
        {contract.marker && (
          <span className="bg-primary-100 text-primary-700 rounded-full px-2 py-0.5 text-xs font-medium">
            {contract.marker}
          </span>
        )}
        <span className="text-foreground ml-auto truncate text-xs font-medium">
          {contract.number}
        </span>
      </div>

      <dl className="grid grid-cols-1 gap-1 text-xs">
        <Row
          label={t('pages.clients.detail.tableHeaders.counterparty', 'Counterparty')}
          value={contract.counterparty || '—'}
        />
        <Row
          label={t('pages.clients.modals.callDialog.loanPrincipal', 'Loan principal')}
          value={formatMoneyUAHTwoDecimals(contract.loanPrincipal)}
        />
        <Row
          label={t('pages.clients.detail.tableHeaders.debt', 'Debt')}
          value={formatMoneyUAHTwoDecimals(contract.debt)}
        />
        <Row
          label={t('pages.clients.detail.tableHeaders.saleDate', 'Sale date')}
          value={asDate(contract.saleDate)}
        />
        <Row
          label={t('pages.clients.modals.callDialog.lastContact', 'Last contact')}
          value={asDate(contract.lastContact)}
        />
      </dl>
    </label>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}:</dt>
      <dd className="text-foreground truncate font-medium">{value}</dd>
    </div>
  )
}
