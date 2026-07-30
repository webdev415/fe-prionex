/**
 * KAN-335 — "Detailed calculation for loan No. {id} after sale" modal.
 *
 * A wide (19-column) table showing one row per date on which a balance-changing
 * event occurred, from the loan's date of sale to today. The first column
 * (Date) is sticky; the table scrolls horizontally inside the modal.
 *
 * Data comes from GET /clients/{clientId}/debts/{debtId}/detailed-calculation
 * via useLoanCalculation. All money values are backend-formatted strings.
 */

import { useTranslation } from 'react-i18next'

import { Icons } from '@/lib/icons'
import { formatDate, formatMoneyUAHTwoDecimals } from '@/lib/formatters'
import { Modal, ModalHeader, ModalContent } from '@/components/ui/Modal'
import { useLoanCalculation } from '@/features/clients/hooks/useClients'
import type { LoanCalculationRow } from '@/features/clients/api/types'

interface LoanCalculationModalProps {
  open: boolean
  onClose: () => void
  clientId: number
  debtId: number
  /** Loan contract number for the dynamic title; falls back to the debt id. */
  loanNumber?: string | null
}

// The five accrual blocks, each with its three sub-columns. `debt` is the
// end-of-day balance; `writtenOff` and `paid` are that day's deltas.
const BLOCKS = [
  { key: 'principal', labelKey: 'blocks.principal', fallback: 'Principal' },
  { key: 'interest', labelKey: 'blocks.interest', fallback: 'Interest' },
  { key: 'fine', labelKey: 'blocks.fine', fallback: 'Fine' },
  { key: 'penalty', labelKey: 'blocks.penalty', fallback: 'Penalty' },
  { key: 'commission', labelKey: 'blocks.commission', fallback: 'Commissions' },
] as const

function money(value: string | number | null | undefined): string {
  return formatMoneyUAHTwoDecimals(value ?? 0)
}

export function LoanCalculationModal({
  open,
  onClose,
  clientId,
  debtId,
  loanNumber,
}: LoanCalculationModalProps) {
  const { t } = useTranslation('common')
  const { data, isLoading, isError } = useLoanCalculation(clientId, debtId, open)

  const p = 'pages.clients.detail.loanCalculation'
  const titleId = loanNumber || (debtId ? `${debtId}` : '—')

  // Sticky first column: same classes on <th> and <td> so the Date column
  // stays fixed while the financial blocks scroll horizontally.
  const stickyCell = 'sticky left-0 z-10 bg-card'
  const th = 'whitespace-nowrap px-3 py-2 text-right font-medium text-muted-foreground'
  const thLeft = 'whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground'
  const td = 'whitespace-nowrap px-3 py-1.5 text-right text-foreground tabular-nums'

  return (
    <Modal open={open} onClose={onClose} maxWidth="full" showCloseButton>
      <ModalHeader
        icon={<Icons.Calculate size={20} className="text-primary" />}
        title={t(`${p}.title`, 'Detailed calculation for loan No. {{id}} after sale', {
          id: titleId,
        })}
      />
      <ModalContent>
        {isLoading ? (
          <div className="text-muted-foreground py-10 text-center text-sm">
            {t('common.loading', 'Loading…')}
          </div>
        ) : isError ? (
          <div className="py-10 text-center text-sm text-red-600">
            {t(`${p}.error`, 'Could not load the calculation. Please try again.')}
          </div>
        ) : !data || data.rows.length === 0 ? (
          <div className="text-muted-foreground py-10 text-center text-sm">
            {t(`${p}.empty`, 'No balance changes recorded for this loan.')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1600px] text-xs">
              <thead className="bg-card text-muted-foreground sticky top-0 z-20">
                {/* Group header row */}
                <tr className="border-border border-b">
                  <th rowSpan={2} className={`${stickyCell} ${thLeft} z-30 align-bottom`}>
                    {t(`${p}.columns.date`, 'Date')}
                  </th>
                  <th rowSpan={2} className={`${th} align-bottom`}>
                    {t(`${p}.columns.principalAmount`, 'Principal amount')}
                  </th>
                  {BLOCKS.map((b) => (
                    <th
                      key={b.key}
                      colSpan={3}
                      className="border-border text-foreground border-l px-3 py-2 text-center font-semibold whitespace-nowrap"
                    >
                      {t(`${p}.${b.labelKey}`, b.fallback)}
                    </th>
                  ))}
                  <th rowSpan={2} className={`${th} border-border border-l align-bottom`}>
                    {t(`${p}.columns.totalPaid`, 'Total paid')}
                  </th>
                  <th rowSpan={2} className={`${th} align-bottom`}>
                    {t(`${p}.columns.totToReturn`, 'Tot to return')}
                  </th>
                </tr>
                {/* Sub-header row: Debt / Written-off / Paid per block */}
                <tr className="border-border border-b">
                  {BLOCKS.map((b) => (
                    <BlockSubHeaders key={b.key} thClass={th} p={p} t={t} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, idx) => (
                  <tr
                    key={`${row.date}-${idx}`}
                    className={`border-border border-b ${
                      row.is_sale_row ? 'bg-primary/40 font-medium' : ''
                    }`}
                  >
                    <td
                      className={`${stickyCell} text-foreground px-3 py-1.5 text-left whitespace-nowrap ${
                        row.is_sale_row ? 'bg-primary/40 font-medium' : ''
                      }`}
                    >
                      {formatDate(row.date)}
                    </td>
                    <td className={td}>{money(data.principal_amount)}</td>
                    {BLOCKS.map((b) => (
                      <BlockCells key={b.key} row={row} block={b.key} tdClass={td} />
                    ))}
                    <td className={`${td} border-border border-l`}>{money(row.total_paid)}</td>
                    <td className={`${td} font-medium`}>{money(row.tot_to_return)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ModalContent>
    </Modal>
  )
}

function BlockSubHeaders({
  thClass,
  p,
  t,
}: {
  thClass: string
  p: string
  t: ReturnType<typeof useTranslation>['t']
}) {
  return (
    <>
      <th className={`${thClass} border-border border-l`}>{t(`${p}.columns.debt`, 'Debt')}</th>
      <th className={thClass}>{t(`${p}.columns.writtenOff`, 'Written-off')}</th>
      <th className={thClass}>{t(`${p}.columns.paid`, 'Paid')}</th>
    </>
  )
}

function BlockCells({
  row,
  block,
  tdClass,
}: {
  row: LoanCalculationRow
  block: (typeof BLOCKS)[number]['key']
  tdClass: string
}) {
  // Field names follow `${block}_debt|_written_off|_paid` on the row.
  const debt = row[`${block}_debt` as keyof LoanCalculationRow] as string
  const writtenOff = row[`${block}_written_off` as keyof LoanCalculationRow] as string
  const paid = row[`${block}_paid` as keyof LoanCalculationRow] as string
  return (
    <>
      <td className={`${tdClass} border-border border-l`}>{money(debt)}</td>
      <td className={tdClass}>{money(writtenOff)}</td>
      <td className={tdClass}>{money(paid)}</td>
    </>
  )
}
