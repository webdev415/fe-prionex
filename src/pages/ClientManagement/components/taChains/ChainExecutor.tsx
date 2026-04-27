/**
 * ChainExecutor — Operator UI for executing TA Chains.
 *
 * Unified flow: each step is a TA field (text/dropdown/date/amount).
 * Dropdown options carry flags (require_promise_date, etc.) replacing
 * the old dictionary tree. Auto-advance on dropdown/date selection;
 * "Continue" button for text/amount fields. One "Save interaction"
 * button at the last step commits the whole chain.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
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
import { usePinTAChain, useTAChains, useUnpinTAChain } from '@/features/taChains/hooks/useTAChains'
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
} from '@/features/taInteractions/hooks/useTAInteractions'
import type { TAChainStep } from '@/features/taChains/api/types'
import { useQuickPicks } from '@/features/quickPicks/hooks/useQuickPicks'
import { getErrorMessage } from '@/lib/errors'
import { useChainExecutorStore } from '@/stores/chainExecutorStore'
import { formatMoneyKopeckTight } from '@/lib/formatters'

interface Props {
  clientId: number
  clientName?: string
  debts?: Array<{
    id: number
    contract_number?: string
    remaining_debt_amount?: string | number | null
    days_past_due?: number | null
    seller_company?: string | null
  }>
  onSave?: () => void
  onMinimize?: () => void
  onMinimizeRef?: React.MutableRefObject<(() => void) | null>
}

export function ChainExecutor({
  clientId,
  clientName,
  debts = [],
  onSave,
  onMinimize,
  onMinimizeRef,
}: Props) {
  const { t } = useTranslation('common')

  // Operator's department drives chain visibility — they should only
  // see chains assigned to their own department. Admins (manage_settings)
  // bypass the filter and see every chain.
  const { user } = useAuthStore()
  const isAdmin = user?.permissions?.includes('manage_settings') ?? false
  const operatorDepartmentId = user?.active_department_id ?? undefined

  // Available chains (manual only, active). For non-admins, scoped to
  // the operator's department via the backend's single-id query param.
  const { data: chainsData } = useTAChains({
    include_inactive: false,
    department_id: isAdmin ? undefined : operatorDepartmentId,
  })
  const manualChains = useMemo(() => {
    // Non-admins with no department: hide everything (better than leaking
    // other departments' chains via a missing filter). Admins always see all.
    if (!isAdmin && operatorDepartmentId === undefined) return []
    return (chainsData?.items ?? []).filter((c) => c.chain_type === 'manual')
  }, [chainsData, operatorDepartmentId, isAdmin])

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

  // Quick picks — keyed by department. A chain may now have several
  // departments; pick the first as the canonical one for fetching picks.
  const { data: quickPicksData } = useQuickPicks(
    manualChains.length > 0 ? manualChains[0]?.department_ids?.[0] : undefined
  )
  const quickPicks = useMemo(() => {
    const manualIds = new Set(manualChains.map((c) => c.id))
    return (quickPicksData ?? []).filter((qp) => manualIds.has(qp.chain_id))
  }, [quickPicksData, manualChains])

  // Active instance
  const { data: instances } = useClientChainInstances(clientId)
  const activeInstance = instances?.find((i) => i.status === 'active') ?? null

  const [selectedChainId, setSelectedChainId] = useState<string>('')

  // Chain selector dropdown — search-enabled to handle many chains.
  const [chainOpen, setChainOpen] = useState(false)
  const [chainSearch, setChainSearch] = useState('')
  const filteredChains = useMemo(() => {
    const q = chainSearch.trim().toLowerCase()
    if (!q) return manualChains
    return manualChains.filter((c) => c.name.toLowerCase().includes(q))
  }, [manualChains, chainSearch])
  const pinnedChains = useMemo(() => filteredChains.filter((c) => c.is_pinned), [filteredChains])
  const unpinnedChains = useMemo(() => filteredChains.filter((c) => !c.is_pinned), [filteredChains])
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

  const handleStartTemplate = async () => {
    if (!selectedTemplate) return
    try {
      presetValuesRef.current = selectedTemplate.preset_values ?? {}
      await startMut.mutateAsync({
        chain_id: selectedTemplate.chain_id,
        client_id: clientId,
      })
      toast.success(t('pages.clientChains.toasts.started'))
      setSelectedTemplateId(null)
      setTemplateSearch('')
    } catch (err) {
      presetValuesRef.current = {}
      toast.error(getErrorMessage(err))
    }
  }

  const activeChain = useMemo(() => {
    if (activeInstance)
      return (chainsData?.items ?? []).find((c) => c.id === activeInstance.chain_id) ?? null
    return null
  }, [activeInstance, chainsData])

  // Steps
  const steps = useMemo<TAChainStep[]>(() => activeChain?.steps ?? [], [activeChain])
  const currentStep = steps.find((s) => s.step_order === (activeInstance?.current_step_order ?? 1))
  const currentTA = currentStep ? taById.get(currentStep.target_action_id) : null
  const isLastStep = (activeInstance?.current_step_order ?? 1) >= steps.length

  const chainForBuilder =
    activeChain?.id ?? (selectedChainId ? parseInt(selectedChainId, 10) : null)
  const { data: builderData } = useBuilderData(chainForBuilder)

  // Selected dropdown value for the current step (replaces dictionary leaf)
  const [stepValue, setStepValue] = useState('')

  const selectedDropdownValue: TADropdownValueOut | null = useMemo(() => {
    if (!currentTA || currentTA.field_type !== 'dropdown' || !stepValue) return null
    return currentTA.dropdown_values.find((dv) => dv.value === stepValue) ?? null
  }, [currentTA, stepValue])

  // Template preset values (from quick pick)
  const presetValuesRef = useRef<Record<string, string>>({})

  // Accumulated data across steps — refs for synchronous access (no React batching issues)
  const collectedStepDataRef = useRef<Record<string, string>>({})
  const collectedDropdownValueIdsRef = useRef<Record<string, number>>({})
  const collectedPromiseDateRef = useRef('')
  const collectedPromiseAmountRef = useRef('')
  const collectedCreditIdRef = useRef('')

  // Completed steps summaries
  interface CompletedStep {
    stepOrder: number
    taName: string
    taValue: string
  }
  const [completedSteps, setCompletedSteps] = useState<CompletedStep[]>([])
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false)

  // Current step form fields
  const [promiseDate, setPromiseDate] = useState('')
  const [promiseAmount, setPromiseAmount] = useState('')
  const [creditId, setCreditId] = useState<string>('')
  const [notes, setNotes] = useState('')

  // Minimize / restore
  const { minimized: minimizedState, setMinimized, clear: clearMinimized } = useChainExecutorStore()
  const restoredRef = useRef(false)

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
      restoredRef.current = true
      clearMinimized()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMinimize = () => {
    setMinimized({
      clientId,
      clientName: clientName ?? `Client #${clientId}`,
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

  // Reset on chain change
  useEffect(() => {
    collectedStepDataRef.current = {}
    collectedDropdownValueIdsRef.current = {}
    collectedPromiseDateRef.current = ''
    collectedPromiseAmountRef.current = ''
    collectedCreditIdRef.current = ''
    setCompletedSteps([])
    setIsAutoAdvancing(false)
    // Don't reset stepValue here — step-change effect handles it with preset support
    setPromiseDate('')
    setPromiseAmount('')
    setCreditId('')
    setNotes('')
  }, [activeInstance?.id])

  // Reset current step fields on step change + pre-fill from template
  useEffect(() => {
    // Skip the first reset when restoring from minimized state
    if (restoredRef.current) {
      restoredRef.current = false
      return
    }
    const taId = currentStep?.target_action_id
    const preset = taId ? presetValuesRef.current[String(taId)] : undefined
    setStepValue(preset ?? '')
    setPromiseDate('')
    setPromiseAmount('')
  }, [activeInstance?.id, activeInstance?.current_step_order, currentStep?.target_action_id])

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

    setIsAutoAdvancing(true)

    // Accumulate data synchronously via refs
    if (stepValue) {
      collectedStepDataRef.current[String(currentStep.target_action_id)] = stepValue
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
      },
    ])

    try {
      await advanceMut.mutateAsync({
        id: activeInstance.id,
        dropdownValueId: selectedDropdownValue?.id ?? null,
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
    if (!isLastStep && !isAutoAdvancing && activeInstance && canAutoAdvance) {
      handleAutoAdvance()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepValue, selectedDropdownValue?.id, promiseDate, promiseAmount, creditId])

  // handleSave — LAST step only
  const handleSave = async () => {
    if (!activeInstance || !activeChain) return

    // Accumulate current step's data into refs
    if (currentStep && stepValue) {
      collectedStepDataRef.current[String(currentStep.target_action_id)] = stepValue
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

    // Use current step's dropdown value or first collected one
    const finalDropdownValueId =
      selectedDropdownValue?.id ??
      Object.values(collectedDropdownValueIdsRef.current)[0] ??
      undefined
    const finalPromiseDate = promiseDate || collectedPromiseDateRef.current
    const finalPromiseAmount = promiseAmount || collectedPromiseAmountRef.current
    const finalCreditId = creditId || collectedCreditIdRef.current

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
        step_data:
          Object.keys(collectedStepDataRef.current).length > 0
            ? collectedStepDataRef.current
            : undefined,
      })
      const result = await advanceMut.mutateAsync({
        id: activeInstance.id,
        dropdownValueId: selectedDropdownValue?.id ?? null,
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
      setCompletedSteps([])
      setStepValue('')
      setPromiseDate('')
      setPromiseAmount('')
      setNotes('')
      onSave?.()
    } catch (err) {
      toast.error(getErrorMessage(err))
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

  // --- No active instance: chain selector ---
  if (!activeInstance) {
    return (
      <div className="flex flex-col gap-4">
        <h3 className="text-dark-500 text-base font-semibold">
          {t('pages.clientChains.logInteraction')}
        </h3>
        {manualChains.length === 0 ? (
          <p className="text-sm text-gray-500">{t('pages.clientChains.noChains')}</p>
        ) : (
          <>
            {quickPicks.length > 0 && (
              <div className="flex flex-col gap-2">
                <Label className="text-sm text-gray-700">
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
                      className="focus:border-primary-500 flex min-h-[40px] w-full items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm outline-none hover:bg-gray-50"
                    >
                      <span className={selectedTemplate ? 'text-gray-800' : 'text-gray-400'}>
                        {selectedTemplate
                          ? (selectedTemplate.name ??
                            selectedTemplate.chain_name ??
                            `Chain #${selectedTemplate.chain_id}`)
                          : t('pages.clientChains.templatePlaceholder', 'Pick a template…')}
                      </span>
                      <Icons.ArrowDown size={16} className="text-gray-400" strokeWidth={1.5} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    sideOffset={6}
                    className="w-[--radix-dropdown-menu-trigger-width] min-w-[260px] rounded-md border border-gray-200 bg-white p-0 shadow-lg"
                  >
                    <div className="border-b border-gray-200 p-2">
                      <input
                        type="text"
                        value={templateSearch}
                        onChange={(e) => setTemplateSearch(e.target.value)}
                        placeholder={t(
                          'pages.clientChains.templateSearchPlaceholder',
                          'Search templates…'
                        )}
                        className="focus:border-primary-500 w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none placeholder:text-gray-400"
                      />
                    </div>
                    <div className="max-h-[220px] overflow-y-auto p-1">
                      {filteredTemplates.length === 0 ? (
                        <div className="py-3 text-center text-xs text-gray-500">
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
                              className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-gray-50 ${
                                isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-800'
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
            <div className="flex flex-col gap-1">
              <Label className="text-sm text-gray-700">
                {t('pages.clientChains.taChainLabel')}
              </Label>
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
                    className="focus:border-primary-500 flex min-h-[40px] w-full items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm outline-none hover:bg-gray-50"
                  >
                    <span className={selectedChainObj ? 'text-gray-800' : 'text-gray-400'}>
                      {selectedChainObj
                        ? selectedChainObj.name
                        : t('pages.clientChains.selectChainPlaceholder')}
                    </span>
                    <Icons.ArrowDown size={16} className="text-gray-400" strokeWidth={1.5} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  sideOffset={6}
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-[260px] rounded-md border border-gray-200 bg-white p-0 shadow-lg"
                >
                  <div className="border-b border-gray-200 p-2">
                    <input
                      type="text"
                      value={chainSearch}
                      onChange={(e) => setChainSearch(e.target.value)}
                      placeholder={t('pages.clientChains.chainSearchPlaceholder', 'Search chains…')}
                      className="focus:border-primary-500 w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none placeholder:text-gray-400"
                    />
                  </div>
                  <div className="max-h-[260px] overflow-y-auto p-1">
                    {filteredChains.length === 0 ? (
                      <div className="py-3 text-center text-xs text-gray-500">
                        {t('pages.clientChains.chainNoneFound', 'No chains match.')}
                      </div>
                    ) : (
                      <>
                        {pinnedChains.length > 0 && (
                          <div>
                            <div className="px-2 pt-1 pb-0.5 text-[10px] font-semibold tracking-wide text-gray-400 uppercase">
                              {t('pages.clientChains.pinnedGroup', 'Pinned')}
                            </div>
                            {pinnedChains.map((c) => {
                              const isSelected = String(c.id) === selectedChainId
                              return (
                                <div
                                  key={c.id}
                                  className={`group flex w-full items-center gap-1 rounded px-2 py-1.5 text-sm hover:bg-gray-50 ${
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
                                      isSelected ? 'text-blue-700' : 'text-gray-800'
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
                                </div>
                              )
                            })}
                          </div>
                        )}
                        {unpinnedChains.length > 0 && (
                          <div>
                            {pinnedChains.length > 0 && (
                              <div className="px-2 pt-2 pb-0.5 text-[10px] font-semibold tracking-wide text-gray-400 uppercase">
                                {t('pages.clientChains.allGroup', 'All chains')}
                              </div>
                            )}
                            {unpinnedChains.map((c) => {
                              const isSelected = String(c.id) === selectedChainId
                              return (
                                <div
                                  key={c.id}
                                  className={`group flex w-full items-center gap-1 rounded px-2 py-1.5 text-sm hover:bg-gray-50 ${
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
                                      isSelected ? 'text-blue-700' : 'text-gray-800'
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
                                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
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
            </div>
            <Button
              variant="primary"
              onClick={handleStart}
              disabled={!selectedChainId || startMut.isPending}
            >
              {t('pages.clientChains.start')}
            </Button>
          </>
        )}
      </div>
    )
  }

  // --- Active instance: two-column form ---
  return (
    <div className="flex w-full flex-col gap-4 lg:flex-row lg:gap-6">
      {/* ===== LEFT: Log interaction form ===== */}
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-dark-500 text-base font-semibold">
            {t('pages.clientChains.logInteraction')}
          </h3>
          <Button variant="cancel" size="sm" onClick={handleCancel}>
            {t('pages.clientChains.cancel')}
          </Button>
        </div>

        {/* TA Chain (read-only) */}
        <div className="flex flex-col gap-1">
          <Label className="text-sm text-gray-700">{t('pages.clientChains.taChainLabel')}</Label>
          <div className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm text-gray-800">
            {activeChain?.name}
          </div>
        </div>

        {/* Completed steps (read-only summaries) */}
        {completedSteps.map((cs) => (
          <div
            key={cs.stepOrder}
            className="flex flex-col gap-1 rounded-lg border border-green-200 bg-green-50/50 p-3"
          >
            <span className="text-xs font-semibold text-green-700">
              {t('pages.clientChains.stepLabel', { order: cs.stepOrder })} — {cs.taName}
            </span>
            <span className="text-xs text-green-800">{cs.taValue}</span>
          </div>
        ))}

        {/* Auto-advancing indicator */}
        {isAutoAdvancing && (
          <div className="text-center text-xs text-gray-500">{t('common.loading')}</div>
        )}

        {/* Delay enforcement */}
        {isDelayBlocked && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
            <span className="text-2xl">⏳</span>
            <span className="text-sm font-medium text-amber-800">
              {delaySecondsLeft >= 60
                ? t('pages.clientChains.delayWaiting', { minutes: delayMinutesLeft })
                : t('pages.clientChains.delayWaitingSeconds', { seconds: delaySecondsLeft })}
            </span>
            <span className="text-xs text-amber-600">{t('pages.clientChains.delayHint')}</span>
          </div>
        )}

        {/* Current step TA field */}
        {!isDelayBlocked && currentStep && currentTA && (
          <div className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-gray-50/50 p-3">
            <Label className="text-sm font-medium text-gray-800">
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
              <Input
                type="datetime-local"
                value={stepValue}
                onChange={(e) => setStepValue(e.target.value)}
              />
            ) : currentTA.field_type === 'amount' ? (
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={stepValue}
                onChange={(e) => setStepValue(e.target.value)}
              />
            ) : currentTA.field_type === 'credit' ? (
              <div className="flex flex-col gap-2">
                {debts.length === 0 ? (
                  <span className="text-xs text-gray-500">{t('pages.clientChains.noCredits')}</span>
                ) : (
                  debts.map((d) => {
                    const creditKey = String(d.id)
                    const selectedIds = stepValue ? stepValue.split(',') : []
                    const isChecked = selectedIds.includes(creditKey)
                    return (
                      <label
                        key={d.id}
                        className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
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

        {/* Promise date */}
        {selectedDropdownValue?.require_promise_date && (
          <div className="flex flex-col gap-1">
            <Label className="text-sm text-gray-700">
              {t('pages.clientChains.promiseDate')} <span className="text-red-500">*</span>
            </Label>
            <Input
              type="date"
              value={promiseDate}
              onChange={(e) => setPromiseDate(e.target.value)}
            />
          </div>
        )}

        {/* Promise amount */}
        {selectedDropdownValue?.require_promise_amount && (
          <div className="flex flex-col gap-1">
            <Label className="text-sm text-gray-700">
              {t('pages.clientChains.promiseAmountUAH')} <span className="text-red-500">*</span>
            </Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={promiseAmount}
              onChange={(e) => setPromiseAmount(e.target.value)}
            />
          </div>
        )}

        {/* Credit picker */}
        {debts.length > 0 && selectedDropdownValue?.require_credit && (
          <div className="flex flex-col gap-1">
            <Label className="text-sm text-gray-700">
              {t('pages.clientChains.credit')} <span className="text-red-500">*</span>
            </Label>
            <Select value={creditId} onValueChange={setCreditId}>
              <SelectTrigger>
                <SelectValue placeholder={t('pages.clientChains.creditPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {debts.map((d) => (
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

        {/* Notes — only on last step */}
        {isLastStep && (
          <div className="flex flex-col gap-1">
            <Label className="text-sm text-gray-700">{t('pages.clientChains.notes')}</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('pages.clientChains.notesPlaceholder')}
            />
          </div>
        )}

        {/* Continue button — non-last steps with text/amount fields */}
        {!isDelayBlocked && !isLastStep && !canAutoAdvance && (
          <Button
            variant="cancel"
            onClick={handleAutoAdvance}
            disabled={advanceMut.isPending || isAutoAdvancing}
            className="w-full"
          >
            {t('pages.clientChains.continueToNext')}
          </Button>
        )}

        {/* Save button — only at last step */}
        {!isDelayBlocked && isLastStep && (
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

      {/* ===== RIGHT: Chain progress + Effects preview ===== */}
      <div className="flex w-full flex-col gap-6 lg:w-[280px]">
        <div className="flex flex-col gap-3">
          <h3 className="text-dark-500 text-base font-semibold">
            {t('pages.clientChains.chainProgress')}
          </h3>
          <p className="text-xs text-gray-500">
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
                            ? 'bg-green-100 text-green-700'
                            : 'border border-gray-300 bg-white text-gray-400'
                      }`}
                    >
                      {step.step_order}
                    </div>
                    {!isLast && <div className="my-1 h-6 border-l border-dashed border-gray-300" />}
                  </div>
                  <div className="flex flex-1 items-center justify-between gap-2 pt-1">
                    <span
                      className={`text-sm ${
                        isCurrent ? 'font-semibold text-gray-900' : 'text-gray-700'
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
                        <span className="text-[11px] text-gray-400">
                          {formatDelay(step.delay_minutes)}
                        </span>
                      )}
                      {hasBranch && (
                        <span className="text-[11px] text-gray-400">
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

        {/* Effects preview */}
        {currentStepEffects.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
            <h3 className="text-dark-500 text-base font-semibold">
              {t('pages.clientChains.effectsOnSave')}
            </h3>
            <ul className="flex flex-col gap-1.5">
              {currentStepEffects.map((ef) => {
                const cfg = ef.config as Record<string, unknown>
                const tagId = typeof cfg.tag_id === 'number' ? cfg.tag_id : undefined
                const tagName =
                  tagId !== undefined ? (tagNameById.get(tagId) ?? `#${tagId}`) : undefined

                return (
                  <li key={ef.id} className="flex items-center gap-1.5 text-sm text-gray-700">
                    <span className="text-gray-400">→</span>
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
  )
}
