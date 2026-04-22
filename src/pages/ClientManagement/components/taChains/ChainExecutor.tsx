/**
 * ChainExecutor — Operator UI matching the mockup design.
 *
 * Two-column layout:
 *   Left:  "Log interaction" form with cascading dictionary dropdowns,
 *          leaf-conditional promise fields, credit picker, notes
 *   Right: "Chain progress" timeline + "Effects on save" preview
 */

import { useEffect, useMemo, useState } from 'react'
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
import { useTAChains } from '@/features/taChains/hooks/useTAChains'
import { useTargetActions } from '@/features/targetActions/hooks/useTargetActions'
import type { TargetAction } from '@/features/targetActions/api/types'
import { useDictionaryTree } from '@/features/taDictionary/hooks/useTADictionary'
import { useTags } from '@/features/tags/hooks/useTags'
import { useAuthStore } from '@/stores/authStore'
import type { TADictionaryNode } from '@/features/taDictionary/api/types'
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

interface Props {
  clientId: number
  debts?: Array<{
    id: number
    contract_number?: string
    remaining_debt_amount?: string | number | null
    days_past_due?: number | null
    seller_company?: string | null
  }>
}

export function ChainExecutor({ clientId, debts = [] }: Props) {
  const { t } = useTranslation('common')

  // Available chains (manual only, active)
  const { data: chainsData } = useTAChains({ include_inactive: false })
  const manualChains = useMemo(
    () => (chainsData?.items ?? []).filter((c) => c.chain_type === 'manual'),
    [chainsData]
  )

  // Full TA data (for dropdown values)
  const { data: tasData } = useTargetActions({ include_hidden: false })
  const taById = useMemo(() => {
    const m = new Map<number, TargetAction>()
    for (const ta of tasData?.items ?? []) m.set(ta.id, ta)
    return m
  }, [tasData])

  // Tag names for the "Effects on save" panel
  const { user } = useAuthStore()
  const projectId = user?.active_project_id ? parseInt(user.active_project_id) : undefined
  const { data: tagsList } = useTags(projectId)
  const tagNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const tg of tagsList ?? []) m.set(tg.id, tg.name)
    return m
  }, [tagsList])

  // Quick picks — fetch all, filter to manual chains client-side
  const { data: quickPicksData } = useQuickPicks(
    manualChains.length > 0 ? manualChains[0]?.department_id : undefined
  )
  const quickPicks = useMemo(() => {
    const manualIds = new Set(manualChains.map((c) => c.id))
    return (quickPicksData ?? []).filter((qp) => manualIds.has(qp.chain_id))
  }, [quickPicksData, manualChains])

  // Active instance
  const { data: instances } = useClientChainInstances(clientId)
  const activeInstance = instances?.find((i) => i.status === 'active') ?? null

  // Selected chain
  const [selectedChainId, setSelectedChainId] = useState<string>('')

  const activeChain = useMemo(() => {
    if (activeInstance)
      return (chainsData?.items ?? []).find((c) => c.id === activeInstance.chain_id) ?? null
    return null
  }, [activeInstance, chainsData])

  // Steps for progress timeline (computed early so dictionary can filter by step)
  const steps = useMemo<TAChainStep[]>(() => activeChain?.steps ?? [], [activeChain])
  const currentStep = steps.find((s) => s.step_order === (activeInstance?.current_step_order ?? 1))
  const currentTA = currentStep ? taById.get(currentStep.target_action_id) : null
  const isLastStep = (activeInstance?.current_step_order ?? 1) >= steps.length

  const chainForTree = activeChain?.id ?? (selectedChainId ? parseInt(selectedChainId, 10) : null)
  const currentStepId = currentStep?.id ?? null
  const { data: treeData } = useDictionaryTree(chainForTree, currentStepId)
  const { data: builderData } = useBuilderData(chainForTree)

  // Dictionary cascading selection
  const [level1, setLevel1] = useState<string>('')
  const [level2, setLevel2] = useState<string>('')
  const [level3, setLevel3] = useState<string>('')

  // Flatten helpers
  const rootNodes = useMemo(() => (treeData?.nodes ?? []).filter((n) => !n.is_hidden), [treeData])

  const level1Node = rootNodes.find((n) => String(n.id) === level1) ?? null
  const level2Nodes = useMemo(
    () => (level1Node?.children ?? []).filter((n) => !n.is_hidden),
    [level1Node]
  )
  const level2Node = level2Nodes.find((n) => String(n.id) === level2) ?? null
  const level3Nodes = useMemo(
    () => (level2Node?.children ?? []).filter((n) => !n.is_hidden),
    [level2Node]
  )
  const level3Node = level3Nodes.find((n) => String(n.id) === level3) ?? null

  // Find the deepest selected leaf
  const selectedLeaf: TADictionaryNode | null = useMemo(() => {
    if (level3Node?.is_leaf) return level3Node
    if (level2Node?.is_leaf) return level2Node
    if (level1Node?.is_leaf) return level1Node
    return null
  }, [level1Node, level2Node, level3Node])

  // Accumulated step data across all steps (persists until chain completes)
  const [collectedStepData, setCollectedStepData] = useState<Record<string, string>>({})
  // Accumulated leaf selections per step (step_order → leaf_id)
  const [collectedLeaves, setCollectedLeaves] = useState<Record<string, number>>({})
  // First promise/credit values collected (kept across steps for final interaction)
  const [collectedPromiseDate, setCollectedPromiseDate] = useState('')
  const [collectedPromiseAmount, setCollectedPromiseAmount] = useState('')
  const [collectedCreditId, setCollectedCreditId] = useState('')

  // Completed steps summaries (for read-only display above current step)
  interface CompletedStep {
    stepOrder: number
    taName: string
    taValue: string
    leafName?: string
  }
  const [completedSteps, setCompletedSteps] = useState<CompletedStep[]>([])
  // Flag to prevent double auto-advance
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false)

  // Current step's TA field value
  const [stepValue, setStepValue] = useState('')

  // Current step's form fields
  const [promiseDate, setPromiseDate] = useState('')
  const [promiseAmount, setPromiseAmount] = useState('')
  const [creditId, setCreditId] = useState<string>('')
  const [notes, setNotes] = useState('')

  // Mutations
  const startMut = useStartChainInstance()
  const createIntMut = useCreateTAInteraction()
  const advanceMut = useAdvanceChainInstance()
  const cancelMut = useCancelChainInstance()

  // Reset form when chain changes (not on step advance — we keep collectedStepData)
  useEffect(() => {
    setCollectedStepData({})
    setCollectedLeaves({})
    setCollectedPromiseDate('')
    setCollectedPromiseAmount('')
    setCollectedCreditId('')
    setCompletedSteps([])
    setIsAutoAdvancing(false)
    setStepValue('')
    setLevel1('')
    setLevel2('')
    setLevel3('')
    setPromiseDate('')
    setPromiseAmount('')
    setCreditId('')
    setNotes('')
  }, [activeInstance?.id])

  // Reset dictionary selection when advancing to a new step
  useEffect(() => {
    setLevel1('')
    setLevel2('')
    setLevel3('')
    setPromiseDate('')
    setPromiseAmount('')
  }, [activeInstance?.current_step_order])

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

  // Auto-advance: when operator completes a non-last step, advance automatically
  const handleAutoAdvance = async () => {
    if (!activeInstance || !activeChain || !currentStep || isLastStep || isAutoAdvancing) return

    // Check step is complete: TA field filled (if required) + leaf selected (if dictionary exists)
    const taFilled = !currentStep.is_required || stepValue.trim()
    const dictFilled = rootNodes.length === 0 || selectedLeaf != null
    if (!taFilled || !dictFilled) return

    // Check leaf-conditional fields
    if (selectedLeaf?.require_promise_date && !promiseDate) return
    if (selectedLeaf?.require_promise_amount && !promiseAmount) return
    if (selectedLeaf?.require_credit && !creditId) return

    setIsAutoAdvancing(true)

    // Accumulate data
    const updatedStepData = { ...collectedStepData }
    if (stepValue) {
      updatedStepData[String(currentStep.target_action_id)] = stepValue
    }
    setCollectedStepData(updatedStepData)

    if (selectedLeaf) {
      setCollectedLeaves((prev) => ({
        ...prev,
        [String(activeInstance.current_step_order ?? 1)]: selectedLeaf.id,
      }))
    }
    if (promiseDate && !collectedPromiseDate) setCollectedPromiseDate(promiseDate)
    if (promiseAmount && !collectedPromiseAmount) setCollectedPromiseAmount(promiseAmount)
    if (creditId && !collectedCreditId) setCollectedCreditId(creditId)

    // Record completed step for read-only display
    setCompletedSteps((prev) => [
      ...prev,
      {
        stepOrder: currentStep.step_order,
        taName: currentTA?.name ?? '',
        taValue: stepValue,
        leafName: selectedLeaf?.name,
      },
    ])

    try {
      await advanceMut.mutateAsync({
        id: activeInstance.id,
        leafNodeId: selectedLeaf?.id ?? null,
      })
      setStepValue('')
    } catch (err) {
      toast.error(getErrorMessage(err))
      // Rollback completed step display on error
      setCompletedSteps((prev) => prev.filter((s) => s.stepOrder !== currentStep.step_order))
    } finally {
      setIsAutoAdvancing(false)
    }
  }

  // Auto-advance for dropdown/date TA fields (single-action = done).
  // Text/amount fields need explicit "Continue" button since user is still typing.
  const canAutoAdvance =
    currentTA && (currentTA.field_type === 'dropdown' || currentTA.field_type === 'date')

  useEffect(() => {
    if (!isLastStep && !isAutoAdvancing && activeInstance && canAutoAdvance) {
      handleAutoAdvance()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepValue, selectedLeaf?.id, promiseDate, promiseAmount, creditId])

  // handleSave — only used at the LAST step
  const handleSave = async () => {
    if (!activeInstance || !activeChain) return

    const updatedStepData = { ...collectedStepData }
    if (currentStep && stepValue) {
      updatedStepData[String(currentStep.target_action_id)] = stepValue
    }

    // Validate
    if (rootNodes.length > 0 && !selectedLeaf) {
      toast.error(t('pages.clientChains.errors.selectResult'))
      return
    }
    if (selectedLeaf?.require_promise_date && !promiseDate) {
      toast.error(t('pages.clientChains.errors.promiseDateRequired'))
      return
    }
    if (selectedLeaf?.require_promise_amount && !promiseAmount) {
      toast.error(t('pages.clientChains.errors.promiseAmountRequired'))
      return
    }
    if (selectedLeaf?.require_credit && !creditId) {
      toast.error(t('pages.clientChains.errors.creditRequired'))
      return
    }

    const finalLeafId = selectedLeaf?.id ?? Object.values(collectedLeaves)[0] ?? undefined
    const finalPromiseDate = promiseDate || collectedPromiseDate
    const finalPromiseAmount = promiseAmount || collectedPromiseAmount
    const finalCreditId = creditId || collectedCreditId

    try {
      await createIntMut.mutateAsync({
        client_id: clientId,
        credit_id: finalCreditId ? parseInt(finalCreditId, 10) : undefined,
        chain_id: activeChain.id,
        chain_instance_id: activeInstance.id,
        leaf_node_id: finalLeafId,
        promise_date: finalPromiseDate ? `${finalPromiseDate}T00:00:00` : undefined,
        promise_amount: finalPromiseAmount ? parseFloat(finalPromiseAmount) : undefined,
        notes: notes || undefined,
        step_data: Object.keys(updatedStepData).length > 0 ? updatedStepData : undefined,
      })
      const result = await advanceMut.mutateAsync({
        id: activeInstance.id,
        leafNodeId: selectedLeaf?.id ?? null,
      })
      if (result.status === 'completed') {
        toast.success(t('pages.clientChains.toasts.completed'))
      } else {
        toast.success(t('pages.clientChains.toasts.advanced', { step: result.current_step_order }))
      }
      setCollectedStepData({})
      setCompletedSteps([])
      setStepValue('')
      setLevel1('')
      setLevel2('')
      setLevel3('')
      setPromiseDate('')
      setPromiseAmount('')
      setNotes('')
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

  // Delay enforcement with live countdown (server-computed, clock-skew-proof)
  const [delaySecondsLeft, setDelaySecondsLeft] = useState(0)

  useEffect(() => {
    const serverSeconds = activeInstance?.delay_seconds_left ?? 0
    if (serverSeconds <= 0) {
      setDelaySecondsLeft(0)
      return
    }
    // Start from the server-provided value and count down locally.
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
    const currentStep = steps.find((s) => s.step_order === activeInstance.current_step_order)
    if (!currentStep) return []
    return builderData.effects.filter((e) => e.step_id === currentStep.id)
  }, [builderData, activeInstance, steps])

  // Branches for progress display
  const stepBranches = useMemo(() => {
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
            {/* Quick-pick buttons */}
            {quickPicks.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-gray-500 uppercase">
                  {t('pages.clientChains.quickPicks')}
                </span>
                <div className="flex flex-wrap gap-2">
                  {quickPicks.map((qp) => (
                    <Button
                      key={qp.id}
                      variant="cancel"
                      size="sm"
                      onClick={async () => {
                        try {
                          await startMut.mutateAsync({ chain_id: qp.chain_id, client_id: clientId })
                          toast.success(t('pages.clientChains.toasts.started'))
                        } catch (err) {
                          toast.error(getErrorMessage(err))
                        }
                      }}
                      disabled={startMut.isPending}
                      className="whitespace-nowrap"
                    >
                      {qp.chain_name ?? `Chain #${qp.chain_id}`}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Full chain dropdown */}
            <div className="flex flex-col gap-1">
              <Label className="text-sm text-gray-700">
                {t('pages.clientChains.taChainLabel')}
              </Label>
              <Select value={selectedChainId} onValueChange={setSelectedChainId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('pages.clientChains.selectChainPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {manualChains.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <div className="flex flex-wrap gap-3 text-xs text-green-800">
              {cs.taValue && <span>{cs.taValue}</span>}
              {cs.leafName && (
                <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium">
                  {cs.leafName}
                </span>
              )}
            </div>
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
              <Input type="date" value={stepValue} onChange={(e) => setStepValue(e.target.value)} />
            ) : currentTA.field_type === 'amount' ? (
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={stepValue}
                onChange={(e) => setStepValue(e.target.value)}
              />
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

        {/* Cascading dictionary dropdowns — only on last step */}
        {rootNodes.length > 0 && (
          <>
            {/* Level 1 */}
            <div className="flex flex-col gap-1">
              <Label className="text-sm text-gray-700">
                {t('pages.clientChains.dictionary.level1')}
              </Label>
              <Select
                value={level1}
                onValueChange={(v) => {
                  setLevel1(v)
                  setLevel2('')
                  setLevel3('')
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('pages.clientChains.dictionary.selectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {rootNodes.map((n) => (
                    <SelectItem key={n.id} value={String(n.id)}>
                      {n.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Level 2 */}
            {level1 && level2Nodes.length > 0 && (
              <div className="flex flex-col gap-1">
                <Label className="text-sm text-gray-700">
                  {t('pages.clientChains.dictionary.level2')}
                </Label>
                <Select
                  value={level2}
                  onValueChange={(v) => {
                    setLevel2(v)
                    setLevel3('')
                  }}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t('pages.clientChains.dictionary.selectPlaceholder')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {level2Nodes.map((n) => (
                      <SelectItem key={n.id} value={String(n.id)}>
                        {n.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Level 3 */}
            {level2 && level3Nodes.length > 0 && (
              <div className="flex flex-col gap-1">
                <Label className="text-sm text-gray-700">
                  {t('pages.clientChains.dictionary.level3')}
                </Label>
                <Select value={level3} onValueChange={setLevel3}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t('pages.clientChains.dictionary.selectPlaceholder')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {level3Nodes.map((n) => (
                      <SelectItem key={n.id} value={String(n.id)}>
                        {n.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
        )}

        {/* Leaf-conditional promise fields */}
        {selectedLeaf &&
          (selectedLeaf.require_promise_date || selectedLeaf.require_promise_amount) && (
            <div className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
              <span className="text-xs font-medium text-blue-700 italic">
                {t('pages.clientChains.requiredByLeaf')}
              </span>
              <div className="flex flex-col gap-3 sm:flex-row">
                {selectedLeaf.require_promise_date && (
                  <div className="flex flex-1 flex-col gap-1">
                    <Label className="text-sm text-gray-700">
                      {t('pages.clientChains.promiseDate')} *
                    </Label>
                    <Input
                      type="date"
                      value={promiseDate}
                      onChange={(e) => setPromiseDate(e.target.value)}
                    />
                  </div>
                )}
                {selectedLeaf.require_promise_amount && (
                  <div className="flex flex-1 flex-col gap-1">
                    <Label className="text-sm text-gray-700">
                      {t('pages.clientChains.promiseAmountUAH')} *
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
              </div>
            </div>
          )}

        {/* Credit picker — only on last step AND when leaf requires it */}
        {debts.length > 0 && selectedLeaf?.require_credit && (
          <div className="flex flex-col gap-1">
            <Label className="text-sm text-gray-700">
              {t('pages.clientChains.credit')}
              {selectedLeaf?.require_credit && <span className="ml-1 text-red-500">*</span>}
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
                      ? ` — ${d.remaining_debt_amount.toLocaleString()} UAH`
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

        {/* Save button — only at last step, hidden during delay */}
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
        {/* Chain progress */}
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
              const hasBranch = stepBranches.has(step.id)
              const isLast = idx === steps.length - 1

              const formatDelay = (minutes: number): string => {
                if (minutes >= 1440) return `+${Math.round(minutes / 1440)}d`
                if (minutes >= 60) return `+${Math.round(minutes / 60)}h`
                return `+${minutes}m`
              }

              return (
                <li key={step.id} className="relative flex items-start gap-3">
                  {/* Step circle + connector line */}
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

                  {/* Name + right-aligned badge */}
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

        {/* Effects preview — matches mockup with → arrows + named tags */}
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
