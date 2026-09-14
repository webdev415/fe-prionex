/**
 * Turns saved preset parameters into the concrete `ClientFilters` the client
 * list already understands (#1100).
 *
 * This is the only place that knows both shapes, and the only place relative
 * parameters become values. Keeping it pure — the clock and the employee
 * directory arrive as arguments — is what makes the recompute-at-apply-time
 * rules testable without freezing time or standing up a directory.
 *
 * Empty parameters produce absent fields rather than empty ones: the ticket
 * requires that a preset's blank fields are not applied as filters, and the
 * client list treats `undefined` and `[]` differently in its query string.
 */

import { formatPickerDateAsYMD } from '@/lib/dateUtils'
import type { ClientFilters } from '@/pages/ClientManagement/ClientManagementPage'

import {
  type ClientFilterPresetParams,
  type DateRangeParam,
  type DateSide,
  type EmployeeScopeParam,
  type NumericRange,
  type RelativeEmployeeScope,
} from '../types'

export interface PresetResolutionContext {
  /** Injected so "today" is a decision of the caller, not of this module. */
  now: Date
  /**
   * Resolves a relative scope to the employee ids it means *right now*.
   * Membership changes between saving and applying a preset must be picked up,
   * which is exactly why this is a callback rather than a captured list.
   */
  resolveEmployeeScope: (scope: RelativeEmployeeScope) => number[]
}

/**
 * Local-time `YYYY-MM-DD`. The same helper the filter bar formats its pickers
 * with, so a resolved bound and a hand-picked one are byte-identical.
 */
const toYMD = formatPickerDateAsYMD

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/**
 * One side of a date range. `undefined` means "this side sets no bound", which
 * is what the client list expects for an unset date.
 */
export function resolveDateSide(side: DateSide | undefined, now: Date): string | undefined {
  if (!side) return undefined
  switch (side.mode) {
    case 'any':
      return undefined
    case 'today':
      return toYMD(now)
    case 'startOfMonth':
      return toYMD(new Date(now.getFullYear(), now.getMonth(), 1))
    case 'minusDays':
      return toYMD(addDays(now, -(side.days ?? 0)))
    case 'plusDays':
      return toYMD(addDays(now, side.days ?? 0))
    case 'custom':
      // A custom mode with no date set is still "no bound" — the operator
      // picked the mode but never filled it in.
      return side.date || undefined
  }
}

function resolveDateRange(
  range: DateRangeParam | undefined,
  now: Date
): { from?: string; to?: string } {
  return {
    from: resolveDateSide(range?.from, now),
    to: resolveDateSide(range?.to, now),
  }
}

/**
 * An employee scope becomes a concrete id list. `any` yields undefined (no
 * filter); `custom` returns exactly what was saved; everything else is asked
 * of the caller so it reflects the directory as it stands now.
 */
export function resolveEmployeeScopeParam(
  param: EmployeeScopeParam | undefined,
  resolve: (scope: RelativeEmployeeScope) => number[]
): number[] | undefined {
  if (!param || param.scope === 'any') return undefined
  if (param.scope === 'custom') {
    const ids = param.employeeIds ?? []
    return ids.length > 0 ? ids : undefined
  }
  const ids = resolve(param.scope)
  return ids.length > 0 ? ids : undefined
}

/** Drops empty arrays so an unset multi-select never reaches the query string. */
function nonEmpty(ids: number[] | undefined): number[] | undefined {
  return ids && ids.length > 0 ? ids : undefined
}

function range(r: NumericRange | undefined): { from?: number; to?: number } {
  return { from: r?.from, to: r?.to }
}

export function resolvePresetToFilters(
  params: ClientFilterPresetParams,
  ctx: PresetResolutionContext
): ClientFilters {
  const { now, resolveEmployeeScope } = ctx

  const totalDebt = range(params.totalDebt)
  const principal = range(params.principalDebt)
  const dpd = range(params.dpd)
  const sale = resolveDateRange(params.dateOfSale, now)
  const assignment = resolveDateRange(params.assignmentDate, now)
  const targetAction = resolveDateRange(params.targetActionDate, now)
  const interaction = resolveDateRange(params.interactionDate, now)

  const filters: ClientFilters = {
    // `debtRangeFrom/To`, not `amountOfDebtRange*`: the latter pair is declared
    // on ClientFilters but read nowhere — the client list's total-debt inputs
    // are bound to debtRange, and only the row's *label* key is named
    // "amountOfDebtRange". Writing the dead pair would apply no filter at all.
    debtRangeFrom: totalDebt.from,
    debtRangeTo: totalDebt.to,
    principalRangeFrom: principal.from,
    principalRangeTo: principal.to,
    dpdRangeFrom: dpd.from,
    dpdRangeTo: dpd.to,
    dateOfSaleFrom: sale.from,
    dateOfSaleTo: sale.to,
    assignmentDateFrom: assignment.from,
    assignmentDateTo: assignment.to,
    taDateFrom: targetAction.from,
    taDateTo: targetAction.to,
    interactionDateFrom: interaction.from,
    interactionDateTo: interaction.to,
    interactionUserIds: resolveEmployeeScopeParam(params.interactionCreated, resolveEmployeeScope),
    responsibleEmployeeIds: resolveEmployeeScopeParam(
      params.responsibleEmployee,
      resolveEmployeeScope
    ),
    responsibleSearcher: params.responsibleSearcher || undefined,
    portfolio: nonEmpty(params.portfolioIds),
    tagIds: nonEmpty(params.tagIds),
    excludeTagIds: nonEmpty(params.excludeTagIds),
    rrStatusIds: nonEmpty(params.rrStatusIds),
    chainIds: nonEmpty(params.chainIds),
    chainStepIds: nonEmpty(params.chainStepIds),
    onlyLastChain: params.onlyLastChain,
    // Only ever written when the preset asks for it. Left absent, the client
    // list falls back to its own `false`, which is what "the preset does not
    // filter on payments" should mean.
    hasVerifiedPayment: params.hasVerifiedPayment ? true : undefined,
  }

  // Applying a preset replaces the whole filter state, so an absent parameter
  // must arrive as an absent key rather than an explicit undefined — otherwise
  // it reads as "set to nothing" wherever the object is spread or serialised.
  for (const key of Object.keys(filters) as (keyof ClientFilters)[]) {
    if (filters[key] === undefined) delete filters[key]
  }
  return filters
}
