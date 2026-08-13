import { useTranslation } from 'react-i18next'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { formatDate, formatMoneyUAHTwoDecimals } from '@/lib/formatters'

/**
 * KAN-993 — one loan rendered as a card row (supersedes the KAN-339 grid row).
 *
 * Three content zones flex between min-widths, so the blocks compress toward
 * their minimums as the card narrows:
 *   - meta/counterparty   flex 1 1 240px / min 170px   (grid 96px 1fr)
 *   - amounts (3 cols)    flex 1 1 400px / min 344px
 *   - secondary dates     flex 1 0 205px / min 205px   (grid 118px 1fr)
 *
 * The "..." menu is NOT a fourth flex item: it is absolutely positioned at the
 * card's top-right, with the row reserving right padding for it. As a flex
 * item it was the last thing in the row, so a narrow panel pushed it off the
 * card entirely and took every per-loan action with it.
 *
 * Values WRAP rather than overflow: a long counterparty/loan number/label
 * breaks onto another line inside its own cell and the card grows in height.
 * The row itself also wraps — when the panel is too narrow for all three
 * zones, the dates block drops to a second line instead of overflowing, so
 * the page never scrolls horizontally (AC #2/#13). The column definitions
 * stay identical on every card, which is what keeps the amounts on one plane
 * and the date values aligned across cards even when a neighbouring cell
 * wraps. Zones are top-aligned so a taller card doesn't shift its amounts
 * block relative to its neighbours.
 *
 * Colored status badges are gone — status is conveyed by which section
 * (Open/Closed) the card sits in. Closed cards are veiled by a translucent
 * overlay that paints ABOVE the static content but BELOW the tooltip layer
 * (TooltipContent is inline at z-50), so hover popovers stay fully legible.
 */

export type LoanCardLoan = {
  id: number
  loanNumber: string
  issueDate: string
  counterparty: string
  saleDate: string
  sellerLegalName: string | null
  factoringAgreementPreviousLender: string | null
  factoringAgreementPurchaseDate: string | null
  principalAmount: number
  principalDebt: number | null
  remainingDebtAmount: number
  totalToReturn: number
  creditClosedDate: string | null
  eligibleForReturn: number | null
  creditTermDays: number | null
  status: string
  sentToCreditBureau: boolean
  creditBureauSentDate: string | null
  /** KAN-784 AC2 — fully repaid but short of principal; auto-close blocked. */
  needsManualClosureReview: boolean
}

export type LoanCardAction = {
  key: string
  label: string
  icon?: React.ReactNode
  onSelect: () => void
  hidden?: boolean
  disabled?: boolean
  danger?: boolean
}

type LoanCardProps = {
  loan: LoanCardLoan
  /** Whether this loan currently sits in the Closed section. */
  isClosed: boolean
  /** Whether this loan carries a restructuring agreement (shows the RR chip). */
  hasRr: boolean
  /** RR agreement status label + tone, when hasRr. */
  rrStatus?: { label: string; tone: 'active' | 'violated' | 'cancelled' | 'default' }
  /** Whether the RR panel is expanded (chip chevron state). */
  rrExpanded: boolean
  onToggleRr: () => void
  /** RR detail panel node, rendered below the card when rrExpanded. */
  rrPanel?: React.ReactNode
  /** Card focus: highlighted border + dims the others. */
  focused: boolean
  /** Another card is focused, so this one is dimmed for comparison (AC #8). */
  dimmed?: boolean
  onFocus: () => void
  /** Status-dependent action entries for the "..." dropdown. */
  actions: LoanCardAction[]
}

const RR_TONE: Record<NonNullable<LoanCardProps['rrStatus']>['tone'], string> = {
  active: 'bg-green-100 text-green-800',
  violated: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-red-100 text-red-800',
  default: 'bg-muted text-muted-foreground',
}

/** Zone 1 line — mockup `.loan-meta-line`: grid 96px | 1fr, baseline-aligned. */
function MetaLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] items-baseline gap-x-2">
      <span className="text-muted-foreground text-[12.5px]">{label}</span>
      <span className="min-w-0">{children}</span>
    </div>
  )
}

/** Zone 3 row — grid 118px | 1fr. The label column width is FIXED so values
 * line up vertically across rows regardless of label length (AC #3). The label
 * wraps if it must; the value does not — these are dates and day counts, and
 * `break-words` happily splits "31-07-2018" at its hyphens. The zone's
 * min-width below reserves enough room for the value instead. */
function SecRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[118px_minmax(0,1fr)] items-baseline gap-x-1.5">
      <span className="text-muted-foreground text-[12.5px] break-words">{label}</span>
      <span className="text-foreground text-[12.5px] whitespace-nowrap">{value}</span>
    </div>
  )
}

/** Zone 2 cell — mockup: label (`.loan-lbl`) stacked above a nowrap value.
 * When `valueTooltip` is set the value gets the mockup's `.has-tip` affordance
 * (dashed underline + help cursor) and reveals the breakdown on hover. */
function AmountCell({
  label,
  value,
  secondary,
  valueTooltip,
}: {
  label: React.ReactNode
  value: React.ReactNode
  secondary?: React.ReactNode
  valueTooltip?: React.ReactNode
}) {
  // Money keeps `whitespace-nowrap`: the formatter groups thousands with plain
  // spaces ("₴ 10 136.00"), so letting it wrap splits a number across lines.
  // The label and secondary line wrap instead, and the columns below are sized
  // to fit a realistic amount.
  const valueEl = (
    <span
      className={cn(
        'text-foreground block text-[15px] font-bold whitespace-nowrap tabular-nums',
        valueTooltip != null &&
          'border-muted-foreground/40 w-fit cursor-help border-b border-dashed'
      )}
    >
      {value}
    </span>
  )
  return (
    <div className="min-w-0">
      <span className="text-muted-foreground mb-[3px] block text-[12.5px] break-words">
        {label}
      </span>
      {valueTooltip != null ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{valueEl}</TooltipTrigger>
            <TooltipContent>{valueTooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        valueEl
      )}
      {secondary != null && (
        <span className="text-muted-foreground mt-px block text-[13px] break-words">
          {secondary}
        </span>
      )}
    </div>
  )
}

