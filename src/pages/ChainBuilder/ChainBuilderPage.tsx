/**
 * Visual Chain Builder page (Chain Builder ticket).
 *
 * Two-panel layout:
 *   Left:  React Flow canvas showing steps as nodes, sequential + branch edges
 *   Right: Config panel for selected step/chain (triggers, blockers, effects, branches)
 *
 * Admin picks a chain from a dropdown, the canvas renders its steps and branches.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { useQueryClient } from '@tanstack/react-query'
import { useTAChains, useTAChain } from '@/features/taChains/hooks/useTAChains'
import { updateStepPositions } from '@/features/taChains/api/taChainsApi'
import { useTaskSubjects } from '@/features/clients/hooks/useClients'
import { useOperators } from '@/features/users/hooks/useUsers'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import {
  useBuilderData,
  useCreateBranch,
  useDeleteBranch,
  useCreateTrigger,
  useDeleteTrigger,
  useCreateBlocker,
  useDeleteBlocker,
  useCreateEffect,
  useDeleteEffect,
} from '@/features/chainBuilder/hooks/useChainBuilder'
import type { TAChainStep } from '@/features/taChains/api/types'
import { useTags } from '@/features/tags/hooks/useTags'
import { useTargetActions } from '@/features/targetActions/hooks/useTargetActions'
import type { TargetAction } from '@/features/targetActions/api/types'
import { useSMSTemplates } from '@/features/sms'
import { useAuthStore } from '@/stores/authStore'
import { getErrorMessage } from '@/lib/errors'

const TYPE_COLOR: Record<string, string> = {
  text: '#10b981',
  dropdown: '#8b5cf6',
  date: '#f97316',
  amount: '#3b82f6',
}

const TRIGGER_TYPES = [
  'tag_change',
  'call_result',
  'date_reached',
  'debt_status',
  'chain_completed',
  'role_action',
]
const BLOCKER_TYPES = [
  'already_launched',
  'launched_within',
  'chain_active',
  'tag_present',
  'in_cooldown',
]
const EFFECT_TYPES = ['add_tag', 'remove_tag', 'create_task', 'send_sms', 'add_to_spam']

function ChainBuilderMainSkeleton() {
  return (
    <div
      className="flex w-full flex-col gap-4 lg:flex-row"
      style={{ height: '70vh' }}
      role="status"
      aria-busy="true"
    >
      <div className="flex-1 animate-pulse rounded-lg border border-gray-200 bg-gradient-to-b from-gray-100 to-gray-50" />
      <div className="w-full space-y-4 rounded-lg border border-gray-200 bg-white p-4 lg:w-[360px]">
        <div className="h-6 w-56 animate-pulse rounded-md bg-gray-200" />
        <div className="space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
          <div className="h-14 w-full animate-pulse rounded-md bg-gray-200" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
          <div className="h-14 w-full animate-pulse rounded-md bg-gray-200" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
          <div className="h-24 w-full animate-pulse rounded-md bg-gray-200" />
        </div>
      </div>
    </div>
  )
}

function ChainBuilderConfigPanelSkeleton() {
  return (
    <div className="flex flex-col gap-5" role="status" aria-busy="true">
      <div className="space-y-2">
        <div className="h-3 w-28 animate-pulse rounded bg-gray-200" />
        <div className="h-10 w-full animate-pulse rounded-md bg-gray-200" />
        <div className="h-8 w-full animate-pulse rounded-md bg-gray-200" />
      </div>
      <div className="h-px w-full bg-gray-100" />
      <div className="space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
        <div className="h-10 w-full animate-pulse rounded-md bg-gray-200" />
        <div className="h-8 w-full animate-pulse rounded-md bg-gray-200" />
      </div>
      <div className="h-px w-full bg-gray-100" />
      <div className="space-y-2">
        <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
        <div className="h-20 w-full animate-pulse rounded-md bg-gray-200" />
      </div>
    </div>
  )
}

export function ChainBuilderPage() {
  const { t } = useTranslation('common')
  const { user } = useAuthStore()
  const projectId = user?.active_project_id ? parseInt(user.active_project_id, 10) : undefined

  const { data: chainsData, isPending: chainsListPending } = useTAChains({
    include_inactive: false,
  })
  const chains = useMemo(() => chainsData?.items ?? [], [chainsData?.items])

  // Reference data for dropdowns
  const { data: tagsList } = useTags(projectId, { includeHidden: true })
  const tags = useMemo(() => tagsList ?? [], [tagsList])
  const { data: smsTemplatesData } = useSMSTemplates(
    projectId ? { project_id: projectId } : undefined
  )
  const smsTemplates = useMemo(
    () => smsTemplatesData?.templates ?? [],
    [smsTemplatesData?.templates]
  )
  const { data: taskSubjects = [] } = useTaskSubjects()
  const { data: operators = [] } = useOperators(projectId ?? null)
  const taskSubjectOptions = useMemo(
    () => taskSubjects.map((s) => ({ id: String(s.id), name: s.name })),
    [taskSubjects]
  )
  const operatorOptions = useMemo(
    () => operators.map((u) => ({ id: String(u.id), name: u.full_name })),
    [operators]
  )
  const subjectNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of taskSubjects) m.set(s.id, s.name)
    return m
  }, [taskSubjects])
  const operatorNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const u of operators) m.set(u.id, u.full_name)
    return m
  }, [operators])

  const [selectedChainId, setSelectedChainId] = useState<number | null>(null)
  const { data: chain, isPending: chainPending } = useTAChain(selectedChainId)
  const { data: builderData, isPending: builderPending } = useBuilderData(selectedChainId)

  // Pretty-print config — replace IDs with names where possible
  const formatConfig = useCallback(
    (config: Record<string, unknown>): string => {
      if (!config || Object.keys(config).length === 0) return ''
      const parts: string[] = []
      const stepRef = (s: TAChainStep) =>
        t('pages.chainBuilder.config.stepRef', {
          order: s.step_order,
          name:
            s.target_action_name ?? t('pages.chainBuilder.taFallback', { id: s.target_action_id }),
        })
      for (const [key, value] of Object.entries(config)) {
        if (value === undefined || value === null) continue
        if (key === 'tag_id') {
          const tag = tags.find((tagItem) => tagItem.id === Number(value))
          parts.push(t('pages.chainBuilder.config.tag', { label: tag?.name ?? `#${value}` }))
        } else if (key === 'sms_template_id') {
          const tpl = smsTemplates.find((tplItem) => tplItem.id === Number(value))
          parts.push(t('pages.chainBuilder.config.template', { label: tpl?.name ?? `#${value}` }))
        } else if (key === 'source_chain_id' || key === 'blocking_chain_id') {
          const ch = chains.find((cItem) => cItem.id === Number(value))
          parts.push(t('pages.chainBuilder.config.chain', { label: ch?.name ?? `#${value}` }))
        } else if (key === 'subject_id') {
          const name = subjectNameById.get(Number(value))
          parts.push(t('pages.chainBuilder.config.subject', { label: name ?? `#${value}` }))
        } else if (key === 'assigned_user_id') {
          const name = operatorNameById.get(Number(value))
          parts.push(t('pages.chainBuilder.config.user', { label: name ?? `#${value}` }))
        } else if (key === 'assignee_mode') {
          const mode = String(value)
          const label =
            mode === 'created_by' || mode === 'client_responsible' || mode === 'specific_user'
              ? t(`pages.chainBuilder.assigneeModes.${mode}`)
              : mode
          parts.push(t('pages.chainBuilder.config.assignee', { label }))
        } else if (key === 'due_date_ref') {
          if (value === 'chain_entry_date') parts.push(t('pages.chainBuilder.config.dueChainEntry'))
          else if (value === 'chain_completion_date')
            parts.push(t('pages.chainBuilder.config.dueChainCompletion'))
          else {
            const ord = Number(value)
            const step = (chain?.steps ?? []).find((s) => s.step_order === ord)
            parts.push(
              step
                ? t('pages.chainBuilder.config.dueStep', { step: stepRef(step) })
                : t('pages.chainBuilder.config.dueStepOrderUnknown', { order: String(value) })
            )
          }
        } else if (key === 'phone_ref') {
          const step = (chain?.steps ?? []).find((s) => s.id === Number(value))
          parts.push(
            step
              ? t('pages.chainBuilder.config.phone', { step: stepRef(step) })
              : t('pages.chainBuilder.config.phoneUnknown', { id: String(value) })
          )
        } else {
          parts.push(t('pages.chainBuilder.config.generic', { key, value: String(value) }))
        }
      }
      return parts.join(' · ')
    },
    [tags, smsTemplates, chains, subjectNameById, operatorNameById, chain, t]
  )

  const typeLabel = useCallback(
    (kind: 'trigger' | 'blocker' | 'effect', code: string) =>
      t(`pages.chainBuilder.types.${kind}.${code}`, { defaultValue: code }),
    [t]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedStepId, setSelectedStepId] = useState<number | null>(null)

  // Mutations (only create when chain is selected)
  const chainId = selectedChainId ?? 0
  const createBranch = useCreateBranch(chainId)
  const deleteBranchMut = useDeleteBranch(chainId)
  const createTrigger = useCreateTrigger(chainId)
  const deleteTriggerMut = useDeleteTrigger(chainId)
  const createBlocker = useCreateBlocker(chainId)
  const deleteBlockerMut = useDeleteBlocker(chainId)
  const createEffect = useCreateEffect(chainId)
  const deleteEffectMut = useDeleteEffect(chainId)

  // Form state for adding new items
  const [newTriggerType, setNewTriggerType] = useState(TRIGGER_TYPES[0])
  const [newTriggerConfig, setNewTriggerConfig] = useState<Record<string, string>>({})
  const [newBlockerType, setNewBlockerType] = useState(BLOCKER_TYPES[0])
  const [newBlockerConfig, setNewBlockerConfig] = useState<Record<string, string>>({})
  const [newEffectType, setNewEffectType] = useState(EFFECT_TYPES[0])
  const [newEffectConditions, setNewEffectConditions] = useState<Set<number>>(new Set())
  const [effectCondDropdownOpen, setEffectCondDropdownOpen] = useState(false)
  const [newEffectConfig, setNewEffectConfig] = useState<Record<string, string>>({})
  const [newBranchTo, setNewBranchTo] = useState('')
  const [newBranchConditions, setNewBranchConditions] = useState<Set<number>>(new Set())
  const [branchCondDropdownOpen, setBranchCondDropdownOpen] = useState(false)

  const steps: TAChainStep[] = useMemo(() => chain?.steps ?? [], [chain?.steps])
  const selectedStep = steps.find((s) => s.id === selectedStepId)

  // Build React Flow nodes + edges from chain steps + branches
  useEffect(() => {
    if (!chain) {
      setNodes([])
      setEdges([])
      return
    }

    const flowNodes: Node[] = steps.map((step, idx) => ({
      id: `step-${step.id}`,
      type: 'default',
      position: {
        x: step.position_x ?? 250,
        y: step.position_y ?? idx * 120 + 50,
      },
      data: {
        label: `${step.step_order}. ${step.target_action_name ?? t('pages.chainBuilder.taFallback', { id: step.target_action_id })}`,
      },
      style: {
        border: `2px solid ${TYPE_COLOR[step.target_action_field_type ?? 'text'] ?? '#6b7280'}`,
        borderRadius: '8px',
        padding: '10px 16px',
        fontSize: '13px',
        fontWeight: 500,
        background: selectedStepId === step.id ? '#eff6ff' : '#ffffff',
        color: '#111827',
        cursor: 'pointer',
        minWidth: '180px',
        textAlign: 'center' as const,
      },
    }))

    // Sequential edges
    const flowEdges: Edge[] = []
    for (let i = 0; i < steps.length - 1; i++) {
      flowEdges.push({
        id: `seq-${steps[i].id}-${steps[i + 1].id}`,
        source: `step-${steps[i].id}`,
        target: `step-${steps[i + 1].id}`,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#9ca3af', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#9ca3af' },
      })
    }

    // Branch edges
    if (builderData) {
      for (const br of builderData.branches) {
        flowEdges.push({
          id: `branch-${br.id}`,
          source: `step-${br.from_step_id}`,
          target: `step-${br.to_step_id}`,
          type: 'smoothstep',
          animated: true,
          style: {
            stroke:
              br.condition_leaf_id === null && br.condition_dropdown_value_id === null
                ? '#f59e0b'
                : '#8b5cf6',
            strokeWidth: 2,
            strokeDasharray: '5,5',
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color:
              br.condition_leaf_id === null && br.condition_dropdown_value_id === null
                ? '#f59e0b'
                : '#8b5cf6',
          },
          label:
            br.condition_dropdown_value_id != null
              ? t('pages.chainBuilder.branchEdgeIfDropdown', {
                  id: br.condition_dropdown_value_id,
                })
              : br.condition_leaf_id != null
                ? t('pages.chainBuilder.branchEdgeLeaf', { id: br.condition_leaf_id })
                : t('pages.chainBuilder.branchElse'),
          labelStyle: { fontSize: 10, fill: '#6b7280' },
        })
      }
    }

    setNodes(flowNodes)
    setEdges(flowEdges)
  }, [chain, builderData, selectedStepId, steps, t, setNodes, setEdges])

  const qc = useQueryClient()
  const onNodeDragStop = useCallback(
    (_: unknown, node: Node) => {
      if (!selectedChainId) return
      const stepId = parseInt(node.id.replace('step-', ''), 10)
      updateStepPositions(selectedChainId, [
        {
          step_id: stepId,
          position_x: Math.round(node.position.x),
          position_y: Math.round(node.position.y),
        },
      ])
        .then(() => qc.invalidateQueries({ queryKey: ['ta-chains', selectedChainId] }))
        .catch(() => {})
    },
    [selectedChainId, qc]
  )

  // Clear the per-step editor form (effect conditions/config, branch
  // target/conditions). Used whenever the selected step or chain changes so
  // one step's in-progress selections can't leak onto another step — audit
  // fe-07 (stale conditions/branch target silently written to the wrong step).
  const resetStepForm = useCallback(() => {
    setNewEffectConditions(new Set())
    setNewBranchConditions(new Set())
    setNewBranchTo('')
    setNewEffectConfig({})
  }, [])

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
      const stepId = parseInt(node.id.replace('step-', ''), 10)
      if (stepId !== selectedStepId) resetStepForm()
      setSelectedStepId(stepId)
    },
    [selectedStepId, resetStepForm]
  )

  const stepEffects = builderData?.effects.filter((e) => e.step_id === selectedStepId) ?? []
  const stepBranches = builderData?.branches.filter((b) => b.from_step_id === selectedStepId) ?? []

  // Full TA data for dropdown values
  const { data: tasData } = useTargetActions({ include_hidden: false })
  const taById = useMemo(() => {
    const m = new Map<number, TargetAction>()
    for (const ta of tasData?.items ?? []) m.set(ta.id, ta)
    return m
  }, [tasData])

  // Dropdown values for the selected step's TA (for branch condition picker)
  const stepDropdownValues = useMemo(() => {
    if (!selectedStep) return []
    const ta = taById.get(selectedStep.target_action_id)
    if (!ta || ta.field_type !== 'dropdown') return []
    return ta.dropdown_values.filter((dv) => !dv.is_hidden)
  }, [selectedStep, taById])

  // Map dropdown value IDs to names for display
  const dvNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const dv of stepDropdownValues) m.set(dv.id, dv.value)
    return m
  }, [stepDropdownValues])

  // Steps of specific field types — used by effect builders that need to
  // reference a chain step (phone for add_to_spam, due date for create_task).
  const contactSteps = useMemo(
    () => steps.filter((s) => s.target_action_field_type === 'contact'),
    [steps]
  )
  const dateSteps = useMemo(
    () => steps.filter((s) => s.target_action_field_type === 'date'),
    [steps]
  )

  return (
    <div className="flex w-full flex-col gap-4">
      <h1 className="text-dark-500 text-2xl font-light">{t('pages.chainBuilder.title')}</h1>

      {/* Chain picker */}
      <div className="sm:max-w-sm">
        <Select
          value={selectedChainId !== null ? String(selectedChainId) : ''}
          onValueChange={(v) => {
            setSelectedChainId(parseInt(v, 10))
            setSelectedStepId(null)
            resetStepForm()
          }}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                chainsListPending && chains.length === 0
                  ? t('pages.chainBuilder.loadingChains')
                  : t('pages.chainBuilder.selectChain')
              }
            />
          </SelectTrigger>
          <SelectContent>
            {chains.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name} ({c.step_count} {t('pages.chainBuilder.steps')})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedChainId && (
        <div className="w-full rounded-lg border border-dashed border-gray-300 bg-white/60 p-10 text-center text-gray-500">
          {t('pages.chainBuilder.selectChainHint')}
        </div>
      )}

      {selectedChainId && chainPending && !chain && <ChainBuilderMainSkeleton />}

      {selectedChainId && chain && (
        <div className="flex w-full flex-col gap-4 lg:flex-row" style={{ height: '70vh' }}>
          {/* Canvas */}
          <div className="flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white [&_.react-flow__controls-button]:border-gray-200 [&_.react-flow__controls-button]:bg-white [&_.react-flow__controls-button]:text-gray-700 [&_.react-flow__controls-button_svg]:fill-gray-700">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              onNodeDragStop={onNodeDragStop}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              proOptions={{ hideAttribution: true }}
            >
              <Background />
              <Controls />
            </ReactFlow>
          </div>

          {/* Config panel */}
          <div className="w-full overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 lg:w-[360px]">
            <div className="flex flex-col gap-5">
              <h2 className="text-dark-500 text-base font-semibold">{chain.name}</h2>
              {builderPending && !builderData ? (
                <ChainBuilderConfigPanelSkeleton />
              ) : (
                <>
                  {/* Triggers */}
                  <section className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold tracking-wide text-gray-700 uppercase">
                        {t('pages.chainBuilder.triggers')}
                      </span>
                      <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                        {builderData?.triggers.length ?? 0}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {builderData?.triggers.map((tr) => (
                        <div
                          key={tr.id}
                          className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5"
                        >
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-blue-800">
                              {typeLabel('trigger', tr.trigger_type)}
                            </span>
                            {Object.keys(tr.config).length > 0 && (
                              <span className="text-[10px] text-blue-600">
                                {formatConfig(tr.config)}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await deleteTriggerMut.mutateAsync(tr.id)
                              } catch (e) {
                                toast.error(getErrorMessage(e))
                              }
                            }}
                            className="ml-2 flex h-4 w-4 items-center justify-center rounded-full text-blue-400 hover:bg-blue-200 hover:text-blue-700"
                            title={t('pages.chainBuilder.removeItem')}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Select
                        value={newTriggerType}
                        onValueChange={(v) => {
                          setNewTriggerType(v)
                          setNewTriggerConfig({})
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TRIGGER_TYPES.map((triggerType) => (
                            <SelectItem key={triggerType} value={triggerType}>
                              {typeLabel('trigger', triggerType)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {newTriggerType === 'tag_change' && (
                        <Select
                          value={newTriggerConfig.tag_id ?? ''}
                          onValueChange={(v) => setNewTriggerConfig({ tag_id: v })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue
                              placeholder={t('pages.chainBuilder.placeholders.selectTag')}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {tags.map((tag) => (
                              <SelectItem key={tag.id} value={String(tag.id)}>
                                {tag.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {newTriggerType === 'chain_completed' && (
                        <Select
                          value={newTriggerConfig.source_chain_id ?? ''}
                          onValueChange={(v) => setNewTriggerConfig({ source_chain_id: v })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue
                              placeholder={t('pages.chainBuilder.placeholders.selectSourceChain')}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {chains
                              .filter((c) => c.id !== selectedChainId)
                              .map((c) => (
                                <SelectItem key={c.id} value={String(c.id)}>
                                  {c.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      )}
                      {newTriggerType === 'call_result' && (
                        <input
                          className="h-8 rounded-md border border-gray-200 px-2 text-xs"
                          placeholder={t('pages.chainBuilder.placeholders.resultCode')}
                          value={newTriggerConfig.result_code ?? ''}
                          onChange={(e) => setNewTriggerConfig({ result_code: e.target.value })}
                        />
                      )}
                      {newTriggerType === 'debt_status' && (
                        <input
                          className="h-8 rounded-md border border-gray-200 px-2 text-xs"
                          placeholder={t('pages.chainBuilder.placeholders.debtStatus')}
                          value={newTriggerConfig.status ?? ''}
                          onChange={(e) => setNewTriggerConfig({ status: e.target.value })}
                        />
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          const cfg: Record<string, unknown> = {}
                          if (newTriggerConfig.tag_id)
                            cfg.tag_id = parseInt(newTriggerConfig.tag_id, 10)
                          if (newTriggerConfig.source_chain_id)
                            cfg.source_chain_id = parseInt(newTriggerConfig.source_chain_id, 10)
                          if (newTriggerConfig.result_code)
                            cfg.result_code = newTriggerConfig.result_code
                          if (newTriggerConfig.status) cfg.status = newTriggerConfig.status
                          try {
                            await createTrigger.mutateAsync({
                              trigger_type: newTriggerType,
                              config: cfg,
                            })
                            toast.success(t('pages.chainBuilder.toasts.triggerAdded'))
                            setNewTriggerConfig({})
                          } catch (e) {
                            toast.error(getErrorMessage(e))
                          }
                        }}
                        className="flex h-8 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-xs text-gray-600 hover:bg-gray-100"
                      >
                        {t('pages.chainBuilder.addTrigger')}
                      </button>
                    </div>
                  </section>

                  <div className="border-t border-gray-100" />

                  {/* Blockers */}
                  <section className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold tracking-wide text-gray-700 uppercase">
                        {t('pages.chainBuilder.blockers')}
                      </span>
                      <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                        {builderData?.blockers.length ?? 0}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {builderData?.blockers.map((bl) => (
                        <div
                          key={bl.id}
                          className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5"
                        >
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-red-800">
                              {typeLabel('blocker', bl.blocker_type)}
                            </span>
                            {Object.keys(bl.config).length > 0 && (
                              <span className="text-[10px] text-red-600">
                                {formatConfig(bl.config)}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await deleteBlockerMut.mutateAsync(bl.id)
                              } catch (e) {
                                toast.error(getErrorMessage(e))
                              }
                            }}
                            className="ml-2 flex h-4 w-4 items-center justify-center rounded-full text-red-400 hover:bg-red-200 hover:text-red-700"
                            title={t('pages.chainBuilder.removeItem')}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Select
                        value={newBlockerType}
                        onValueChange={(v) => {
                          setNewBlockerType(v)
                          setNewBlockerConfig({})
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BLOCKER_TYPES.map((blockerType) => (
                            <SelectItem key={blockerType} value={blockerType}>
                              {typeLabel('blocker', blockerType)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {newBlockerType === 'launched_within' && (
                        <input
                          className="h-8 rounded-md border border-gray-200 px-2 text-xs"
                          placeholder={t('pages.chainBuilder.placeholders.daysCooldown')}
                          value={newBlockerConfig.days ?? ''}
                          onChange={(e) => setNewBlockerConfig({ days: e.target.value })}
                        />
                      )}
                      {newBlockerType === 'chain_active' && (
                        <Select
                          value={newBlockerConfig.blocking_chain_id ?? ''}
                          onValueChange={(v) => setNewBlockerConfig({ blocking_chain_id: v })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue
                              placeholder={t('pages.chainBuilder.placeholders.selectBlockingChain')}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {chains
                              .filter((c) => c.id !== selectedChainId)
                              .map((c) => (
                                <SelectItem key={c.id} value={String(c.id)}>
                                  {c.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      )}
                      {newBlockerType === 'tag_present' && (
                        <Select
                          value={newBlockerConfig.tag_id ?? ''}
                          onValueChange={(v) => setNewBlockerConfig({ tag_id: v })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue
                              placeholder={t('pages.chainBuilder.placeholders.selectTag')}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {tags.map((tag) => (
                              <SelectItem key={tag.id} value={String(tag.id)}>
                                {tag.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          const cfg: Record<string, unknown> = {}
                          if (newBlockerConfig.days) cfg.days = parseInt(newBlockerConfig.days, 10)
                          if (newBlockerConfig.blocking_chain_id)
                            cfg.blocking_chain_id = parseInt(newBlockerConfig.blocking_chain_id, 10)
                          if (newBlockerConfig.tag_id)
                            cfg.tag_id = parseInt(newBlockerConfig.tag_id, 10)
                          try {
                            await createBlocker.mutateAsync({
                              blocker_type: newBlockerType,
                              config: cfg,
                            })
                            toast.success(t('pages.chainBuilder.toasts.blockerAdded'))
                            setNewBlockerConfig({})
                          } catch (e) {
                            toast.error(getErrorMessage(e))
                          }
                        }}
                        className="flex h-8 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-xs text-gray-600 hover:bg-gray-100"
                      >
                        {t('pages.chainBuilder.addBlocker')}
                      </button>
                    </div>
                  </section>

                  {/* Step config */}
                  {selectedStep ? (
                    <>
                      <div className="border-t border-gray-100" />

                      <section className="flex flex-col gap-3">
                        <div>
                          <p className="text-[10px] font-semibold tracking-wide text-gray-400 uppercase">
                            {t('pages.chainBuilder.stepConfig')}
                          </p>
                          <h3 className="mt-0.5 text-sm font-semibold text-gray-800">
                            {selectedStep.step_order}. {selectedStep.target_action_name}
                          </h3>
                          <div className="mt-1 flex gap-3 text-xs text-gray-500">
                            <span>
                              {t('pages.chainBuilder.delay')}:{' '}
                              {t('pages.chainBuilder.delayMinutes', {
                                minutes: selectedStep.delay_minutes,
                              })}
                            </span>
                            <span>
                              {t('pages.chainBuilder.required')}:{' '}
                              {selectedStep.is_required ? t('common.yes') : t('common.no')}
                            </span>
                          </div>
                        </div>

                        {/* Effects */}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold tracking-wide text-gray-700 uppercase">
                              {t('pages.chainBuilder.effects')}
                            </span>
                            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                              {stepEffects.length}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1">
                            {stepEffects.map((ef) => (
                              <div
                                key={ef.id}
                                className="flex items-center justify-between rounded-md border border-green-200 bg-green-50 px-2.5 py-1.5"
                              >
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium text-green-800">
                                    {typeLabel('effect', ef.effect_type)}
                                    {ef.condition_dropdown_value_ids.length > 0 && (
                                      <span className="font-normal text-green-600">
                                        {' '}
                                        {t('pages.chainBuilder.ifPrefix')}{' '}
                                        {ef.condition_dropdown_value_ids
                                          .map((id) => `"${dvNameById.get(id) ?? `#${id}`}"`)
                                          .join(` ${t('pages.chainBuilder.orLower')} `)}
                                      </span>
                                    )}
                                  </span>
                                  {Object.keys(ef.config).length > 0 && (
                                    <span className="text-[10px] text-green-600">
                                      {formatConfig(ef.config)}
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await deleteEffectMut.mutateAsync(ef.id)
                                    } catch (e) {
                                      toast.error(getErrorMessage(e))
                                    }
                                  }}
                                  className="ml-2 flex h-4 w-4 items-center justify-center rounded-full text-green-400 hover:bg-green-200 hover:text-green-700"
                                  title={t('pages.chainBuilder.removeItem')}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Select
                              value={newEffectType}
                              onValueChange={(v) => {
                                setNewEffectType(v)
                                setNewEffectConfig({})
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {EFFECT_TYPES.map((effectType) => (
                                  <SelectItem key={effectType} value={effectType}>
                                    {typeLabel('effect', effectType)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {(newEffectType === 'add_tag' || newEffectType === 'remove_tag') && (
                              <Select
                                value={newEffectConfig.tag_id ?? ''}
                                onValueChange={(v) =>
                                  setNewEffectConfig({ ...newEffectConfig, tag_id: v })
                                }
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue
                                    placeholder={t('pages.chainBuilder.placeholders.selectTag')}
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {tags.map((tag) => (
                                    <SelectItem key={tag.id} value={String(tag.id)}>
                                      {tag.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            {/* add_tag — if the selected tag has expiry_type
                                = target_action_date, the chain effect must
                                also point at a specific date-typed step in
                                this chain. The BE rejects the save without
                                ta_date_step_order, so we mirror that here
                                by requiring it before "Add". */}
                            {newEffectType === 'add_tag' &&
                              (() => {
                                const selectedTag = tags.find(
                                  (tg) => String(tg.id) === String(newEffectConfig.tag_id)
                                )
                                if (
                                  !selectedTag ||
                                  (selectedTag.expiry_type ?? 'permanent') !== 'target_action_date'
                                ) {
                                  return null
                                }
                                if (dateSteps.length === 0) {
                                  return (
                                    <p className="text-xs text-amber-600">
                                      {t(
                                        'pages.chainBuilder.placeholders.noDateStepsForTag',
                                        'This chain has no date-type steps; add one before using a Target-Action-Date tag.'
                                      )}
                                    </p>
                                  )
                                }
                                return (
                                  <Select
                                    value={newEffectConfig.ta_date_step_order ?? ''}
                                    onValueChange={(v) =>
                                      setNewEffectConfig({
                                        ...newEffectConfig,
                                        ta_date_step_order: v,
                                      })
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue
                                        placeholder={t(
                                          'pages.chainBuilder.placeholders.selectDateField',
                                          'Date field from TA *'
                                        )}
                                      />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {dateSteps.map((s) => (
                                        <SelectItem key={s.id} value={String(s.step_order)}>
                                          {s.step_order}.{' '}
                                          {s.target_action_name ??
                                            t('pages.chainBuilder.taFallback', {
                                              id: s.target_action_id,
                                            })}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )
                              })()}
                            {newEffectType === 'send_sms' && (
                              <Select
                                value={newEffectConfig.sms_template_id ?? ''}
                                onValueChange={(v) =>
                                  setNewEffectConfig({ ...newEffectConfig, sms_template_id: v })
                                }
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue
                                    placeholder={t(
                                      'pages.chainBuilder.placeholders.selectSmsTemplate'
                                    )}
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {smsTemplates.map((tpl) => (
                                    <SelectItem key={tpl.id} value={String(tpl.id)}>
                                      {tpl.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            {newEffectType === 'create_task' && (
                              <>
                                <SearchableSelect
                                  options={taskSubjectOptions}
                                  value={newEffectConfig.subject_id ?? ''}
                                  onValueChange={(v) =>
                                    setNewEffectConfig({ ...newEffectConfig, subject_id: v })
                                  }
                                  placeholder={t('pages.chainBuilder.placeholders.subjectRequired')}
                                  searchPlaceholder={t(
                                    'pages.chainBuilder.placeholders.searchSubjects'
                                  )}
                                  className="text-xs"
                                />
                                <input
                                  className="h-8 rounded-md border border-gray-200 px-2 text-xs text-gray-800"
                                  placeholder={t('pages.chainBuilder.placeholders.titleOptional')}
                                  value={newEffectConfig.title ?? ''}
                                  onChange={(e) =>
                                    setNewEffectConfig({
                                      ...newEffectConfig,
                                      title: e.target.value,
                                    })
                                  }
                                />
                                <textarea
                                  className="min-h-[48px] rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-800"
                                  placeholder={t(
                                    'pages.chainBuilder.placeholders.descriptionOptional'
                                  )}
                                  value={newEffectConfig.description ?? ''}
                                  onChange={(e) =>
                                    setNewEffectConfig({
                                      ...newEffectConfig,
                                      description: e.target.value,
                                    })
                                  }
                                />
                                <select
                                  className="h-8 rounded-md border border-gray-200 px-2 text-xs text-gray-800"
                                  value={newEffectConfig.priority ?? 'normal'}
                                  onChange={(e) =>
                                    setNewEffectConfig({
                                      ...newEffectConfig,
                                      priority: e.target.value,
                                    })
                                  }
                                >
                                  <option value="low">
                                    {t('pages.chainBuilder.taskPriority.low')}
                                  </option>
                                  <option value="normal">
                                    {t('pages.chainBuilder.taskPriority.normal')}
                                  </option>
                                  <option value="high">
                                    {t('pages.chainBuilder.taskPriority.high')}
                                  </option>
                                  <option value="urgent">
                                    {t('pages.chainBuilder.taskPriority.urgent')}
                                  </option>
                                  <option value="critical">
                                    {t('pages.chainBuilder.taskPriority.critical')}
                                  </option>
                                </select>
                                <select
                                  className="h-8 rounded-md border border-gray-200 px-2 text-xs text-gray-800"
                                  value={newEffectConfig.assignee_mode ?? ''}
                                  onChange={(e) =>
                                    setNewEffectConfig({
                                      ...newEffectConfig,
                                      assignee_mode: e.target.value,
                                      assigned_user_id: '',
                                    })
                                  }
                                >
                                  <option value="">
                                    {t('pages.chainBuilder.placeholders.assigneeRequired')}
                                  </option>
                                  <option value="created_by">
                                    {t('pages.chainBuilder.assigneeModes.created_by')}
                                  </option>
                                  <option value="client_responsible">
                                    {t('pages.chainBuilder.assigneeModes.client_responsible')}
                                  </option>
                                  <option value="specific_user">
                                    {t('pages.chainBuilder.assigneeModes.specific_user')}
                                  </option>
                                </select>
                                {newEffectConfig.assignee_mode === 'specific_user' && (
                                  <SearchableSelect
                                    options={operatorOptions}
                                    value={newEffectConfig.assigned_user_id ?? ''}
                                    onValueChange={(v) =>
                                      setNewEffectConfig({
                                        ...newEffectConfig,
                                        assigned_user_id: v,
                                      })
                                    }
                                    placeholder={t('pages.chainBuilder.placeholders.pickUser')}
                                    searchPlaceholder={t(
                                      'pages.chainBuilder.placeholders.searchUsers'
                                    )}
                                    className="text-xs"
                                  />
                                )}
                                <select
                                  className="h-8 rounded-md border border-gray-200 px-2 text-xs text-gray-800"
                                  value={newEffectConfig.due_date_ref ?? ''}
                                  onChange={(e) =>
                                    setNewEffectConfig({
                                      ...newEffectConfig,
                                      due_date_ref: e.target.value,
                                    })
                                  }
                                >
                                  <option value="">
                                    {t('pages.chainBuilder.placeholders.dueDateNone')}
                                  </option>
                                  <option value="chain_entry_date">
                                    {t('pages.chainBuilder.dueDateRefs.chain_entry_date')}
                                  </option>
                                  <option value="chain_completion_date">
                                    {t('pages.chainBuilder.dueDateRefs.chain_completion_date')}
                                  </option>
                                  {dateSteps.map((s) => (
                                    <option key={s.id} value={String(s.step_order)}>
                                      {t('pages.chainBuilder.config.stepRef', {
                                        order: s.step_order,
                                        name:
                                          s.target_action_name ??
                                          t('pages.chainBuilder.taFallback', {
                                            id: s.target_action_id,
                                          }),
                                      })}
                                    </option>
                                  ))}
                                </select>
                              </>
                            )}
                            {newEffectType === 'add_to_spam' &&
                              (contactSteps.length === 0 ? (
                                <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700">
                                  {t('pages.chainBuilder.addToSpamNoContactSteps')}
                                </div>
                              ) : (
                                <select
                                  className="h-8 rounded-md border border-gray-200 px-2 text-xs text-gray-800"
                                  value={newEffectConfig.phone_ref ?? ''}
                                  onChange={(e) =>
                                    setNewEffectConfig({
                                      ...newEffectConfig,
                                      phone_ref: e.target.value,
                                    })
                                  }
                                >
                                  <option value="">
                                    {t('pages.chainBuilder.placeholders.phoneSourceRequired')}
                                  </option>
                                  {contactSteps.map((s) => (
                                    <option key={s.id} value={String(s.id)}>
                                      {t('pages.chainBuilder.config.stepRef', {
                                        order: s.step_order,
                                        name:
                                          s.target_action_name ??
                                          t('pages.chainBuilder.taFallback', {
                                            id: s.target_action_id,
                                          }),
                                      })}
                                    </option>
                                  ))}
                                </select>
                              ))}
                            {stepDropdownValues.length > 0 && (
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setEffectCondDropdownOpen(!effectCondDropdownOpen)}
                                  className="flex h-9 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 text-xs text-gray-700 hover:bg-gray-50"
                                >
                                  <span className="truncate">
                                    {newEffectConditions.size > 0
                                      ? `${t('pages.chainBuilder.ifPrefix')} ${Array.from(
                                          newEffectConditions
                                        )
                                          .map((id) => dvNameById.get(id) ?? `#${id}`)
                                          .join(', ')}`
                                      : t('pages.chainBuilder.effectCondition')}
                                  </span>
                                  <span
                                    className={`ml-2 text-gray-400 transition-transform ${effectCondDropdownOpen ? 'rotate-180' : ''}`}
                                  >
                                    ▾
                                  </span>
                                </button>
                                {effectCondDropdownOpen && (
                                  <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                                    <div className="max-h-48 overflow-y-auto">
                                      {stepDropdownValues.map((dv) => {
                                        const checked = newEffectConditions.has(dv.id)
                                        return (
                                          <button
                                            key={dv.id}
                                            type="button"
                                            onClick={() => {
                                              const next = new Set(newEffectConditions)
                                              if (checked) next.delete(dv.id)
                                              else next.add(dv.id)
                                              setNewEffectConditions(next)
                                            }}
                                            className="flex w-full items-center justify-between px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
                                          >
                                            <span>{dv.value}</span>
                                            {checked && <span className="text-gray-500">✓</span>}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                            {(() => {
                              const ec = newEffectConfig
                              // add_tag with a target_action_date tag must
                              // also carry ta_date_step_order — mirrors the
                              // BE validation in ta_chain_builder.
                              const selectedAddTag =
                                newEffectType === 'add_tag'
                                  ? tags.find((tg) => String(tg.id) === String(ec.tag_id))
                                  : null
                              const addTagNeedsDate =
                                (selectedAddTag?.expiry_type ?? 'permanent') ===
                                'target_action_date'
                              const addEffectDisabled =
                                (newEffectType === 'add_tag' && !ec.tag_id) ||
                                (newEffectType === 'add_tag' &&
                                  addTagNeedsDate &&
                                  !ec.ta_date_step_order) ||
                                (newEffectType === 'remove_tag' && !ec.tag_id) ||
                                (newEffectType === 'send_sms' && !ec.sms_template_id) ||
                                (newEffectType === 'add_to_spam' &&
                                  (contactSteps.length === 0 || !ec.phone_ref)) ||
                                (newEffectType === 'create_task' &&
                                  (!ec.subject_id ||
                                    !ec.assignee_mode ||
                                    (ec.assignee_mode === 'specific_user' && !ec.assigned_user_id)))
                              return (
                                <button
                                  type="button"
                                  disabled={addEffectDisabled}
                                  onClick={async () => {
                                    const cfg: Record<string, unknown> = {}
                                    if (ec.tag_id) cfg.tag_id = parseInt(ec.tag_id, 10)
                                    if (newEffectType === 'add_tag' && addTagNeedsDate) {
                                      cfg.ta_date_step_order = parseInt(ec.ta_date_step_order!, 10)
                                    }
                                    if (ec.sms_template_id)
                                      cfg.sms_template_id = parseInt(ec.sms_template_id, 10)
                                    if (newEffectType === 'create_task') {
                                      cfg.subject_id = parseInt(ec.subject_id!, 10)
                                      if (ec.title) cfg.title = ec.title
                                      if (ec.description) cfg.description = ec.description
                                      cfg.priority = ec.priority || 'normal'
                                      cfg.assignee_mode = ec.assignee_mode
                                      if (ec.assignee_mode === 'specific_user') {
                                        cfg.assigned_user_id = parseInt(ec.assigned_user_id!, 10)
                                      }
                                      if (ec.due_date_ref) cfg.due_date_ref = ec.due_date_ref
                                    } else if (newEffectType === 'add_to_spam') {
                                      cfg.phone_ref = parseInt(ec.phone_ref!, 10)
                                    }
                                    // Only send conditions that belong to THIS
                                    // step's dropdown values — guards against
                                    // stale picks carried over from a
                                    // previously-selected step (audit fe-07,
                                    // defense-in-depth behind the form reset).
                                    const validDvIds = new Set(
                                      stepDropdownValues.map((dv) => dv.id)
                                    )
                                    const effectConditionIds = Array.from(
                                      newEffectConditions
                                    ).filter((id) => validDvIds.has(id))
                                    try {
                                      await createEffect.mutateAsync({
                                        step_id: selectedStep.id,
                                        effect_type: newEffectType,
                                        config: cfg,
                                        condition_dropdown_value_ids:
                                          effectConditionIds.length > 0
                                            ? effectConditionIds
                                            : undefined,
                                      })
                                      toast.success(t('pages.chainBuilder.toasts.effectAdded'))
                                      setNewEffectConfig({})
                                      setNewEffectConditions(new Set())
                                      setEffectCondDropdownOpen(false)
                                    } catch (e) {
                                      toast.error(getErrorMessage(e))
                                    }
                                  }}
                                  className="flex h-8 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {t('pages.chainBuilder.addEffect')}
                                </button>
                              )
                            })()}
                          </div>
                        </div>

                        {/* Branches */}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold tracking-wide text-gray-700 uppercase">
                              {t('pages.chainBuilder.branches')}
                            </span>
                            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                              {stepBranches.length}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1">
                            {stepBranches.map((br) => (
                              <div
                                key={br.id}
                                className="flex items-center justify-between rounded-md border border-purple-200 bg-purple-50 px-2.5 py-1.5"
                              >
                                <span className="text-xs font-medium text-purple-800">
                                  →{' '}
                                  {(() => {
                                    const toStep = steps.find((s) => s.id === br.to_step_id)
                                    return toStep
                                      ? `${toStep.step_order}. ${toStep.target_action_name ?? t('pages.chainBuilder.taFallback', { id: toStep.target_action_id })}`
                                      : t('pages.chainBuilder.branchUnknownStep', {
                                          id: br.to_step_id,
                                        })
                                  })()}{' '}
                                  <span className="font-normal text-purple-600">
                                    {br.condition_dropdown_value_ids.length > 0
                                      ? `${t('pages.chainBuilder.ifPrefix')} ${br.condition_dropdown_value_ids
                                          .map((id) => `"${dvNameById.get(id) ?? `#${id}`}"`)
                                          .join(` ${t('pages.chainBuilder.orLower')} `)}`
                                      : br.condition_dropdown_value_id != null
                                        ? `${t('pages.chainBuilder.ifPrefix')} "${dvNameById.get(br.condition_dropdown_value_id) ?? `#${br.condition_dropdown_value_id}`}"`
                                        : br.condition_leaf_id != null
                                          ? t('pages.chainBuilder.branchIfLeaf', {
                                              id: br.condition_leaf_id,
                                            })
                                          : t('pages.chainBuilder.branchElseShort')}
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await deleteBranchMut.mutateAsync(br.id)
                                    } catch (e) {
                                      toast.error(getErrorMessage(e))
                                    }
                                  }}
                                  className="ml-2 flex h-4 w-4 items-center justify-center rounded-full text-purple-400 hover:bg-purple-200 hover:text-purple-700"
                                  title={t('pages.chainBuilder.removeItem')}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <div className="flex gap-1.5">
                              <Select value={newBranchTo} onValueChange={setNewBranchTo}>
                                <SelectTrigger className="h-8 flex-1 text-xs">
                                  <SelectValue placeholder={t('pages.chainBuilder.branchTo')} />
                                </SelectTrigger>
                                <SelectContent>
                                  {steps
                                    .filter((s) => s.id !== selectedStep.id)
                                    .map((s) => (
                                      <SelectItem key={s.id} value={String(s.id)}>
                                        {s.step_order}.{' '}
                                        {s.target_action_name ??
                                          t('pages.chainBuilder.taFallback', {
                                            id: s.target_action_id,
                                          })}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!newBranchTo) return
                                  try {
                                    await createBranch.mutateAsync({
                                      from_step_id: selectedStep.id,
                                      to_step_id: parseInt(newBranchTo, 10),
                                      condition_dropdown_value_ids:
                                        newBranchConditions.size > 0
                                          ? Array.from(newBranchConditions)
                                          : undefined,
                                    })
                                    toast.success(
                                      newBranchConditions.size > 0
                                        ? t('pages.chainBuilder.branchAddedCondition')
                                        : t('pages.chainBuilder.branchAddedElse')
                                    )
                                    setNewBranchTo('')
                                    setNewBranchConditions(new Set())
                                    setBranchCondDropdownOpen(false)
                                  } catch (e) {
                                    toast.error(getErrorMessage(e))
                                  }
                                }}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"
                              >
                                +
                              </button>
                            </div>
                            {stepDropdownValues.length > 0 &&
                              (() => {
                                const [open, setOpen] = [
                                  branchCondDropdownOpen,
                                  setBranchCondDropdownOpen,
                                ]
                                return (
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={() => setOpen(!open)}
                                      className="flex h-9 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 text-xs text-gray-700 hover:bg-gray-50"
                                    >
                                      <span className="truncate">
                                        {newBranchConditions.size > 0
                                          ? Array.from(newBranchConditions)
                                              .map((id) => dvNameById.get(id) ?? `#${id}`)
                                              .join(', ')
                                          : t('pages.chainBuilder.conditionLeaf')}
                                      </span>
                                      <span
                                        className={`ml-2 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
                                      >
                                        ▾
                                      </span>
                                    </button>
                                    {open && (
                                      <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                                        <div className="max-h-48 overflow-y-auto">
                                          {stepDropdownValues.map((dv) => {
                                            const checked = newBranchConditions.has(dv.id)
                                            return (
                                              <button
                                                key={dv.id}
                                                type="button"
                                                onClick={() => {
                                                  const next = new Set(newBranchConditions)
                                                  if (checked) next.delete(dv.id)
                                                  else next.add(dv.id)
                                                  setNewBranchConditions(next)
                                                }}
                                                className="flex w-full items-center justify-between px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
                                              >
                                                <span>{dv.value}</span>
                                                {checked && (
                                                  <span className="text-gray-500">✓</span>
                                                )}
                                              </button>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })()}
                          </div>
                        </div>
                      </section>
                    </>
                  ) : (
                    <>
                      <div className="border-t border-gray-100" />
                      <p className="py-2 text-center text-xs text-gray-400">
                        {t('pages.chainBuilder.selectStepHint')}
                      </p>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChainBuilderPage
