import { useTranslation } from 'react-i18next'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip'
import { Icons } from '@/lib/icons'
import { formatNumber } from '@/lib/localeFormat'
import { cn } from '@/lib/utils'
import { formatDate, formatMoneyUAHTwoDecimals } from '@/lib/formatters'
import { saleTypeLabelKey, toSaleType } from '@/features/sellers/saleType'

/**
 * KAN-993 — one loan rendered as a card row (supersedes the KAN-339 grid row).
 *
 * A purchased debt has four content zones in a 2×2 grid — meta | amounts over
 * dates | type — laid out as two wrapping rows of two:
 *   - 1 meta/counterparty   flex 1 1 300px / min 170px   (grid 88px 1fr)
 *   - 2 amounts (3 cols)    flex 1 1 400px / min 342px
 *   - 3 secondary dates     flex 1 1 300px / min 200px   (grid 112px 1fr)
 *   - 4 contract type       flex 1 1 400px / min 200px   (grid 112px 1fr)
 *
 * Both rows give their zones the SAME flex bases, so whenever a row holds two
 * zones they resolve to the same widths and the columns line up; the minimums
 * only differ once a row has wrapped.
 *
 * Those bases are tuned so that at 100% zoom on a full-width panel nothing has
 * to wrap: the widest real counterparty stays on one line, and so does the
 * "including payments" line under the remaining-debt column. Type is 14px for
 * values, 12px for everything else.
 *
 * A credit-module loan (ours, not bought) keeps the first row only — meta and
 * two amounts: it has no purchase dates and no purchase contract to show.
 *
 * The "..." menu is NOT a zone: it is absolutely positioned at the card's
 * top-right, with the rows reserving right padding for it. As a flex item it
 * was the last thing in the row, so a narrow panel pushed it off the card
 * entirely and took every per-loan action with it.
 *
 * Values WRAP rather than overflow: a long counterparty/loan number/label
 * breaks onto another line inside its own cell and the card grows in height.
 * The rows themselves also wrap — when the card is too narrow for two
 * columns, each row drops its right zone under its left one and the card reads
 * as one column (meta, amounts, dates, type) instead of overflowing, so the
 * page never scrolls horizontally (AC #2/#13). Equal bases make both rows
 * break at the same width. The column definitions stay identical on every
 * card, which is what keeps the amounts on one plane and the date values
 * aligned across cards even when a neighbouring cell wraps. Zones are
 * top-aligned so a taller card doesn't shift its amounts block relative to its
 * neighbours.
 *
 * Colored status badges are gone — status is conveyed by which section
 * (Open/Closed) the card sits in. Closed cards are veiled by a translucent
 * overlay that paints ABOVE the static content but BELOW the tooltip layer
 * (TooltipContent is inline at z-50), so hover popovers stay fully legible.
 */

import { buildPrincipalDebtTooltip } from './principalDebtTooltip'

export type LoanCardLoan = {
  id: number
  loanNumber: string
  issueDate: string
  counterparty: string
  saleDate: string
  sellerLegalName: string | null
  factoringAgreementPreviousLender: string | null
  factoringAgreementPurchaseDate: string | null
  /**
   * `null` — только у кредита модуля, чья проекция суммы выдачи не принесла:
   * отсутствие печатается прочерком, а не нулём. Купленный долг несёт число
   * всегда.
   */
  principalAmount: number | null
  principalDebt: number | null
  remainingDebtAmount: number
  totalToReturn: number
  /** KAN-994 — null means no coefficient tooltip for this loan. Amounts are
   *  whole-hryvnia strings and coefficients one-decimal strings, both computed
   *  server-side and rendered as-is. */
  closingCoefficient: {
    min_coefficient: string
    max_coefficient: string
    min_amount: string
    max_amount: string
    debt_age_days: number
  } | null
  creditClosedDate: string | null
  eligibleForReturn: number | null
  creditTermDays: number | null
  status: string
  sentToCreditBureau: boolean
  creditBureauSentDate: string | null
  /** KAN-784 AC2 — fully repaid but short of principal; auto-close blocked. */
  needsManualClosureReview: boolean
  /**
   * Contract type the debt was bought under — the debt's own `sale_type`.
   * Optional for the same reason as the three fields below, and read only
   * through `toSaleType`: absent (server not rolled out yet), `null` or an
   * unknown string all print "—". A credit-module loan never shows it.
   */
  saleType?: string | null
  /**
   * WS-11 (14-7b) — откуда взялась строка. Три поля ниже ОПЦИОНАЛЬНЫ намеренно:
   * у купленного долга их нет и не будет, и их обязательность заставила бы
   * править каждую существующую фабрику строки, включая чужие тесты.
   *
   * `origin === 'credit_module'` — кредит, который выдали МЫ. Карточка ветвится
   * по нему, а не по «значение пустое»: у проекции нет продавца, дат покупки и
   * коридора выкупа, и `Number(x ?? 0)` превратил бы «поля нет» в «₴ 0.00» —
   * утверждение, которое оператор произнесёт человеку вслух.
   */
  origin?: 'factoring' | 'credit_module'
  /** Код валюты строки (`CAD`). У кредита он свой — гривна карточки соврала бы. */
  currency?: string | null
  /** Машинная стадия модуля (`delinquent`); печатается ТОЛЬКО словарём. */
  lifecycleDetail?: string | null
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
  /**
   * WS-11 (14-7b) — разворот карты кредитного модуля, по образцу трёх пропсов
   * РР выше. Ручка отдельная, а не клик по карточке: клик уже занят фокусом
   * (`onClick={onFocus}` ниже), и переиспользовать его значило бы каждый
   * разворот притемнять соседние карточки.
   */
  creditExpanded?: boolean
  /**
   * Отсутствует — значит ручки нет: на стенде с выключенным флагом пометка
   * остаётся, а разворачивать нечего. Пометка и ручка — разные вещи в одном
   * элементе.
   */
  onToggleCredit?: () => void
  /** Карта класса А, рисуемая под карточкой при `creditExpanded`. */
  creditPanel?: React.ReactNode
}

/**
 * Стадия кредита модуля → строка словаря. Известное множество — РЕАЛЬНЫЙ выход
 * модуля, а не словарь статусов фронта (WS-11, 14-7b, Р-FEL1B-13).
 *
 * `lifecycle_detail` дверь client-service принимает свободной строкой, и
 * перечнем его значения не опубликованы нигде. Здесь они записаны по коду
 * модуля (`credit-module crm_projection.py@8ccb0295`: `PROJECTED_STATUS` и
 * `crm_status_of`), и это значения ДВУХ словарей в одном поле: нюанс статуса
 * (`delinquent` … `withdrawn`; `closed`, когда причины закрытия нет) и причина
 * закрытия (`repaid`, `early_settled`). Сторно выдачи приходит словом ЧУЖОЙ
 * стороны — `disbursement_reversed`, — а подпись у него наша:
 * `disbursement_failed`. Прежний отбор по `CREDIT_LOAN_STATUSES` молчал ровно у
 * самых частых закрытий — «погашено» и «погашено досрочно», — а у редкого
 * «списано» говорил, и молчание читалось как «с этим кредитом что-то не так».
 *
 * Новых ключей нет: каждый адрес — существующая строка словаря. Значение вне
 * таблицы не печатается вовсе — машинное слово на экране оператора есть утечка
 * внутреннего словаря, а не подпись. `Map`, а не объект: у объекта «известными»
 * оказались бы и имена его прототипа (`constructor`).
 */
const LIFECYCLE_DETAIL_KEY: ReadonlyMap<string, string> = new Map([
  ['delinquent', 'credit.loanStatus.delinquent'],
  ['forbearance', 'credit.loanStatus.forbearance'],
  ['protected', 'credit.loanStatus.protected'],
  ['charged_off', 'credit.loanStatus.charged_off'],
  ['written_off', 'credit.loanStatus.written_off'],
  ['cancelled', 'credit.loanStatus.cancelled'],
  ['withdrawn', 'credit.loanStatus.withdrawn'],
  ['closed', 'credit.loanStatus.closed'],
  ['disbursement_reversed', 'credit.loanStatus.disbursement_failed'],
  ['repaid', 'credit.closeReason.repaid'],
  ['early_settled', 'credit.closeReason.early_settled'],
])

