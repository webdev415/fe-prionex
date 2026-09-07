/**
 * ChainExecutor — Operator UI for executing TA Chains.
 *
 * Unified one-window UI: chain selector at the top, body below shows
 * either a wizard (chains with delays or branches), an instant-mode
 * form (chains with neither — every step rendered at once and saved
 * in a single click), or a read-only preview with a Start button.
 *
 * Wizard: each step is a TA field (text/dropdown/date/amount/credit/
 * contact). Dropdown options carry flags (require_promise_date, etc.).
 * Auto-advance on dropdown selection; "Continue" for text/amount; one
 * "Save interaction" button at the last step commits the whole chain.
 *
 * Instant: same per-step fields, but visible at once. On Save we run
 * start → advance × (N-1) → create interaction → final advance,
 * preserving per-step effects.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DateSelect } from '@/components/ui/DateSelect'
import {
  getDateTimeStringInTimezone,
  isWallTimeInPast,
  nowAsWallTimeInTimezone,
  notInPastTimeFilter,
  wallTimeAsTimezoneToUtcIso,
} from '@/lib/dateUtils'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Icons } from '@/lib/icons'
import {
  usePinTAChain,
  useTAChain,
  useTAChains,
  useUnpinTAChain,
} from '@/features/taChains/hooks/useTAChains'
import { useTargetActions } from '@/features/targetActions/hooks/useTargetActions'
import type { TargetAction, TADropdownValueOut } from '@/features/targetActions/api/types'
import { useTags } from '@/features/tags/hooks/useTags'
import { useAuthStore } from '@/stores/authStore'
import { useBuilderData } from '@/features/chainBuilder/hooks/useChainBuilder'
import {
  useStartChainInstance,
  useCreateTAInteraction,
  useAdvanceChainInstance,
  useClientChainInstances,
  useCancelChainInstance,
  useClientPinnedChainIds,
  useRewindChainInstance,
} from '@/features/taInteractions/hooks/useTAInteractions'
import type { TAChainStep } from '@/features/taChains/api/types'
import { useQuickPicks } from '@/features/quickPicks/hooks/useQuickPicks'
import type { QuickPick } from '@/features/quickPicks/api/types'
import { decideHotkeyAutoStart } from '@/features/taHotkeys/decideHotkeyAutoStart'
import { getErrorMessage } from '@/lib/errors'
import { useChainExecutorStore } from '@/stores/chainExecutorStore'
import { formatMoneyKopeckTight } from '@/lib/formatters'
import { useClientEmails } from '@/features/clients/hooks/useClientEmails'
import { useClientPhones } from '@/features/clients/hooks/useClientPhones'
import { pickSingleContactCandidate } from './taChainAutoSelect'
import { applyStepEdits, collectFromSnapshot, type StepEdit } from './taChainSaveData'
import {
  decideEnterSave,
  isPressForPanel,
  NOTES_FIELD_ATTR,
  resolveEnterSaveMode,
} from './decideEnterSave'

interface Props {
  clientId: number
  clientName?: string
  responsibleEmployeeId?: number | null
  debts?: Array<{
    id: number
    contract_number?: string
    remaining_debt_amount?: string | number | null
    days_past_due?: number | null
    seller_company?: string | null
    status?: string | null
  }>
  /**
   * Context-aware entry filter. When set, the chain list is narrowed to
   * chains that contain at least one contact-type step whose
   * ``contact_source`` matches. ``null`` (the default, used by the
   * header "Log Interaction" button) shows every available chain.
   */
  contactSource?: 'client' | 'recommender' | null
  /**
   * Phone number to pre-fill on contact-type steps. When set, contact
   * steps whose ``contact_source`` matches ``contactSource`` are
   * auto-selected with this value so the operator never has to pick
   * the phone manually. Empty value = no auto-fill (general entry).
   */
  prefilledPhone?: string | null
  /**
   * Which contact source ``prefilledPhone`` belongs to, when it must NOT also
   * narrow the chain list.
   *
   * The two were one prop, and that quietly broke hotkey launches: a phone
   * resolved from a recent call always has a source, and setting
   * ``contactSource`` filters the chain list — and with it the quick picks —
   * to chains touching that source. A template bound to a chain that does not
   * match simply vanished, so the modal opened and started nothing, which
   * looks exactly like a broken shortcut.
   *
   * Entry points that mean "show me only this phone's chains" keep passing
   * ``contactSource``. The hotkey path passes this instead: pre-select the
   * phone, leave the template list alone. Falls back to ``contactSource`` so
   * existing callers are unaffected.
   */
  prefilledPhoneSource?: 'client' | 'recommender' | null
  /**
   * Quick-pick template to start immediately on open, instead of making the
   * operator find it in the picker (KAN-973 hotkey quick-launch).
   *
   * Ignored when the client already has an active instance — that instance is
   * what the modal shows, and starting a second one would 409 on the server.
   * Ignored too when the id is not among the operator's accessible templates:
   * the ticket says a mapping to a template that became inaccessible behaves as
   * unassigned, so this quietly does nothing rather than reporting an error.
   */
  initialTemplateId?: number | null
  onSave?: () => void
  onMinimize?: () => void
  onMinimizeRef?: React.MutableRefObject<(() => void) | null>
}

interface InstantStepValue {
  value: string
  promiseDate: string
  promiseAmount: string
  creditId: string
  // True while the date field holds incomplete/invalid typed text, so the
  // save handler can block submission.
  dateInvalid?: boolean
}

function ChainExecutorSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="border-border bg-muted-foreground/25 h-10 w-full animate-pulse rounded-md border" />
      <div className="border-border bg-muted/60 space-y-3 rounded-lg border p-3">
        <div className="bg-muted-foreground/25 h-4 w-48 animate-pulse rounded" />
        <div className="bg-muted-foreground/25 h-10 w-full animate-pulse rounded-md" />
        <div className="bg-muted-foreground/25 h-10 w-full animate-pulse rounded-md" />
      </div>
    </div>
  )
}

const EMPTY_INSTANT_VALUE: InstantStepValue = {
  value: '',
  promiseDate: '',
  promiseAmount: '',
  creditId: '',
  dateInvalid: false,
}

// Shared props for the manually-typeable TA date field. Format uses dots
// (DD.MM.YYYY HH:MM) and a 09:00 default on first entry, per spec.
const MANUAL_DATE_FORMAT = 'dd.MM.yyyy HH:mm'
const MANUAL_DATE_DEFAULT_TIME = '09:00'

// "Date cannot be in the past" enforcement has two layers (KAN-578):
//   1. The calendar disables past days + greys out past time slots for today
//      (``notInPastBounds`` below), so the picker can't produce a past value.
//   2. Manual typing bypasses the calendar, so a past value can still be
//      *entered* — it's flagged inline immediately and blocks advancing the
//      step (``stepDateIsPast``).
// ``isWallTimeInPast`` evaluates "now" in the user's profile timezone,
// mirroring ``toUtcIsoIfDate``.
function stepDateIsPast(
  value: string | null | undefined,
  fieldType: string | null | undefined,
  notInPast: boolean | undefined,
  timezone: string | null | undefined
): boolean {
  if (!notInPast || fieldType !== 'date' || !value) return false
  return isWallTimeInPast(value, timezone)
}

// Calendar bounds for a step that forbids past dates: block past days via
// ``min`` and past time-of-day (today only) via ``filterTime``. Returns {} for
// unconstrained steps so the picker is unrestricted.
//
// "Now" is measured in the operator's PROFILE timezone, not the browser's
// (KAN-992 AC5). The wall time a slot shows is browser-local — that is all
// react-datepicker can render — but ``toUtcIsoIfDate`` below re-reads that
// same wall time as profile-timezone before saving. Measuring "past" on the
// browser clock therefore used a different reference from the one that stores
// the value: with the two zones apart, the picker offered a slot that
// ``stepDateIsPast`` then rejected on save, which is the confusion this ticket
// exists to remove rather than relocate. The helpers keep a stable identity
// per zone, so the time list does not thrash on re-render.
function notInPastBounds(notInPast: boolean | undefined, timezone: string | null | undefined) {
  if (!notInPast) return {}
  return {
    min: nowAsWallTimeInTimezone(timezone),
    filterTime: notInPastTimeFilter(timezone),
  }
}

// Date-type steps store the picker output as a naive browser-local string
// (e.g. "2026-04-30T00:53"). The user is mentally typing in their profile
// timezone (e.g. Kyiv), which may differ from the browser tz. So at submit
// time we re-interpret the naive wall time as profile-tz wall time, then
// convert to UTC ISO. If the value is already a UTC ISO (Z/+offset), pass
// through.
function toUtcIsoIfDate(
  value: string | null | undefined,
  fieldType: string | null | undefined,
  profileTimezone: string | null | undefined
): string | null {
  if (!value) return null
  if (fieldType !== 'date') return value
  if (/[Zz]$|[+-]\d{2}:\d{2}$/.test(value)) return value // already absolute
  if (!profileTimezone) {
    const d = new Date(value)
    return isNaN(d.getTime()) ? value : d.toISOString()
  }
  return wallTimeAsTimezoneToUtcIso(value, profileTimezone)
}

