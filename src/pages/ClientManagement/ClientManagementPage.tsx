/**
 * Client Management Page
 *
 * Main page for managing clients with priority overview, filters, and data table.
 */

import { useState, useMemo, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import i18n, { spanishLocaleOr } from '@/lib/i18n'
import { DataTable, type Column, type SortConfig } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { Button } from '@/components/ui/Button'
import { LinkButton } from '@/components/ui/LinkButton'
import { PriorityCards } from './components/PriorityCards'
import { V3PriorityCards } from './components/V3PriorityCards'
import { NotScoredBadge } from './components/NotScoredBadge'
import { PriorityBadge } from './components/PriorityBadge'
import { V3BucketBadge } from '@/pages/OperatorWorkList/components/V3BucketBadge'
import {
  currentMonthStart,
  useV3ClientRollup,
  useV3BucketCounts,
  useV3ClientSummary,
  useV3UiEnabled,
} from '@/features/scoring/hooks/useV3Scores'
import { TagBadge } from '@/components/ui/TagBadge'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { ClientFiltersBar } from './components/ClientFiltersBar'
import { AssignClientModal } from './components/AssignClientModal'
import { BulkAssignClientModal } from './components/BulkAssignClientModal'
import { formatClientFullName, formatDate, formatDateTime, withCurrency } from '@/lib/formatters'
import { TagSelectorModal } from './components/TagSelectorModal'
import { BulkTagModal } from './components/BulkTagModal'
import { BulkSendMessageModal } from './components/BulkSendMessageModal'
import { fetchFilteredClientIds } from '@/features/messaging/utils/fetchFilteredClientIds'
import { ClientManagementPageSkeleton } from './components/ClientManagementPageSkeleton'
import { Icons } from '@/lib/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Link } from 'react-router-dom'
import {
  useAssignClient,
  useBulkAssignClients,
  useClients,
} from '@/features/clients/hooks/useClients'
import { useOperators } from '@/features/users/hooks/useUsers'
import { useAuthStore } from '@/stores/authStore'
import { useSearchStore } from '@/stores/searchStore'
import { usePriorityThresholds } from '@/features/clients/hooks/useConfig'
import { mapScoreToPriority } from '@/features/clients/api/configApi'
import type { Client as APIClient } from '@/features/clients/api/types'
import type { PriorityThresholds } from '@/features/clients/api/configApi'
import { useURLState } from '@/hooks/useURLState'
import { useOperatorFilterOptions, coversAllOptions } from './hooks/useOperatorFilterOptions'
import { NO_INTERACTIONS_ID, NO_RESPONSIBLE_ID } from './components/OperatorMultiSelectDropdown'
import type { StepValueEntry } from './components/ClientStepValueRow'
import type { Priority } from './types'
import { cycleTagTriState } from '@/features/tags/utils/tagFilterState'
import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import { ALL_MESSAGING_LAUNCH_PERMISSIONS } from '@/features/messaging'
import { useBulkOptOutUbki, useBulkSubmitByClients } from '@/features/ubki'
import { useTags } from '@/features/tags/hooks/useTags'
import { isAdminRole, isHiddenVisibility } from '@/features/tags/utils/visibility'
import { toast } from 'sonner'

// Display type matching page requirements
interface DisplayClient {
  id: number
  /** Compliance exclusions — a do-not-call client, with or without a v3 score. */
  isDeceased?: boolean
  isFraudster?: boolean
  lawsuitFiled?: boolean
  fullName: string
  taxIdNumber: string
  tags: Array<{
    id: number
    name: string
    color: string
    visibility?: string | null
    is_protected?: boolean
    expiry_type?: 'permanent' | 'ttl' | 'loan_closure'
  }>
  phoneNumber: string
  lastPurchaseDate: string
  creditor: string
  debt: string
  priority: 'Critical' | 'High' | 'Medium' | 'Low'
  score: number
  employeeName: string
  searcherName: string
  assignmentDate: string
  lastInteractionResult: string
  doNotSendToUbki: boolean
  // Raw ISO timestamp of the latest TA (or '' when none). Formatted with the
  // user's timezone in the column render, so it's stored unformatted here.
  lastTaDate: string
}

// Default thresholds (fallback if API not available)
const DEFAULT_THRESHOLDS: PriorityThresholds = {
  critical: 75,
  high: 50,
  medium: 25,
  low: 0,
}

// Helper to map API Client to DisplayClient
const mapAPIClientToDisplay = (
  client: APIClient,
  thresholds: PriorityThresholds,
  userNameMap: Map<number, string>,
  showHiddenTags: boolean,
  /** When set (operator + catalog loaded): only show tags present in tag-service catalog (hidden tags are omitted there). */
  operatorAllowedTags: { names: Set<string>; codes: Set<string> } | null
): DisplayClient => {
  const fullName = formatClientFullName(client)

  return {
    id: client.id,
    fullName,
    taxIdNumber: client.tax_id,
    // Compliance exclusions travel with the row so the priority column can mark
    // a do-not-call client without waiting on (or needing) a v3 score.
    isDeceased: !!client.is_deceased,
    isFraudster: !!client.is_fraudster,
    lawsuitFiled: !!client.lawsuit_filed,
    tags: (client.tags || []).filter((tag) => {
      if (showHiddenTags) return true
      if (isHiddenVisibility(tag.visibility)) return false
      if (operatorAllowedTags !== null) {
        const code = (tag as { code?: string | null }).code
        if (code && operatorAllowedTags.codes.has(code)) return true
        return operatorAllowedTags.names.has(tag.name)
      }
      return true
    }),
    // phone_primary is now resolved from contacts by backend
    phoneNumber:
      client.phone_primary && !/^0+$/.test(client.phone_primary) ? client.phone_primary : '-',
    lastPurchaseDate: client.last_purchase_date ? formatDate(client.last_purchase_date) : '-',
    creditor: client.primary_creditor || '-',
    debt: client.total_debt || '0',
    priority:
      (client.manual_priority as 'Critical' | 'High' | 'Medium' | 'Low') ||
      mapScoreToPriority(client.priority_score, thresholds),
    score: client.priority_score,
    employeeName: client.responsible_employee_id
      ? userNameMap.get(client.responsible_employee_id) || '-'
      : '-',
    searcherName: client.responsible_searcher_id
      ? userNameMap.get(client.responsible_searcher_id) || '-'
      : '-',
    assignmentDate: client.assignment_date ? formatDate(client.assignment_date) : '-',
    lastInteractionResult: client.last_interaction_result_name || '—',
    doNotSendToUbki: client.do_not_send_to_ubki ?? false,
    lastTaDate: client.last_ta_date || '',
  }
}

export interface ClientFilters {
  // Debt Range Filters
  debtRangeFrom?: number // Legacy remaining debt min
  debtRangeTo?: number // Legacy remaining debt max
  amountOfDebtRangeFrom?: number // Total debt min (UI label)
  amountOfDebtRangeTo?: number // Total debt max (UI label)

  // Principal Amount Filter — maps to principal_min/max on the BE.
  // Filters clients with at least one open (active) loan whose
  // principal_amount falls in the range (KAN-572).
  principalRangeFrom?: number
  principalRangeTo?: number

  // Days Past Due Filter
  dpdRangeFrom?: number
  dpdRangeTo?: number

  // Date Range Filter
  dateOfSaleFrom?: string
  dateOfSaleTo?: string

  // Target Action Date Filter — merges the legacy Promise + Callback
  // date pickers into one range. Reads the user-entered date value(s)
  // inside the most-recent TA-with-date for each client (see the BE
  // filter for the precise rule).
  taDateFrom?: string
  taDateTo?: string

  // Assignment Date Filter
  assignmentDateFrom?: string
  assignmentDateTo?: string

  // Interaction Created By — operators who created the latest TA
  // (multi-select OR, KAN-572). Empty/undefined means no filter.
  interactionUserIds?: number[]

  // Interaction Logged Date — created_at of the latest TA, regardless
  // of whether the TA carries any date values
  interactionDateFrom?: string
  interactionDateTo?: string

  // Portfolio/Sellers Filter (now stores IDs only)
  portfolio?: number[]

  // Assignment Filters — Responsible Employee is multi-select OR
  // (KAN-572). Empty/undefined means no filter.
  responsibleEmployeeIds?: number[]
  responsibleSearcher?: string
  unassignedOnly?: boolean

  // Tags Filter (3-state: include / exclude / neutral)
  tagIds?: number[]
  excludeTagIds?: number[]
  /** Active Tag Service segment preset (mutually exclusive with manual tags) */
  segmentId?: number

  rrStatusIds?: number[]

  // "Has verified payment(s)". Existence only: a client matches on
  // ONE verified, non-deleted, non-pre-acquisition payment, whatever its date
  // or amount. Undefined/false applies no filter, which is also the reset state.
  hasVerifiedPayment?: boolean

  // Chain filter — TA Chain IDs (KAN-821: multi-select). Narrows to clients
  // with at least one ta_interaction in ANY of these chains. Pairs with
  // ``chainStepIds`` (steps belonging to the picked chains) and ``stepValues``
  // (per-step value bounds).
  chainIds?: number[]

  // KAN-821 — "Only last TA chain". When true (the default), a client matches
  // only if their MOST RECENT interaction, across every chain rather than per
  // selected chain, belongs to the picked set: "where the client is now", not
  // "where they have ever been". Ignored when no chain is picked.
  onlyLastChain?: boolean

  // Step filter — multi-select chain step IDs (``ta_chain_steps.id``)
  // within the selected chains. Keyed per-step (not per-target_action)
  // so a chain with two steps that share the same TA — e.g.
  // Contact → Credit → Credit — toggles each independently. Ignored
  // unless at least one chain is picked.
  chainStepIds?: number[]

  // Step value bounds keyed by chain step ID. ``eq`` for dropdown /
  // text / credit / contact; ``min`` + ``max`` for date / amount. Empty
  // entries are dropped so the URL stays clean.
  stepValues?: Record<number, StepValueEntry>

  // Priority Filter
  priorities?: Priority[]
}

/**
 * Encode a per-step value map as a compact URL-safe JSON string.
 *
 * ``useURLState`` only serializes primitives + arrays, so the nested
 * ``Record<step_id, StepValueEntry>`` shape round-trips through a single
 * string URL param. Empty → ``''`` so the param disappears from the URL.
 */
function encodeStepValues(values: Record<number, StepValueEntry>): string {
  if (!values || Object.keys(values).length === 0) return ''
  return JSON.stringify(values)
}

function decodeStepValues(raw: string): Record<number, StepValueEntry> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, StepValueEntry>
    const out: Record<number, StepValueEntry> = {}
    for (const [k, v] of Object.entries(parsed)) {
      const id = Number(k)
      if (!Number.isFinite(id)) continue
      const clean: StepValueEntry = {}
      if (v?.eq) clean.eq = v.eq
      if (v?.min) clean.min = v.min
      if (v?.max) clean.max = v.max
      if (clean.eq || clean.min || clean.max) out[id] = clean
    }
    return out
  } catch {
    return {}
  }
}

// DISABLED for the release (client requirement): bulk "Send to UBKI" must stay
// OFF; only per-loan manual submit stays active. The backend
// /submit/by-clients endpoint is also disabled. Re-enable by flipping this
// flag to true.
const ENABLE_BULK_UBKI_SUBMISSION = true

const BULK_ACTION_LIMIT = 10000