const RR_TONE: Record<NonNullable<LoanCardProps['rrStatus']>['tone'], string> = {
  active: 'bg-green-100 text-green-800',
  violated: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-red-100 text-red-800',
  default: 'bg-muted text-muted-foreground',
}

/** Zone 1 line — mockup `.loan-meta-line`: grid 96px | 1fr, baseline-aligned. */
function MetaLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] items-baseline gap-x-2">
      <span className="text-muted-foreground text-[12px]">{label}</span>
      <span className="min-w-0">{children}</span>
    </div>
  )
}

/** Zone 3 row — grid 112px | 1fr. The label column width is FIXED so values
 * line up vertically across rows regardless of label length (AC #3). The label
 * wraps if it must; the value does not — these are dates and day counts, and
 * `break-words` happily splits "31-07-2018" at its hyphens. The zone's
 * min-width below reserves enough room for the value instead. */
function SecRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[112px_minmax(0,1fr)] items-baseline gap-x-1.5">
      <span className="text-muted-foreground text-[12px] break-words">{label}</span>
      <span className="text-foreground text-[12px] whitespace-nowrap">{value}</span>
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
        'text-foreground block text-[14px] font-bold whitespace-nowrap tabular-nums',
        valueTooltip != null &&
          'border-muted-foreground/40 w-fit cursor-help border-b border-dashed'
      )}
    >
      {value}
    </span>
  )
  return (
    <div className="min-w-0">
      <span className="text-muted-foreground mb-[3px] block text-[12px] break-words">{label}</span>
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
        <span className="text-muted-foreground mt-px block text-[12px] break-words">
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
  creditExpanded = false,
  onToggleCredit,
  creditPanel,
}: LoanCardProps) {
  const { t, i18n } = useTranslation('common')
  // 🔴 Кредит, выданный НАМИ, — не предмет взыскания: им владеет кредитный
  // модуль, и вторая отправка в бюро была бы повторной передачей чужой записи.
  // Пунктов меню у такой строки НОЛЬ — не «неактивный пункт»: неактивный
  // остаётся пунктом, попадает в `queryAllByRole('menuitem')`, читается
  // скринридером как действие и однажды будет «временно включён». Вместо
  // пунктов — неинтерактивная подпись, объясняющая, где действия живут.
  const isCreditModule = loan.origin === 'credit_module'
  const visibleActions = isCreditModule ? [] : actions.filter((a) => !a.hidden)
  const actionsHint = t(
    'pages.clients.detail.creditModuleActionsHint',
    'Actions live in the credit module'
  )
  /**
   * Деньги кредитной строки — числом по локали плюс КОД валюты проекции.
   *
   * Общий `formatMoneyUAHTwoDecimals` здесь не годится: он печатает `₴`
   * жёстко (четыре возврата подряд), а живой кредит приходит в `CAD` —
   * «₴ 456.00» было бы ложью о деньгах, произнесённой клиенту вслух.
   * `formatCreditMoney` тоже не годится, по обратной причине: он делит на 100
   * (суммы модуля — в minor units), а проекция `debts` приходит в major —
   * получилось бы «4,56 CAD»: код валюты верен, сумма занижена в сто раз.
   * Валюты нет вовсе — печатается одно число: выдумывать символ нельзя.
   *
   * Разряды `Intl` сам связывает неразрывным пробелом, поэтому замены пробелов,
   * как у `money()` ниже, здесь нет: общий форматтер группирует обычными.
   */
  const rowMoney = (v: number | null | undefined) => {
    if (v == null) return '—'
    const value = formatNumber(v, i18n.language, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    // Нечисловой вход `formatNumber` отдаёт своим плейсхолдером «—»
    // (`INVALID_PLACEHOLDER`, `src/lib/localeFormat.ts:18`; наружу константа не
    // экспортируется), и код валюты к нему не клеится: «— CAD» читается как
    // сумма в долларах, а значения нет.
    if (value === '—') return value
    return loan.currency ? `${value} ${loan.currency}` : value
  }
  // Стадия модуля печатается ТОЛЬКО переведённой и только из известного
  // множества (`LIFECYCLE_DETAIL_KEY`). Проверка идёт по таблице значений, а не
  // через `i18n.exists`: под тестовым моком словаря тот вернул бы сам ключ.
  const lifecycleKey =
    loan.lifecycleDetail != null ? LIFECYCLE_DETAIL_KEY.get(loan.lifecycleDetail) : undefined
  // Zone 4 and the purchase-date label follow the contract type. The label may
  // name the factoring agreement only on a factoring debt (a cession debt must
  // not read as one). It names an agreement only when there is an agreement
  // date to show: a debt without one (its type derived from its own date)
  // would read "by the assignment agreement: —", and without a known type it
  // names no agreement at all.
  const saleType = toSaleType(loan.saleType)
  const saleTypeKey = saleTypeLabelKey(saleType)
  const agreementSaleType = loan.factoringAgreementPurchaseDate ? saleType : null
  const purchaseDateLabel =
    agreementSaleType === 'factoring'
      ? t('pages.clients.detail.tableHeaders.purchaseDateFa', 'Purchase date (FA)')
      : agreementSaleType === 'cession'
        ? t('pages.clients.detail.tableHeaders.purchaseDateCession', 'Purchase date (assignment)')
        : t('pages.clients.detail.tableHeaders.purchaseDateGeneric', 'Purchase date')

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

  // Only the coefficient line, and only when one applies — AC: hovering
  // Principal debt with no principal debt or no matching range shows no
  // tooltip at all. undefined (not an empty node) so AmountCell drops the
  // tooltip wrapper and its `.has-tip` affordance with it.
  //
  // NOTE: this means KAN-993's "principal less repaid less written off"
  // explanation no longer appears anywhere in the UI.
  //
  // nowrap because the requirement specifies a single line; without it the
  // break lands mid-range ("8 485 -" / "13 114").
  const principalDebtTooltip = loan.closingCoefficient ? (
    <span className="block whitespace-nowrap">
      {buildPrincipalDebtTooltip(loan.closingCoefficient, t)}
    </span>
  ) : undefined

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

      {/* "..." actions menu — not a zone. Absolutely positioned rather than a
          flex item so it can never be pushed off a narrow card; the rows below
          reserve `pr` for it. No z-index: on a closed card it sits under the
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
            {/* Кнопка-триггер «…» остаётся и у кредитной строки: её отсутствие
                на одной карточке из ряда читается как поломка там, где её нет.
                А внутри — подпись вместо пунктов: ответ стоит там, где его
                ищут, и при этом не заводит ни одного действия. */}
            {isCreditModule ? (
              <DropdownMenuLabel className="text-muted-foreground font-normal">
                {actionsHint}
              </DropdownMenuLabel>
            ) : (
              visibleActions.map((a) => (
                <DropdownMenuItem
                  key={a.key}
                  disabled={a.disabled}
                  onSelect={a.onSelect}
                  className={cn(a.danger && 'text-destructive focus:text-destructive')}
                >
                  {a.icon}
                  {a.label}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* `.loan-row`, first row of the grid: zones top-aligned so wrapping in
          one cell doesn't shift a neighbour's vertical position (AC #3).
          `flex-wrap` is the overflow escape hatch — the amounts drop under the
          meta rather than pushing content past the card edge. The bottom
          padding shrinks to the zone gap when the second row follows. */}
      <div
        className={cn(
          'relative flex min-w-0 flex-wrap items-start gap-2.5 pt-3.5 pr-[52px] pl-[18px]',
          isCreditModule ? 'pb-3.5' : 'pb-2.5'
        )}
      >
        {/* Zone 1 — meta / counterparty. Basis is sized so a long counterparty
            ("Егроши (НП) - Финбуст (ЕГ-ФБ)", ~212px at 14px bold) stays on one
            line at 100% zoom; it still wraps rather than overflows if squeezed. */}
        <div className="flex min-w-[170px] flex-[1_1_300px] flex-col gap-1">
          <MetaLine label={t('pages.clients.detail.tableHeaders.loanNumber')}>
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-foreground min-w-0 text-[14px] font-bold break-words">
                № {loan.loanNumber}
              </span>
              {/* Пометка «кредит (наш)» — она же ручка разворота, по образцу
                  чипа РР ниже. Слово «Кредит» в этой карточке уже занято
                  КУПЛЕННЫМ долгом (пять ключей словаря той же страницы), и две
                  одинаковые подписи о разных деньгах на одном экране — ровно
                  то, от чего пометка должна защитить. */}
              {isCreditModule &&
                (onToggleCredit ? (
                  <button
                    type="button"
                    title={actionsHint}
                    // Без остановки всплытия клик по чипу переключил бы ФОКУС
                    // карточки (`onClick={onFocus}` на корне) и притемнил
                    // соседние карточки на каждом развороте.
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleCredit()
                    }}
                    className="inline-flex shrink-0 items-center gap-1 rounded bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800"
                  >
                    {t('pages.clients.detail.creditModuleTag', 'own credit')}
                    <Icons.ArrowDown
                      size={14}
                      className={cn('transition-transform', creditExpanded && 'rotate-180')}
                    />
                  </button>
                ) : (
                  // Флаг стенда выключен: пометка остаётся, разворачивать
                  // нечего. Принадлежность долга от переменной сборки не
                  // зависит, а карта — зависит.
                  <span
                    title={actionsHint}
                    className="inline-flex shrink-0 items-center rounded bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800"
                  >
                    {t('pages.clients.detail.creditModuleTag', 'own credit')}
                  </span>
                ))}
              {/* 🔴 РР у кредита модуля заперт СТРУКТУРНО, а не данными: страница
                  считает `hasRr` одинаково для всех строк, а сервер при создании
                  соглашения происхождение долга не проверяет. Реструктуризация —
                  действие взыскания по долгу, которым CRM не владеет, поэтому
                  чип, статус и панель РР ветвятся по `origin` — как меню и
                  суммы выше. */}
              {!isCreditModule && hasRr && (
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
              {!isCreditModule && hasRr && rrStatus && (
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

          {/* Стадия модуля вместо даты продажи и продавца: у своего кредита
              продавца нет ПО ОПРЕДЕЛЕНИЮ, а пустая строка с тултипом
              «Первинний кредитор» читалась бы как потерянные данные. */}
          {isCreditModule && lifecycleKey && (
            <MetaLine label={t('credit.clientBlock.status', 'Status')}>
              <span className="text-foreground text-[14px] font-bold break-words">
                {t(lifecycleKey)}
              </span>
            </MetaLine>
          )}

          {!isCreditModule && (
            <>
              <MetaLine label={t('pages.clients.detail.tableHeaders.saleDate')}>
                <span className="text-foreground text-[14px] font-bold break-words">
                  {loan.saleDate}
                  {isClosed && loan.creditClosedDate && (
                    <span className="text-muted-foreground ml-2 text-[12px] font-normal">
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
                      <span className="decoration-muted-foreground/60 text-foreground cursor-help text-[14px] font-bold break-words underline decoration-dotted underline-offset-4">
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
            </>
          )}
        </div>

        {/* Zone 2 — amounts. Columns are identical on every card, so the
            amounts stay on one plane (AC #3) — the requirement asks for that
            alignment "without fixing exact column widths", so these are
            minmax(): they hold a common amount at the floor and grow with the
            card, keeping large values on one line whenever there is room.
            min-width matches the true content width (88+88+120 + 32 gap + 16
            padding = 344) so the grid can never overflow its flex box. On a
            purchased debt it is the grid's right column, so only its left edge
            borders anything, and zone 4 below repeats that edge as the divider;
            the credit-module row keeps its original two borders. */}
        {/* 🔴 У кредитной строки рисуются ДВЕ суммы из трёх, а не три с нулями.
            «Основний борг» проекция не несёт вовсе, и `money(null)` напечатал
            бы «—», а `Number(x ?? 0)` — «₴ 0.00»: ноль на экране есть ФАКТ
            («основного боргу нема»), который оператор произнесёт человеку.
            Ветвление идёт по `origin`, а не по «значение пустое»: у проекции
            `totalToReturn` равен нулю, и общий путь включил бы ветку
            `hasPayments` с подписью «Including payments: ₴ 0.00». */}
        {isCreditModule ? (
          <div className="border-border grid min-w-[342px] flex-[1_1_400px] grid-cols-[minmax(80px,1fr)_minmax(150px,1.8fr)] items-start gap-x-2 gap-y-[3px] border-x pr-1 pl-3">
            <AmountCell
              label={t('pages.clients.detail.tableHeaders.loanAmount', 'Loan amount')}
              value={rowMoney(loan.principalAmount)}
            />
            <AmountCell
              label={t('pages.clients.detail.tableHeaders.remainingDebtAmount', 'Remaining debt')}
              value={rowMoney(loan.remainingDebtAmount)}
            />
          </div>
        ) : (
          <div className="border-border grid min-w-[342px] flex-[1_1_400px] grid-cols-[minmax(80px,1fr)_minmax(80px,1fr)_minmax(150px,1.8fr)] items-start gap-x-2 gap-y-[3px] border-l pr-1 pl-3">
            <AmountCell
              label={t('pages.clients.detail.tableHeaders.loanAmount', 'Loan amount')}
              value={money(loan.principalAmount)}
            />
            <AmountCell
              label={t('pages.clients.detail.tableHeaders.principalDebt')}
              value={money(loan.principalDebt)}
              valueTooltip={principalDebtTooltip}
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
                        {t(
                          'pages.clients.detail.remainingDebtPlain',
                          'Remaining debt: {{amount}}',
                          {
                            amount: money(loan.remainingDebtAmount),
                          }
                        )}
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
        )}
      </div>

      {/* Second row of the grid — dates | contract type, on the same bases as
          the first row so the columns line up.

          У кредитной строки ряда нет вовсе: ни даты выдачи в форме карточки,
          ни даты покупки, ни срока долга, ни договора покупки у проекции нет,
          и прочерки подряд читались бы как «данные потерялись». Даты кредита
          живут в развёрнутой карте, а сам он уже помечен «кредит (наш)». */}
      {!isCreditModule && (
        <div className="relative flex min-w-0 flex-wrap items-start gap-2.5 pr-[52px] pb-3.5 pl-[18px]">
          {/* Zone 3 — secondary dates. min-width = 112px label col (fixed, so
              values align vertically — AC #3) + 6px gap + ~65px for the widest
              value ("31-07-2018"), rounded up, so a date never has to break. */}
          <div className="flex min-w-[200px] flex-[1_1_300px] flex-col gap-1">
            <SecRow
              label={t('pages.clients.detail.tableHeaders.issueDate')}
              value={loan.issueDate}
            />
            <SecRow label={purchaseDateLabel} value={loan.factoringAgreementPurchaseDate ?? '—'} />
            <SecRow
              label={t('pages.clients.detail.tableHeaders.debtTerm', 'Debt term')}
              value={
                loan.creditTermDays != null
                  ? t('pages.clients.detail.days', '{{days}} days', { days: loan.creditTermDays })
                  : '—'
              }
            />
          </div>

          {/* Zone 4 — contract type, bottom right. Always present on a purchased
              debt: "—" when the type is unknown, never an empty corner. */}
          <div className="border-border flex min-w-[200px] flex-[1_1_400px] flex-col gap-1 border-l pr-1 pl-3">
            <SecRow
              label={t('saleType.label', 'Contract type')}
              value={saleTypeKey ? t(saleTypeKey) : '—'}
            />
          </div>
        </div>
      )}

      {/* RR panel — collapsed by default, expands on chip click (AC #6).
          У кредита модуля её нет никогда — см. чип РР выше. */}
      {!isCreditModule && hasRr && rrExpanded && rrPanel && (
        <div className="relative border-t px-[18px] py-3.5">{rrPanel}</div>
      )}

      {/* Карта кредитного модуля — та же форма, что панель РР. Монтируется
          ТОЛЬКО развёрнутой: спрятанная стилями, она отправила бы запрос в
          модуль при открытии вкладки «Позики» у каждого клиента. */}
      {isCreditModule && creditExpanded && creditPanel && (
        <div className="relative border-t px-[18px] py-3.5">{creditPanel}</div>
      )}
    </div>
  )
}