export function LoanCard({
  loan,
  isClosed,
  hasRr,
  rrStatus,
  rrExpanded,
  onToggleRr,
  rrPanel,
  focused,
  dimmed = false,
  onFocus,
  actions,
}: LoanCardProps) {
  const { t } = useTranslation('common')
  const visibleActions = actions.filter((a) => !a.hidden)

  // The formatter groups thousands with plain spaces ("₴ 61 502.86"), so any
  // wrapping context can split a number across lines. Binding those spaces
  // keeps the amount whole wherever it lands — including inside sentence-shaped
  // strings like "Including payments: …", which must still wrap as a sentence.
  const money = (v: number | null | undefined) =>
    v == null ? '—' : formatMoneyUAHTwoDecimals(v).replace(/ /g, ' ')
  // legacy_f53 is populated on ~47% of debts but equals remaining_debt_amount
  // on ~40% of ALL debts, so "present" is a poor test: it would stamp "(Lawful)"
  // over a number identical to the plain remaining debt on ~198k rows. Keep the
  // pre-redesign column rule instead — surface the lawful figure only when it
  // actually diverges, which is what "where applicable" means in the spec.
  const isLawful =
    loan.eligibleForReturn != null && loan.eligibleForReturn !== loan.remainingDebtAmount
  // Only describe the payments split when payments actually moved the number;
  // otherwise the breakdown reads "X (X − ₴ 0.00)", which is noise.
  const hasPayments = loan.totalToReturn !== loan.remainingDebtAmount

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'bg-card relative rounded-xl border transition-[color,background-color,border-color,opacity]',
        focused ? 'border-information-400 ring-information-400 ring-1' : 'border-border',
        // AC #8: focusing one card dims the rest for comparison.
        dimmed && 'opacity-[0.42] hover:opacity-70'
      )}
      onClick={onFocus}
      onKeyDown={(e) => {
        // Only focus when the keypress lands on the card itself, not on an
        // inner control (button/link) that bubbled up.
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onFocus()
        }
      }}
    >
      {/* Closed dimming (AC #7): the veil paints ABOVE the static content and
          BELOW the tooltip layer. TooltipContent is inline at z-50, so it must
          stay in this same stacking context — that is why the content wrapper
          below carries no z-index of its own: giving it one would trap the
          tooltip underneath the veil. The "..." menu portals out entirely.
          A focused card is never veiled (mockup `.focused::after{opacity:0}`). */}
      {isClosed && !focused && (
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0 z-20 rounded-xl',
            dimmed ? 'bg-card/80' : 'bg-card/60'
          )}
        />
      )}

      {/* Zone 4 — "..." actions menu. Absolutely positioned rather than a flex
          item so it can never be pushed off a narrow card; the row below
          reserves `pr` for it. No z-index: on a closed card it sits under the
          veil like the rest of the content, and the veil is pointer-events-none
          so the trigger stays clickable. */}
      {/* z-10 is required, not decorative: the row below is `relative` and comes
          later in DOM order, so without it the row paints over this button and
          eats the clicks. Stays under the z-20 closed-card veil. */}
      <div className="absolute top-3.5 right-[18px] z-10 flex items-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t('pages.clients.detail.moreActions', 'More actions')}
              // Opening the menu must not also toggle card focus/dimming.
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:bg-muted flex h-8 w-8 items-center justify-center rounded"
            >
              <Icons.MoreVertical size={20} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {visibleActions.map((a) => (
              <DropdownMenuItem
                key={a.key}
                disabled={a.disabled}
                onSelect={a.onSelect}
                className={cn(a.danger && 'text-destructive focus:text-destructive')}
              >
                {a.icon}
                {a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* `.loan-row`: zones top-aligned so wrapping in one cell doesn't shift
          a neighbour's vertical position (AC #3). `flex-wrap` is the overflow
          escape hatch — the dates block drops to its own line rather than
          pushing content past the card edge. */}
      <div className="relative flex min-w-0 flex-wrap items-start gap-2.5 py-3.5 pr-[52px] pl-[18px]">
        {/* Zone 1 — meta / counterparty (flex 1 1 240px, min 170px) */}
        <div className="flex min-w-[170px] flex-[1_1_240px] flex-col gap-1">
          <MetaLine label={t('pages.clients.detail.tableHeaders.loanNumber')}>
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-foreground min-w-0 text-[15px] font-bold break-words">
                № {loan.loanNumber}
              </span>
              {hasRr && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleRr()
                  }}
                  className="inline-flex shrink-0 items-center gap-1 rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800"
                >
                  {t('pages.clients.detail.rrTag', 'RR')}
                  <Icons.ArrowDown
                    size={14}
                    className={cn('transition-transform', rrExpanded && 'rotate-180')}
                  />
                </button>
              )}
              {hasRr && rrStatus && (
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
                    RR_TONE[rrStatus.tone]
                  )}
                >
                  {rrStatus.label}
                </span>
              )}
              {/* KAN-784 AC2 — carried over from the removed "Total to return"
                  column; the redesign only drops the status badges and the
                  bulk-action panel, not this. */}
              {loan.needsManualClosureReview && (
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                  title={t(
                    'pages.clients.detail.needsManualClosureReviewTooltip',
                    'Fully repaid, but payments to us fell short of the principal. Auto-close is blocked — review and close manually.'
                  )}
                >
                  <Icons.Warning size={12} strokeWidth={2} />
                  {t(
                    'pages.clients.detail.needsManualClosureReview',
                    'Needs manual closure review'
                  )}
                </span>
              )}
            </span>
          </MetaLine>

          <MetaLine label={t('pages.clients.detail.tableHeaders.saleDate')}>
            <span className="text-foreground text-[15px] font-bold break-words">
              {loan.saleDate}
              {isClosed && loan.creditClosedDate && (
                <span className="text-muted-foreground ml-2 text-[12.5px] font-normal">
                  (
                  {t('pages.clients.detail.closedInline', 'Closed: {{date}}', {
                    // Raw ISO in the model — the edit-closure action parses it.
                    // Display must be DD-MM-YYYY (AC #2), so format here.
                    date: formatDate(loan.creditClosedDate),
                  })}
                  )
                </span>
              )}
            </span>
          </MetaLine>

          <MetaLine label={t('pages.clients.detail.tableHeaders.counterparty')}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="decoration-muted-foreground/60 text-foreground cursor-help text-[15px] font-bold break-words underline decoration-dotted underline-offset-4">
                    {loan.counterparty}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="flex flex-col gap-1 text-xs">
                    <span>
                      {t('pages.clients.detail.primaryCreditor', 'Primary creditor')}:{' '}
                      {loan.sellerLegalName ?? '—'}
                    </span>
                    <span>
                      {t('pages.clients.detail.previousCreditor', 'Previous creditor')}:{' '}
                      {loan.factoringAgreementPreviousLender ?? '—'}
                    </span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </MetaLine>
        </div>

        {/* Zone 2 — amounts. Columns are identical on every card, so the
            amounts stay on one plane (AC #3) — the requirement asks for that
            alignment "without fixing exact column widths", so these are
            minmax(): they hold a common amount at the floor and grow with the
            card, keeping large values on one line whenever there is room.
            min-width matches the true content width (88+88+120 + 32 gap + 16
            padding = 344) so the grid can never overflow its flex box. */}
        <div className="border-border grid min-w-[344px] flex-[1_1_400px] grid-cols-[minmax(88px,1fr)_minmax(88px,1fr)_minmax(120px,1.4fr)] items-start gap-x-4 gap-y-[3px] border-x pr-1 pl-3">
          <AmountCell
            label={t('pages.clients.detail.tableHeaders.loanAmount', 'Loan amount')}
            value={money(loan.principalAmount)}
          />
          <AmountCell
            label={t('pages.clients.detail.tableHeaders.principalDebt')}
            value={money(loan.principalDebt)}
            valueTooltip={t(
              'pages.clients.detail.principalDebtTooltip',
              'Principal amount less principal repaid and principal written off. For loans carried over from the old CRM, the amount issued is shown instead.'
            )}
          />
          <AmountCell
            label={
              isLawful
                ? t(
                    'pages.clients.detail.tableHeaders.remainingDebtLawful',
                    'Remaining debt (Lawful)'
                  )
                : t('pages.clients.detail.tableHeaders.remainingDebtAmount', 'Remaining debt')
            }
            // Header says "(Lawful)" → the value must be that field.
            value={money(isLawful ? loan.eligibleForReturn : loan.remainingDebtAmount)}
            // Both facts can matter at once: the plain remaining debt (when the
            // lawful figure differs from it) and the payments-adjusted total.
            // Neither may push the other out.
            secondary={
              isLawful || hasPayments ? (
                <>
                  {isLawful && (
                    <span className="block">
                      {t('pages.clients.detail.remainingDebtPlain', 'Remaining debt: {{amount}}', {
                        amount: money(loan.remainingDebtAmount),
                      })}
                    </span>
                  )}
                  {hasPayments && (
                    <span className="block">
                      {t(
                        'pages.clients.detail.includingPayments',
                        'Including payments: {{amount}}',
                        { amount: money(loan.totalToReturn) }
                      )}
                    </span>
                  )}
                </>
              ) : undefined
            }
            // The copy names "Remaining debt" explicitly, so it stays accurate
            // even when the displayed value is the lawful figure.
            valueTooltip={
              hasPayments
                ? t(
                    'pages.clients.detail.remainingDebtTooltip',
                    'Remaining debt including payments: {{total}} ({{remaining}} − {{payments}})',
                    {
                      total: money(loan.totalToReturn),
                      remaining: money(loan.remainingDebtAmount),
                      payments: money(loan.remainingDebtAmount - loan.totalToReturn),
                    }
                  )
                : undefined
            }
          />
        </div>

        {/* Zone 3 — secondary dates. min-width = 118px label col (fixed, so
            values align vertically — AC #3) + 6px gap + ~65px for the widest
            value ("31-07-2018") + 16px padding, so a date never has to break.
            When the row runs out of room this block wraps to its own line
            rather than forcing the card wider. */}
        <div className="flex min-w-[205px] flex-[1_0_205px] flex-col gap-1 px-2">
          <SecRow label={t('pages.clients.detail.tableHeaders.issueDate')} value={loan.issueDate} />
          <SecRow
            label={t('pages.clients.detail.tableHeaders.purchaseDateFa', 'Purchase date (FA)')}
            value={loan.factoringAgreementPurchaseDate ?? '—'}
          />
          <SecRow
            label={t('pages.clients.detail.tableHeaders.debtTerm', 'Debt term')}
            value={
              loan.creditTermDays != null
                ? t('pages.clients.detail.days', '{{days}} days', { days: loan.creditTermDays })
                : '—'
            }
          />
        </div>
      </div>

      {/* RR panel — collapsed by default, expands on chip click (AC #6). */}
      {hasRr && rrExpanded && rrPanel && (
        <div className="relative border-t px-[18px] py-3.5">{rrPanel}</div>
      )}
    </div>
  )
}
