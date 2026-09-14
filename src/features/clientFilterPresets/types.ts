/**
 * Client-list filter presets (#1100).
 *
 * A preset stores filter *parameters*, never resolved values. That distinction
 * is the whole point of the feature: a preset saved as "the last 7 days" has to
 * mean the last 7 days on the day it is applied, not the week it was created.
 * The same holds for employee scopes — "my group" follows group membership
 * rather than freezing whoever was in it at save time.
 *
 * Only the explicitly-chosen options store concrete values: a custom date, and
 * a custom employee list.
 */

/** How one side (from / to) of a date range derives its bound. */
export type DateSideMode = 'any' | 'today' | 'startOfMonth' | 'minusDays' | 'plusDays' | 'custom'

export interface DateSide {
  mode: DateSideMode
  /** Only meaningful for `minusDays` / `plusDays`. Absent reads as 0. */
  days?: number
  /** Only meaningful for `custom`. `YYYY-MM-DD`, matching ClientFilters. */
  date?: string
}

export interface DateRangeParam {
  from: DateSide
  to: DateSide
}

/**
 * Employee-filter scope. Every option except `custom` is relative and is
 * recomputed when the preset is applied; `custom` stores explicit ids.
 */
export type EmployeeScope =
  | 'any'
  | 'myGroup'
  | 'myDepartment'
  | 'everyoneExceptMe'
  | 'everyoneExceptMyGroup'
  | 'everyoneExceptMyDepartment'
  | 'custom'

/** The relative scopes — the ones the caller must resolve at apply time. */
export type RelativeEmployeeScope = Exclude<EmployeeScope, 'any' | 'custom'>

export interface EmployeeScopeParam {
  scope: EmployeeScope
  /** Only for `custom`: static, explicitly chosen, never recomputed. */
  employeeIds?: number[]
}

export interface NumericRange {
  from?: number
  to?: number
}

/**
 * The saved shape. Field names follow the ticket's filter table rather than the
 * `ClientFilters` field names, because the mapping between them is deliberately
 * a single place (`resolvePresetToFilters`) rather than spread across the UI.
 */
export interface ClientFilterPresetParams {
  totalDebt?: NumericRange
  principalDebt?: NumericRange
  dpd?: NumericRange
  dateOfSale?: DateRangeParam
  assignmentDate?: DateRangeParam
  targetActionDate?: DateRangeParam
  interactionDate?: DateRangeParam
  interactionCreated?: EmployeeScopeParam
  portfolioIds?: number[]
  tagIds?: number[]
  excludeTagIds?: number[]
  rrStatusIds?: number[]
  chainIds?: number[]
  chainStepIds?: number[]
  /** The ticket's "Last interaction only" — ClientFilters.onlyLastChain. */
  onlyLastChain?: boolean
  responsibleEmployee?: EmployeeScopeParam
  responsibleSearcher?: string
  /**
   * Singular, matching `ClientFilters.hasVerifiedPayment` — the filter #1099
   * added. Absent means the preset does not ask about payments at all, which
   * the client list reads as its `false` default.
   */
  hasVerifiedPayment?: boolean
}

export interface ClientFilterPreset {
  id: number
  name: string
  params: ClientFilterPresetParams
}

/** A preset side with no bound set — the default for every date filter. */
export const ANY_DATE_SIDE: DateSide = { mode: 'any' }

export const EMPTY_DATE_RANGE: DateRangeParam = {
  from: ANY_DATE_SIDE,
  to: ANY_DATE_SIDE,
}

export const ANY_EMPLOYEE_SCOPE: EmployeeScopeParam = { scope: 'any' }