export function ChainExecutor({
  clientId,
  clientName,
  responsibleEmployeeId,
  debts = [],
  contactSource = null,
  prefilledPhoneSource = null,
  prefilledPhone = null,
  initialTemplateId = null,
  onSave,
  onMinimize,
  onMinimizeRef,
}: Props) {
  const { t } = useTranslation('common')

  // Department drives chain & quick-pick visibility for users on a
  // department-scoped role. Two cases bypass the department filter and
  // see every chain/pick in the project:
  //   1. Admins (`manage_settings` permission).
  //   2. Users on a default role with no `department_id` — the built-in
  //      "Operator" / "Supervisor" roles ship with `department_id = NULL`
  //      (see auth/models/role.py: "only for custom roles"). Treating
  //      these like admins means a fresh install works without forcing
  //      every project to define custom department-scoped roles.
  const { user } = useAuthStore()
  const isAdmin = user?.permissions?.includes('manage_settings') ?? false
  const operatorDepartmentId = user?.active_department_id ?? undefined
  const seesAllDepartments = isAdmin || operatorDepartmentId === undefined

  // Available chains (manual only, active). Department-scoped users get
  // their own department's chains; admins and default-role users get all.
  const { data: chainsData, isLoading: isLoadingChains } = useTAChains({
    include_inactive: false,
    department_id: seesAllDepartments ? undefined : operatorDepartmentId,
  })
  const manualChains = useMemo(() => {
    // Two independent settings, per KAN-318: Chain Type says who launches a
    // chain, Visibility says who may see it. Filtering on type alone left the
    // second unchecked — a System (hidden) chain that happened to be Manual
    // would have been offered here (KAN-1045). The server now withholds hidden
    // chains from operators too; this is the half that also holds for an admin,
    // who legitimately receives them for the settings screen.
    const all = (chainsData?.items ?? []).filter(
      (c) => c.chain_type === 'manual' && !c.is_system_hidden
    )
    // Strict context filter (refactor ticket): when this executor was
    // opened from a specific phone row, only show chains whose contact
    // steps target that phone's source. A chain qualifies when *any*
    // of its steps has the matching contact_source — that's the step
    // where the prefilled phone will land. Chains with no contact_source
    // tagged on any step are hidden under context entry because the
    // ticket calls for "only show TA whose contact type matches".
    if (!contactSource) return all
    return all.filter((c) => (c.steps ?? []).some((s) => s.contact_source === contactSource))
  }, [chainsData, contactSource])

  // The source the prefilled phone belongs to. Distinct from `contactSource`,
  // which additionally narrows the chain list — see the prop docs.
  const prefillSource = prefilledPhoneSource ?? contactSource

  // Full TA data (for dropdown values + flags)
  const { data: tasData } = useTargetActions({ include_hidden: false })
  const taById = useMemo(() => {
    const m = new Map<number, TargetAction>()
    for (const ta of tasData?.items ?? []) m.set(ta.id, ta)
    return m
  }, [tasData])

  // Tag names for the "Effects on save" panel
  const projectId = user?.active_project_id ? parseInt(user.active_project_id) : undefined
  const { data: tagsList } = useTags(projectId)
  const tagNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const tg of tagsList ?? []) m.set(tg.id, tg.name)
    return m
  }, [tagsList])

  // Quick picks are scoped per department: each pick row carries its own
  // `department_id`, and the server filters by it. The lookup uses the
  // operator's department — not "the first department of the first manual
  // chain", which is fragile (chains can belong to several departments,
  // and the order of `department_ids[]` is not meaningful). Users who
  // see every chain (admins and default-role users without a department)
  // also get every pick; the chain-id filter below still drops picks for
  // chains they can't actually run.
  const { data: quickPicksData } = useQuickPicks(
    seesAllDepartments ? undefined : operatorDepartmentId,
    { fetchAll: seesAllDepartments }
  )
  const quickPicks = useMemo(() => {
    const manualIds = new Set(manualChains.map((c) => c.id))
    return (quickPicksData ?? []).filter((qp) => manualIds.has(qp.chain_id))
  }, [quickPicksData, manualChains])

  // Active instance.
  //
  // "Active" is not enough on its own (KAN-1045). A chain whose Visibility is
  // System (hidden) is launched by its trigger and filled from that event's
  // payload; KAN-318 is explicit that it must never be visible or reachable by
  // a user "in any form at all". But an instance of one still exists on the
  // client while it runs — and if it is ever left active (the `email_confirmed`
  // chain was), this lookup used to adopt it as the operator's own unfinished
  // work: the picker below is hidden whenever `activeInstance` is set, so Log
  // Interaction opened straight into a system fill-in form nobody chose, whose
  // save then failed for want of the triggering event.
  //
  // Skipping those here rather than at each use is deliberate — it is the one
  // place that decides "is a chain running for this client", and every branch
  // downstream (picker, wizard, Enter-to-save, auto-advance) follows from it.
  const { data: instances } = useClientChainInstances(clientId)
  const activeInstance =
    instances?.find((i) => i.status === 'active' && !i.is_system_hidden) ?? null

  const [selectedChainId, setSelectedChainId] = useState<string>('')

  // Identifies "which selection do the all-at-once values belong to". Derived
  // once: the selection-reset effect writes it to lastInstantSelectionRef, and
  // the cards compare against it to know whether that reset has run yet. Both
  // sites must format it identically, and the JSX branch below has
  // ``activeInstance`` narrowed to never, so it cannot rebuild the string there.
  const instantSelectionKey = `${selectedChainId}|${activeInstance?.id ?? ''}`

  // Chain selector dropdown — search-enabled to handle many chains.
  const [chainOpen, setChainOpen] = useState(false)
  const [chainSearch, setChainSearch] = useState('')
  const filteredChains = useMemo(() => {
    const q = chainSearch.trim().toLowerCase()
    if (!q) return manualChains
    return manualChains.filter((c) => c.name.toLowerCase().includes(q))
  }, [manualChains, chainSearch])
  // Per-client pin: a chain becomes "pinned for this client" when at least
  // one of its interactions in this client's history is pinned. This is
  // additive to the chain-level `is_pinned` (which is project-wide).
  const { data: clientPinnedChainIdsData } = useClientPinnedChainIds(clientId)
  const clientPinnedChainIds = useMemo(
    () => new Set(clientPinnedChainIdsData ?? []),
    [clientPinnedChainIdsData]
  )
  const pinnedChains = useMemo(
    () => filteredChains.filter((c) => c.is_pinned || clientPinnedChainIds.has(c.id)),
    [filteredChains, clientPinnedChainIds]
  )
  const unpinnedChains = useMemo(
    () => filteredChains.filter((c) => !c.is_pinned && !clientPinnedChainIds.has(c.id)),
    [filteredChains, clientPinnedChainIds]
  )
  const selectedChainObj = useMemo(
    () => manualChains.find((c) => String(c.id) === selectedChainId) ?? null,
    [manualChains, selectedChainId]
  )

  const pinMut = usePinTAChain()
  const unpinMut = useUnpinTAChain()
  const toggleChainPin = async (chainId: number, currentlyPinned: boolean) => {
    try {
      if (currentlyPinned) {
        await unpinMut.mutateAsync(chainId)
      } else {
        await pinMut.mutateAsync(chainId)
      }
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  // Templates (quick picks) dropdown — replaces the old chip row.
  const [templateOpen, setTemplateOpen] = useState(false)
  const [templateSearch, setTemplateSearch] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  const filteredTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase()
    if (!q) return quickPicks
    return quickPicks.filter((qp) => {
      const label = qp.name ?? qp.chain_name ?? ''
      return label.toLowerCase().includes(q)
    })
  }, [quickPicks, templateSearch])
  const selectedTemplate = useMemo(
    () => quickPicks.find((qp) => qp.id === selectedTemplateId) ?? null,
    [quickPicks, selectedTemplateId]
  )

  // The active instance's chain may be missing from `chainsData` — that list
  // is filtered by department and only used to populate the manual-chain
  // picker. An auto-launched (trigger-fired) chain can be automatic and/or
  // outside the operator's department, so we also fetch it directly by id.
  // Without this fallback the wizard renders "Pick a chain above to continue"
  // and the operator can't complete an auto-started chain (KAN-396 / debt_status).
  const { data: activeChainById } = useTAChain(activeInstance?.chain_id ?? null)
  const activeChain = useMemo(() => {
    if (!activeInstance) return null
    return (
      (chainsData?.items ?? []).find((c) => c.id === activeInstance.chain_id) ??
      activeChainById ??
      null
    )
  }, [activeInstance, chainsData, activeChainById])

  // Steps
  const steps = useMemo<TAChainStep[]>(() => activeChain?.steps ?? [], [activeChain])
  const currentStep = steps.find((s) => s.step_order === (activeInstance?.current_step_order ?? 1))
  const currentTA = currentStep ? taById.get(currentStep.target_action_id) : null

  // Contact list for contact-type steps (phone or email per step contact_medium).
  const contactStepSource =
    currentTA?.field_type === 'contact' ? (currentStep?.contact_source ?? 'client') : null
  const isEmailContactStep = currentStep?.contact_medium === 'email'
  const { data: contactPhones } = useClientPhones(
    clientId,
    contactStepSource && !isEmailContactStep ? contactStepSource : null
  )
  const { data: contactEmails } = useClientEmails(
    clientId,
    contactStepSource && isEmailContactStep ? contactStepSource : null
  )
  const contactOptions = isEmailContactStep ? contactEmails : contactPhones

  // Filter the debt list per the current step's "show closed credits"
  // admin flag. Default (flag false) hides closed debts; flag true
  // shows both active and closed. Computed against currentStep so the
  // wizard's primary credit picker and the dropdown's require_credit
  // follow-up both honour the same setting on the same step.
  const visibleDebts = useMemo(() => {
    if (currentStep?.show_closed_credits) return debts
    return debts.filter((d) => (d.status ?? '').toLowerCase() !== 'closed')
  }, [debts, currentStep?.show_closed_credits])

  // Steps auto-filled by a debt-status auto-start (Credit/Date) carry an
  // ``autofilled`` marker in step_data. The operator never stops on them — the
  // server skips them on advance — so they must not count toward "is this the
  // last step". Otherwise a trailing auto-filled Date step would hide the
  // Finalize button on the operator's real last (manual) step.
  const autofilledOrders = useMemo<Set<number>>(() => {
    const sd = activeInstance?.step_data ?? {}
    const out = new Set<number>()
    for (const [k, v] of Object.entries(sd)) {
      if (v && typeof v === 'object' && (v as { autofilled?: boolean }).autofilled) {
        const n = parseInt(k, 10)
        if (!Number.isNaN(n)) out.add(n)
      }
    }
    return out
  }, [activeInstance?.step_data])

  // Last step for the operator = no MANUAL step remains after the current one.
  // Auto-filled Credit/Date steps beyond the current pointer don't count.
  const currentStepOrderVal = activeInstance?.current_step_order ?? 1
  const isLastStep = !steps.some(
    (s) => s.step_order > currentStepOrderVal && !autofilledOrders.has(s.step_order)
  )

  const chainForBuilder =
    activeChain?.id ?? (selectedChainId ? parseInt(selectedChainId, 10) : null)
  const { data: builderData } = useBuilderData(chainForBuilder)

  // "Effective" chain = the one the user is interacting with (either the
  // active instance's chain or the one currently selected in the dropdown
  // before starting). Drives Part 2's unified panel layout.
  const effectiveChain = activeChain ?? selectedChainObj
  const effectiveSteps = useMemo<TAChainStep[]>(() => effectiveChain?.steps ?? [], [effectiveChain])
  // Instant mode: render every step at once and save in one click.
  // Allowed only when the chain has zero per-step delays and zero
  // branches — otherwise the wizard's sequencing semantics matter.
  const isInstantMode = useMemo(() => {
    if (!effectiveChain || effectiveSteps.length === 0) return false
    if (effectiveSteps.some((s) => s.delay_minutes > 0)) return false
    if ((builderData?.branches?.length ?? 0) > 0) return false
    return true
  }, [effectiveChain, effectiveSteps, builderData])

  // Selected dropdown value for the current step (replaces dictionary leaf)
  const [stepValue, setStepValue] = useState('')

  const selectedDropdownValue: TADropdownValueOut | null = useMemo(() => {
    if (!currentTA || currentTA.field_type !== 'dropdown' || !stepValue) return null
    return currentTA.dropdown_values.find((dv) => dv.value === stepValue) ?? null
  }, [currentTA, stepValue])

  // Template preset values (from quick pick)
  const presetValuesRef = useRef<Record<string, string>>({})

  // Step id whose lone contact candidate was already auto-selected (KAN-977),
  // so unticking that radio is not immediately undone. Cleared on step change.
  const autoSelectedContactStepRef = useRef<number | null>(null)

  // Accumulated data across steps — refs for synchronous access (no React batching issues)
  const collectedStepDataRef = useRef<Record<string, string>>({})
  const collectedDropdownValueIdsRef = useRef<Record<string, number>>({})
  const collectedPromiseDateRef = useRef('')
  const collectedPromiseAmountRef = useRef('')
  const collectedCreditIdRef = useRef('')
  // Local, not-yet-persisted edits to previously confirmed steps, keyed by
  // step_order. Layered over the server snapshot for BOTH the edit form
  // (so re-opening a step shows the edit, not the stale server value) and the
  // final save (so TA history reflects the edit). Per-step, so editing one
  // step never clobbers another step's promise fields.
  const editedStepsRef = useRef<Record<string, StepEdit>>({})

  // Completed steps summaries
  interface CompletedStep {
    stepOrder: number
    taName: string
    taValue: string
    targetActionId?: number
    fieldType?: string
  }
  const [completedSteps, setCompletedSteps] = useState<CompletedStep[]>([])
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false)

  // Step editing — when set, the completed card for that step_order shows
  // an inline edit form instead of the read-only summary.
  interface EditingStep {
    stepOrder: number
    targetActionId: number
    fieldType: string
    value: string
    promiseDate: string
    promiseAmount: string
    creditId: string
  }
  const [editingStep, setEditingStep] = useState<EditingStep | null>(null)
  const [showRewindWarning, setShowRewindWarning] = useState(false)
  // Manual date entry that is currently incomplete/invalid blocks saving.
  // Tracked separately for the wizard's active step and the inline step editor
  // (instant mode keeps its flag inside InstantStepValue.dateInvalid).
  const [wizardDateInvalid, setWizardDateInvalid] = useState(false)
  const [editDateInvalid, setEditDateInvalid] = useState(false)

  // Phone list for the step currently being edited (may differ from active step)
  const editingContactMeta = useMemo(() => {
    if (!editingStep || editingStep.fieldType !== 'contact') return null
    const stepDef = steps.find((s) => s.step_order === editingStep.stepOrder)
    return {
      source: (stepDef?.contact_source ?? 'client') as 'client' | 'recommender',
      isEmail: stepDef?.contact_medium === 'email',
    }
  }, [editingStep, steps])
  const { data: editingContactPhones } = useClientPhones(
    clientId,
    editingContactMeta && !editingContactMeta.isEmail ? editingContactMeta.source : null
  )
  const { data: editingContactEmails } = useClientEmails(
    clientId,
    editingContactMeta?.isEmail ? editingContactMeta.source : null
  )
  const editingContactOptions = editingContactMeta?.isEmail
    ? editingContactEmails
    : editingContactPhones
  // Set true once the final save round-trip starts. Gates the body render
  // so the user never sees a re-rendered step (e.g. a branched-back step 2)
  // during the brief window between mutations finishing and `onSave` closing
  // the modal at the parent.
  const [isFinalizing, setIsFinalizing] = useState(false)

  // Current step form fields
  const [promiseDate, setPromiseDate] = useState('')
  const [promiseAmount, setPromiseAmount] = useState('')
  const [creditId, setCreditId] = useState<string>('')
  const [notes, setNotes] = useState('')

  // "Notify responsible" — default-on so collaborators stay in the loop;
  // operator can opt out per-interaction. Hidden when there's no responsible
  // employee, or when the operator IS the responsible employee (would be a
  // self-notification).
  const operatorUserId = user?.id ? parseInt(user.id, 10) : null
  const showNotifyResponsibleCheckbox = !!(
    responsibleEmployeeId &&
    operatorUserId !== null &&
    responsibleEmployeeId !== operatorUserId
  )
  const [notifyResponsible, setNotifyResponsible] = useState(true)

  // Instant-mode state — keyed by step.id so values survive across renders
  // even if the steps array is re-fetched (id is stable, step_order isn't
  // guaranteed to be).
  const [instantValues, setInstantValues] = useState<Record<number, InstantStepValue>>({})
  const [instantNotes, setInstantNotes] = useState('')
  const [instantSubmitting, setInstantSubmitting] = useState(false)

  // Minimize / restore
  const { minimized: minimizedState, setMinimized, clear: clearMinimized } = useChainExecutorStore()
  const restoredRef = useRef(false)
  // Tracks the last "all-at-once" selection the reset effect applied, so it
  // only resets on a genuine chain change — not on async data reloads or a
  // restore. Pre-seeded during restore (see below).
  const lastInstantSelectionRef = useRef<string | null>(null)

  // Restore form state from minimized store on mount
  useEffect(() => {
    if (minimizedState?.clientId === clientId && minimizedState.formState) {
      const fs = minimizedState.formState
      setStepValue(fs.stepValue)
      setPromiseDate(fs.promiseDate)
      setPromiseAmount(fs.promiseAmount)
      setCreditId(fs.creditId)
      setNotes(fs.notes)
      setCompletedSteps(fs.completedSteps)
      collectedStepDataRef.current = fs.collectedStepData
      collectedDropdownValueIdsRef.current = fs.collectedDropdownValueIds
      collectedPromiseDateRef.current = fs.collectedPromiseDate
      collectedPromiseAmountRef.current = fs.collectedPromiseAmount
      collectedCreditIdRef.current = fs.collectedCreditId
      editedStepsRef.current = fs.editedSteps ?? {}
      // "All-at-once" mode: restore the chain selection + entered values.
      // (Optional fields — absent in snapshots saved before this existed.)
      if (fs.selectedChainId !== undefined) {
        setSelectedChainId(fs.selectedChainId)
        if (fs.instantValues !== undefined) setInstantValues(fs.instantValues)
        if (fs.instantNotes !== undefined) setInstantNotes(fs.instantNotes)
        if (fs.notifyResponsible !== undefined) setNotifyResponsible(fs.notifyResponsible)
        // Pre-mark this selection as already applied so the reset effect treats
        // the restored chain as "settled" and doesn't wipe the restored values
        // when selectedChainId lands on the next render.
        lastInstantSelectionRef.current = `${fs.selectedChainId}|`
      }
      restoredRef.current = true
      clearMinimized()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMinimize = () => {
    setMinimized({
      clientId,
      clientName: clientName ?? `Client #${clientId}`,
      responsibleEmployeeId: responsibleEmployeeId ?? null,
      chainName: activeChain?.name ?? null,
      currentStepOrder: activeInstance?.current_step_order ?? 1,
      totalSteps: steps.length || 1,
      timestamp: Date.now(),
      debts,
      formState: {
        stepValue,
        promiseDate,
        promiseAmount,
        creditId,
        notes,
        completedSteps,
        collectedStepData: { ...collectedStepDataRef.current },
        collectedDropdownValueIds: { ...collectedDropdownValueIdsRef.current },
        collectedPromiseDate: collectedPromiseDateRef.current,
        collectedPromiseAmount: collectedPromiseAmountRef.current,
        collectedCreditId: collectedCreditIdRef.current,
        editedSteps: { ...editedStepsRef.current },
        // "All-at-once" mode state (no server snapshot exists for it).
        selectedChainId,
        instantValues,
        instantNotes,
        notifyResponsible,
      },
    })
    onMinimize?.()
  }

  // Expose handleMinimize to parent via ref
  useEffect(() => {
    if (onMinimizeRef) onMinimizeRef.current = handleMinimize
    return () => {
      if (onMinimizeRef) onMinimizeRef.current = null
    }
  })

  // Mutations
  const startMut = useStartChainInstance()
  const createIntMut = useCreateTAInteraction()
  const advanceMut = useAdvanceChainInstance()
  const cancelMut = useCancelChainInstance()
  const rewindMut = useRewindChainInstance()

  // Shared by the picker and by hotkey quick-launch (KAN-973). The template is
  // passed in rather than read from `selectedTemplateId`, so the hotkey path
  // does not have to set picker state and wait a render to start.
  const startTemplate = useCallback(
    async (template: QuickPick) => {
      try {
        presetValuesRef.current = template.preset_values ?? {}
        await startMut.mutateAsync({
          chain_id: template.chain_id,
          client_id: clientId,
        })
        toast.success(t('pages.clientChains.toasts.started'))
        setSelectedTemplateId(null)
        setTemplateSearch('')
      } catch (err) {
        presetValuesRef.current = {}
        toast.error(getErrorMessage(err))
      }
    },
    [startMut, clientId, t]
  )

  const handleStartTemplate = async () => {
    if (!selectedTemplate) return
    await startTemplate(selectedTemplate)
  }

  // KAN-973 — hotkey quick-launch. The gating rule (and the loading-vs-empty
  // trap behind it) lives in decideHotkeyAutoStart, where it is unit-tested;
  // the ref latches so a started chain is never started twice.
  // Latched on the first SETTLED decision, not only on a successful start.
  //
  // Latching only when it started left a deferred decision alive: press the
  // hotkey while the client has an active instance and the launch is correctly
  // skipped, but `initialTemplateId` stays set and the modal stays open. The
  // operator then cancels that instance — which does not close the modal —
  // `activeInstance` flips to null, this effect re-runs, and the hotkey's chain
  // starts by itself, with a success toast, from an action nobody took.
  //
  // "Settled" means the instances query has answered. Before that, skipping is
  // provisional and the effect must be allowed to run again.
  const autoStartDecidedRef = useRef(false)
  useEffect(() => {
    if (autoStartDecidedRef.current) return

    const instancesLoaded = instances !== undefined
    const { start } = decideHotkeyAutoStart({
      initialTemplateId,
      instancesLoaded,
      hasActiveInstance: activeInstance !== null,
      templates: quickPicks,
    })

    if (start) {
      autoStartDecidedRef.current = true
      void startTemplate(start)
      return
    }

    // No start, and the data it depends on has arrived — the answer is "no",
    // for this opening of the modal. Anything that changes later is the
    // operator's doing, not the hotkey's.
    //
    // `templates` is excluded from "settled": an empty quick-pick list is
    // indistinguishable from one still loading, and latching on it would drop
    // a launch whose template simply had not arrived yet.
    if (instancesLoaded && initialTemplateId !== null && quickPicks.length > 0) {
      autoStartDecidedRef.current = true
    }
  }, [initialTemplateId, instances, activeInstance, quickPicks, startTemplate])

  // Reset on chain change
  useEffect(() => {
    // Don't wipe state on the restore mount. When reopening a minimized
    // session the restore effect (above) has just repopulated completedSteps,
    // the collected refs, and the current-step fields from the saved snapshot;
    // this reset runs right after it on the same mount and would clobber them
    // (e.g. the completed-step cards vanish after restore). The hydration
    // effect is also gated by ``restoredRef``, so it won't rebuild them either
    // — leaving the form blank. Skipping here lets the restored state stand.
    // Mirrors the instant-mode reset effect below, which already guards this.
    if (restoredRef.current) return
    collectedStepDataRef.current = {}
    collectedDropdownValueIdsRef.current = {}
    collectedPromiseDateRef.current = ''
    collectedPromiseAmountRef.current = ''
    collectedCreditIdRef.current = ''
    editedStepsRef.current = {}
    setCompletedSteps([])
    setIsAutoAdvancing(false)
    // Don't reset stepValue here — step-change effect handles it with preset support
    setPromiseDate('')
    setPromiseAmount('')
    setCreditId('')
    setNotes('')
    // Allow the hydration effect to re-run for the new instance so it can
    // rebuild completedSteps from step_data (even if steps loads slightly late).
    hydratedInstanceRef.current = null
  }, [activeInstance?.id])

  // Rehydrate completed steps + collected refs from server-side step_data
  // when the modal opens onto an in-progress instance. Without this, closing
  // the modal mid-chain and reopening would lose the values entered on prior
  // steps even though the chain pointer is still on the right step.
  const hydratedInstanceRef = useRef<number | null>(null)
  useEffect(() => {
    if (!activeInstance || !activeChain || steps.length === 0) return
    if (hydratedInstanceRef.current === activeInstance.id) return
    if (restoredRef.current) {
      // Minimized-store restore wins — its state is fresher than server.
      hydratedInstanceRef.current = activeInstance.id
      return
    }
    const sd = activeInstance.step_data
    if (!sd) {
      hydratedInstanceRef.current = activeInstance.id
      return
    }
    const orders = Object.keys(sd)
      .map((k) => parseInt(k, 10))
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => a - b)
    if (orders.length === 0) {
      hydratedInstanceRef.current = activeInstance.id
      return
    }
    const rebuiltCompleted: CompletedStep[] = []
    for (const order of orders) {
      const snap = sd[String(order)]
      if (!snap) continue
      const stepDef = steps.find((s) => s.step_order === order)
      const taName =
        snap.target_action_name ??
        (stepDef ? taById.get(stepDef.target_action_id)?.name : undefined) ??
        ''
      const taId = snap.target_action_id ?? stepDef?.target_action_id
      if (snap.value && taId != null) {
        collectedStepDataRef.current[String(order)] = snap.value
      }
      if (snap.dropdown_value_id != null) {
        collectedDropdownValueIdsRef.current[String(order)] = snap.dropdown_value_id
      }
      if (snap.promise_date && !collectedPromiseDateRef.current) {
        collectedPromiseDateRef.current = snap.promise_date
      }
      if (snap.promise_amount && !collectedPromiseAmountRef.current) {
        collectedPromiseAmountRef.current = snap.promise_amount
      }
      if (snap.credit_id && !collectedCreditIdRef.current) {
        collectedCreditIdRef.current = snap.credit_id
      }
      rebuiltCompleted.push({
        stepOrder: order,
        taName,
        taValue: snap.dropdown_value_name ?? snap.value ?? '',
        targetActionId: snap.target_action_id ?? stepDef?.target_action_id,
        fieldType: stepDef ? taById.get(stepDef.target_action_id)?.field_type : undefined,
      })
    }
    setCompletedSteps(rebuiltCompleted)
    hydratedInstanceRef.current = activeInstance.id
  }, [
    activeInstance,
    activeInstance?.id,
    activeInstance?.step_data,
    activeChain,
    activeChain?.id,
    steps,
    taById,
  ])

  // Reset instant-mode state when the user changes which chain is selected
  // (or when an active instance appears/disappears). Also seed contact
  // steps with the prefilledPhone for context-aware entries — when the
  // executor was opened from a phone row, every instant contact step
  // whose source matches starts pre-filled with that phone so the
  // operator can save with one click.
  //
  // IMPORTANT: only reset on an actual SELECTION change. The effect's other
  // deps (effectiveChain / taById) resolve asynchronously and used to re-fire
  // this reset, wiping values the user had already entered — including values
  // just restored from a minimized "all-at-once" session. We track the last
  // selection and bail out when it hasn't changed.
  useEffect(() => {
    // Skip the restore pass entirely: the restore effect sets selectedChainId/
    // instantValues via state setters that land on the next render, and it
    // pre-seeds lastInstantSelectionRef to the restored chain so that follow-up
    // render is treated as already-settled. Resetting here would wipe them.
    if (restoredRef.current) return

    const selectionKey = instantSelectionKey
    if (lastInstantSelectionRef.current === selectionKey) return
    lastInstantSelectionRef.current = selectionKey

    if (prefilledPhone && prefillSource && effectiveChain) {
      const seed: Record<number, InstantStepValue> = {}
      for (const step of effectiveChain.steps ?? []) {
        const ta = taById.get(step.target_action_id)
        const stepSource = step.contact_source ?? 'client'
        if (ta?.field_type === 'contact' && stepSource === prefillSource) {
          seed[step.id] = { ...EMPTY_INSTANT_VALUE, value: prefilledPhone }
        }
      }
      setInstantValues(seed)
    } else {
      setInstantValues({})
    }
    setInstantNotes('')
    setInstantSubmitting(false)
    setNotifyResponsible(true)
    // ``instantSelectionKey`` is derived from selectedChainId + activeInstance.id,
    // both already listed, so naming it changes nothing at runtime — it is here
    // to satisfy exhaustive-deps now that the body reads it instead of rebuilding
    // the string.
  }, [
    instantSelectionKey,
    selectedChainId,
    activeInstance?.id,
    prefilledPhone,
    contactSource,
    prefillSource,
    effectiveChain,
    taById,
  ])

  // Reset current step fields on step change + pre-fill from template
  useEffect(() => {
    // Skip the first reset when restoring from minimized state
    if (restoredRef.current) {
      restoredRef.current = false
      return
    }
    const taId = currentStep?.target_action_id
    const preset = taId ? presetValuesRef.current[String(taId)] : undefined
    // Auto-fill the phone for context-aware entries (refactor ticket):
    // when this executor was opened from a phone row and we land on a
    // contact-type step that matches the source, pre-select the phone
    // so the operator can advance with zero clicks. The radio list still
    // shows other phones from the same source, but this one is checked
    // by default. Template preset wins if both are set.
    const isContactStep = currentTA?.field_type === 'contact'
    const stepSource = currentStep?.contact_source ?? 'client'
    const phonePrefill =
      isContactStep && prefilledPhone && prefillSource === stepSource ? prefilledPhone : ''
    setStepValue(preset ?? phonePrefill)
    // New step, so the single-candidate auto-select (KAN-977, below) is allowed
    // to run again. Cleared here rather than keyed on step id so returning to a
    // step via rewind re-arms it, matching what the operator sees: the field
    // was cleared, so it should refill.
    autoSelectedContactStepRef.current = null
    setPromiseDate('')
    setPromiseAmount('')
  }, [
    activeInstance?.id,
    activeInstance?.current_step_order,
    currentStep?.target_action_id,
    currentStep?.contact_source,
    currentTA?.field_type,
    prefillSource,
    prefilledPhone,
  ])

  // KAN-977 — see ``pickSingleContactCandidate`` for the rules.
  //
  // Its own effect, after the reset above, because the candidate list is
  // fetched: on the render where the step becomes current it is still
  // ``undefined`` and the phones land a moment later. Folding this into the
  // reset and adding ``contactOptions`` to those deps would re-run the whole
  // reset when they arrive, wiping anything already entered.
  useEffect(() => {
    const pick = pickSingleContactCandidate({
      fieldType: currentTA?.field_type,
      isEmailStep: isEmailContactStep,
      candidates: contactOptions,
      currentValue: stepValue,
      alreadyAutoSelected: autoSelectedContactStepRef.current === currentStep?.id,
    })
    if (pick === null) return

    autoSelectedContactStepRef.current = currentStep?.id ?? null
    // Functional, not ``setStepValue(pick)``. This effect and the reset above
    // run in the SAME commit, and both read the render-time ``stepValue`` —
    // so on a render where it was still '' (the executor mounting onto an
    // already-active instance, or a quick-pick start served from a warm
    // contact cache) the helper sees an empty step and this setter lands
    // AFTER the reset's ``setStepValue(preset)``, silently discarding an
    // admin-configured preset. Reading ``prev`` consults the value the reset
    // just queued, which is what the documented precedence actually requires.
    setStepValue((prev) => (prev ? prev : pick))
  }, [contactOptions, currentTA?.field_type, isEmailContactStep, currentStep?.id, stepValue])

  // ── Step editing ──────────────────────────────────────────────────────────

  const stepHasBranch = (stepOrder: number): boolean => {
    if (!builderData || !steps) return false
    const stepDef = steps.find((s) => s.step_order === stepOrder)
    if (!stepDef) return false
    return stepBranchSet.has(stepDef.id)
  }

  const openEditStep = (cs: CompletedStep) => {
    if (!cs.targetActionId) return
    const snap = activeInstance?.step_data?.[String(cs.stepOrder)]
    // A prior local edit wins over the server snapshot, so re-opening a step
    // shows the edited values rather than the original confirmed ones.
    const edited = editedStepsRef.current[String(cs.stepOrder)]
    setEditingStep({
      stepOrder: cs.stepOrder,
      targetActionId: cs.targetActionId,
      fieldType: cs.fieldType ?? 'text',
      value: edited?.value ?? snap?.value ?? cs.taValue,
      promiseDate: edited?.promiseDate ?? snap?.promise_date ?? '',
      promiseAmount: edited?.promiseAmount ?? snap?.promise_amount ?? '',
      creditId: edited?.creditId ?? snap?.credit_id ?? '',
    })
  }

  const cancelEditStep = () => setEditingStep(null)

  // Situation A: non-branch — just update local collected data, no server call
  const saveEditStepLocal = () => {
    if (!editingStep) return
    const {
      stepOrder,
      value,
      fieldType,
      promiseDate: pd,
      promiseAmount: pa,
      creditId: ci,
    } = editingStep

    if (value)
      collectedStepDataRef.current[String(stepOrder)] =
        toUtcIsoIfDate(value, fieldType, user?.timezone) ?? value
    else delete collectedStepDataRef.current[String(stepOrder)]

    if (pd) collectedPromiseDateRef.current = pd
    if (pa) collectedPromiseAmountRef.current = pa
    if (ci) collectedCreditIdRef.current = ci

    // Record the edit PER STEP so it (a) survives re-opening the edit form and
    // (b) is layered over the server snapshot at final save — the fix for
    // "editing a confirmed step is silently discarded". Storing '' explicitly
    // clears a field; only fields present on the edit are overridden.
    editedStepsRef.current[String(stepOrder)] = {
      value,
      promiseDate: pd,
      promiseAmount: pa,
      creditId: ci,
    }

    setCompletedSteps((prev) =>
      prev.map((cs) => (cs.stepOrder === stepOrder ? { ...cs, taValue: value } : cs))
    )
    setEditingStep(null)
  }

  // Situation B: branch step — warn then rewind server + clear state from that step onwards
  const confirmRewindAndEdit = async () => {
    if (!editingStep || !activeInstance) return
    setShowRewindWarning(false)
    try {
      await rewindMut.mutateAsync({ id: activeInstance.id, stepOrder: editingStep.stepOrder })
      // Clear local state for steps >= editingStep.stepOrder
      setCompletedSteps((prev) => prev.filter((cs) => cs.stepOrder < editingStep.stepOrder))
      const keysToRemove = Object.keys(collectedStepDataRef.current)
      for (const k of keysToRemove) {
        if (parseInt(k, 10) >= editingStep.stepOrder) {
          delete collectedStepDataRef.current[k]
        }
      }
      for (const k of Object.keys(editedStepsRef.current)) {
        if (parseInt(k, 10) >= editingStep.stepOrder) {
          delete editedStepsRef.current[k]
        }
      }
      // Reset extra fields — they'll be re-collected as the user re-walks
      collectedPromiseDateRef.current = ''
      collectedPromiseAmountRef.current = ''
      collectedCreditIdRef.current = ''
      collectedDropdownValueIdsRef.current = Object.fromEntries(
        Object.entries(collectedDropdownValueIdsRef.current).filter(
          ([order]) => parseInt(order, 10) < editingStep.stepOrder
        )
      )
      // Pre-fill the current step with the edited value so the user
      // can see their change immediately and just hit Continue/Save
      setStepValue(editingStep.value)
      if (editingStep.promiseDate) setPromiseDate(editingStep.promiseDate)
      if (editingStep.promiseAmount) setPromiseAmount(editingStep.promiseAmount)
      if (editingStep.creditId) setCreditId(editingStep.creditId)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setEditingStep(null)
    }
  }

  const handleSaveEditStep = () => {
    if (!editingStep) return
    if (editDateInvalid) {
      toast.error(t('pages.clientChains.errors.dateInvalid'))
      return
    }
    if (
      stepDateIsPast(
        editingStep.value,
        editingStep.fieldType,
        steps.find((s) => s.step_order === editingStep.stepOrder)?.not_in_the_past,
        user?.timezone
      )
    ) {
      toast.error(t('pages.clientChains.errors.datePast'))
      return
    }
    if (stepHasBranch(editingStep.stepOrder)) {
      setShowRewindWarning(true)
    } else {
      saveEditStepLocal()
    }
  }

  // ── End step editing ───────────────────────────────────────────────────────

  const handleStart = async () => {
    const chainId = parseInt(selectedChainId, 10)
    if (!chainId) return
    try {
      await startMut.mutateAsync({ chain_id: chainId, client_id: clientId })
      toast.success(t('pages.clientChains.toasts.started'))
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  // Check if current step is fully filled
  const isStepComplete = () => {
    if (!currentStep || !currentTA) return false
    // TA field filled (if required)
    if (currentStep.is_required && !stepValue.trim()) return false
    // Dropdown promise flags
    if (selectedDropdownValue?.require_promise_date && !promiseDate) return false
    if (selectedDropdownValue?.require_promise_amount && !promiseAmount) return false
    if (selectedDropdownValue?.require_credit && !creditId) return false
    return true
  }

  // Auto-advance for non-last steps
  const handleAutoAdvance = async () => {
    if (!activeInstance || !activeChain || !currentStep || isLastStep || isAutoAdvancing) return
    if (!isStepComplete()) return

    // Block advancing this step when its date is invalid or in the past
    // (KAN-578): validation happens per-step, not only at final save. The
    // inline error under the field already shows why; this guards the action.
    if (wizardDateInvalid) {
      toast.error(t('pages.clientChains.errors.dateInvalid'))
      return
    }
    if (
      stepDateIsPast(stepValue, currentTA?.field_type, currentStep?.not_in_the_past, user?.timezone)
    ) {
      toast.error(t('pages.clientChains.errors.datePast'))
      return
    }

    setIsAutoAdvancing(true)

    // Accumulate data synchronously via refs.
    // Convert date-type values to UTC ISO so TAInteraction.step_data
    // (used by the Result column) matches what the chain_instance stores.
    if (stepValue) {
      collectedStepDataRef.current[String(currentStep.step_order)] =
        toUtcIsoIfDate(stepValue, currentTA?.field_type, user?.timezone) ?? stepValue
    }
    if (selectedDropdownValue) {
      collectedDropdownValueIdsRef.current[String(activeInstance.current_step_order ?? 1)] =
        selectedDropdownValue.id
    }
    if (promiseDate && !collectedPromiseDateRef.current)
      collectedPromiseDateRef.current = promiseDate
    if (promiseAmount && !collectedPromiseAmountRef.current)
      collectedPromiseAmountRef.current = promiseAmount
    if (creditId && !collectedCreditIdRef.current) collectedCreditIdRef.current = creditId

    setCompletedSteps((prev) => [
      ...prev,
      {
        stepOrder: currentStep.step_order,
        taName: currentTA?.name ?? '',
        taValue: stepValue,
        targetActionId: currentStep.target_action_id,
        fieldType: currentTA?.field_type,
      },
    ])

    try {
      await advanceMut.mutateAsync({
        id: activeInstance.id,
        dropdownValueId: selectedDropdownValue?.id ?? null,
        dropdownValueName: selectedDropdownValue?.value ?? null,
        stepValue: toUtcIsoIfDate(stepValue || null, currentTA?.field_type, user?.timezone),
        targetActionId: currentStep.target_action_id,
        targetActionName: currentTA?.name ?? null,
        promiseDate: promiseDate || null,
        promiseAmount: promiseAmount || null,
        creditId: creditId || null,
      })
      setStepValue('')
    } catch (err) {
      toast.error(getErrorMessage(err))
      setCompletedSteps((prev) => prev.filter((s) => s.stepOrder !== currentStep.step_order))
    } finally {
      setIsAutoAdvancing(false)
    }
  }

  // Auto-advance for dropdown/date — but NOT when the selected option requires
  // additional fields (promise date/amount/credit). In that case, wait for those.
  const needsExtraFields =
    selectedDropdownValue?.require_promise_date ||
    selectedDropdownValue?.require_promise_amount ||
    selectedDropdownValue?.require_credit
  const canAutoAdvance = currentTA && currentTA.field_type === 'dropdown' && !needsExtraFields

  useEffect(() => {
    // Guard against the post-advance re-fire race: after `setStepValue('')`
    // resets local state, this effect re-runs while `activeInstance` is
    // still stale (TanStack Query refetch is in flight). Without this guard
    // we'd auto-advance a second time using the previous step's stale
    // `currentTA`, which causes the backend to advance again from the
    // already-updated server state — silently skipping the next step
    // (e.g. step 7 'Дата обещания' between dropdown step 6 and step 8).
    if (!stepValue.trim()) return
    if (!isLastStep && !isAutoAdvancing && activeInstance && canAutoAdvance) {
      handleAutoAdvance()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepValue, selectedDropdownValue?.id, promiseDate, promiseAmount, creditId])

  // handleSave — LAST step only
  const handleSave = async () => {
    if (!activeInstance || !activeChain) return

    // Accumulate current step's data into refs (date-type → UTC ISO).
    if (currentStep && stepValue) {
      collectedStepDataRef.current[String(currentStep.step_order)] =
        toUtcIsoIfDate(stepValue, currentTA?.field_type, user?.timezone) ?? stepValue
    }
    if (selectedDropdownValue) {
      collectedDropdownValueIdsRef.current[String(activeInstance.current_step_order ?? 1)] =
        selectedDropdownValue.id
    }
    if (promiseDate && !collectedPromiseDateRef.current)
      collectedPromiseDateRef.current = promiseDate
    if (promiseAmount && !collectedPromiseAmountRef.current)
      collectedPromiseAmountRef.current = promiseAmount
    if (creditId && !collectedCreditIdRef.current) collectedCreditIdRef.current = creditId

    // Validate
    if (wizardDateInvalid) {
      toast.error(t('pages.clientChains.errors.dateInvalid'))
      return
    }
    if (
      stepDateIsPast(stepValue, currentTA?.field_type, currentStep?.not_in_the_past, user?.timezone)
    ) {
      toast.error(t('pages.clientChains.errors.datePast'))
      return
    }
    if (currentStep?.is_required && !stepValue.trim()) {
      toast.error(t('pages.clientChains.errors.stepRequired'))
      return
    }
    if (selectedDropdownValue?.require_promise_date && !promiseDate) {
      toast.error(t('pages.clientChains.errors.promiseDateRequired'))
      return
    }
    if (selectedDropdownValue?.require_promise_amount && !promiseAmount) {
      toast.error(t('pages.clientChains.errors.promiseAmountRequired'))
      return
    }
    if (selectedDropdownValue?.require_credit && !creditId) {
      toast.error(t('pages.clientChains.errors.creditRequired'))
      return
    }

    // Rebuild the collected values from the authoritative server snapshot
    // (chain_instances.step_data) before saving. Each step is snapshotted to
    // the backend as it's advanced, so this copy is always complete — even
    // after a minimize/restore cycle that wiped the in-memory refs (TA fields
    // missing from history after minimize/restore). The in-memory refs win on
    // conflict, since they hold the current step and any local edits not yet
    // pushed to the server.
    // Layer local edits to previously confirmed steps over the server snapshot
    // BEFORE collecting, so an edit that was never round-tripped to the server
    // (saveEditStepLocal makes no server call) still reaches TA history.
    const effectiveSnapshot = applyStepEdits(activeInstance.step_data, editedStepsRef.current)
    const snap = collectFromSnapshot(effectiveSnapshot)
    const mergedStepData = { ...snap.stepData, ...collectedStepDataRef.current }
    // A confirmed-step edit (saveEditStepLocal makes no server call) is the most
    // authoritative source: re-apply it LAST so the value the server-snapshot
    // hydration left in collectedStepDataRef can't clobber the edit. Normalize
    // the same way saveEditStepLocal does; an empty edit clears the step.
    // `editedStepData` carries just these explicit edits to the backend, which
    // mirrors them into the chain-instance snapshot so the completion
    // reconciliation (KAN-744) preserves the edit instead of overwriting it.
    const editedStepData: Record<string, string> = {}
    for (const [order, edit] of Object.entries(editedStepsRef.current)) {
      if (typeof edit.value !== 'string') continue
      const fieldType = completedSteps.find((cs) => String(cs.stepOrder) === order)?.fieldType
      const normalized =
        edit.value === ''
          ? ''
          : (toUtcIsoIfDate(edit.value, fieldType, user?.timezone) ?? edit.value)
      editedStepData[order] = normalized
      if (normalized === '') delete mergedStepData[order]
      else mergedStepData[order] = normalized
    }
    const mergedDropdownIds = { ...snap.dropdownIds, ...collectedDropdownValueIdsRef.current }

    // Use current step's dropdown value or first collected one
    const finalDropdownValueId =
      selectedDropdownValue?.id ?? Object.values(mergedDropdownIds)[0] ?? undefined
    const finalPromiseDate = promiseDate || collectedPromiseDateRef.current || snap.promiseDate
    const finalPromiseAmount =
      promiseAmount || collectedPromiseAmountRef.current || snap.promiseAmount
    const finalCreditId = creditId || collectedCreditIdRef.current || snap.creditId

    setIsFinalizing(true)
    try {
      await createIntMut.mutateAsync({
        client_id: clientId,
        credit_id: finalCreditId ? parseInt(finalCreditId, 10) : undefined,
        chain_id: activeChain.id,
        chain_instance_id: activeInstance.id,
        dropdown_value_id: finalDropdownValueId,
        promise_date: finalPromiseDate ? `${finalPromiseDate}T00:00:00` : undefined,
        promise_amount: finalPromiseAmount ? parseFloat(finalPromiseAmount) : undefined,
        notes: notes || undefined,
        step_data: Object.keys(mergedStepData).length > 0 ? mergedStepData : undefined,
        edited_step_data: Object.keys(editedStepData).length > 0 ? editedStepData : undefined,
        notify_responsible: showNotifyResponsibleCheckbox ? notifyResponsible : false,
      })
      const result = await advanceMut.mutateAsync({
        id: activeInstance.id,
        dropdownValueId: selectedDropdownValue?.id ?? null,
        dropdownValueName: selectedDropdownValue?.value ?? null,
        stepValue: toUtcIsoIfDate(stepValue || null, currentTA?.field_type, user?.timezone),
        targetActionId: currentStep?.target_action_id ?? null,
        targetActionName: currentTA?.name ?? null,
        promiseDate: promiseDate || null,
        promiseAmount: promiseAmount || null,
        creditId: creditId || null,
      })
      if (result.status === 'completed') {
        toast.success(t('pages.clientChains.toasts.completed'))
      } else {
        toast.success(t('pages.clientChains.toasts.advanced', { step: result.current_step_order }))
      }
      collectedStepDataRef.current = {}
      collectedDropdownValueIdsRef.current = {}
      collectedPromiseDateRef.current = ''
      collectedPromiseAmountRef.current = ''
      collectedCreditIdRef.current = ''
      editedStepsRef.current = {}
      setCompletedSteps([])
      setStepValue('')
      setPromiseDate('')
      setPromiseAmount('')
      setNotes('')
      onSave?.()
    } catch (err) {
      toast.error(getErrorMessage(err))
      setIsFinalizing(false)
    }
  }

  const handleCancel = async () => {
    if (!activeInstance) return
    try {
      await cancelMut.mutateAsync(activeInstance.id)
      toast.success(t('pages.clientChains.toasts.cancelled'))
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const updateInstantStep = (stepId: number, patch: Partial<InstantStepValue>) => {
    setInstantValues((prev) => ({
      ...prev,
      [stepId]: { ...EMPTY_INSTANT_VALUE, ...prev[stepId], ...patch },
    }))
  }

  // Save the entire chain in one shot. Sequence: start → advance × (N-1)
  // → create interaction → final advance. We keep the per-step advances
  // so server-side step effects (add tag, create task, etc.) still fire.
  const handleInstantSave = async () => {
    if (!effectiveChain || instantSubmitting) return
    if (effectiveSteps.length === 0) return

    // Local validation across every step before any network call
    for (const step of effectiveSteps) {
      const ta = taById.get(step.target_action_id)
      if (!ta) continue
      const v = instantValues[step.id] ?? EMPTY_INSTANT_VALUE
      if (v.dateInvalid) {
        toast.error(t('pages.clientChains.errors.dateInvalid'))
        return
      }
      if (stepDateIsPast(v.value, ta.field_type, step.not_in_the_past, user?.timezone)) {
        toast.error(t('pages.clientChains.errors.datePast'))
        return
      }
      if (step.is_required && !v.value.trim()) {
        toast.error(
          t('pages.clientChains.errors.stepFieldRequired', {
            name: ta.name,
            defaultValue: `${ta.name} is required.`,
          })
        )
        return
      }
      if (ta.field_type === 'dropdown' && v.value) {
        const dv = ta.dropdown_values.find((d) => d.value === v.value)
        if (dv?.require_promise_date && !v.promiseDate) {
          toast.error(t('pages.clientChains.errors.promiseDateRequired'))
          return
        }
        if (dv?.require_promise_amount && !v.promiseAmount) {
          toast.error(t('pages.clientChains.errors.promiseAmountRequired'))
          return
        }
        if (dv?.require_credit && !v.creditId) {
          toast.error(t('pages.clientChains.errors.creditRequired'))
          return
        }
      }
    }

    // Aggregate payloads
    const stepData: Record<string, string> = {}
    const dvByOrder: Record<number, number | null> = {}
    let firstPromiseDate = ''
    let firstPromiseAmount = ''
    let firstCreditId = ''

    for (const step of effectiveSteps) {
      const v = instantValues[step.id]
      if (!v) {
        dvByOrder[step.step_order] = null
        continue
      }
      const ta = taById.get(step.target_action_id)
      if (v.value) {
        stepData[String(step.step_order)] =
          toUtcIsoIfDate(v.value, ta?.field_type, user?.timezone) ?? v.value
      }

      let dvId: number | null = null
      if (ta?.field_type === 'dropdown' && v.value) {
        const dv = ta.dropdown_values.find((d) => d.value === v.value)
        if (dv) dvId = dv.id
      }
      dvByOrder[step.step_order] = dvId

      if (v.promiseDate && !firstPromiseDate) firstPromiseDate = v.promiseDate
      if (v.promiseAmount && !firstPromiseAmount) firstPromiseAmount = v.promiseAmount
      if (v.creditId && !firstCreditId) firstCreditId = v.creditId
    }

    setInstantSubmitting(true)
    setIsFinalizing(true)
    try {
      const inst = await startMut.mutateAsync({
        chain_id: effectiveChain.id,
        client_id: clientId,
      })

      // Walk through middle steps so server-side per-step effects fire.
      // Pass stepValue + targetActionId so the backend snapshots step_data,
      // which create_task / add_to_spam effects need to resolve refs.
      for (let i = 0; i < effectiveSteps.length - 1; i++) {
        const step = effectiveSteps[i]
        const v = instantValues[step.id]
        const ta = taById.get(step.target_action_id)
        const dvId = dvByOrder[step.step_order] ?? null
        await advanceMut.mutateAsync({
          id: inst.id,
          dropdownValueId: dvId,
          stepValue: toUtcIsoIfDate(v?.value || null, ta?.field_type, user?.timezone),
          targetActionId: step.target_action_id,
          targetActionName: ta?.name ?? null,
        })
      }

      const lastStep = effectiveSteps[effectiveSteps.length - 1]
      const lastDvId = dvByOrder[lastStep.step_order]
      const finalDvId = lastDvId ?? Object.values(dvByOrder).find((x) => x != null) ?? undefined

      await createIntMut.mutateAsync({
        client_id: clientId,
        credit_id: firstCreditId ? parseInt(firstCreditId, 10) : undefined,
        chain_id: effectiveChain.id,
        chain_instance_id: inst.id,
        dropdown_value_id: finalDvId ?? undefined,
        promise_date: firstPromiseDate ? `${firstPromiseDate}T00:00:00` : undefined,
        promise_amount: firstPromiseAmount ? parseFloat(firstPromiseAmount) : undefined,
        notes: instantNotes || undefined,
        step_data: Object.keys(stepData).length > 0 ? stepData : undefined,
        notify_responsible: showNotifyResponsibleCheckbox ? notifyResponsible : false,
      })

      // KAN-451: pass the LAST step's snapshot fields too, so the backend
      // persists step_data[lastStepOrder]. Without this, date-type final
      // steps (which have no dropdown_value_id) leave step_data incomplete,
      // and chain-completion create_task effects can't resolve due_date_ref.
      const lastV = instantValues[lastStep.id]
      const lastTa = taById.get(lastStep.target_action_id)
      await advanceMut.mutateAsync({
        id: inst.id,
        dropdownValueId: lastDvId ?? null,
        stepValue: toUtcIsoIfDate(lastV?.value || null, lastTa?.field_type, user?.timezone),
        targetActionId: lastStep.target_action_id,
        targetActionName: lastTa?.name ?? null,
      })

      toast.success(t('pages.clientChains.toasts.completed'))
      setInstantValues({})
      setInstantNotes('')
      setSelectedChainId('')
      onSave?.()
    } catch (err) {
      toast.error(getErrorMessage(err))
      setIsFinalizing(false)
    } finally {
      setInstantSubmitting(false)
    }
  }

  // Delay enforcement
  const [delaySecondsLeft, setDelaySecondsLeft] = useState(0)

  useEffect(() => {
    const serverSeconds = activeInstance?.delay_seconds_left ?? 0
    if (serverSeconds <= 0) {
      setDelaySecondsLeft(0)
      return
    }
    const startedAt = Date.now()
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000)
      setDelaySecondsLeft(Math.max(0, serverSeconds - elapsed))
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [activeInstance?.id, activeInstance?.current_step_order, activeInstance?.delay_seconds_left])

  const isDelayBlocked = delaySecondsLeft > 0
  const delayMinutesLeft = Math.ceil(delaySecondsLeft / 60)

  // Effects for preview
  const currentStepEffects = useMemo(() => {
    if (!builderData || !activeInstance?.current_step_order) return []
    const cs = steps.find((s) => s.step_order === activeInstance.current_step_order)
    if (!cs) return []
    return builderData.effects.filter((e) => e.step_id === cs.id)
  }, [builderData, activeInstance, steps])

  // Branches for progress display
  const stepBranchSet = useMemo(() => {
    if (!builderData) return new Set<number>()
    const branched = new Set<number>()
    for (const br of builderData.branches) branched.add(br.from_step_id)
    return branched
  }, [builderData])

  // KAN-974 — Enter saves the interaction, as an alias for clicking Save.
  //
  // `canSave` mirrors what actually puts an enabled Save button on screen, in
  // both modes: the wizard renders one only on the last step and only while
  // nothing is finalising, auto-advancing or delay-blocked, and both modes
  // disable it while their save is in flight. Enter must not reach further
  // than the button, or it would submit from a step that has no Save at all.
  //
  // The ticket describes the wizard; instant mode is included because a
  // hotkey launch lands in whichever mode the chain implies, and an Enter that
  // worked for one template and silently did nothing for the next would look
  // like a bug rather than a rule.
  const enterSaveMode = resolveEnterSaveMode({
    hasChain: Boolean(effectiveChain),
    hasActiveInstance: Boolean(activeInstance),
    isInstantMode,
  })
  // The panel body itself is behind two guards — a loading skeleton and a
  // "no chains" message — and neither is implied by the wizard state below.
  // `activeChain` can resolve from `activeChainById` while the chain LIST is
  // still loading, so without this Enter could finalise an interaction from a
  // screen showing a spinner.
  const isPanelBodyRendered = !isLoadingChains && manualChains.length > 0

  const canSaveOnEnter = !isPanelBodyRendered
    ? false
    : enterSaveMode === 'instant'
      ? !instantSubmitting
      : enterSaveMode === 'wizard' &&
        Boolean(activeChain) &&
        isLastStep &&
        // An inline edit on a completed step is uncommitted work held in the
        // form, not in `editedStepsRef` — only handleSaveEditStep writes
        // there. Saving now would finalise the interaction with the old
        // value and discard the edit, with no undo in the UI. Enter inside
        // that form is exactly what an operator would press to commit it.
        editingStep === null &&
        !isFinalizing &&
        !isAutoAdvancing &&
        !isDelayBlocked &&
        !createIntMut.isPending &&
        !advanceMut.isPending

  // Listens on the document, not on the panel: when the modal opens Radix puts
  // focus on the dialog's content wrapper, which contains this panel rather
  // than sitting inside it, so a panel-mounted handler sees nothing until the
  // operator happens to tab into a field. `isPressForPanel` supplies the scope
  // — the dialog this panel lives in, or the panel alone when there is no
  // dialog (the dialer renders this executor inline).
  //
  // The listener is attached once and reads current values through a ref.
  // Re-attaching on every change would be correct but noisy, and a stale
  // closure over `canSaveOnEnter` would let Enter save from the wrong step.
  const panelRef = useRef<HTMLDivElement | null>(null)
  const enterSaveRef = useRef({ canSaveOnEnter, enterSaveMode, handleSave, handleInstantSave })
  useEffect(() => {
    enterSaveRef.current = { canSaveOnEnter, enterSaveMode, handleSave, handleInstantSave }
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Cheapest guard first, and not just for tidiness: `isPressForPanel`
      // reads `offsetParent` and falls back to `getClientRects()`, both of
      // which force a synchronous layout — and the fallback is the normal path
      // here, since the modal's content is `position: fixed`. Without this line
      // every character typed into the notes field would reflow the page.
      if (event.key !== 'Enter') return
      if (!isPressForPanel(event.target, panelRef.current)) return

      const current = enterSaveRef.current
      if (!decideEnterSave({ event, canSave: current.canSaveOnEnter })) return

      event.preventDefault()
      void (current.enterSaveMode === 'instant'
        ? current.handleInstantSave()
        : current.handleSave())
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // --- Unified panel: chain selector at top, body below adapts ---
  return (
    <div ref={panelRef} className="flex w-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-foreground text-base font-semibold">
          {t('pages.clientChains.logInteraction')}
        </h3>
        {activeInstance && (
          <Button variant="cancel" size="sm" onClick={handleCancel}>
            {t('pages.clientChains.cancel')}
          </Button>
        )}
      </div>

      {isLoadingChains ? (
        <ChainExecutorSkeleton />
      ) : manualChains.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('pages.clientChains.noChains')}</p>
      ) : (
        <>
          {/* Templates dropdown — only when no instance is running */}
          {!activeInstance && quickPicks.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label className="text-foreground text-sm">
                {t('pages.clientChains.quickPicks')}
              </Label>
              <DropdownMenu
                open={templateOpen}
                onOpenChange={(o) => {
                  setTemplateOpen(o)
                  if (!o) setTemplateSearch('')
                }}
                modal={false}
              >
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="text-foreground focus:border-primary-500 border-border bg-card hover:bg-muted flex min-h-[40px] w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm outline-none"
                  >
                    <span
                      className={selectedTemplate ? 'text-foreground' : 'text-muted-foreground'}
                    >
                      {selectedTemplate
                        ? (selectedTemplate.name ??
                          selectedTemplate.chain_name ??
                          `Chain #${selectedTemplate.chain_id}`)
                        : t('pages.clientChains.templatePlaceholder', 'Pick a template…')}
                    </span>
                    <Icons.ArrowDown
                      size={16}
                      className="text-muted-foreground"
                      strokeWidth={1.5}
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  sideOffset={6}
                  className="border-border bg-card w-[--radix-dropdown-menu-trigger-width] min-w-[260px] rounded-md border p-0 shadow-lg"
                >
                  <div className="border-border border-b p-2">
                    <input
                      type="text"
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                      placeholder={t(
                        'pages.clientChains.templateSearchPlaceholder',
                        'Search templates…'
                      )}
                      className="text-foreground focus:border-primary-500 placeholder:text-muted-foreground border-border bg-card w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                    />
                  </div>
                  <div
                    className="max-h-[220px] overflow-y-auto overscroll-contain p-1"
                    onWheel={(e) => e.stopPropagation()}
                  >
                    {filteredTemplates.length === 0 ? (
                      <div className="text-muted-foreground py-3 text-center text-xs">
                        {t('pages.clientChains.templateNoneFound', 'No templates match.')}
                      </div>
                    ) : (
                      filteredTemplates.map((qp) => {
                        const label = qp.name ?? qp.chain_name ?? `Chain #${qp.chain_id}`
                        const isSelected = qp.id === selectedTemplateId
                        return (
                          <button
                            key={qp.id}
                            type="button"
                            onClick={() => {
                              setSelectedTemplateId(qp.id)
                              setTemplateOpen(false)
                              setTemplateSearch('')
                            }}
                            className={`hover:bg-muted flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm ${
                              isSelected ? 'bg-blue-50 text-blue-700' : 'text-foreground'
                            }`}
                          >
                            <span className="truncate">{label}</span>
                            {isSelected && (
                              <Icons.Tick01 size={14} strokeWidth={2} className="text-blue-700" />
                            )}
                          </button>
                        )
                      })
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              {selectedTemplate && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleStartTemplate}
                  disabled={startMut.isPending}
                >
                  {t('pages.clientChains.startWithTemplate', 'Start with this template')}
                </Button>
              )}
            </div>
          )}

          {/* Chain selector — always present; locked once an instance is running */}
          <div className="flex flex-col gap-1">
            <Label className="text-foreground text-sm">
              {t('pages.clientChains.taChainLabel')}
            </Label>
            {activeInstance ? (
              <div className="border-border bg-muted text-foreground rounded-md border px-3 py-2.5 text-sm">
                {activeChain?.name}
              </div>
            ) : (
              <DropdownMenu
                open={chainOpen}
                onOpenChange={(o) => {
                  setChainOpen(o)
                  if (!o) setChainSearch('')
                }}
                modal={false}
              >
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="text-foreground focus:border-primary-500 border-border bg-card hover:bg-muted flex min-h-[40px] w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm outline-none"
                  >
                    <span
                      className={selectedChainObj ? 'text-foreground' : 'text-muted-foreground'}
                    >
                      {selectedChainObj
                        ? selectedChainObj.name
                        : t('pages.clientChains.selectChainPlaceholder')}
                    </span>
                    <Icons.ArrowDown
                      size={16}
                      className="text-muted-foreground"
                      strokeWidth={1.5}
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  sideOffset={6}
                  className="border-border bg-card w-[--radix-dropdown-menu-trigger-width] min-w-[260px] rounded-md border p-0 shadow-lg"
                >
                  <div className="border-border border-b p-2">
                    <input
                      type="text"
                      value={chainSearch}
                      onChange={(e) => setChainSearch(e.target.value)}
                      placeholder={t('pages.clientChains.chainSearchPlaceholder', 'Search chains…')}
                      className="text-foreground focus:border-primary-500 placeholder:text-muted-foreground border-border bg-card w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                    />
                  </div>
                  <div
                    className="max-h-[260px] overflow-y-auto overscroll-contain p-1"
                    onWheel={(e) => e.stopPropagation()}
                  >
                    {filteredChains.length === 0 ? (
                      <div className="text-muted-foreground py-3 text-center text-xs">
                        {t('pages.clientChains.chainNoneFound', 'No chains match.')}
                      </div>
                    ) : (
                      <>
                        {pinnedChains.length > 0 && (
                          <div>
                            <div className="text-muted-foreground px-2 pt-1 pb-0.5 text-[10px] font-semibold tracking-wide uppercase">
                              {t('pages.clientChains.pinnedGroup', 'Pinned')}
                            </div>
                            {pinnedChains.map((c) => {
                              const isSelected = String(c.id) === selectedChainId
                              const isChainPinned = c.is_pinned
                              const isClientPinned = clientPinnedChainIds.has(c.id)
                              return (
                                <div
                                  key={c.id}
                                  className={`group hover:bg-muted flex w-full items-center gap-1 rounded px-2 py-1.5 text-sm ${
                                    isSelected ? 'bg-blue-50' : ''
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedChainId(String(c.id))
                                      setChainOpen(false)
                                      setChainSearch('')
                                    }}
                                    className={`flex flex-1 items-center justify-between text-left ${
                                      isSelected ? 'text-blue-700' : 'text-foreground'
                                    }`}
                                  >
                                    <span className="flex items-center gap-1 truncate">
                                      <span className="truncate">{c.name}</span>
                                      {isClientPinned && !isChainPinned && (
                                        <span
                                          className="text-warning-700 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-medium"
                                          title={t(
                                            'pages.clientChains.clientPinHint',
                                            'Pinned via this client’s history'
                                          )}
                                        >
                                          {t('pages.clientChains.clientPinTag', 'client')}
                                        </span>
                                      )}
                                    </span>
                                    {isSelected && (
                                      <Icons.Tick01
                                        size={14}
                                        strokeWidth={2}
                                        className="text-blue-700"
                                      />
                                    )}
                                  </button>
                                  {isChainPinned && (
                                    <button
                                      type="button"
                                      aria-label={t('pages.clientChains.unpin', 'Unpin')}
                                      title={t('pages.clientChains.unpin', 'Unpin')}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        toggleChainPin(c.id, true)
                                      }}
                                      className="rounded p-1 text-blue-600 hover:bg-blue-100"
                                    >
                                      <Icons.Pin size={14} strokeWidth={2} />
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                        {unpinnedChains.length > 0 && (
                          <div>
                            {pinnedChains.length > 0 && (
                              <div className="text-muted-foreground px-2 pt-2 pb-0.5 text-[10px] font-semibold tracking-wide uppercase">
                                {t('pages.clientChains.allGroup', 'All chains')}
                              </div>
                            )}
                            {unpinnedChains.map((c) => {
                              const isSelected = String(c.id) === selectedChainId
                              return (
                                <div
                                  key={c.id}
                                  className={`group hover:bg-muted flex w-full items-center gap-1 rounded px-2 py-1.5 text-sm ${
                                    isSelected ? 'bg-blue-50' : ''
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedChainId(String(c.id))
                                      setChainOpen(false)
                                      setChainSearch('')
                                    }}
                                    className={`flex flex-1 items-center justify-between text-left ${
                                      isSelected ? 'text-blue-700' : 'text-foreground'
                                    }`}
                                  >
                                    <span className="truncate">{c.name}</span>
                                    {isSelected && (
                                      <Icons.Tick01
                                        size={14}
                                        strokeWidth={2}
                                        className="text-blue-700"
                                      />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={t('pages.clientChains.pin', 'Pin')}
                                    title={t('pages.clientChains.pin', 'Pin')}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      toggleChainPin(c.id, false)
                                    }}
                                    className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1"
                                  >
                                    <Icons.Pin size={14} strokeWidth={1.5} />
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Body switch */}
          {!effectiveChain ? (
            <p className="text-muted-foreground text-sm">
              {t('pages.clientChains.pickToContinue', 'Pick a chain above to continue.')}
            </p>
          ) : activeInstance ? (
            // ===== WIZARD MODE =====
            <div className="flex w-full flex-col gap-4 lg:flex-row lg:gap-6">
              {/* LEFT: form */}
              <div className="flex flex-1 flex-col gap-4">
                {completedSteps.map((cs) => {
                  const isEditing = editingStep?.stepOrder === cs.stepOrder
                  const ta = cs.targetActionId ? taById.get(cs.targetActionId) : null
                  return (
                    <div
                      key={cs.stepOrder}
                      className={`flex flex-col gap-2 rounded-lg border p-3 ${
                        isEditing
                          ? 'border-blue-200 bg-blue-50/50'
                          : 'border-green-200 bg-green-50/50'
                      }`}
                    >
                      {/* Header row */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-semibold ${isEditing ? 'text-blue-700' : 'text-success-700'}`}
                        >
                          {t('pages.clientChains.stepLabel', { order: cs.stepOrder })} — {cs.taName}
                        </span>
                        {!isEditing && !isFinalizing && !isAutoAdvancing && (
                          <button
                            onClick={() => openEditStep(cs)}
                            className="text-muted-foreground hover:bg-card hover:text-foreground rounded p-1"
                            title={t('common.edit', 'Edit')}
                          >
                            <Icons.Edit size={13} strokeWidth={1.5} />
                          </button>
                        )}
                      </div>

                      {/* Read-only summary */}
                      {!isEditing && <span className="text-xs text-green-800">{cs.taValue}</span>}

                      {/* Inline edit form */}
                      {isEditing && editingStep && (
                        <div className="flex flex-col gap-2">
                          {/* Main value input */}
                          {editingStep.fieldType === 'dropdown' && ta ? (
                            <Select
                              value={editingStep.value}
                              onValueChange={(v) =>
                                setEditingStep((prev) => (prev ? { ...prev, value: v } : prev))
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder={t('pages.clientChains.selectValue')} />
                              </SelectTrigger>
                              <SelectContent>
                                {ta.dropdown_values
                                  .filter((dv) => !dv.is_hidden)
                                  .map((dv) => (
                                    <SelectItem key={dv.id} value={dv.value} className="text-xs">
                                      {dv.value}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          ) : editingStep.fieldType === 'contact' ? (
                            <div className="flex flex-col gap-1">
                              {!editingContactOptions ? (
                                <span className="text-muted-foreground text-xs">
                                  {t('common.loading')}
                                </span>
                              ) : editingContactOptions.length === 0 ? (
                                <span className="text-muted-foreground text-xs">
                                  {editingContactMeta?.isEmail
                                    ? t(
                                        'pages.clientChains.noEmails',
                                        'No emails available for this source.'
                                      )
                                    : t(
                                        'pages.clientChains.noContacts',
                                        'No phones available for this source.'
                                      )}
                                </span>
                              ) : (
                                editingContactOptions.map((p) => {
                                  const isChecked = editingStep.value === p.contact_value
                                  const showComment = editingContactMeta?.source === 'recommender'
                                  return (
                                    <label
                                      key={p.id}
                                      className="border-border bg-card text-foreground hover:bg-muted flex items-center gap-2 rounded-md border px-3 py-2 text-xs"
                                    >
                                      <input
                                        type="radio"
                                        name={`edit-contact-step-${editingStep.stepOrder}`}
                                        checked={isChecked}
                                        onChange={() => {}}
                                        onClick={() =>
                                          setEditingStep((prev) =>
                                            prev
                                              ? { ...prev, value: isChecked ? '' : p.contact_value }
                                              : prev
                                          )
                                        }
                                      />
                                      <span className="flex flex-col">
                                        <span className="font-medium">
                                          {p.contact_value}
                                          {p.type_name && (
                                            <span className="text-muted-foreground ml-2 text-xs">
                                              ({p.type_name})
                                            </span>
                                          )}
                                        </span>
                                        {showComment && p.comment && (
                                          <span className="text-muted-foreground text-xs">
                                            {p.comment}
                                          </span>
                                        )}
                                      </span>
                                    </label>
                                  )
                                })
                              )}
                            </div>
                          ) : editingStep.fieldType === 'date' ? (
                            <DateSelect
                              value={editingStep.value || null}
                              onChange={({ value }) =>
                                setEditingStep((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        value: value ? getDateTimeStringInTimezone(value) : '',
                                      }
                                    : prev
                                )
                              }
                              onValidityChange={setEditDateInvalid}
                              allowManualInput
                              defaultTime={MANUAL_DATE_DEFAULT_TIME}
                              format={MANUAL_DATE_FORMAT}
                              showTimeSelect
                              timeFormat="HH:mm"
                              timeIntervals={15}
                              invalidText={t('pages.clientChains.errors.dateInvalid')}
                              error={
                                stepDateIsPast(
                                  editingStep.value,
                                  editingStep.fieldType,
                                  steps.find((s) => s.step_order === editingStep.stepOrder)
                                    ?.not_in_the_past,
                                  user?.timezone
                                )
                                  ? t('pages.clientChains.errors.datePast')
                                  : undefined
                              }
                              {...notInPastBounds(
                                steps.find((s) => s.step_order === editingStep.stepOrder)
                                  ?.not_in_the_past,
                                user?.timezone
                              )}
                            />
                          ) : editingStep.fieldType === 'amount' ? (
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              className="h-8 text-xs"
                              leftIcon={<span className="text-foreground">₴</span>}
                              value={editingStep.value}
                              onChange={(e) =>
                                setEditingStep((prev) =>
                                  prev ? { ...prev, value: e.target.value } : prev
                                )
                              }
                            />
                          ) : (
                            <Input
                              className="h-8 text-xs"
                              value={editingStep.value}
                              onChange={(e) =>
                                setEditingStep((prev) =>
                                  prev ? { ...prev, value: e.target.value } : prev
                                )
                              }
                            />
                          )}

                          {/* Promise date / amount / credit if this step had extras */}
                          {editingStep.promiseDate !== undefined &&
                            editingStep.promiseDate !== '' && (
                              <div className="flex flex-col gap-1">
                                <Label className="text-muted-foreground text-xs">
                                  {t('pages.clientChains.promiseDate')}
                                </Label>
                                <DateSelect
                                  value={editingStep.promiseDate || null}
                                  onChange={({ value }) =>
                                    setEditingStep((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            promiseDate: value
                                              ? getDateTimeStringInTimezone(value)
                                              : '',
                                          }
                                        : prev
                                    )
                                  }
                                  format="dd/MM/yyyy HH:mm"
                                  showTimeSelect
                                  timeFormat="HH:mm"
                                  timeIntervals={15}
                                />
                              </div>
                            )}
                          {editingStep.promiseAmount !== undefined &&
                            editingStep.promiseAmount !== '' && (
                              <div className="flex flex-col gap-1">
                                <Label className="text-muted-foreground text-xs">
                                  {t('pages.clientChains.promiseAmount')}
                                </Label>
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  className="h-8 text-xs"
                                  leftIcon={<span className="text-foreground">₴</span>}
                                  value={editingStep.promiseAmount}
                                  onChange={(e) =>
                                    setEditingStep((prev) =>
                                      prev ? { ...prev, promiseAmount: e.target.value } : prev
                                    )
                                  }
                                />
                              </div>
                            )}

                          {/* Rewind warning — shown inline when a branch step is saved */}
                          {showRewindWarning ? (
                            <div className="border-warning-200 bg-warning-100 rounded-lg border p-3">
                              <p className="mb-1 text-xs font-semibold text-amber-800">
                                {t(
                                  'pages.clientChains.rewindWarningTitle',
                                  'Change branching step?'
                                )}
                              </p>
                              <p className="text-warning-700 mb-2 text-xs">
                                {t(
                                  'pages.clientChains.rewindWarningBody',
                                  'Steps after step {{order}} will be cleared and you will re-walk them.',
                                  { order: editingStep.stepOrder }
                                )}
                              </p>
                              <div className="flex gap-2">
                                <Button
                                  variant="primary"
                                  className="h-7 flex-1 text-xs"
                                  onClick={confirmRewindAndEdit}
                                  disabled={rewindMut.isPending}
                                >
                                  {rewindMut.isPending
                                    ? t('common.loading')
                                    : t('pages.clientChains.rewindConfirm', 'Yes, reset & re-walk')}
                                </Button>
                                <Button
                                  variant="cancel"
                                  className="h-7 flex-1 text-xs"
                                  onClick={() => setShowRewindWarning(false)}
                                >
                                  {t('common.cancel', 'Cancel')}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            /* Normal Save / Cancel buttons */
                            <div className="flex gap-2">
                              <Button
                                variant="primary"
                                className="h-7 flex-1 text-xs"
                                onClick={handleSaveEditStep}
                              >
                                {t('common.save', 'Save')}
                              </Button>
                              <Button
                                variant="cancel"
                                className="h-7 flex-1 text-xs"
                                onClick={cancelEditStep}
                              >
                                {t('common.cancel', 'Cancel')}
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}

                {(isFinalizing || isAutoAdvancing) && (
                  <div className="text-muted-foreground flex items-center justify-center gap-2 py-8 text-sm">
                    <span className="border-border h-4 w-4 animate-spin rounded-full border-2 border-t-blue-600" />
                    {t('pages.clientChains.saving', 'Saving…')}
                  </div>
                )}

                {!isFinalizing && !isAutoAdvancing && isDelayBlocked && (
                  <div className="border-warning-200 bg-warning-100 flex flex-col items-center gap-2 rounded-lg border p-6 text-center">
                    <span className="text-2xl">⏳</span>
                    <span className="text-sm font-medium text-amber-800">
                      {delaySecondsLeft >= 60
                        ? t('pages.clientChains.delayWaiting', { minutes: delayMinutesLeft })
                        : t('pages.clientChains.delayWaitingSeconds', {
                            seconds: delaySecondsLeft,
                          })}
                    </span>
                    <span className="text-warning-600 text-xs">
                      {t('pages.clientChains.delayHint')}
                    </span>
                  </div>
                )}

                {!isFinalizing &&
                  !isAutoAdvancing &&
                  !isDelayBlocked &&
                  currentStep &&
                  currentTA && (
                    <div className="border-border bg-muted/50 flex flex-col gap-1 rounded-lg border p-3">
                      <Label className="text-foreground text-sm font-medium">
                        {t('pages.clientChains.stepLabel', { order: currentStep.step_order })} —{' '}
                        {currentTA.name}
                        {currentStep.is_required && <span className="ml-1 text-red-500">*</span>}
                      </Label>
                      {currentTA.field_type === 'dropdown' ? (
                        <Select value={stepValue} onValueChange={setStepValue}>
                          <SelectTrigger>
                            <SelectValue placeholder={t('pages.clientChains.selectValue')} />
                          </SelectTrigger>
                          <SelectContent>
                            {currentTA.dropdown_values
                              .filter((dv) => !dv.is_hidden)
                              .map((dv) => (
                                <SelectItem key={dv.id} value={dv.value}>
                                  {dv.value}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      ) : currentTA.field_type === 'date' ? (
                        <DateSelect
                          value={stepValue || null}
                          onChange={({ value }) =>
                            setStepValue(value ? getDateTimeStringInTimezone(value) : '')
                          }
                          onValidityChange={setWizardDateInvalid}
                          allowManualInput
                          defaultTime={MANUAL_DATE_DEFAULT_TIME}
                          format={MANUAL_DATE_FORMAT}
                          showTimeSelect
                          timeFormat="HH:mm"
                          timeIntervals={15}
                          invalidText={t('pages.clientChains.errors.dateInvalid')}
                          error={
                            stepDateIsPast(
                              stepValue,
                              currentTA.field_type,
                              currentStep?.not_in_the_past,
                              user?.timezone
                            )
                              ? t('pages.clientChains.errors.datePast')
                              : undefined
                          }
                          {...notInPastBounds(currentStep?.not_in_the_past, user?.timezone)}
                        />
                      ) : currentTA.field_type === 'amount' ? (
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="0.00"
                          leftIcon={<span className="text-foreground">₴</span>}
                          value={stepValue}
                          onChange={(e) => setStepValue(e.target.value)}
                        />
                      ) : currentTA.field_type === 'credit' ? (
                        <div className="flex flex-col gap-2">
                          {visibleDebts.length === 0 ? (
                            <span className="text-muted-foreground text-xs">
                              {t('pages.clientChains.noCredits')}
                            </span>
                          ) : (
                            visibleDebts.map((d) => {
                              const creditKey = String(d.id)
                              const selectedIds = stepValue ? stepValue.split(',') : []
                              const isChecked = selectedIds.includes(creditKey)
                              return (
                                <label
                                  key={d.id}
                                  className="border-border bg-card text-foreground hover:bg-muted flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      const next = e.target.checked
                                        ? [...selectedIds, creditKey]
                                        : selectedIds.filter((id) => id !== creditKey)
                                      setStepValue(next.filter(Boolean).join(','))
                                    }}
                                  />
                                  <span>
                                    #{d.contract_number ?? d.id}
                                    {d.seller_company ? ` — ${d.seller_company}` : ''}
                                    {d.remaining_debt_amount
                                      ? ` — ${formatMoneyKopeckTight(d.remaining_debt_amount)}`
                                      : ''}
                                    {d.days_past_due ? ` — overdue ${d.days_past_due}d` : ''}
                                  </span>
                                </label>
                              )
                            })
                          )}
                        </div>
                      ) : currentTA.field_type === 'contact' ? (
                        <div className="flex flex-col gap-2">
                          {!contactOptions ? (
                            <span className="text-muted-foreground text-xs">
                              {t('common.loading')}
                            </span>
                          ) : contactOptions.length === 0 ? (
                            <span className="text-muted-foreground text-xs">
                              {isEmailContactStep
                                ? t(
                                    'pages.clientChains.noEmails',
                                    'No emails available for this source.'
                                  )
                                : t(
                                    'pages.clientChains.noContacts',
                                    'No phones available for this source.'
                                  )}
                            </span>
                          ) : (
                            contactOptions.map((p) => {
                              const isChecked = stepValue === p.contact_value
                              const showComment = currentStep?.contact_source === 'recommender'
                              return (
                                <label
                                  key={p.id}
                                  className="border-border bg-card text-foreground hover:bg-muted flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                                >
                                  <input
                                    type="radio"
                                    name={`contact-step-${currentStep?.id ?? 0}`}
                                    checked={isChecked}
                                    onChange={() => {}}
                                    onClick={() => setStepValue(isChecked ? '' : p.contact_value)}
                                  />
                                  <span className="flex flex-col">
                                    <span className="font-medium">
                                      {p.contact_value}
                                      {p.type_name ? (
                                        <span className="text-muted-foreground ml-2 text-xs">
                                          ({p.type_name})
                                        </span>
                                      ) : null}
                                    </span>
                                    {showComment && p.comment && (
                                      <span className="text-muted-foreground text-xs">
                                        {p.comment}
                                      </span>
                                    )}
                                  </span>
                                </label>
                              )
                            })
                          )}
                        </div>
                      ) : (
                        <Input
                          type="text"
                          placeholder={currentTA.name}
                          value={stepValue}
                          onChange={(e) => setStepValue(e.target.value)}
                        />
                      )}
                    </div>
                  )}

                {selectedDropdownValue?.require_promise_date && (
                  <div className="flex flex-col gap-1">
                    <Label className="text-foreground text-sm">
                      {t('pages.clientChains.promiseDate')} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="date"
                      value={promiseDate}
                      onChange={(e) => setPromiseDate(e.target.value)}
                    />
                  </div>
                )}

                {selectedDropdownValue?.require_promise_amount && (
                  <div className="flex flex-col gap-1">
                    <Label className="text-foreground text-sm">
                      {t('pages.clientChains.promiseAmountUAH')}{' '}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      leftIcon={<span className="text-foreground">₴</span>}
                      value={promiseAmount}
                      onChange={(e) => setPromiseAmount(e.target.value)}
                    />
                  </div>
                )}

                {visibleDebts.length > 0 && selectedDropdownValue?.require_credit && (
                  <div className="flex flex-col gap-1">
                    <Label className="text-foreground text-sm">
                      {t('pages.clientChains.credit')} <span className="text-red-500">*</span>
                    </Label>
                    <Select value={creditId} onValueChange={setCreditId}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('pages.clientChains.creditPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {visibleDebts.map((d) => (
                          <SelectItem key={d.id} value={String(d.id)}>
                            #{d.contract_number ?? d.id}
                            {d.seller_company ? ` — ${d.seller_company}` : ''}
                            {d.remaining_debt_amount
                              ? ` — ${formatMoneyKopeckTight(d.remaining_debt_amount)}`
                              : ''}
                            {d.days_past_due ? ` — overdue ${d.days_past_due}d` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {!isFinalizing && !isAutoAdvancing && isLastStep && (
                  <div className="flex flex-col gap-1">
                    <Label className="text-foreground text-sm">
                      {t('pages.clientChains.notes')}
                    </Label>
                    <Textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={t('pages.clientChains.notesPlaceholder')}
                      // KAN-974: the one field where Enter stays a line break.
                      {...{ [NOTES_FIELD_ATTR]: true }}
                    />
                  </div>
                )}

                {!isFinalizing &&
                  !isAutoAdvancing &&
                  !isDelayBlocked &&
                  !isLastStep &&
                  !canAutoAdvance && (
                    <Button
                      variant="cancel"
                      onClick={handleAutoAdvance}
                      disabled={advanceMut.isPending || isAutoAdvancing}
                      className="w-full"
                    >
                      {t('pages.clientChains.continueToNext')}
                    </Button>
                  )}

                {!isFinalizing &&
                  !isAutoAdvancing &&
                  !isDelayBlocked &&
                  isLastStep &&
                  showNotifyResponsibleCheckbox && (
                    <label className="text-foreground flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={notifyResponsible}
                        onChange={(e) => setNotifyResponsible(e.target.checked)}
                      />
                      {t('pages.clientChains.notifyResponsible', 'Notify responsible employee')}
                    </label>
                  )}

                {!isFinalizing && !isAutoAdvancing && !isDelayBlocked && isLastStep && (
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    disabled={createIntMut.isPending || advanceMut.isPending}
                    className="w-full"
                  >
                    {t('pages.clientChains.saveInteraction')}
                  </Button>
                )}
              </div>

              {/* RIGHT: progress + effects */}
              <div className="flex w-full flex-col gap-6 lg:w-[280px]">
                <div className="flex flex-col gap-3">
                  <h3 className="text-foreground text-base font-semibold">
                    {t('pages.clientChains.chainProgress')}
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    {activeChain?.name} —{' '}
                    {t('pages.clientChains.stepOf', {
                      current: activeInstance.current_step_order ?? 1,
                      total: steps.length,
                    })}
                  </p>

                  <ol className="flex flex-col">
                    {steps.map((step, idx) => {
                      const isCurrent = step.step_order === (activeInstance.current_step_order ?? 1)
                      const isPast = step.step_order < (activeInstance.current_step_order ?? 1)
                      const hasBranch = stepBranchSet.has(step.id)
                      const isLast = idx === steps.length - 1
                      const formatDelay = (minutes: number): string => {
                        if (minutes >= 1440) return `+${Math.round(minutes / 1440)}d`
                        if (minutes >= 60) return `+${Math.round(minutes / 60)}h`
                        return `+${minutes}m`
                      }
                      return (
                        <li key={step.id} className="relative flex items-start gap-3">
                          <div className="flex flex-col items-center">
                            <div
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                                isCurrent
                                  ? 'bg-blue-600 text-white'
                                  : isPast
                                    ? 'text-success-700 bg-green-100'
                                    : 'border-border bg-card text-muted-foreground border'
                              }`}
                            >
                              {step.step_order}
                            </div>
                            {!isLast && (
                              <div className="border-border my-1 h-6 border-l border-dashed" />
                            )}
                          </div>
                          <div className="flex flex-1 items-center justify-between gap-2 pt-1">
                            <span
                              className={`text-sm ${
                                isCurrent ? 'text-foreground font-semibold' : 'text-foreground'
                              }`}
                            >
                              {step.target_action_name ?? `Step ${step.step_order}`}
                            </span>
                            <div className="flex shrink-0 items-center gap-2">
                              {isCurrent && (
                                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
                                  {t('pages.clientChains.current')}
                                </span>
                              )}
                              {step.delay_minutes > 0 && (
                                <span className="text-muted-foreground text-[11px]">
                                  {formatDelay(step.delay_minutes)}
                                </span>
                              )}
                              {hasBranch && (
                                <span className="text-muted-foreground text-[11px]">
                                  {t('pages.clientChains.branch')}
                                </span>
                              )}
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                </div>

                {currentStepEffects.length > 0 && (
                  <div className="border-border flex flex-col gap-2 border-t pt-4">
                    <h3 className="text-foreground text-base font-semibold">
                      {t('pages.clientChains.effectsOnSave')}
                    </h3>
                    <ul className="flex flex-col gap-1.5">
                      {currentStepEffects.map((ef) => {
                        const cfg = ef.config as Record<string, unknown>
                        const tagId = typeof cfg.tag_id === 'number' ? cfg.tag_id : undefined
                        const tagName =
                          tagId !== undefined ? (tagNameById.get(tagId) ?? `#${tagId}`) : undefined
                        return (
                          <li
                            key={ef.id}
                            className="text-foreground flex items-center gap-1.5 text-sm"
                          >
                            <span className="text-muted-foreground">→</span>
                            {ef.effect_type === 'add_tag' && (
                              <>
                                <span>{t('pages.clientChains.effectTag')}:</span>
                                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                                  {tagName}
                                </span>
                              </>
                            )}
                            {ef.effect_type === 'remove_tag' && (
                              <>
                                <span>{t('pages.clientChains.effectRemoveTag')}:</span>
                                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                                  {tagName}
                                </span>
                              </>
                            )}
                            {ef.effect_type === 'create_task' && (
                              <span>{t('pages.clientChains.effectTask')}</span>
                            )}
                            {ef.effect_type === 'send_sms' && (
                              <span>{t('pages.clientChains.effectSMS')}</span>
                            )}
                            {ef.effect_type === 'send_message' && (
                              <span>{t('pages.clientChains.effectMessage')}</span>
                            )}
                            {ef.effect_type === 'add_to_spam' && (
                              <span>{t('pages.clientChains.effectSpam')}</span>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : isInstantMode ? (
            // ===== INSTANT MODE — every step rendered at once =====
            <div className="flex flex-col gap-3">
              {effectiveSteps.map((step, idx) => {
                const ta = taById.get(step.target_action_id)
                if (!ta) return null
                const v = instantValues[step.id] ?? EMPTY_INSTANT_VALUE
                return (
                  <InstantStepCard
                    key={step.id}
                    index={idx}
                    step={step}
                    ta={ta}
                    value={v}
                    onChange={(patch) => updateInstantStep(step.id, patch)}
                    debts={debts}
                    clientId={clientId}
                    hasPriorEntry={Object.prototype.hasOwnProperty.call(instantValues, step.id)}
                    selectionSettled={lastInstantSelectionRef.current === instantSelectionKey}
                  />
                )
              })}
              <div className="flex flex-col gap-1">
                <Label className="text-foreground text-sm">{t('pages.clientChains.notes')}</Label>
                <Textarea
                  rows={3}
                  value={instantNotes}
                  onChange={(e) => setInstantNotes(e.target.value)}
                  placeholder={t('pages.clientChains.notesPlaceholder')}
                  // KAN-974: the one field where Enter stays a line break.
                  {...{ [NOTES_FIELD_ATTR]: true }}
                />
              </div>
              {showNotifyResponsibleCheckbox && (
                <label className="text-foreground flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={notifyResponsible}
                    onChange={(e) => setNotifyResponsible(e.target.checked)}
                  />
                  {t('pages.clientChains.notifyResponsible', 'Notify responsible employee')}
                </label>
              )}
              <Button
                variant="primary"
                onClick={handleInstantSave}
                disabled={instantSubmitting}
                className="w-full"
              >
                {instantSubmitting ? t('common.loading') : t('pages.clientChains.saveInteraction')}
              </Button>
            </div>
          ) : (
            // ===== PREVIEW MODE — chain has delays/branches; show progress + Start =====
            <div className="flex w-full flex-col gap-4 lg:flex-row lg:gap-6">
              {/* LEFT: hint + Start */}
              <div className="flex flex-1 flex-col gap-4">
                <p className="text-muted-foreground text-sm">
                  {t(
                    'pages.clientChains.previewHint',
                    'Review the chain on the right and click Start when ready.'
                  )}
                </p>
                <Button
                  variant="primary"
                  onClick={handleStart}
                  disabled={!selectedChainId || startMut.isPending}
                >
                  {t('pages.clientChains.start')}
                </Button>
              </div>

              {/* RIGHT: progress timeline (no current step yet) */}
              <div className="flex w-full flex-col gap-6 lg:w-[280px]">
                <div className="flex flex-col gap-3">
                  <h3 className="text-foreground text-base font-semibold">
                    {t('pages.clientChains.chainProgress')}
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    {effectiveChain.name} —{' '}
                    {t('pages.clientChains.stepCount', {
                      count: effectiveSteps.length,
                    })}
                  </p>
                  <ol className="flex flex-col">
                    {effectiveSteps.map((step, idx) => {
                      const hasBranch = stepBranchSet.has(step.id)
                      const isLast = idx === effectiveSteps.length - 1
                      const formatDelay = (minutes: number): string => {
                        if (minutes >= 1440) return `+${Math.round(minutes / 1440)}d`
                        if (minutes >= 60) return `+${Math.round(minutes / 60)}h`
                        return `+${minutes}m`
                      }
                      const ta = taById.get(step.target_action_id)
                      return (
                        <li key={step.id} className="relative flex items-start gap-3">
                          <div className="flex flex-col items-center">
                            <div className="border-border bg-card text-muted-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">
                              {step.step_order}
                            </div>
                            {!isLast && (
                              <div className="border-border my-1 h-6 border-l border-dashed" />
                            )}
                          </div>
                          <div className="flex flex-1 items-center justify-between gap-2 pt-1">
                            <span className="text-foreground text-sm">
                              {ta?.name ?? step.target_action_name ?? `Step ${step.step_order}`}
                              {step.is_required && <span className="ml-1 text-red-500">*</span>}
                            </span>
                            <div className="flex shrink-0 items-center gap-2">
                              {step.delay_minutes > 0 && (
                                <span className="text-muted-foreground text-[11px]">
                                  {formatDelay(step.delay_minutes)}
                                </span>
                              )}
                              {hasBranch && (
                                <span className="text-muted-foreground text-[11px]">
                                  {t('pages.clientChains.branch')}
                                </span>
                              )}
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---------- InstantStepCard helper ----------
// Lives outside ChainExecutor so each card owns a stable hook order
// (a contact-type step needs useClientPhones; mapping over steps in
// the parent would call hooks in a loop with variable count).
interface InstantStepCardProps {
  index: number
  step: TAChainStep
  ta: TargetAction
  value: InstantStepValue
  onChange: (patch: Partial<InstantStepValue>) => void
  /**
   * Whether the parent's ``instantValues`` already holds an entry for this
   * step. ``value`` alone cannot say: a step the operator cleared and one they
   * never opened both arrive as ``value: ''``. Only used to seed the KAN-977
   * auto-select latch — see the effect for why that distinction matters.
   */
  hasPriorEntry: boolean
  /**
   * Whether the parent's selection-reset effect has already run for the current
   * ``selectedChainId``/instance — i.e. whether ``instantValues`` describes THIS
   * selection rather than the previous one. Auto-select waits for it; see the
   * effect for the race it prevents.
   */
  selectionSettled: boolean
  debts: Array<{
    id: number
    contract_number?: string
    remaining_debt_amount?: string | number | null
    days_past_due?: number | null
    seller_company?: string | null
    status?: string | null
  }>
  clientId: number
}

export function InstantStepCard({
  index,
  step,
  ta,
  value,
  onChange,
  debts,
  clientId,
  hasPriorEntry,
  selectionSettled,
}: InstantStepCardProps) {
  const { t } = useTranslation('common')
  const cardUser = useAuthStore((s) => s.user)
  const contactSource = ta.field_type === 'contact' ? (step.contact_source ?? 'client') : null
  const isEmailContact = step.contact_medium === 'email'
  const { data: phones } = useClientPhones(
    clientId,
    contactSource && !isEmailContact ? contactSource : null
  )
  const { data: emails } = useClientEmails(
    clientId,
    contactSource && isEmailContact ? contactSource : null
  )
  const contactOptions = isEmailContact ? emails : phones

  // KAN-977, all-at-once mode — same rule as the wizard, shared via
  // ``pickSingleContactCandidate``. The effect is repeated rather than lifted
  // because this card owns its own contact query: the parent cannot call the
  // hook per step without calling hooks in a loop (see the note above).
  //
  // Two guards beyond the shared rule, each for a race found in review:
  //
  // * ``selectionSettled``. This card mounts in the SAME commit where
  //   ``selectedChainId`` changes, and React flushes child effects before
  //   parent ones. With a warm contact cache the list is populated on the very
  //   first render, so without this the card would pick and queue a FUNCTIONAL
  //   ``setInstantValues`` — and the parent's selection reset would then queue
  //   a PLAIN ``setInstantValues({})`` that lands last and discards it. Nothing
  //   would retry: on the next render neither ``value.value`` ('' both times)
  //   nor ``contactOptions`` (same cached array) changes, so the effect would
  //   not re-run and the feature would silently no-op after every chain switch.
  //   Waiting for the reset makes this prop the dependency that DOES flip, so
  //   the effect runs exactly once, after ``instantValues`` describes this
  //   selection.
  //
  // * ``hasPriorEntry`` seeding the latch. Restoring a minimized session
  //   remounts these cards with the persisted ``instantValues``. A step the
  //   operator deliberately unticked comes back as ``value: ''`` —
  //   indistinguishable from never-touched — so a fresh latch would re-tick it
  //   and undo an explicit choice. Presence of the step's key in the snapshot
  //   is what separates "cleared on purpose" from "never visited".
  const autoSelectedRef = useRef(hasPriorEntry)

  // ``onChange`` is an inline arrow rebuilt on every parent render, so keeping
  // it in the dep array below would re-run this effect on every parent render.
  // A ref keeps the dependency list honest about what actually triggers it.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  useEffect(() => {
    // Any value present — the pick that landed, a prefill, or operator input —
    // means there is nothing left to choose for this card.
    if (value.value) {
      autoSelectedRef.current = true
      return
    }
    if (!selectionSettled) return

    const pick = pickSingleContactCandidate({
      fieldType: ta.field_type,
      isEmailStep: isEmailContact,
      candidates: contactOptions,
      currentValue: value.value,
      alreadyAutoSelected: autoSelectedRef.current,
    })
    if (pick === null) return

    autoSelectedRef.current = true
    onChangeRef.current({ value: pick })
  }, [contactOptions, ta.field_type, isEmailContact, value.value, selectionSettled])

  // Mirror the wizard-mode debt filter: hide closed debts unless the
  // step's show_closed_credits admin flag is set.
  const visibleDebts = useMemo(() => {
    if (step.show_closed_credits) return debts
    return debts.filter((d) => (d.status ?? '').toLowerCase() !== 'closed')
  }, [debts, step.show_closed_credits])

  const dv =
    ta.field_type === 'dropdown' && value.value
      ? (ta.dropdown_values.find((d) => d.value === value.value) ?? null)
      : null

  return (
    <div className="border-border bg-muted/50 flex flex-col gap-1 rounded-md border p-3">
      <Label className="text-foreground text-sm font-medium">
        {t('pages.clientChains.stepLabel', { order: index + 1 })} — {ta.name}
        {step.is_required && <span className="ml-1 text-red-500">*</span>}
      </Label>

      {ta.field_type === 'dropdown' ? (
        <Select value={value.value} onValueChange={(v) => onChange({ value: v })}>
          <SelectTrigger>
            <SelectValue placeholder={t('pages.clientChains.selectValue')} />
          </SelectTrigger>
          <SelectContent>
            {ta.dropdown_values
              .filter((opt) => !opt.is_hidden)
              .map((opt) => (
                <SelectItem key={opt.id} value={opt.value}>
                  {opt.value}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      ) : ta.field_type === 'date' ? (
        <DateSelect
          value={value.value || null}
          onChange={({ value: v }) => onChange({ value: v ? getDateTimeStringInTimezone(v) : '' })}
          onValidityChange={(invalid) => onChange({ dateInvalid: invalid })}
          allowManualInput
          defaultTime={MANUAL_DATE_DEFAULT_TIME}
          format={MANUAL_DATE_FORMAT}
          showTimeSelect
          timeFormat="HH:mm"
          timeIntervals={15}
          invalidText={t('pages.clientChains.errors.dateInvalid')}
          error={
            stepDateIsPast(value.value, ta.field_type, step.not_in_the_past, cardUser?.timezone)
              ? t('pages.clientChains.errors.datePast')
              : undefined
          }
          {...notInPastBounds(step.not_in_the_past, cardUser?.timezone)}
        />
      ) : ta.field_type === 'amount' ? (
        <Input
          type="number"
          min={0}
          step="0.01"
          placeholder="0.00"
          leftIcon={<span className="text-foreground">₴</span>}
          value={value.value}
          onChange={(e) => onChange({ value: e.target.value })}
        />
      ) : ta.field_type === 'credit' ? (
        <div className="flex flex-col gap-2">
          {visibleDebts.length === 0 ? (
            <span className="text-muted-foreground text-xs">
              {t('pages.clientChains.noCredits')}
            </span>
          ) : (
            visibleDebts.map((d) => {
              const creditKey = String(d.id)
              const selectedIds = value.value ? value.value.split(',') : []
              const isChecked = selectedIds.includes(creditKey)
              return (
                <label
                  key={d.id}
                  className="border-border bg-card text-foreground hover:bg-muted flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...selectedIds, creditKey]
                        : selectedIds.filter((id) => id !== creditKey)
                      onChange({ value: next.filter(Boolean).join(',') })
                    }}
                  />
                  <span>
                    #{d.contract_number ?? d.id}
                    {d.seller_company ? ` — ${d.seller_company}` : ''}
                    {d.remaining_debt_amount
                      ? ` — ${formatMoneyKopeckTight(d.remaining_debt_amount)}`
                      : ''}
                    {d.days_past_due ? ` — overdue ${d.days_past_due}d` : ''}
                  </span>
                </label>
              )
            })
          )}
        </div>
      ) : ta.field_type === 'contact' ? (
        <div className="flex flex-col gap-2">
          {!contactOptions ? (
            <span className="text-muted-foreground text-xs">{t('common.loading')}</span>
          ) : contactOptions.length === 0 ? (
            <span className="text-muted-foreground text-xs">
              {isEmailContact
                ? t('pages.clientChains.noEmails', 'No emails available for this source.')
                : t('pages.clientChains.noContacts', 'No phones available for this source.')}
            </span>
          ) : (
            contactOptions.map((p) => {
              const isChecked = value.value === p.contact_value
              const showComment = step.contact_source === 'recommender'
              return (
                <label
                  key={p.id}
                  className="border-border bg-card text-foreground hover:bg-muted flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <input
                    type="radio"
                    name={`instant-contact-${step.id}`}
                    checked={isChecked}
                    onChange={() => {}}
                    onClick={() => onChange({ value: isChecked ? '' : p.contact_value })}
                  />
                  <span className="flex flex-col">
                    <span className="font-medium">
                      {p.contact_value}
                      {p.type_name ? (
                        <span className="text-muted-foreground ml-2 text-xs">({p.type_name})</span>
                      ) : null}
                    </span>
                    {showComment && p.comment && (
                      <span className="text-muted-foreground text-xs">{p.comment}</span>
                    )}
                  </span>
                </label>
              )
            })
          )}
        </div>
      ) : (
        <Input
          type="text"
          placeholder={ta.name}
          value={value.value}
          onChange={(e) => onChange({ value: e.target.value })}
        />
      )}

      {dv?.require_promise_date && (
        <div className="mt-1 flex flex-col gap-1">
          <Label className="text-muted-foreground text-xs">
            {t('pages.clientChains.promiseDate')} <span className="text-red-500">*</span>
          </Label>
          <Input
            type="date"
            value={value.promiseDate}
            onChange={(e) => onChange({ promiseDate: e.target.value })}
          />
        </div>
      )}
      {dv?.require_promise_amount && (
        <div className="mt-1 flex flex-col gap-1">
          <Label className="text-muted-foreground text-xs">
            {t('pages.clientChains.promiseAmountUAH')} <span className="text-red-500">*</span>
          </Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            leftIcon={<span className="text-foreground">₴</span>}
            value={value.promiseAmount}
            onChange={(e) => onChange({ promiseAmount: e.target.value })}
          />
        </div>
      )}
      {dv?.require_credit && visibleDebts.length > 0 && (
        <div className="mt-1 flex flex-col gap-1">
          <Label className="text-muted-foreground text-xs">
            {t('pages.clientChains.credit')} <span className="text-red-500">*</span>
          </Label>
          <Select value={value.creditId} onValueChange={(v) => onChange({ creditId: v })}>
            <SelectTrigger>
              <SelectValue placeholder={t('pages.clientChains.creditPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {visibleDebts.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>
                  #{d.contract_number ?? d.id}
                  {d.seller_company ? ` — ${d.seller_company}` : ''}
                  {d.remaining_debt_amount
                    ? ` — ${formatMoneyKopeckTight(d.remaining_debt_amount)}`
                    : ''}
                  {d.days_past_due ? ` — overdue ${d.days_past_due}d` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