export function ClientManagementPage() {
  const { t } = useTranslation('common')
  // Get search state from global store (synced with header search)
  const { searchQuery, searchType, setSearchQuery: clearSearchQuery } = useSearchStore()
  const user = useAuthStore((state) => state.user)
  const showHiddenTags = isAdminRole(user?.active_role_name)

  // URL state for priority filtering
  const [selectedPriorities, setSelectedPriorities] = useURLState<Priority[]>('priority', [])
  // v3 bucket filter, kept separate from the legacy one: only one of the two
  // card sets is on screen at a time, and mixing them into one state would
  // let a stale legacy filter survive cutover.
  const [selectedV3Buckets, setSelectedV3Buckets] = useURLState<string[]>('v3bucket', [])

  // URL state for pagination
  const [currentPage, setCurrentPage] = useURLState<number>('page', 1)
  const [rowsPerPage, setRowsPerPage] = useURLState<number>('pageSize', 10)

  // URL state for sorting (stores frontend column key, converted to backend field in apiParams)
  const [sortBy, setSortBy] = useURLState<string>('sort_by', 'priority')
  const [sortOrder, setSortOrder] = useURLState<'asc' | 'desc'>('sort_order', 'desc')

  // URL state for filters
  const [portfolioFilter, setPortfolioFilter] = useURLState<number[]>('sellers', [])
  const [tagIdsFilter, setTagIdsFilter] = useURLState<number[]>('tags', [])
  const [rrStatusFilter, setRrStatusFilter] = useURLState<number[]>('rr_status', [])
  const [excludeTagIdsFilter, setExcludeTagIdsFilter] = useURLState<number[]>('excludeTags', [])
  const [segmentIdFilter, setSegmentIdFilter] = useURLState<number>('segment', 0)
  const [responsibleEmployeeFilter, setResponsibleEmployeeFilter] = useURLState<string>(
    'employee',
    ''
  )
  const [responsibleEmployeeIdsFilter, setResponsibleEmployeeIdsFilter] = useURLState<number[]>(
    'employeeIds',
    []
  )
  const [responsibleSearcherFilter, setResponsibleSearcherFilter] = useURLState<string>(
    'searcher',
    ''
  )
  const [unassignedOnlyFilter, setUnassignedOnlyFilter] = useURLState<boolean>('unassigned', false)
  const [hasVerifiedPaymentFilter, setHasVerifiedPaymentFilter] = useURLState<boolean>(
    'hasVerifiedPayment',
    false
  )
  const [dateOfSaleFromFilter, setDateOfSaleFromFilter] = useURLState<string>('dateFrom', '')
  const [dateOfSaleToFilter, setDateOfSaleToFilter] = useURLState<string>('dateTo', '')
  const [debtRangeFromFilter, setDebtRangeFromFilter] = useURLState<number>('debtMin', 0)
  const [debtRangeToFilter, setDebtRangeToFilter] = useURLState<number>('debtMax', 0)
  const [principalRangeFromFilter, setPrincipalRangeFromFilter] = useURLState<number>(
    'principalMin',
    0
  )
  const [principalRangeToFilter, setPrincipalRangeToFilter] = useURLState<number>('principalMax', 0)
  const [dpdRangeFromFilter, setDpdRangeFromFilter] = useURLState<number>('dpdMin', 0)
  const [dpdRangeToFilter, setDpdRangeToFilter] = useURLState<number>('dpdMax', 0)
  // URL query keys for the unified Target Action Date range. CamelCase
  // matches every other URL filter on this page; the snake_case
  // ta_date_from/to is only used at the API boundary.
  const [taDateFromFilter, setTaDateFromFilter] = useURLState<string>('taDateFrom', '')
  const [taDateToFilter, setTaDateToFilter] = useURLState<string>('taDateTo', '')
  const [interactionUserIdsFilter, setInteractionUserIdsFilter] = useURLState<number[]>(
    'interactionUserIds',
    []
  )
  const [interactionDateFromFilter, setInteractionDateFromFilter] = useURLState<string>(
    'interactionDateFrom',
    ''
  )
  const [interactionDateToFilter, setInteractionDateToFilter] = useURLState<string>(
    'interactionDateTo',
    ''
  )
  const [assignmentDateFromFilter, setAssignmentDateFromFilter] = useURLState<string>(
    'assignmentDateFrom',
    ''
  )
  const [assignmentDateToFilter, setAssignmentDateToFilter] = useURLState<string>(
    'assignmentDateTo',
    ''
  )
  // Chain + Step filter URL state. An empty ``chainIdsFilter`` is "no chain
  // picked". When the selection changes we wipe ``chainSteps`` and
  // ``stepValues`` because both belong to the previously-selected chains.
  const [chainIdsFilter, setChainIdsFilter] = useURLState<number[]>('chainIds', [])
  // KAN-821: default ON, so a request that omits it still means "only last".
  // Bookmarks saved before this shipped therefore adopt the new default, which
  // is the intended behaviour change.
  const [onlyLastChainFilter, setOnlyLastChainFilter] = useURLState<boolean>('onlyLastChain', true)
  const [chainStepIdsFilter, setChainStepIdsFilter] = useURLState<number[]>('chainSteps', [])
  // Step-value sub-filters are a nested object (step_id → {eq,min,max}).
  // useURLState can't serialize objects directly, so we round-trip it
  // through a single JSON-encoded string URL param.
  const [stepValuesRawFilter, setStepValuesRawFilter] = useURLState<string>('stepValues', '')
  const stepValuesFilter = useMemo(
    () => decodeStepValues(stepValuesRawFilter),
    [stepValuesRawFilter]
  )

  // Compute filters object from URL state
  const filters: ClientFilters = useMemo(
    () => ({
      portfolio: portfolioFilter,
      tagIds: tagIdsFilter,
      rrStatusIds: rrStatusFilter,
      hasVerifiedPayment: hasVerifiedPaymentFilter,
      excludeTagIds: excludeTagIdsFilter,
      segmentId: segmentIdFilter || undefined,
      responsibleEmployee: responsibleEmployeeFilter || undefined,
      responsibleEmployeeIds: responsibleEmployeeIdsFilter,
      responsibleSearcher: responsibleSearcherFilter || undefined,
      unassignedOnly: unassignedOnlyFilter,
      dateOfSaleFrom: dateOfSaleFromFilter || undefined,
      dateOfSaleTo: dateOfSaleToFilter || undefined,
      debtRangeFrom: debtRangeFromFilter || undefined,
      debtRangeTo: debtRangeToFilter || undefined,
      principalRangeFrom: principalRangeFromFilter || undefined,
      principalRangeTo: principalRangeToFilter || undefined,
      dpdRangeFrom: dpdRangeFromFilter || undefined,
      dpdRangeTo: dpdRangeToFilter || undefined,
      taDateFrom: taDateFromFilter || undefined,
      taDateTo: taDateToFilter || undefined,
      interactionUserIds: interactionUserIdsFilter,
      interactionDateFrom: interactionDateFromFilter || undefined,
      interactionDateTo: interactionDateToFilter || undefined,
      assignmentDateFrom: assignmentDateFromFilter || undefined,
      assignmentDateTo: assignmentDateToFilter || undefined,
      chainIds: chainIdsFilter,
      onlyLastChain: onlyLastChainFilter,
      chainStepIds: chainStepIdsFilter,
      stepValues: stepValuesFilter,
    }),
    [
      portfolioFilter,
      tagIdsFilter,
      rrStatusFilter,
      excludeTagIdsFilter,
      segmentIdFilter,
      responsibleEmployeeFilter,
      responsibleEmployeeIdsFilter,
      responsibleSearcherFilter,
      unassignedOnlyFilter,
      hasVerifiedPaymentFilter,
      dateOfSaleFromFilter,
      dateOfSaleToFilter,
      debtRangeFromFilter,
      debtRangeToFilter,
      principalRangeFromFilter,
      principalRangeToFilter,
      dpdRangeFromFilter,
      dpdRangeToFilter,
      taDateFromFilter,
      taDateToFilter,
      interactionUserIdsFilter,
      interactionDateFromFilter,
      interactionDateToFilter,
      assignmentDateFromFilter,
      assignmentDateToFilter,
      chainIdsFilter,
      onlyLastChainFilter,
      chainStepIdsFilter,
      stepValuesFilter,
    ]
  )

  // Compute sortConfig from URL state (sortBy already stores the frontend column key)
  const sortConfig: SortConfig | undefined = useMemo(() => {
    if (!sortBy) return undefined
    return { key: sortBy, order: sortOrder }
  }, [sortBy, sortOrder])

  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [selectedClients, setSelectedClients] = useState<Set<number>>(new Set())
  const [allClientsSelected, setAllClientsSelected] = useState(false)
  const [excludedClients, setExcludedClients] = useState<Set<number>>(new Set())
  const [assignModalClientId, setAssignModalClientId] = useState<number | null>(null)
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false)
  const [showBulkTagModal, setShowBulkTagModal] = useState(false)
  const [showBulkSendMessageModal, setShowBulkSendMessageModal] = useState(false)
  const [bulkTagAction, setBulkTagAction] = useState<'add' | 'remove'>('add')
  const [bulkTagClientIds, setBulkTagClientIds] = useState<number[]>([])
  const [tagModalOpen, setTagModalOpen] = useState(false)
  const [selectedClientForTags, setSelectedClientForTags] = useState<{
    id: number
    name: string
  } | null>(null)
  const [openDropdownClientId, setOpenDropdownClientId] = useState<number | null>(null)
  const hasSetDefaultFilter = useRef(false)
  // User-specific storage key to prevent filter leakage between users
  const STORAGE_KEY = user?.id ? `client-filters-state-${user.id}` : null

  // Legacy URL fold (KAN-572): saved bookmarks with `?employee=<id>` or
  // `?interactionUserId=<id>` (singular scalar) are migrated to the new
  // `?employeeIds=<id>` / `?interactionUserIds=<id>` (comma-separated
  // multi-select) on first mount. One-shot; the new keys win when both
  // are present. The hook setters write the URL via react-router's
  // setSearchParams; we also strip the legacy keys from the URL once
  // we've consumed them so they don't keep round-tripping.
  const hasFoldedLegacyURL = useRef(false)
  useEffect(() => {
    if (hasFoldedLegacyURL.current) return
    hasFoldedLegacyURL.current = true
    const params = new URLSearchParams(window.location.search)
    const legacyEmployee = params.get('employee')
    const legacyInteractionUser = params.get('interactionUserId')
    if (!legacyEmployee && !legacyInteractionUser) return

    if (legacyEmployee && !params.has('employeeIds')) {
      const n = Number(legacyEmployee)
      if (Number.isFinite(n)) {
        setResponsibleEmployeeIdsFilter([n])
      }
    }
    if (legacyInteractionUser && !params.has('interactionUserIds')) {
      const n = Number(legacyInteractionUser)
      if (Number.isFinite(n)) {
        setInteractionUserIdsFilter([n])
      }
    }
    // Strip the legacy keys from the URL so they don't shadow the new
    // ones on subsequent renders.
    params.delete('employee')
    params.delete('interactionUserId')
    const newSearch = params.toString()
    const newUrl =
      window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash
    window.history.replaceState(window.history.state, '', newUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Save filters to localStorage whenever they change (for persistence when sidebar navigation clears URL)
  useEffect(() => {
    const filterState = {
      selectedPriorities,
      currentPage,
      rowsPerPage,
      sortBy,
      sortOrder,
      portfolioFilter,
      tagIdsFilter,
      rrStatusFilter,
      excludeTagIdsFilter,
      segmentIdFilter,
      responsibleEmployeeIdsFilter,
      responsibleSearcherFilter,
      unassignedOnlyFilter,
      hasVerifiedPaymentFilter,
      dateOfSaleFromFilter,
      dateOfSaleToFilter,
      debtRangeFromFilter,
      debtRangeToFilter,
      principalRangeFromFilter,
      principalRangeToFilter,
      dpdRangeFromFilter,
      dpdRangeToFilter,
      taDateFromFilter,
      taDateToFilter,
      interactionUserIdsFilter,
      interactionDateFromFilter,
      interactionDateToFilter,
      assignmentDateFromFilter,
      assignmentDateToFilter,
      chainIdsFilter,
      onlyLastChainFilter,
      chainStepIdsFilter,
      stepValuesRawFilter,
      searchQuery,
      searchType,
    }

    // Only save if there are active filters (don't save empty state)
    const hasActiveFilters =
      selectedPriorities.length > 0 ||
      searchQuery !== '' ||
      responsibleEmployeeIdsFilter.length > 0 ||
      responsibleSearcherFilter !== '' ||
      portfolioFilter.length > 0 ||
      tagIdsFilter.length > 0 ||
      rrStatusFilter.length > 0 ||
      excludeTagIdsFilter.length > 0 ||
      segmentIdFilter > 0 ||
      unassignedOnlyFilter ||
      hasVerifiedPaymentFilter ||
      dateOfSaleFromFilter !== '' ||
      dateOfSaleToFilter !== '' ||
      taDateFromFilter !== '' ||
      taDateToFilter !== '' ||
      interactionUserIdsFilter.length > 0 ||
      interactionDateFromFilter !== '' ||
      interactionDateToFilter !== '' ||
      assignmentDateFromFilter !== '' ||
      assignmentDateToFilter !== '' ||
      debtRangeFromFilter > 0 ||
      debtRangeToFilter > 0 ||
      principalRangeFromFilter > 0 ||
      principalRangeToFilter > 0 ||
      dpdRangeFromFilter > 0 ||
      dpdRangeToFilter > 0 ||
      chainIdsFilter.length > 0 ||
      chainStepIdsFilter.length > 0 ||
      stepValuesRawFilter !== ''

    if (hasActiveFilters && STORAGE_KEY) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filterState))
      } catch (e) {
        console.error('Failed to save filters to localStorage:', e)
      }
    }
  }, [
    STORAGE_KEY,
    selectedPriorities,
    currentPage,
    rowsPerPage,
    sortBy,
    sortOrder,
    portfolioFilter,
    tagIdsFilter,
    rrStatusFilter,
    excludeTagIdsFilter,
    segmentIdFilter,
    responsibleEmployeeFilter,
    responsibleEmployeeIdsFilter,
    responsibleSearcherFilter,
    unassignedOnlyFilter,
    hasVerifiedPaymentFilter,
    dateOfSaleFromFilter,
    dateOfSaleToFilter,
    debtRangeFromFilter,
    debtRangeToFilter,
    principalRangeFromFilter,
    principalRangeToFilter,
    dpdRangeFromFilter,
    dpdRangeToFilter,
    taDateFromFilter,
    taDateToFilter,
    interactionUserIdsFilter,
    interactionDateFromFilter,
    interactionDateToFilter,
    assignmentDateFromFilter,
    assignmentDateToFilter,
    chainIdsFilter,
    onlyLastChainFilter,
    chainStepIdsFilter,
    stepValuesRawFilter,
    searchQuery,
    searchType,
  ])

  // Set default "assigned to me" filter on initial load OR restore from localStorage
  useEffect(() => {
    if (hasSetDefaultFilter.current || !user?.id) return

    // Check if URL has any filters
    const hasURLFilters =
      selectedPriorities.length > 0 ||
      searchQuery !== '' ||
      responsibleEmployeeIdsFilter.length > 0 ||
      portfolioFilter.length > 0 ||
      tagIdsFilter.length > 0 ||
      rrStatusFilter.length > 0 ||
      excludeTagIdsFilter.length > 0 ||
      segmentIdFilter > 0 ||
      unassignedOnlyFilter ||
      hasVerifiedPaymentFilter ||
      dateOfSaleFromFilter !== '' ||
      dateOfSaleToFilter !== '' ||
      taDateFromFilter !== '' ||
      taDateToFilter !== '' ||
      interactionUserIdsFilter.length > 0 ||
      interactionDateFromFilter !== '' ||
      interactionDateToFilter !== '' ||
      assignmentDateFromFilter !== '' ||
      assignmentDateToFilter !== '' ||
      debtRangeFromFilter > 0 ||
      principalRangeFromFilter > 0

    // Default-filter helper: "assigned to me" via the multi-select.
    const userIdNum = Number(user.id)
    const defaultEmployeeIds = Number.isFinite(userIdNum) ? [userIdNum] : []

    if (!hasURLFilters && STORAGE_KEY) {
      // Try to restore from localStorage first
      try {
        const savedState = localStorage.getItem(STORAGE_KEY)
        if (savedState) {
          const parsed = JSON.parse(savedState)
          // Restore filters (use setTimeout to avoid state updates during render)
          setTimeout(() => {
            if (parsed.selectedPriorities) setSelectedPriorities(parsed.selectedPriorities)
            if (parsed.portfolioFilter) setPortfolioFilter(parsed.portfolioFilter)
            if (parsed.tagIdsFilter) setTagIdsFilter(parsed.tagIdsFilter)
            if (parsed.rrStatusFilter) setRrStatusFilter(parsed.rrStatusFilter)
            if (parsed.excludeTagIdsFilter) setExcludeTagIdsFilter(parsed.excludeTagIdsFilter)
            if (parsed.segmentIdFilter) setSegmentIdFilter(parsed.segmentIdFilter)
            // Migrate legacy scalar `responsibleEmployeeFilter` to the new
            // `responsibleEmployeeIdsFilter` array (KAN-572). Saved states
            // from before the multi-select migration carry the scalar key.
            if (
              Array.isArray(parsed.responsibleEmployeeIdsFilter) &&
              parsed.responsibleEmployeeIdsFilter.length > 0
            ) {
              setResponsibleEmployeeIdsFilter(
                parsed.responsibleEmployeeIdsFilter.map(Number).filter(Number.isFinite)
              )
            } else if (parsed.responsibleEmployeeFilter) {
              const legacy = Number(parsed.responsibleEmployeeFilter)
              if (Number.isFinite(legacy)) {
                setResponsibleEmployeeIdsFilter([legacy])
              }
            }
            if (parsed.responsibleSearcherFilter)
              setResponsibleSearcherFilter(parsed.responsibleSearcherFilter)
            if (parsed.unassignedOnlyFilter) setUnassignedOnlyFilter(parsed.unassignedOnlyFilter)
            if (parsed.hasVerifiedPaymentFilter)
              setHasVerifiedPaymentFilter(parsed.hasVerifiedPaymentFilter)
            if (parsed.dateOfSaleFromFilter) setDateOfSaleFromFilter(parsed.dateOfSaleFromFilter)
            if (parsed.dateOfSaleToFilter) setDateOfSaleToFilter(parsed.dateOfSaleToFilter)
            if (parsed.debtRangeFromFilter) setDebtRangeFromFilter(parsed.debtRangeFromFilter)
            if (parsed.debtRangeToFilter) setDebtRangeToFilter(parsed.debtRangeToFilter)
            if (parsed.principalRangeFromFilter)
              setPrincipalRangeFromFilter(parsed.principalRangeFromFilter)
            if (parsed.principalRangeToFilter)
              setPrincipalRangeToFilter(parsed.principalRangeToFilter)
            if (parsed.dpdRangeFromFilter) setDpdRangeFromFilter(parsed.dpdRangeFromFilter)
            if (parsed.dpdRangeToFilter) setDpdRangeToFilter(parsed.dpdRangeToFilter)
            // Migrate legacy localStorage entries (promiseDate*/callbackDate*)
            // into the merged Target Action Date range. Min/max so a
            // partial legacy state widens (never narrows) the new
            // range. Remove this block once all saved states have been
            // rewritten under the new keys.
            const legacyDateFroms = [
              parsed.taDateFromFilter,
              parsed.promiseDateFromFilter,
              parsed.callbackDateFromFilter,
            ].filter(Boolean) as string[]
            const legacyDateTos = [
              parsed.taDateToFilter,
              parsed.promiseDateToFilter,
              parsed.callbackDateToFilter,
            ].filter(Boolean) as string[]
            if (legacyDateFroms.length) {
              setTaDateFromFilter(legacyDateFroms.reduce((a, b) => (a < b ? a : b)))
            }
            if (legacyDateTos.length) {
              setTaDateToFilter(legacyDateTos.reduce((a, b) => (a > b ? a : b)))
            }
            // Same migration shape for the interaction-user filter.
            if (
              Array.isArray(parsed.interactionUserIdsFilter) &&
              parsed.interactionUserIdsFilter.length > 0
            ) {
              setInteractionUserIdsFilter(
                parsed.interactionUserIdsFilter.map(Number).filter(Number.isFinite)
              )
            } else if (parsed.interactionUserIdFilter) {
              const legacy = Number(parsed.interactionUserIdFilter)
              if (Number.isFinite(legacy)) {
                setInteractionUserIdsFilter([legacy])
              }
            }
            if (parsed.interactionDateFromFilter)
              setInteractionDateFromFilter(parsed.interactionDateFromFilter)
            if (parsed.interactionDateToFilter)
              setInteractionDateToFilter(parsed.interactionDateToFilter)
            if (parsed.assignmentDateFromFilter)
              setAssignmentDateFromFilter(parsed.assignmentDateFromFilter)
            if (parsed.assignmentDateToFilter)
              setAssignmentDateToFilter(parsed.assignmentDateToFilter)
            // KAN-821: a stored single chainIdFilter is upgraded to the array
            // so saved filter sets survive the multi-select change.
            if (Array.isArray(parsed.chainIdsFilter)) setChainIdsFilter(parsed.chainIdsFilter)
            else if (parsed.chainIdFilter) setChainIdsFilter([parsed.chainIdFilter])
            if (typeof parsed.onlyLastChainFilter === 'boolean')
              setOnlyLastChainFilter(parsed.onlyLastChainFilter)
            if (Array.isArray(parsed.chainStepIdsFilter))
              setChainStepIdsFilter(parsed.chainStepIdsFilter)
            if (parsed.stepValuesRawFilter) setStepValuesRawFilter(parsed.stepValuesRawFilter)
            if (parsed.currentPage) setCurrentPage(parsed.currentPage)
            if (parsed.rowsPerPage) setRowsPerPage(parsed.rowsPerPage)
            if (parsed.sortBy) setSortBy(parsed.sortBy)
            if (parsed.sortOrder) setSortOrder(parsed.sortOrder)
            // Note: search query and type are managed separately via setSearchParams
          }, 0)
        } else {
          // No saved state, apply default "assigned to me" filter
          setResponsibleEmployeeIdsFilter(defaultEmployeeIds)
        }
      } catch (e) {
        console.error('Failed to restore filters from localStorage:', e)
        // Fallback to default filter
        setResponsibleEmployeeIdsFilter(defaultEmployeeIds)
      }
    }

    hasSetDefaultFilter.current = true
    // Only run once when user is available
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Close dropdown when screen size crosses breakpoint (in either direction)
  useEffect(() => {
    let wasMobile = window.innerWidth < 1024 // lg breakpoint

    const handleResize = () => {
      const isMobile = window.innerWidth < 1024

      // Close dropdown if transitioning across breakpoint (mobile <-> desktop)
      if (wasMobile !== isMobile && openDropdownClientId !== null) {
        setOpenDropdownClientId(null)
      }

      wasMobile = isMobile
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [openDropdownClientId])

  // NO need to debounce filters - useURLState already does this with 300ms debounce
  // const filters = useDebounce(filters, 500)

  // Operator option sets (same derivation the filter dropdowns render). Used to
  // detect the "all operators selected" case and OMIT the responsible_employee_ids
  // / interaction_user_ids filter: sending every id is a no-op constraint that
  // defeats the priority index and turns the dashboard query into a full-scan +
  // sort — the heavy query behind the morning-login OOM/502s. Shares the
  // react-query cache with ClientFiltersBar, so no extra fetch.
  const {
    employeeOptions,
    interactionUserOptions,
    isReady: operatorOptionsReady,
  } = useOperatorFilterOptions(user?.active_project_id ? Number(user.active_project_id) : null)
  const allEmployeeOptionIds = useMemo(() => employeeOptions.map((o) => o.id), [employeeOptions])
  const allInteractionOptionIds = useMemo(
    () => interactionUserOptions.map((o) => o.id),
    [interactionUserOptions]
  )

  // Toggle handler for priority card clicks
  const handlePriorityToggle = (priority: Priority) => {
    setSelectedPriorities((prev) => {
      const newValue = prev.includes(priority)
        ? prev.filter((p) => p !== priority)
        : [...prev, priority]
      return newValue
    })
  }

  // Convert frontend filters to API parameters
  const apiParams = useMemo(() => {
    // Map frontend column keys to backend sort fields
    const frontendToBackendSort: Record<string, string> = {
      priority: 'priority_score',
      score: 'priority_score',
      fullName: 'first_name',
      id: 'id',
      lastPurchaseDate: 'last_purchase_date',
      taxIdNumber: 'tax_id',
      employeeName: 'responsible_employee_id',
      searcherName: 'responsible_searcher_id',
      creditor: 'primary_creditor',
      debt: 'total_debt',
      assignmentDate: 'assignment_date',
      lastInteractionResult: 'last_interaction_result',
      lastOutgoingTADate: 'last_ta_date',
    }

    const params: Record<string, unknown> = {
      // Server-side pagination
      skip: (currentPage - 1) * rowsPerPage,
      limit: rowsPerPage,
      // Sorting (convert frontend key to backend field)
      sort_by: frontendToBackendSort[sortBy] || 'priority_score',
      sort_order: sortOrder,
    }

    // FILTER 1: Portfolio/Sellers (now using IDs directly)
    if (filters.portfolio && filters.portfolio.length > 0) {
      params.seller_ids = filters.portfolio.join(',')
    }

    // FILTER 2: Sale Date Range (FIXED - correct parameter names)
    if (filters.dateOfSaleFrom) {
      params.sale_date_from = filters.dateOfSaleFrom
    }
    if (filters.dateOfSaleTo) {
      params.sale_date_to = filters.dateOfSaleTo
    }

    // FILTER 3: Assignment - Employee (multi-select OR, KAN-572).
    // Sent as a comma-separated string matching the BE schema. When every
    // operator is selected ("All employees", no "No Responsible" sentinel) the
    // filter is a no-op — omit it so the BE takes the fast priority-index path
    // instead of a 200-id IN-list full scan (the morning OOM/502 trigger). This
    // also matches the dropdown label, which already shows "All employees" for
    // both the empty and all-selected states.
    if (filters.responsibleEmployeeIds && filters.responsibleEmployeeIds.length > 0) {
      const selected = filters.responsibleEmployeeIds
      const hasNoResponsible = selected.includes(NO_RESPONSIBLE_ID)
      const realIds = selected.filter((id) => id !== NO_RESPONSIBLE_ID)
      if (!(!hasNoResponsible && coversAllOptions(realIds, allEmployeeOptionIds))) {
        params.responsible_employee_ids = selected.join(',')
      }
    }

    // FILTER 4: Assignment - Searcher
    if (filters.responsibleSearcher) {
      params.responsible_searcher_id = parseInt(filters.responsibleSearcher)
    }

    // FILTER 5: Assignment - Unassigned Only
    if (filters.unassignedOnly) {
      params.unassigned_only = true
    }

    // FILTER 6: Principal Amount
    if (filters.principalRangeFrom !== undefined) {
      params.principal_min = filters.principalRangeFrom
    }
    if (filters.principalRangeTo !== undefined) {
      params.principal_max = filters.principalRangeTo
    }

    // FILTER 8: Days Past Due
    if (filters.dpdRangeFrom !== undefined) {
      params.dpd_min = filters.dpdRangeFrom
    }
    if (filters.dpdRangeTo !== undefined) {
      params.dpd_max = filters.dpdRangeTo
    }

    // Existing filters (already working)
    if (filters.debtRangeFrom !== undefined) {
      params.debt_min = filters.debtRangeFrom
    }
    if (filters.debtRangeTo !== undefined) {
      params.debt_max = filters.debtRangeTo
    }

    // FILTER 9: Tags (include OR + exclude AND-NOT) OR segment preset
    // (mutually exclusive — prefer segment when set)
    if (filters.segmentId) {
      params.segment_id = filters.segmentId
    } else {
      if (filters.tagIds && filters.tagIds.length > 0) {
        params.tag_ids = filters.tagIds.join(',')
      }
      if (filters.excludeTagIds && filters.excludeTagIds.length > 0) {
        params.exclude_tag_ids = filters.excludeTagIds.join(',')
      }
    }

    if (filters.rrStatusIds && filters.rrStatusIds.length > 0) {
      params.rr_status_in = filters.rrStatusIds.join(',')
    }

    // Sent only when ticked: the backend defaults it to false, and an explicit
    // `false` would still register as a set filter in its audit snapshot.
    if (filters.hasVerifiedPayment) {
      params.has_verified_payment = true
    }

    // FILTER 10: Priority
    if (selectedPriorities.length > 0) {
      // Map priority labels to lowercase for API
      const priorityValues = selectedPriorities.map((p) => p.toLowerCase()).join(',')
      params.priorities = priorityValues
    }

    // FILTER 10b: v3 priority bucket. Reads clients.v3_bucket, published by the
    // scoring job after each run — the client service holds no model knowledge.
    if (selectedV3Buckets.length > 0) {
      params.v3_buckets = selectedV3Buckets.join(',')
    }

    // FILTER 11: Target Action Date — single range replaces the legacy
    // Promise + Callback pair. BE picks the latest TA-with-date per
    // client and matches when ANY of that TA's date values is in the
    // range.
    if (filters.taDateFrom) {
      params.ta_date_from = filters.taDateFrom
    }
    if (filters.taDateTo) {
      params.ta_date_to = filters.taDateTo
    }

    // FILTER 13: Interaction Created By (multi-select OR, KAN-572).
    // Sent as a comma-separated string matching the BE schema. Same "all
    // operators selected → omit the no-op filter" optimization as Filter 3
    // (the "No Interactions" sentinel widens results, so it blocks the omit).
    if (filters.interactionUserIds && filters.interactionUserIds.length > 0) {
      const selected = filters.interactionUserIds
      const hasNoInteractions = selected.includes(NO_INTERACTIONS_ID)
      const realIds = selected.filter((id) => id !== NO_INTERACTIONS_ID)
      if (!(!hasNoInteractions && coversAllOptions(realIds, allInteractionOptionIds))) {
        params.interaction_user_ids = selected.join(',')
      }
    }

    // FILTER 14: Interaction Logged Date (applies to promise/callback subqueries)
    if (filters.interactionDateFrom) {
      params.interaction_date_from = filters.interactionDateFrom
    }
    if (filters.interactionDateTo) {
      params.interaction_date_to = filters.interactionDateTo
    }

    // FILTER 15: Assignment Date Range
    if (filters.assignmentDateFrom) {
      params.assignment_date_from = filters.assignmentDateFrom
    }
    if (filters.assignmentDateTo) {
      params.assignment_date_to = filters.assignmentDateTo
    }

    if (user?.timezone) {
      params.tz = user.timezone
    }

    // FILTER 15b: TA Chain + Step + per-step values. Steps only ship
    // when a chain is selected — BE silently drops orphan steps but no
    // point sending them. Step selection is keyed by
    // ``ta_chain_steps.id`` (not target_action_id) so duplicate-TA chains
    // stay independently filterable.
    if (filters.chainIds && filters.chainIds.length > 0) {
      params.chain_ids = filters.chainIds.join(',')
      // KAN-821: sent explicitly on every chain-filtered request, and it has
      // to be — the API parameter defaults to FALSE (the pre-KAN-821
      // behaviour) so that callers which predate the flag keep their results.
      // The pre-ticked checkbox is a UI default, expressed here.
      params.only_last_chain = filters.onlyLastChain ?? true
      if (filters.chainStepIds && filters.chainStepIds.length > 0) {
        params.step_ids = filters.chainStepIds.join(',')
      }
      // Per-step value sub-filters. Format ``<step_id>:<value>``,
      // comma-separated.
      const eqList: string[] = []
      const minList: string[] = []
      const maxList: string[] = []
      const sv = filters.stepValues ?? {}
      for (const id of filters.chainStepIds ?? []) {
        const entry = sv[id]
        if (!entry) continue
        if (entry.eq) eqList.push(`${id}:${entry.eq}`)
        if (entry.min) minList.push(`${id}:${entry.min}`)
        if (entry.max) maxList.push(`${id}:${entry.max}`)
      }
      if (eqList.length) params.step_value_eq = eqList.join(',')
      if (minList.length) params.step_value_min = minList.join(',')
      if (maxList.length) params.step_value_max = maxList.join(',')
    }

    // FILTER 16: Search (from global header search)
    if (searchQuery.trim()) {
      params.q = searchQuery.trim()
      params.search_type = searchType
    }

    return params
  }, [
    filters,
    currentPage,
    rowsPerPage,
    sortBy,
    sortOrder,
    selectedPriorities,
    // Without this the request keeps the PREVIOUS bucket filter: clicking a card
    // updated the state but never rebuilt apiParams, so the list showed the last
    // filter's result and looked like the click had done nothing.
    selectedV3Buckets,
    searchQuery,
    searchType,
    user?.timezone,
    allEmployeeOptionIds,
    allInteractionOptionIds,
  ])

  /** Filters + sort for bulk messaging when "select all" is used (no pagination). */
  const clientListFilterParams = useMemo(() => {
    const { skip, limit, ...rest } = apiParams
    void skip
    void limit
    return rest
  }, [apiParams])

  // Fetch clients from API. When an operator multi-select filter is active we
  // defer the first fetch until the operator option sets have loaded — otherwise
  // an "all operators" selection would fire the heavy 200-id query against an
  // empty option set and then refetch the light (omitted-filter) query once the
  // options arrive. With no operator filter active there's nothing to wait for.
  const operatorFilterActive =
    (filters.responsibleEmployeeIds?.length ?? 0) > 0 ||
    (filters.interactionUserIds?.length ?? 0) > 0
  const {
    data: clientsResponse,
    isLoading,
    isFetching,
    isError,
    error,
  } = useClients(apiParams, {
    enabled: !operatorFilterActive || operatorOptionsReady,
  })

  // Extract paginated data from response
  const apiClients = useMemo(() => clientsResponse?.items || [], [clientsResponse?.items])
  const totalCount = clientsResponse?.total || 0
  const totalPages = clientsResponse?.total_pages || 1
  const prioritySummaryData = clientsResponse?.priority_summary

  // Fetch priority thresholds configuration
  const { data: thresholds = DEFAULT_THRESHOLDS } = usePriorityThresholds()

  // Fetch active users for resolving employee/searcher IDs to names (project-scoped)
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const activeProjectIdNum = activeProjectId ? Number(activeProjectId) : undefined

  // v3 priority rollup for the visible clients (KAN-791) — only for brands cut
  // over after the KAN-794 sign-off; shows the v3 bucket in place of the old
  // priority badge.
  const v3UiEnabled = useV3UiEnabled()
  const v3ClientIds = useMemo(() => apiClients.map((c) => c.id), [apiClients])
  const { data: v3Rollup } = useV3ClientRollup(
    activeProjectIdNum,
    v3ClientIds,
    currentMonthStart(),
    { enabled: v3UiEnabled }
  )
  // Brand-wide bucket totals for the summary cards. Same snapshot month as the
  // row badges, so a card and the rows under it always describe one scoring run.
  const { data: v3Summary } = useV3ClientSummary(activeProjectIdNum, currentMonthStart(), {
    enabled: v3UiEnabled,
  })
  // Brand-wide counts, independent of the list filter — see V3PriorityCards.
  const { data: v3BucketCounts } = useV3BucketCounts(activeProjectIdNum, {
    enabled: v3UiEnabled,
  })
  // Tag-service list for operators excludes hidden tags — use names to filter client-list embedded tags
  // when client-service rows omit or stale-sync visibility (different DB ids than tag-service).
  const { data: operatorTagCatalog } = useTags(activeProjectIdNum)
  const operatorAllowedTags = useMemo(() => {
    if (showHiddenTags) return null
    if (operatorTagCatalog === undefined) return null
    const names = new Set<string>()
    const codes = new Set<string>()
    for (const t of operatorTagCatalog) {
      names.add(t.name)
      if (t.code) codes.add(t.code)
    }
    return { names, codes }
  }, [showHiddenTags, operatorTagCatalog])
  const { data: operators } = useOperators(activeProjectId ? Number(activeProjectId) : null)
  const userNameMap = useMemo(() => {
    const map = new Map<number, string>()
    if (operators) {
      for (const user of operators) {
        map.set(user.id, user.full_name)
      }
    }
    return map
  }, [operators])

  // Assignment mutations
  const assignClientMutation = useAssignClient()
  const bulkAssignClientsMutation = useBulkAssignClients()
  const bulkOptOutUbkiMutation = useBulkOptOutUbki()
  const bulkSubmitByClientsMutation = useBulkSubmitByClients()

  // Map API clients to display format
  const displayClients = useMemo(() => {
    return apiClients.map((client) =>
      mapAPIClientToDisplay(client, thresholds, userNameMap, showHiddenTags, operatorAllowedTags)
    )
  }, [apiClients, thresholds, userNameMap, showHiddenTags, operatorAllowedTags])

  // Count applied filters
  const appliedFiltersCount = useMemo(() => {
    let count = 0
    if (filters.debtRangeFrom || filters.debtRangeTo) count++
    if (filters.principalRangeFrom || filters.principalRangeTo) count++
    // DPD Range not yet implemented (days past due not calculated)
    // if (filters.dpdRangeFrom || filters.dpdRangeTo) count++
    if (filters.dateOfSaleFrom || filters.dateOfSaleTo) count++
    if (filters.taDateFrom || filters.taDateTo) count++
    if (filters.interactionUserIds && filters.interactionUserIds.length > 0) count++
    if (filters.interactionDateFrom || filters.interactionDateTo) count++
    if (filters.assignmentDateFrom || filters.assignmentDateTo) count++
    if (filters.portfolio && filters.portfolio.length > 0) count++
    if (
      (filters.tagIds && filters.tagIds.length > 0) ||
      (filters.excludeTagIds && filters.excludeTagIds.length > 0) ||
      filters.segmentId
    )
      count++
    if (filters.responsibleEmployeeIds && filters.responsibleEmployeeIds.length > 0) count++
    if (filters.responsibleSearcher) count++
    if (filters.unassignedOnly) count++
    if (filters.hasVerifiedPayment) count++
    if (filters.chainIds && filters.chainIds.length > 0) count++
    if (filters.chainStepIds && filters.chainStepIds.length > 0) count++
    if (filters.stepValues && Object.keys(filters.stepValues).length > 0) count++
    if (selectedPriorities.length > 0) count++
    if (selectedV3Buckets.length > 0) count++
    return count
  }, [filters, selectedPriorities, selectedV3Buckets])

  // All filtering (including search) is now handled server-side
  const filteredClients = displayClients

  // Map API priority summary to component format
  const priorityStats = useMemo(() => {
    if (!prioritySummaryData) {
      return {
        Critical: { totalDebt: 0, count: 0 },
        High: { totalDebt: 0, count: 0 },
        Medium: { totalDebt: 0, count: 0 },
        Low: { totalDebt: 0, count: 0 },
      }
    }

    return {
      Critical: {
        totalDebt: prioritySummaryData.critical.total_debt,
        count: prioritySummaryData.critical.count,
      },
      High: {
        totalDebt: prioritySummaryData.high.total_debt,
        count: prioritySummaryData.high.count,
      },
      Medium: {
        totalDebt: prioritySummaryData.medium.total_debt,
        count: prioritySummaryData.medium.count,
      },
      Low: {
        totalDebt: prioritySummaryData.low.total_debt,
        count: prioritySummaryData.low.count,
      },
    }
  }, [prioritySummaryData])

  const handleSort = (key: string, order: 'asc' | 'desc') => {
    setSortBy(key)
    setSortOrder(order)
    // Reset to page 1 when sort changes
    setCurrentPage(1)
  }

  const handleSelectPage = () => {
    setAllClientsSelected(false)
    setExcludedClients(new Set())
    setSelectedClients(new Set(filteredClients.map((client) => client.id)))
  }

  const exceedsBulkLimit = (): boolean => {
    if (totalSelectedCount > BULK_ACTION_LIMIT) {
      toast.error(
        t(
          'pages.clients.bulkActions.limitExceeded',
          'The maximum allowed selection for bulk actions is 10,000 clients. Please narrow your filter and try again.'
        )
      )
      return true
    }
    return false
  }

  const resolveBulkClientIds = async (): Promise<number[]> => {
    if (allClientsSelected) {
      return fetchFilteredClientIds(clientListFilterParams, excludedClients)
    }
    return Array.from(selectedClients).map(Number)
  }

  const handleBulkAssign = () => {
    if (totalSelectedCount === 0) {
      toast.error(
        t(
          'pages.clients.bulkActions.selectClientsFirst',
          'Select at least one client before starting a bulk action'
        )
      )
      return
    }
    if (exceedsBulkLimit()) return
    setShowBulkAssignModal(true)
  }

  const openBulkTagModal = async (action: 'add' | 'remove') => {
    if (totalSelectedCount === 0) {
      toast.error(
        t(
          'pages.clients.bulkActions.selectClientsFirst',
          'Select at least one client before starting a bulk action'
        )
      )
      return
    }
    if (exceedsBulkLimit()) return
    const ids = await resolveBulkClientIds()
    setBulkTagClientIds(ids)
    setBulkTagAction(action)
    setShowBulkTagModal(true)
  }

  const handleBulkAddTags = () => {
    void openBulkTagModal('add')
  }

  const handleBulkRemoveTags = () => {
    void openBulkTagModal('remove')
  }

  const handleBulkSendMessage = () => {
    if (totalSelectedCount === 0) {
      toast.error(
        t(
          'pages.clients.bulkActions.selectClientsFirst',
          'Select at least one client before starting a bulk action'
        )
      )
      return
    }
    if (exceedsBulkLimit()) return
    setShowBulkSendMessageModal(true)
  }

  // Resolve the currently-selected client IDs (respecting select-all-across-pages
  // minus the explicitly excluded rows). Mirrors handleBulkAssignSubmit.
  const resolveSelectedClientIds = (): number[] => {
    if (allClientsSelected) {
      return apiClients
        .filter((client) => !excludedClients.has(client.id))
        .map((client) => client.id)
    }
    return Array.from(selectedClients).map(Number)
  }

  const handleBulkUbkiOptOut = (doNotSend: boolean) => {
    const clientIds = resolveSelectedClientIds()
    if (clientIds.length === 0) {
      toast.error(
        t(
          'pages.clients.bulkActions.selectClientsFirst',
          'Select at least one client before starting a bulk action'
        )
      )
      return
    }
    bulkOptOutUbkiMutation.mutate(
      { client_ids: clientIds, do_not_send: doNotSend },
      {
        onSuccess: () => {
          setSelectedClients(new Set())
          setAllClientsSelected(false)
          setExcludedClients(new Set())
        },
      }
    )
  }

  // Bulk "Send to UBKI": submit all loans for the currently-selected clients.
  // Server-side expansion handles per-client loans and auto-skips opted-out
  // clients, so we only need to pass client_ids (mirrors handleBulkUbkiOptOut).
  const handleBulkUbkiSubmit = () => {
    const clientIds = resolveSelectedClientIds()
    if (clientIds.length === 0) {
      toast.error(
        t(
          'pages.clients.bulkActions.selectClientsFirst',
          'Select at least one client before starting a bulk action'
        )
      )
      return
    }
    bulkSubmitByClientsMutation.mutate(
      { client_ids: clientIds },
      {
        onSuccess: () => {
          setSelectedClients(new Set())
          setAllClientsSelected(false)
          setExcludedClients(new Set())
        },
      }
    )
  }

  const handleBulkAssignSubmit = async (assignmentData: {
    employeeId?: string
    searcherId?: string
    distributionMethod: 'assign-all' | 'distribute-evenly'
    reason: string
  }) => {
    if (exceedsBulkLimit()) return

    const clientIds = await resolveBulkClientIds()

    if (clientIds.length === 0) return

    bulkAssignClientsMutation.mutate(
      {
        client_ids: clientIds,
        responsible_employee_id: assignmentData.employeeId
          ? parseInt(assignmentData.employeeId)
          : undefined,
        responsible_searcher_id: assignmentData.searcherId
          ? parseInt(assignmentData.searcherId)
          : undefined,
        assignment_reason: assignmentData.reason,
      },
      {
        onSuccess: () => {
          // Close modal and clear selection after successful assignment
          setShowBulkAssignModal(false)
          setSelectedClients(new Set())
          setAllClientsSelected(false)
          setExcludedClients(new Set())
        },
      }
    )
  }

  // Get selected clients data for bulk assign modal
  const selectedClientsData = useMemo(() => {
    if (allClientsSelected) {
      // If all clients are selected, use current page clients as preview
      // The actual count will be totalCount - excludedClients.size
      return filteredClients
        .filter((client) => !excludedClients.has(client.id))
        .map((client) => ({
          id: client.id,
          fullName: client.fullName,
          priority: client.priority,
          score: client.score,
          debt: client.debt,
        }))
    }
    return filteredClients
      .filter((client) => selectedClients.has(client.id))
      .map((client) => ({
        id: client.id,
        fullName: client.fullName,
        priority: client.priority,
        score: client.score,
        debt: client.debt,
      }))
  }, [filteredClients, selectedClients, allClientsSelected, excludedClients])

  // Calculate total selected count for bulk assign modal
  const totalSelectedCount = useMemo(() => {
    if (allClientsSelected) {
      return totalCount - excludedClients.size
    }
    return selectedClients.size
  }, [allClientsSelected, totalCount, excludedClients.size, selectedClients.size])

  // Individual row assign handler
  const handleAssign = (clientId: number) => {
    setAssignModalClientId(clientId)
  }

  // Tag management handler
  const handleManageTags = (clientId: number, clientName: string) => {
    setSelectedClientForTags({ id: clientId, name: clientName })
    setTagModalOpen(true)
  }

  const handleAssignSubmit = (assignmentData: {
    employeeId?: string
    searcherId?: string
    reason: string
  }) => {
    if (!assignModalClientId) return

    assignClientMutation.mutate(
      {
        clientId: assignModalClientId,
        data: {
          responsible_employee_id: assignmentData.employeeId
            ? parseInt(assignmentData.employeeId)
            : undefined,
          responsible_searcher_id: assignmentData.searcherId
            ? parseInt(assignmentData.searcherId)
            : undefined,
          assignment_reason: assignmentData.reason,
        },
      },
      {
        onSuccess: () => {
          // Close modal after successful assignment
          setAssignModalClientId(null)
        },
      }
    )
  }

  const handleSelectionChange = (selectedItems: Set<number | string>) => {
    const newSelection = new Set(Array.from(selectedItems).map(Number))

    // If selection is completely empty, clear all selection state
    if (newSelection.size === 0) {
      setSelectedClients(new Set())
      setAllClientsSelected(false)
      setExcludedClients(new Set())
      return
    }

    if (allClientsSelected) {
      // When all items are selected, track which items are excluded (unchecked)
      const currentPageIds = new Set(filteredClients.map((client) => client.id))
      const uncheckedOnCurrentPage = filteredClients
        .filter((client) => !newSelection.has(client.id))
        .map((client) => client.id)

      // Add unchecked items to excluded set
      const newExcluded = new Set(excludedClients)
      uncheckedOnCurrentPage.forEach((id) => newExcluded.add(id))

      // Remove items that are checked again from excluded set
      currentPageIds.forEach((id) => {
        if (newSelection.has(id)) {
          newExcluded.delete(id)
        }
      })

      setExcludedClients(newExcluded)
      setSelectedClients(newSelection)

      // If all items are checked again (no exclusions), clear excluded set
      if (newExcluded.size === 0) {
        setExcludedClients(new Set())
      }
    } else {
      // Normal selection mode
      setSelectedClients(newSelection)
      setExcludedClients(new Set())
    }
  }

  const handleSelectAll = () => {
    // Select all items across all pages
    setAllClientsSelected(true)
    setExcludedClients(new Set()) // Clear any exclusions
    // Also select all items on the current page for visual feedback
    const currentPageIds = new Set(filteredClients.map((client) => client.id))
    setSelectedClients(currentPageIds)
    // Note: We mark all as selected, so the count will show "Selected 14060 of 14060"
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    // Don't clear selection when page changes - keep selections across pages
  }

  // Handler to update filters from ClientFiltersBar
  // Uses functional updates for array filters to avoid stale closure issues
  const handleFilterChange = (
    newFilters: ClientFilters & { _action?: string; _value?: string | number; _checked?: boolean }
  ) => {
    // Handle toggle actions with functional updates to avoid stale state
    if (newFilters._action === 'togglePortfolio') {
      const sellerId = newFilters._value as number
      const checked = newFilters._checked as boolean
      setPortfolioFilter((prev) =>
        checked ? [...prev, sellerId] : prev.filter((id) => id !== sellerId)
      )
      setCurrentPage(1)
      return
    }

    if (newFilters._action === 'cycleTag') {
      const tagId = newFilters._value as number
      const next = cycleTagTriState(
        { includeIds: tagIdsFilter, excludeIds: excludeTagIdsFilter },
        tagId
      )
      setTagIdsFilter(next.includeIds)
      setExcludeTagIdsFilter(next.excludeIds)
      // Manual tag selection clears segment (mutually exclusive)
      if (next.includeIds.length > 0 || next.excludeIds.length > 0) {
        setSegmentIdFilter(0)
      }
      setCurrentPage(1)
      return
    }

    if (newFilters._action === 'toggleRrStatus') {
      const statusId = newFilters._value as number
      const checked = newFilters._checked as boolean
      setRrStatusFilter((prev) =>
        checked ? [...prev, statusId] : prev.filter((id) => id !== statusId)
      )
      setCurrentPage(1)
      return
    }

    // Handle regular filter updates (non-toggle actions)
    // Only update if value has actually changed (use JSON.stringify for deep comparison)
    if (JSON.stringify(newFilters.portfolio) !== JSON.stringify(portfolioFilter)) {
      setPortfolioFilter(newFilters.portfolio || [])
    }
    if (JSON.stringify(newFilters.tagIds) !== JSON.stringify(tagIdsFilter)) {
      setTagIdsFilter(newFilters.tagIds || [])
    }
    if (JSON.stringify(newFilters.rrStatusIds) !== JSON.stringify(rrStatusFilter)) {
      setRrStatusFilter(newFilters.rrStatusIds || [])
    }
    if (JSON.stringify(newFilters.excludeTagIds) !== JSON.stringify(excludeTagIdsFilter)) {
      setExcludeTagIdsFilter(newFilters.excludeTagIds || [])
    }
    if ((newFilters.segmentId || 0) !== segmentIdFilter) {
      setSegmentIdFilter(newFilters.segmentId || 0)
    }
    if (
      JSON.stringify(newFilters.responsibleEmployeeIds) !==
      JSON.stringify(responsibleEmployeeIdsFilter)
    ) {
      setResponsibleEmployeeIdsFilter(newFilters.responsibleEmployeeIds || [])
    }
    if (newFilters.responsibleSearcher !== responsibleSearcherFilter) {
      setResponsibleSearcherFilter(newFilters.responsibleSearcher || '')
    }
    if (newFilters.unassignedOnly !== unassignedOnlyFilter) {
      setUnassignedOnlyFilter(newFilters.unassignedOnly || false)
    }
    if (newFilters.hasVerifiedPayment !== hasVerifiedPaymentFilter) {
      setHasVerifiedPaymentFilter(newFilters.hasVerifiedPayment || false)
    }
    if (newFilters.dateOfSaleFrom !== dateOfSaleFromFilter) {
      setDateOfSaleFromFilter(newFilters.dateOfSaleFrom || '')
    }
    if (newFilters.dateOfSaleTo !== dateOfSaleToFilter) {
      setDateOfSaleToFilter(newFilters.dateOfSaleTo || '')
    }
    if (newFilters.debtRangeFrom !== debtRangeFromFilter) {
      setDebtRangeFromFilter(newFilters.debtRangeFrom || 0)
    }
    if (newFilters.debtRangeTo !== debtRangeToFilter) {
      setDebtRangeToFilter(newFilters.debtRangeTo || 0)
    }
    if (newFilters.principalRangeFrom !== principalRangeFromFilter) {
      setPrincipalRangeFromFilter(newFilters.principalRangeFrom || 0)
    }
    if (newFilters.principalRangeTo !== principalRangeToFilter) {
      setPrincipalRangeToFilter(newFilters.principalRangeTo || 0)
    }
    if (newFilters.dpdRangeFrom !== dpdRangeFromFilter) {
      setDpdRangeFromFilter(newFilters.dpdRangeFrom || 0)
    }
    if (newFilters.dpdRangeTo !== dpdRangeToFilter) {
      setDpdRangeToFilter(newFilters.dpdRangeTo || 0)
    }
    if (newFilters.taDateFrom !== taDateFromFilter) {
      setTaDateFromFilter(newFilters.taDateFrom || '')
    }
    if (newFilters.taDateTo !== taDateToFilter) {
      setTaDateToFilter(newFilters.taDateTo || '')
    }
    if (
      JSON.stringify(newFilters.interactionUserIds) !== JSON.stringify(interactionUserIdsFilter)
    ) {
      setInteractionUserIdsFilter(newFilters.interactionUserIds || [])
    }
    if (newFilters.interactionDateFrom !== interactionDateFromFilter) {
      setInteractionDateFromFilter(newFilters.interactionDateFrom || '')
    }
    if (newFilters.interactionDateTo !== interactionDateToFilter) {
      setInteractionDateToFilter(newFilters.interactionDateTo || '')
    }
    if (newFilters.assignmentDateFrom !== assignmentDateFromFilter) {
      setAssignmentDateFromFilter(newFilters.assignmentDateFrom || '')
    }
    if (newFilters.assignmentDateTo !== assignmentDateToFilter) {
      setAssignmentDateToFilter(newFilters.assignmentDateTo || '')
    }
    if (
      newFilters.onlyLastChain !== undefined &&
      newFilters.onlyLastChain !== onlyLastChainFilter
    ) {
      setOnlyLastChainFilter(newFilters.onlyLastChain)
    }
    // Chain change resets the step picks and their per-step values —
    // both belong to the previously-selected chains and their IDs would
    // be orphans on the BE otherwise. Compared by value: the bar hands back
    // a fresh array on every render, so identity would reset on every keystroke.
    const nextChainIds = newFilters.chainIds ?? []
    if (JSON.stringify(nextChainIds) !== JSON.stringify(chainIdsFilter)) {
      setChainIdsFilter(nextChainIds)
      setChainStepIdsFilter([])
      setStepValuesRawFilter('')
    } else {
      const nextStepIds = newFilters.chainStepIds ?? []
      const stepsChanged = JSON.stringify(nextStepIds) !== JSON.stringify(chainStepIdsFilter)
      if (stepsChanged) {
        setChainStepIdsFilter(nextStepIds)
        // Drop value entries for steps that were just deselected so the
        // BE doesn't keep filtering on inputs the operator can't see.
        const picked = new Set(nextStepIds)
        const filtered: Record<number, StepValueEntry> = {}
        for (const [k, v] of Object.entries(stepValuesFilter)) {
          const id = Number(k)
          if (picked.has(id)) filtered[id] = v
        }
        setStepValuesRawFilter(encodeStepValues(filtered))
      }
      if (newFilters.stepValues !== undefined) {
        const encoded = encodeStepValues(newFilters.stepValues)
        if (encoded !== stepValuesRawFilter) {
          setStepValuesRawFilter(encoded)
        }
      }
    }

    // Reset to page 1 when filters change
    setCurrentPage(1)
  }

  const handleClearAll = () => {
    // Clear all URL state filters (useURLState will handle URL updates after debounce)
    setSelectedPriorities([])
    setPortfolioFilter([])
    setTagIdsFilter([])
    setRrStatusFilter([])
    setExcludeTagIdsFilter([])
    setSegmentIdFilter(0)
    setResponsibleEmployeeFilter('')
    setResponsibleEmployeeIdsFilter([])
    setResponsibleSearcherFilter('')
    setUnassignedOnlyFilter(false)
    setHasVerifiedPaymentFilter(false)
    setDateOfSaleFromFilter('')
    setDateOfSaleToFilter('')
    setDebtRangeFromFilter(0)
    setDebtRangeToFilter(0)
    setPrincipalRangeFromFilter(0)
    setPrincipalRangeToFilter(0)
    setDpdRangeFromFilter(0)
    setDpdRangeToFilter(0)
    setTaDateFromFilter('')
    setTaDateToFilter('')
    setInteractionUserIdsFilter([])
    setInteractionDateFromFilter('')
    setInteractionDateToFilter('')
    setAssignmentDateFromFilter('')
    setAssignmentDateToFilter('')
    setChainIdsFilter([])
    // Back to the default, not to false — Clear All restores defaults.
    setOnlyLastChainFilter(true)
    setChainStepIdsFilter([])
    setStepValuesRawFilter('')

    // Reset to first page
    setCurrentPage(1)

    // Reset sorting to defaults
    setSortBy('priority')
    setSortOrder('desc')

    // Clear search query from global store
    clearSearchQuery('')

    // Clear localStorage saved state
    if (STORAGE_KEY) {
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch (e) {
        console.error('Failed to clear localStorage:', e)
      }
    }
  }

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(num)) return '0'
    return new Intl.NumberFormat(spanishLocaleOr(i18n.language, 'uk-UA'), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true,
    })
      .format(num)
      .replace(/,/g, ' ')
  }

  // Get tag icon based on tag name

  const columns: Column<DisplayClient>[] = [
    {
      key: 'id',
      header: '#',
      align: 'left',
      render: (client) => {
        const index = filteredClients.findIndex((c) => c.id === client.id)
        const rowNumber = (currentPage - 1) * rowsPerPage + index + 1
        return rowNumber
      },
    },
    {
      key: 'fullName',
      header: t('pages.clients.tableHeaders.fullName'),
      align: 'left',
      sortable: true,
      sortKey: 'fullName',
      render: (client) => (
        <Link
          to={`/dashboard/clients/${client.id}?from=list`}
          className="text-primary-700 hover:text-primary-600 cursor-pointer text-left hover:underline"
        >
          {client.fullName}
        </Link>
      ),
    },
    {
      key: 'taxIdNumber',
      header: t('pages.clients.tableHeaders.taxIdNumber'),
      align: 'left',
      sortable: true,
      sortKey: 'taxIdNumber',
      render: (client) => (
        <Link
          to={`/dashboard/clients/${client.id}?from=list`}
          className="text-primary-700 hover:text-primary-600 cursor-pointer text-left hover:underline"
        >
          {client.taxIdNumber}
        </Link>
      ),
    },
    {
      key: 'tags',
      header: t('pages.clients.tableHeaders.tags'),
      align: 'left',
      render: (client) => {
        const tags = client.tags || []
        const visibleTags = tags.slice(0, 3)
        const remainingCount = tags.length - 3

        return (
          <div className="flex flex-wrap items-center gap-1">
            {tags.length > 0 ? (
              <>
                {visibleTags.map((tag) => (
                  <TagBadge
                    key={tag.id}
                    name={tag.name}
                    color={tag.color}
                    size="sm"
                    isProtected={tag.is_protected}
                    expiryType={tag.expiry_type}
                  />
                ))}
                {remainingCount > 0 && (
                  <span
                    className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium"
                    title={tags
                      .slice(3)
                      .map((t) => t.name)
                      .join(', ')}
                  >
                    +{remainingCount}
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground text-xs">-</span>
            )}
          </div>
        )
      },
    },
    {
      key: 'phoneNumber',
      header: t('pages.clients.tableHeaders.phoneNumber'),
      align: 'left',
      render: (client) => client.phoneNumber,
    },
    {
      key: 'creditor',
      header: t('pages.clients.tableHeaders.creditor'),
      align: 'left',
    },
    {
      key: 'debt',
      header: t('pages.clients.tableHeaders.totalDebt'),
      align: 'right',
      sortable: true,
      sortKey: 'debt',
      render: (client) => withCurrency(formatCurrency(client.debt), 'suffix'),
    },
    {
      key: 'priority',
      header: t('pages.clients.tableHeaders.priority'),
      align: 'left',
      sortable: true,
      sortKey: 'priority',
      render: (client) => {
        const v3 = v3UiEnabled ? v3Rollup?.get(client.id) : undefined
        // Compliance does not need a model. A debtor who has died, is marked
        // as fraud, or is in court must never be offered for calling — and we
        // already know that without any score. Checking it BEFORE the v3 lookup
        // means the exclusion holds for the ~38% of clients the model does not
        // cover, which is exactly where the old badge said "Critical".
        const blocked = client.isDeceased || client.isFraudster || client.lawsuitFiled
        if (v3UiEnabled && blocked) return <V3BucketBadge bucket="EXIT" />
        if (v3) return <V3BucketBadge bucket={v3.bucket_v3} />
        // Cut over, but this client has no v3 score — their debts all predate
        // the model's cohort. Falling back to the LEGACY badge here was wrong
        // twice over: it silently mixed two scoring systems in one column, and
        // it labelled compliance cases (a deceased debtor) "Critical", i.e.
        // call first. Industry practice for an unscorable record is to say so,
        // never to substitute a number from a different model.
        if (v3UiEnabled) return <NotScoredBadge />
        return <PriorityBadge priority={client.priority} variant="compact" />
      },
    },
    {
      key: 'score',
      header: t('pages.clients.tableHeaders.score'),
      align: 'right',
      sortable: true,
      sortKey: 'score',
    },
    {
      key: 'lastPurchaseDate',
      header: t('pages.clients.tableHeaders.lastPurchaseDate'),
      align: 'left',
      sortable: true,
      sortKey: 'lastPurchaseDate',
    },
    {
      key: 'employeeName',
      header: t('pages.clients.tableHeaders.employee'),
      align: 'left',
    },
    {
      key: 'searcherName',
      header: t('pages.clients.tableHeaders.searcher'),
      align: 'left',
    },
    {
      key: 'assignmentDate',
      header: t('pages.clients.tableHeaders.assignmentDate'),
      align: 'left',
      sortable: true,
      sortKey: 'assignmentDate',
    },
    {
      key: 'lastInteractionResult',
      header: t('pages.clients.tableHeaders.lastInteractionResult', 'Last Interaction Result'),
      align: 'left',
      sortable: true,
      sortKey: 'lastInteractionResult',
      render: (client) => client.lastInteractionResult,
    },
    {
      key: 'ubki',
      header: t('pages.clients.tableHeaders.ubki', 'UBKI'),
      align: 'center',
      render: (client) =>
        client.doNotSendToUbki ? (
          <span
            className="bg-error-100 text-error-700 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            title={t(
              'pages.clients.detail.ubki.optedOutTooltip',
              'Client is opted out of UBKI; submission is disabled.'
            )}
          >
            {t('pages.clients.detail.ubki.optedOut', 'Opted out')}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        ),
    },
    {
      key: 'actions',
      header: t('pages.clients.tableHeaders.actions'),
      align: 'center',
      render: (client) => {
        // Disable assign button when bulk actions are active (items are selected)
        const isBulkActionActive = selectedClients.size > 0 || allClientsSelected
        return (
          <div
            className="flex items-center justify-center gap-2 sm:gap-4"
            data-testid={`client-actions-${client.id}`}
          >
            {/* Desktop: Individual buttons */}
            <div className="hidden items-center gap-4 lg:flex">
              {/* Reassign trigger is always visible; warn-on-click happens on the
                  modal's Submit (PERMISSIONS.CLIENTS.REASSIGN_RESPONSIBLE). */}
              <LinkButton
                variant="regular-black"
                size="xs"
                onClick={() => handleAssign(client.id)}
                leftIcon={<Icons.PencilEdit size={16} strokeWidth={1.5} />}
                disabled={isBulkActionActive}
              >
                {t('pages.clients.assign')}
              </LinkButton>
              <PermissionGuard permission={PERMISSIONS.CLIENTS.EDIT}>
                <LinkButton
                  variant="regular-black"
                  size="xs"
                  onClick={() => handleManageTags(client.id, client.fullName)}
                  leftIcon={<Icons.File size={16} strokeWidth={1.5} />}
                  disabled={isBulkActionActive}
                  data-testid={`tag-button-${client.id}`}
                >
                  {t('pages.clients.manageTags')}
                </LinkButton>
              </PermissionGuard>
            </div>

            {/* Mobile/Tablet: Dropdown button group */}
            <div className="lg:hidden">
              <DropdownMenu
                modal={false}
                open={openDropdownClientId === client.id}
                onOpenChange={(open) => setOpenDropdownClientId(open ? client.id : null)}
              >
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="border-border bg-card text-foreground hover:bg-muted focus-visible:ring-ring flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={t('pages.clients.tableHeaders.actions')}
                    disabled={isBulkActionActive}
                  >
                    <Icons.FilterVertical size={16} strokeWidth={1.5} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="border-border bg-card">
                  {/* Reassign trigger is always visible; warn-on-click happens on the
                      modal's Submit (PERMISSIONS.CLIENTS.REASSIGN_RESPONSIBLE). */}
                  <DropdownMenuItem
                    onClick={() => handleAssign(client.id)}
                    className="text-foreground flex cursor-pointer items-center gap-2 text-sm"
                    disabled={isBulkActionActive}
                  >
                    <Icons.PencilEdit size={16} strokeWidth={1.5} />
                    <span>{t('pages.clients.assign')}</span>
                  </DropdownMenuItem>
                  <PermissionGuard permission={PERMISSIONS.CLIENTS.EDIT}>
                    <DropdownMenuItem
                      onClick={() => handleManageTags(client.id, client.fullName)}
                      className="text-foreground flex cursor-pointer items-center gap-2 text-sm"
                      disabled={isBulkActionActive}
                      data-testid={`tag-button-${client.id}`}
                    >
                      <Icons.File size={16} strokeWidth={1.5} />
                      <span>{t('pages.clients.manageTags')}</span>
                    </DropdownMenuItem>
                  </PermissionGuard>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )
      },
    },
    {
      key: 'lastOutgoingTADate',
      header: t('pages.clients.tableHeaders.lastOutgoingTADate', 'Last outgoing TA date'),
      align: 'left',
      sortable: true,
      sortKey: 'lastOutgoingTADate',
      render: (client) =>
        client.lastTaDate ? formatDateTime(client.lastTaDate, user?.timezone) : '—',
    },
  ]

  // Columns hidden from the dashboard table per product spec. They remain
  // defined above (data + render intact) and are only filtered out at render
  // time, so re-enabling one is a one-line change here. The bulk-selection
  // checkbox is rendered by DataTable itself and is intentionally kept.
  const HIDDEN_COLUMN_KEYS = new Set(['creditor', 'actions'])
  const visibleColumns = columns.filter((c) => !HIDDEN_COLUMN_KEYS.has(c.key))

  // Show initial loading state (only when no data exists yet). The clients query
  // is intentionally disabled while operator options load (see useClients
  // `enabled` above); a disabled query reports isLoading=false, so cover that
  // gating window here too or the empty state would flash before the fetch runs.
  const awaitingOperatorOptions = operatorFilterActive && !operatorOptionsReady
  if ((isLoading || awaitingOperatorOptions) && apiClients.length === 0) {
    return <ClientManagementPageSkeleton />
  }

  // Show error state
  if (isError && apiClients.length === 0) {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-4 pt-20">
        <Icons.Warning className="text-error-500 h-8 w-8" strokeWidth={2} />
        <p className="text-foreground font-medium">{t('pages.clients.errorLoading')}</p>
        <p className="text-muted-foreground text-sm">
          {error?.message || t('pages.clients.errorOccurred')}
        </p>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="flex w-full flex-col items-start gap-3 px-2 sm:gap-4 sm:px-0">
        {/* Priority Overview Cards.
            After cutover these must show v3 buckets: leaving the legacy cards
            above v3 row badges put two scoring systems on one screen with
            totals that could not be reconciled against the rows beneath. */}
        {v3UiEnabled && v3Summary?.buckets?.length ? (
          <V3PriorityCards
            buckets={v3Summary.buckets}
            counts={v3BucketCounts?.counts}
            selected={selectedV3Buckets}
            onToggle={(bucket) => {
              setCurrentPage(1)
              setSelectedV3Buckets(
                selectedV3Buckets.includes(bucket)
                  ? selectedV3Buckets.filter((b) => b !== bucket)
                  : [...selectedV3Buckets, bucket]
              )
            }}
          />
        ) : (
          <PriorityCards
            priorityStats={priorityStats}
            selected={selectedPriorities}
            onToggle={handlePriorityToggle}
          />
        )}

        {/* List of Clients Section */}
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex flex-row items-center gap-2">
              <span className="text-foreground text-center text-xl leading-tight font-light tracking-[-0.4px] sm:text-2xl sm:tracking-[-0.48px]">
                {t('pages.clients.listOfClients')}
              </span>
              <span className="text-muted-foreground text-center text-sm leading-[155%] font-light tracking-[-0.28px] sm:text-base sm:tracking-[-0.32px]">
                {totalCount}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-5">
            {appliedFiltersCount > 0 && (
              <button
                onClick={handleClearAll}
                className="border-border bg-card text-foreground hover:bg-muted flex items-center gap-2 rounded-full border px-4 py-2.5 transition-colors"
              >
                <Icons.Cancel01 size={20} className="text-foreground" strokeWidth={1.5} />
                <span className="text-foreground text-center text-xs leading-[140%] font-medium tracking-[-0.24px]">
                  {t('pages.clients.clearAll')}
                </span>
              </button>
            )}
            <button
              onClick={() => setIsFiltersOpen(!isFiltersOpen)}
              className="border-border bg-card/50 flex flex-col items-start gap-2.5 rounded-lg border px-5 py-3 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <Icons.FilterVertical size={20} className="text-foreground" strokeWidth={1.5} />
                <span className="text-foreground text-center text-xs leading-[140%] font-light tracking-[-0.24px]">
                  {t('pages.clients.filtersLabel')}{' '}
                  <span className="font-medium">
                    ({appliedFiltersCount} {t('pages.clients.applied')})
                  </span>
                </span>
                <span className={`transition-transform ${isFiltersOpen ? 'rotate-180' : ''}`}>
                  <Icons.ArrowUp size={18} className="text-foreground" strokeWidth={1.5} />
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        {isFiltersOpen && (
          <ClientFiltersBar filters={filters} onFilterChange={handleFilterChange} />
        )}

        {/* Data Table - Show skeleton when fetching */}
        {isFetching && !isLoading ? (
          <div className="flex w-full flex-col items-start gap-4 self-stretch sm:gap-8">
            <TableSkeleton columns={columns.length + 1} rows={rowsPerPage} className="w-full" />
          </div>
        ) : (
          <div className="mx-0 w-full overflow-x-auto px-0">
            <DataTable
              columns={visibleColumns}
              data={filteredClients}
              sortConfig={sortConfig}
              onSort={handleSort}
              emptyMessage={t('pages.clients.noClientsFound')}
              className="flex flex-col items-start self-stretch"
              enableBulkSelection
              selectedItems={selectedClients}
              onSelectionChange={handleSelectionChange}
              totalCount={totalCount}
              onSelectPage={handleSelectPage}
              onSelectAllByFilter={handleSelectAll}
              pageSelectableCount={filteredClients.length}
              filterSelectableCount={totalCount}
              allItemsSelected={allClientsSelected}
              excludedItemsCount={excludedClients.size}
              excludedItems={excludedClients}
              headerActions={
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="primary"
                      size="sm"
                      className="h-9 gap-1.5 rounded-lg px-3 text-xs sm:h-10 sm:gap-2 sm:px-4 sm:text-sm"
                    >
                      <Icons.Settings
                        size={16}
                        className="text-primary-foreground sm:h-[18px] sm:w-[18px]"
                        strokeWidth={1.5}
                      />
                      <span className="hidden font-medium sm:inline">
                        {t('pages.clients.bulkActions.title')}
                      </span>
                      <span className="font-medium sm:hidden">{t('common.actions')}</span>
                      <Icons.ArrowDown
                        size={14}
                        className="text-primary-foreground sm:h-4 sm:w-4"
                        strokeWidth={1.5}
                      />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="border-border bg-card w-56 rounded-lg border p-1 shadow-lg"
                  >
                    {/* Bulk-assign trigger is always visible; warn-on-click happens on the
                        modal's Submit (PERMISSIONS.CLIENTS.REASSIGN_RESPONSIBLE). */}
                    <DropdownMenuItem
                      onClick={handleBulkAssign}
                      className="text-foreground hover:bg-muted focus:bg-muted flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition-colors"
                    >
                      <Icons.UserCheck01 size={18} className="text-foreground" strokeWidth={1.5} />
                      <span className="text-foreground text-sm font-medium">
                        {t('pages.clients.bulkActions.assignEmployee', 'Assign Employee')}
                      </span>
                    </DropdownMenuItem>
                    <PermissionGuard permission={PERMISSIONS.CLIENTS.ASSIGN_TAGS}>
                      <DropdownMenuItem
                        onClick={handleBulkAddTags}
                        className="text-foreground hover:bg-muted focus:bg-muted flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition-colors"
                      >
                        <Icons.PlusSignCircle
                          size={18}
                          className="text-foreground"
                          strokeWidth={1.5}
                        />
                        <span className="text-foreground text-sm font-medium">
                          {t('pages.clients.bulkActions.addTags', 'Add Tags')}
                        </span>
                      </DropdownMenuItem>
                    </PermissionGuard>
                    <PermissionGuard permission={PERMISSIONS.CLIENTS.ASSIGN_TAGS}>
                      <DropdownMenuItem
                        onClick={handleBulkRemoveTags}
                        className="text-foreground hover:bg-muted focus:bg-muted flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition-colors"
                      >
                        <Icons.Remove02 size={18} className="text-foreground" strokeWidth={1.5} />
                        <span className="text-foreground text-sm font-medium">
                          {t('pages.clients.bulkActions.removeTags', 'Remove Tags')}
                        </span>
                      </DropdownMenuItem>
                    </PermissionGuard>
                    <PermissionGuard permissions={ALL_MESSAGING_LAUNCH_PERMISSIONS} mode="any">
                      <DropdownMenuItem
                        onClick={handleBulkSendMessage}
                        className="text-foreground hover:bg-muted focus:bg-muted flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition-colors"
                      >
                        <Icons.MessageMultiple01
                          size={18}
                          className="text-foreground"
                          strokeWidth={1.5}
                        />
                        <span className="text-foreground text-sm font-medium">
                          {t('pages.clients.bulkActions.sendMessage', 'Send Message')}
                        </span>
                      </DropdownMenuItem>
                    </PermissionGuard>
                    {/* Bulk "Send to UBKI" disabled for the release via
                        ENABLE_BULK_UBKI_SUBMISSION (see the flag definition above). */}
                    {ENABLE_BULK_UBKI_SUBMISSION && (
                      <PermissionGuard permission={PERMISSIONS.UBKI.SUBMIT}>
                        <DropdownMenuItem
                          onClick={handleBulkUbkiSubmit}
                          disabled={
                            totalSelectedCount === 0 || bulkSubmitByClientsMutation.isPending
                          }
                          className="text-foreground hover:bg-muted focus:bg-muted flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition-colors"
                        >
                          <Icons.MailSend01
                            size={18}
                            className="text-foreground"
                            strokeWidth={1.5}
                          />
                          <span className="text-foreground text-sm font-medium">
                            {t('pages.clients.bulkActions.submitUbki', 'Send to UBKI')}
                          </span>
                        </DropdownMenuItem>
                      </PermissionGuard>
                    )}
                    <PermissionGuard permission={PERMISSIONS.CLIENTS.EDIT}>
                      <DropdownMenuItem
                        onClick={() => handleBulkUbkiOptOut(true)}
                        className="text-foreground hover:bg-muted focus:bg-muted flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition-colors"
                      >
                        <Icons.Cancel01 size={18} className="text-foreground" strokeWidth={1.5} />
                        <span className="text-foreground text-sm font-medium">
                          {t('pages.clients.bulkActions.optOutUbki', 'Do not send to UBKI')}
                        </span>
                      </DropdownMenuItem>
                    </PermissionGuard>
                    <PermissionGuard permission={PERMISSIONS.CLIENTS.EDIT}>
                      <DropdownMenuItem
                        onClick={() => handleBulkUbkiOptOut(false)}
                        className="text-foreground hover:bg-muted focus:bg-muted flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition-colors"
                      >
                        <Icons.Reload size={18} className="text-foreground" strokeWidth={1.5} />
                        <span className="text-foreground text-sm font-medium">
                          {t('pages.clients.bulkActions.optInUbki', 'Re-enable UBKI sending')}
                        </span>
                      </DropdownMenuItem>
                    </PermissionGuard>
                  </DropdownMenuContent>
                </DropdownMenu>
              }
            />
          </div>
        )}

        {/* Pagination */}
        {!isFetching && (
          <div className="flex w-full flex-col items-center gap-4 self-stretch sm:gap-8">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={rowsPerPage}
              pageSizeOptions={[10, 20, 50, 100]}
              onPageChange={handlePageChange}
              onPageSizeChange={setRowsPerPage}
            />
          </div>
        )}

        {/* Assign Client Modal */}
        <AssignClientModal
          open={assignModalClientId !== null}
          clientId={assignModalClientId}
          onClose={() => setAssignModalClientId(null)}
          onAssign={handleAssignSubmit}
        />

        {/* Bulk Assign Client Modal */}
        <BulkAssignClientModal
          open={showBulkAssignModal}
          selectedClientIds={selectedClients}
          selectedClients={selectedClientsData}
          totalSelectedCount={totalSelectedCount}
          onClose={() => setShowBulkAssignModal(false)}
          onAssign={handleBulkAssignSubmit}
        />

        {/* Tag Selector Modal */}
        {selectedClientForTags && (
          <TagSelectorModal
            open={tagModalOpen}
            clientId={selectedClientForTags.id}
            clientName={selectedClientForTags.name}
            projectId={1}
            onClose={() => {
              setTagModalOpen(false)
              setSelectedClientForTags(null)
            }}
          />
        )}

        {/* Bulk Tag Modal */}
        <BulkTagModal
          open={showBulkTagModal}
          clientIds={bulkTagClientIds}
          clientCount={totalSelectedCount}
          action={bulkTagAction}
          onClose={() => setShowBulkTagModal(false)}
        />

        <BulkSendMessageModal
          open={showBulkSendMessageModal}
          clientIds={Array.from(selectedClients).map(Number)}
          selectedClients={selectedClientsData}
          totalSelectedCount={totalSelectedCount}
          allClientsSelectedAcrossPages={allClientsSelected}
          excludedClientIds={Array.from(excludedClients)}
          clientListFilterParams={clientListFilterParams}
          onClose={() => setShowBulkSendMessageModal(false)}
          onLaunched={() => {
            setShowBulkSendMessageModal(false)
            setSelectedClients(new Set())
            setAllClientsSelected(false)
            setExcludedClients(new Set())
          }}
        />
      </div>
    </TooltipProvider>
  )
}

export default ClientManagementPage
