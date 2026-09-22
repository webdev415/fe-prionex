import { useTranslation } from 'react-i18next'

import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { Icons } from '@/lib/icons'
import { formatDate } from '@/lib/localeFormat'
import { formatMoneyUAHTwoDecimals } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { Pii } from '@/lib/openreplay/pii'

export interface CallContract {
  id: string
  number: string
  /** Free-form: the backend records more dispositions than the UI enumerates. */
  status: string
  /**
   * The debt's latest restructuring status, shown beside the contract status.
   * Whatever the system holds — a violated or cancelled restructuring is
   * exactly what an operator wants to know before they start talking.
   */
  marker?: string | null
  counterparty: string
  loanPrincipal: number
  debt: number
  saleDate?: string | null
  lastContact?: string | null
}

export interface CallMatchedClient {
  clientId: number
  clientName: string
  /**
   * Whose number the caller rang in on. Kept separate from `thirdPartyName`
   * because the two are independently absent: the payload can say the number
   * belongs to a third party without the annotation naming who they are, and
   * folding that into one nullable string renders such a caller as the client.
   */
  contactCategory?: CallContactCategory | null
  /** The third party's name, from the number's annotation, when there is one. */
  thirdPartyName?: string | null
  contracts: CallContract[]
}

interface CallClientContractsProps {
  client: CallMatchedClient
  /** Whether the interaction will be written to this client's card. */
  included: boolean
  onIncludedChange: (included: boolean) => void
}

const CLOSED_STATUSES = new Set(['closed', 'paid', 'repaid'])

/** Whose number the caller rang in on, as the screen-pop reports it. */
export type CallContactCategory = 'client' | 'guarantor' | 'third_party' | 'other'

/**
 * How the client's card is introduced.
 *
 * A guarantor and a third party are both somebody other than the debtor, and
 * saying "Client" over either of them invites the operator to discuss the debt
 * with a person not entitled to hear it.
 */
function labelFor(client: CallMatchedClient, t: (key: string, fallback: string) => string): string {
  const category = client.contactCategory
  if (category === null || category === undefined) {
    // Not "Client": the category is absent for a contact type nobody has
    // classified, and claiming the caller is the debtor on that basis is the
    // same mistake as mislabelling a third party. Neutral rather than named,
    // because naming here would also assert which client the caller is when
    // several matched the number.
    return t('pages.clients.modals.callDialog.contracts.unknown', 'Contracts')
  }
  if (category !== 'third_party' && category !== 'guarantor') {
    return t('pages.clients.modals.callDialog.contracts.client', 'Client by contracts')
  }
  const heading =
    category === 'guarantor'
      ? t('pages.clients.modals.callDialog.contracts.guarantor', 'Guarantor by contracts')
      : t('pages.clients.modals.callDialog.contracts.thirdParty', 'Third party by contracts')
  return heading
}

/**
 * One matched client: their header, and their contracts as read-only context.
 *
 * The toggle decides only whether the interaction is written to this client's
 * card. It is not a filter — switching it off changes nothing about what the
 * operator can see or reach, because they still need the contracts to talk
 * about while the caller is on the line.
 */
export function CallClientContracts({
  client,
  included,
  onIncludedChange,
}: CallClientContractsProps) {
  const { t } = useTranslation('common')
  const label = labelFor(client, t)
  /**
   * The third party's name used to be appended to `label` (KAN-KB-54).
   *
   * That string went two places: into this `<span>`, where markup could have
   * covered it, and into `ariaLabel` on the toggle — where markup does nothing,
   * because OpenReplay sends attribute values verbatim outside `privateMode`.
   * So it is kept apart from the heading: the heading stays readable in both,
   * and the name is a node of its own that the markup can reach.
   */
  const thirdPartyName = client.thirdPartyName ?? null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <ToggleSwitch checked={included} onChange={onIncludedChange} ariaLabel={label} />
        <Icons.Info
          size={14}
          className="text-muted-foreground shrink-0"
          strokeWidth={1.5}
          aria-hidden
        />
        <span className="text-foreground truncate text-xs font-medium sm:text-sm">
          {label}
          {thirdPartyName ? (
            <>
              {': '}
              <Pii>{thirdPartyName}</Pii>
            </>
          ) : null}
        </span>
        <a
          href={`/dashboard/clients/${client.clientId}?from=dialer`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-700 ml-auto shrink-0 text-xs font-medium"
        >
          {t('pages.clients.modals.callDialog.contracts.view', 'View')} &gt;
        </a>
      </div>

      {/* Horizontal, because a client can hold more contracts than fit the modal
          and the operator scans them side by side rather than scrolling a list. */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {client.contracts.map((contract) => (
          <ContractCard key={contract.id} contract={contract} />
        ))}
      </div>
    </div>
  )
}

function ContractCard({ contract }: { contract: CallContract }) {
  const { t, i18n } = useTranslation('common')
  const closed = CLOSED_STATUSES.has(contract.status.toLowerCase())
  const asDate = (value?: string | null) => (value ? formatDate(value, i18n.language) : '—')

  return (
    <div className="border-border bg-card flex w-64 shrink-0 flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        {/* The backend records more dispositions than the design shows, and
            they are raw lowercase codes. Reduced to the two states the operator
            acts on rather than printed as-is. */}
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            closed ? 'bg-success-50 text-success-700' : 'bg-error-50 text-error-500'
          )}
        >
          {closed
            ? t('pages.clients.modals.callDialog.contracts.closed', 'Closed')
            : t('pages.clients.modals.callDialog.contracts.open', 'Open')}
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
    </div>
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
