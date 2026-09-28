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
import { useSMSTemplates, useSmsServiceAvailable } from '@/features/sms'
import { useProjectCountry } from '@/hooks/useProjectCountry'
import {
  useCanReadMessagingDrafts,
  useMessagingDrafts,
  useMessagingIntegrations,
} from '@/features/messaging/hooks/useMessaging'
import {
  MESSAGING_CHANNELS,
  getMessagingServiceLabel,
  isMessagingIntegrationUsable,
  type MessagingChannel,
} from '@/features/messaging/api/types'
import { useAuthStore } from '@/stores/authStore'
import { getErrorMessage } from '@/lib/errors'

const TYPE_COLOR: Record<string, string> = {
  text: 'var(--color-success-500)',
  dropdown: 'var(--color-information-500)',
  date: 'var(--color-warning-500)',
  amount: 'var(--color-information-400)',
}

const TRIGGER_TYPES = [
  'tag_change',
  'call_result',
  'date_reached',
  'debt_status',
  'chain_completed',
  'role_action',
]

// Debt statuses offered for the "Debt status" trigger. The dropdown (vs free
// text) guarantees the stored value matches the backend exactly — no "close"
// vs "closed" typos. The trigger fires when a debt's ``status`` becomes the
// chosen value (event ``debt.status_changed``).
//
// A debt's ``status`` is only ever ``active`` or ``closed`` in the data — there
// is no stored ``overdue``/``paid``/``partially_paid``/``written_off``. Those
// were removed so an admin can't configure a trigger that can never fire.
const DEBT_STATUS_OPTIONS: Array<{ value: string; fallback: string }> = [
  { value: 'active', fallback: 'Active' },
  { value: 'closed', fallback: 'Closed' },
]
const BLOCKER_TYPES = [
  'already_launched',
  'launched_within',
  'chain_active',
  'tag_present',
  'in_cooldown',
]
const EFFECT_TYPES = [
  'add_tag',
  'remove_tag',
  'create_task',
  'send_sms',
  'send_message',
  'add_to_spam',
]

function ChainBuilderMainSkeleton() {
  return (
    <div
      className="flex w-full flex-col gap-4 lg:flex-row"
      style={{ height: '70vh' }}
      role="status"
      aria-busy="true"
    >
      <div className="border-border bg-muted flex-1 animate-pulse rounded-lg border" />
      <div className="border-border bg-card w-full animate-pulse space-y-4 rounded-lg border p-4 lg:w-[360px]">
        <div className="bg-muted h-6 w-56 rounded-md" />
        <div className="space-y-2">
          <div className="bg-muted h-3 w-24 rounded" />
          <div className="bg-muted h-14 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <div className="bg-muted h-3 w-20 rounded" />
          <div className="bg-muted h-14 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <div className="bg-muted h-3 w-16 rounded" />
          <div className="bg-muted h-24 w-full rounded-md" />
        </div>
      </div>
    </div>
  )
}

function ChainBuilderConfigPanelSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5" role="status" aria-busy="true">
      <div className="space-y-2">
        <div className="bg-muted h-3 w-28 rounded" />
        <div className="bg-muted h-10 w-full rounded-md" />
        <div className="bg-muted h-8 w-full rounded-md" />
      </div>
      <div className="bg-muted h-px w-full" />
      <div className="space-y-2">
        <div className="bg-muted h-3 w-24 rounded" />
        <div className="bg-muted h-10 w-full rounded-md" />
        <div className="bg-muted h-8 w-full rounded-md" />
      </div>
      <div className="bg-muted h-px w-full" />
      <div className="space-y-2">
        <div className="bg-muted h-3 w-20 rounded" />
        <div className="bg-muted h-20 w-full rounded-md" />
      </div>
    </div>
  )
}

export function ChainBuilderPage() {
  const { t } = useTranslation('common')
  const projectCountry = useProjectCountry()
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
  const [messageChannel, setMessageChannel] = useState<MessagingChannel>('sms')
  const canReadDrafts = useCanReadMessagingDrafts()
  const { data: messagingDrafts = [] } = useMessagingDrafts(messageChannel)
  const { data: messagingIntegrations = [] } = useMessagingIntegrations(!!projectId)
  const usableMessagingServices = useMemo(
    () =>
      messagingIntegrations.filter((integration) =>
        isMessagingIntegrationUsable(integration, messageChannel, projectCountry)
      ),
    [messagingIntegrations, messageChannel, projectCountry]
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
        } else if (key === 'draft_id') {
          const draft = messagingDrafts.find((d) => d.id === Number(value))
          parts.push(
            t('pages.chainBuilder.config.messagingDraft', {
              label: draft?.name ?? `#${value}`,
            })
          )
        } else if (key === 'channel') {
          parts.push(
            t('pages.chainBuilder.config.channel', {
              label: t(`pages.messaging.channels.${String(value)}`, {
                defaultValue: String(value),
              }),
            })
          )
        } else if (key === 'service') {
          parts.push(
            t('pages.chainBuilder.config.messagingService', {
              label: getMessagingServiceLabel(String(value)),
            })
          )
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
        } else if (key === 'email_ref') {
          const step = (chain?.steps ?? []).find((s) => s.id === Number(value))
          parts.push(
            step
              ? t('pages.chainBuilder.config.email', {
                  step: stepRef(step),
                  defaultValue: `Email: ${stepRef(step)}`,
                })
              : t('pages.chainBuilder.config.emailUnknown', {
                  id: String(value),
                  defaultValue: `Email step #${String(value)}`,
                })
          )
        } else {
          parts.push(t('pages.chainBuilder.config.generic', { key, value: String(value) }))
        }
      }
      return parts.join(' · ')
    },
    [tags, smsTemplates, messagingDrafts, chains, subjectNameById, operatorNameById, chain, t]
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
  const smsServiceAvailable = useSmsServiceAvailable()
  const effectTypes = useMemo(
    () => EFFECT_TYPES.filter((effectType) => effectType !== 'send_sms' || smsServiceAvailable),
    [smsServiceAvailable]
  )
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
        border: `2px solid ${TYPE_COLOR[step.target_action_field_type ?? 'text'] ?? 'var(--muted-foreground)'}`,
        borderRadius: '8px',
        padding: '10px 16px',
        fontSize: '13px',
        fontWeight: 500,
        background:
          selectedStepId === step.id
            ? 'color-mix(in srgb, var(--color-information-500) 12%, var(--card))'
            : 'var(--card)',
        color: 'var(--foreground)',
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
        style: { stroke: 'var(--muted-foreground)', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--muted-foreground)' },
      })
    }

    // Branch edges
    if (builderData) {
      for (const br of builderData.branches) {
        const branchStroke =
          br.condition_leaf_id === null && br.condition_dropdown_value_id === null
            ? 'var(--color-warning-500)'
            : 'var(--color-information-500)'
        flowEdges.push({
          id: `branch-${br.id}`,
          source: `step-${br.from_step_id}`,
          target: `step-${br.to_step_id}`,
          type: 'smoothstep',
          animated: true,
          style: {
            stroke: branchStroke,
            strokeWidth: 2,
            strokeDasharray: '5,5',
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: branchStroke,
          },
          label:
            br.condition_dropdown_value_id != null
              ? t('pages.chainBuilder.branchEdgeIfDropdown', {
                  id: br.condition_dropdown_value_id,
                })
              : br.condition_leaf_id != null
                ? t('pages.chainBuilder.branchEdgeLeaf', { id: br.condition_leaf_id })
                : t('pages.chainBuilder.branchElse'),
          labelStyle: { fontSize: 10, fill: 'var(--muted-foreground)' },
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
  const phoneContactSteps = useMemo(
    () => contactSteps.filter((s) => (s.contact_medium ?? 'phone') !== 'email'),
    [contactSteps]
  )
  const emailContactSteps = useMemo(
    () => contactSteps.filter((s) => s.contact_medium === 'email'),
    [contactSteps]
  )
  const dateSteps = useMemo(
    () => steps.filter((s) => s.target_action_field_type === 'date'),
    [steps]
  )

  return (
    <div className="flex w-full flex-col gap-4">
      <h1 className="text-foreground text-2xl font-light">{t('pages.chainBuilder.title')}</h1>

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
        <div className="border-border bg-card/60 text-muted-foreground w-full rounded-lg border border-dashed p-10 text-center">
          {t('pages.chainBuilder.selectChainHint')}
        </div>
      )}

      {selectedChainId && chainPending && !chain && <ChainBuilderMainSkeleton />}

      {selectedChainId && chain && (
        <div className="flex w-full flex-col gap-4 lg:flex-row" style={{ height: '70vh' }}>
          {/* Canvas */}
          <div className="border-border bg-card [&_.react-flow__controls-button]:border-border [&_.react-flow__controls-button]:bg-card [&_.react-flow__controls-button]:text-foreground [&_.react-flow__controls-button_svg]:fill-foreground flex-1 overflow-hidden rounded-lg border">
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
          <div className="border-border bg-card w-full overflow-y-auto rounded-lg border p-4 lg:w-[360px]">
            <div className="flex flex-col gap-5">
              <h2 className="text-foreground text-base font-semibold">{chain.name}</h2>
              {builderPending && !builderData ? (
                <ChainBuilderConfigPanelSkeleton />
              ) : (
                <>
                  {/* Triggers */}
                  <section className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-foreground text-xs font-semibold tracking-wide uppercase">
                        {t('pages.chainBuilder.triggers')}
                      </span>
                      <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                        {builderData?.triggers.length ?? 0}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {builderData?.triggers.map((tr) => (
                        <div
                          key={tr.id}
                          className="border-info-200 bg-info-100 flex items-center justify-between rounded-md border px-2.5 py-1.5"
                        >
                          <div className="flex flex-col">
                            <span className="text-info-800 text-xs font-medium">
                              {typeLabel('trigger', tr.trigger_type)}
                            </span>
                            {Object.keys(tr.config).length > 0 && (
                              <span className="text-info-600 text-[10px]">
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
                            className="text-info-500 hover:bg-info-100 hover:text-info-700 ml-2 flex h-4 w-4 items-center justify-center rounded-full"
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
                          className="border-border h-8 rounded-md border px-2 text-xs"
                          placeholder={t('pages.chainBuilder.placeholders.resultCode')}
                          value={newTriggerConfig.result_code ?? ''}
                          onChange={(e) => setNewTriggerConfig({ result_code: e.target.value })}
                        />
                      )}
                      {newTriggerType === 'debt_status' && (
                        <Select
                          value={newTriggerConfig.status ?? ''}
                          onValueChange={(v) => setNewTriggerConfig({ status: v })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue
                              placeholder={t('pages.chainBuilder.placeholders.debtStatus')}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {DEBT_STATUS_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {t(`pages.chainBuilder.debtStatus.${opt.value}`, opt.fallback)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                        disabled={newTriggerType === 'debt_status' && !newTriggerConfig.status}
                        className="border-border bg-muted text-muted-foreground hover:bg-muted flex h-8 items-center justify-center rounded-md border text-xs disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t('pages.chainBuilder.addTrigger')}
                      </button>
                    </div>
                  </section>

                  <div className="border-border border-t" />

                  {/* Blockers */}
                  <section className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-foreground text-xs font-semibold tracking-wide uppercase">
                        {t('pages.chainBuilder.blockers')}
                      </span>
                      <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                        {builderData?.blockers.length ?? 0}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {builderData?.blockers.map((bl) => (
                        <div
                          key={bl.id}
                          className="border-error-200 bg-error-50 flex items-center justify-between rounded-md border px-2.5 py-1.5"
                        >
                          <div className="flex flex-col">
                            <span className="text-error-800 text-xs font-medium">
                              {typeLabel('blocker', bl.blocker_type)}
                            </span>
                            {Object.keys(bl.config).length > 0 && (
                              <span className="text-error-600 text-[10px]">
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
                            className="text-error-500 hover:bg-error-100 hover:text-error-700 ml-2 flex h-4 w-4 items-center justify-center rounded-full"
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
                          className="border-border h-8 rounded-md border px-2 text-xs"
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
                        className="border-border bg-muted text-muted-foreground hover:bg-muted flex h-8 items-center justify-center rounded-md border text-xs"
                      >
                        {t('pages.chainBuilder.addBlocker')}
                      </button>
                    </div>
                  </section>

                  {/* Step config */}
                  {selectedStep ? (
                    <>
                      <div className="border-border border-t" />

                      <section className="flex flex-col gap-3">
                        <div>
                          <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                            {t('pages.chainBuilder.stepConfig')}
                          </p>
                          <h3 className="text-foreground mt-0.5 text-sm font-semibold">
                            {selectedStep.step_order}. {selectedStep.target_action_name}
                          </h3>
                          <div className="text-muted-foreground mt-1 flex gap-3 text-xs">
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
                            <span className="text-foreground text-xs font-semibold tracking-wide uppercase">
                              {t('pages.chainBuilder.effects')}
                            </span>
                            <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                              {stepEffects.length}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1">
                            {stepEffects.map((ef) => (
                              <div
                                key={ef.id}
                                className="border-success-200 bg-success-50 flex items-center justify-between rounded-md border px-2.5 py-1.5"
                              >
                                <div className="flex flex-col">
                                  <span className="text-success-800 text-xs font-medium">
                                    {typeLabel('effect', ef.effect_type)}
                                    {ef.condition_dropdown_value_ids.length > 0 && (
                                      <span className="text-success-600 font-normal">
                                        {' '}
                                        {t('pages.chainBuilder.ifPrefix')}{' '}
                                        {ef.condition_dropdown_value_ids
                                          .map((id) => `"${dvNameById.get(id) ?? `#${id}`}"`)
                                          .join(` ${t('pages.chainBuilder.orLower')} `)}
                                      </span>
                                    )}
                                  </span>
                                  {Object.keys(ef.config).length > 0 && (
                                    <span className="text-success-600 text-[10px]">
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
                                  className="text-success-500 hover:bg-success-100 hover:text-success-700 ml-2 flex h-4 w-4 items-center justify-center rounded-full"
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
                                if (v === 'send_message') {
                                  setMessageChannel('sms')
                                  setNewEffectConfig(
                                    phoneContactSteps.length === 1
                                      ? { phone_ref: String(phoneContactSteps[0].id) }
                                      : {}
                                  )
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {effectTypes.map((effectType) => (
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
                                    <p className="text-warning-600 text-xs">
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
                            {newEffectType === 'send_message' && (
                              <>
                                <select
                                  className="border-border text-foreground h-8 rounded-md border px-2 text-xs"
                                  value={messageChannel}
                                  onChange={(e) => {
                                    const ch = e.target.value as MessagingChannel
                                    setMessageChannel(ch)
                                    const next: Record<string, string> = {
                                      channel: ch,
                                      service: '',
                                      draft_id: '',
                                    }
                                    if (ch === 'sms' || ch === 'viber') {
                                      if (phoneContactSteps.length === 1) {
                                        next.phone_ref = String(phoneContactSteps[0].id)
                                      }
                                    } else if (ch === 'email' && emailContactSteps.length === 1) {
                                      next.email_ref = String(emailContactSteps[0].id)
                                    }
                                    setNewEffectConfig(next)
                                  }}
                                >
                                  {MESSAGING_CHANNELS.map((ch) => (
                                    <option key={ch} value={ch}>
                                      {t(`pages.messaging.channels.${ch}`, {
                                        defaultValue: ch,
                                      })}
                                    </option>
                                  ))}
                                </select>
                                {usableMessagingServices.length === 0 ? (
                                  <div className="border-warning-200 bg-warning-100 text-warning-700 rounded-md border px-2 py-1.5 text-[11px]">
                                    {t('pages.chainBuilder.sendMessageNoIntegration')}
                                  </div>
                                ) : (
                                  <select
                                    className="border-border text-foreground h-8 rounded-md border px-2 text-xs"
                                    value={newEffectConfig.service ?? ''}
                                    onChange={(e) =>
                                      setNewEffectConfig({
                                        ...newEffectConfig,
                                        channel: messageChannel,
                                        service: e.target.value,
                                        draft_id: '',
                                      })
                                    }
                                  >
                                    <option value="">
                                      {t('pages.chainBuilder.placeholders.selectMessagingService')}
                                    </option>
                                    {usableMessagingServices.map((integration) => (
                                      <option key={integration.service} value={integration.service}>
                                        {getMessagingServiceLabel(integration.service)}
                                      </option>
                                    ))}
                                  </select>
                                )}
                                {!canReadDrafts ? (
                                  <div className="border-warning-200 bg-warning-100 text-warning-700 rounded-md border px-2 py-1.5 text-[11px]">
                                    {t('pages.chainBuilder.sendMessageNoDraftPermission')}
                                  </div>
                                ) : (
                                  <Select
                                    disabled={!newEffectConfig.service}
                                    value={newEffectConfig.draft_id ?? ''}
                                    onValueChange={(v) =>
                                      setNewEffectConfig({
                                        ...newEffectConfig,
                                        channel: messageChannel,
                                        draft_id: v,
                                      })
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue
                                        placeholder={t(
                                          'pages.chainBuilder.placeholders.selectMessagingDraft'
                                        )}
                                      />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {messagingDrafts.map((draft) => (
                                        <SelectItem key={draft.id} value={String(draft.id)}>
                                          {draft.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                                {(messageChannel === 'sms' || messageChannel === 'viber') &&
                                  (phoneContactSteps.length === 0 ? (
                                    <div className="border-warning-200 bg-warning-100 text-warning-700 rounded-md border px-2 py-1.5 text-[11px]">
                                      {t('pages.chainBuilder.addToSpamNoContactSteps')}
                                    </div>
                                  ) : (
                                    <select
                                      className="border-border text-foreground h-8 rounded-md border px-2 text-xs"
                                      value={newEffectConfig.phone_ref ?? ''}
                                      onChange={(e) => {
                                        const next: Record<string, string> = {
                                          ...newEffectConfig,
                                          phone_ref: e.target.value,
                                        }
                                        delete next.email_ref
                                        setNewEffectConfig(next)
                                      }}
                                    >
                                      <option value="">
                                        {t('pages.chainBuilder.placeholders.phoneSourceRequired')}
                                      </option>
                                      {phoneContactSteps.map((s) => (
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
                                {messageChannel === 'email' &&
                                  (emailContactSteps.length === 0 ? (
                                    <p className="text-muted-foreground text-[11px]">
                                      {t(
                                        'pages.chainBuilder.sendMessageEmailRefOptional',
                                        'Optional: add an email contact step to pick the address from chain data. Otherwise the client primary email is used.'
                                      )}
                                    </p>
                                  ) : (
                                    <select
                                      className="border-border text-foreground h-8 rounded-md border px-2 text-xs"
                                      value={newEffectConfig.email_ref ?? ''}
                                      onChange={(e) => {
                                        const next: Record<string, string> = {
                                          ...newEffectConfig,
                                          email_ref: e.target.value,
                                        }
                                        delete next.phone_ref
                                        setNewEffectConfig(next)
                                      }}
                                    >
                                      <option value="">
                                        {t(
                                          'pages.chainBuilder.placeholders.emailSourceOptional',
                                          'Primary email (default)'
                                        )}
                                      </option>
                                      {emailContactSteps.map((s) => (
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
                              </>
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
                                  className="border-border text-foreground h-8 rounded-md border px-2 text-xs"
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
                                  className="border-border text-foreground min-h-[48px] rounded-md border px-2 py-1.5 text-xs"
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
                                  className="border-border text-foreground h-8 rounded-md border px-2 text-xs"
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
                                  className="border-border text-foreground h-8 rounded-md border px-2 text-xs"
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
                                    obscured
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
                                  className="border-border text-foreground h-8 rounded-md border px-2 text-xs"
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
                              (phoneContactSteps.length === 0 ? (
                                <div className="border-warning-200 bg-warning-100 text-warning-700 rounded-md border px-2 py-1.5 text-[11px]">
                                  {t('pages.chainBuilder.addToSpamNoContactSteps')}
                                </div>
                              ) : (
                                <select
                                  className="border-border text-foreground h-8 rounded-md border px-2 text-xs"
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
                                  {phoneContactSteps.map((s) => (
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
                                  className="border-border bg-card text-foreground hover:bg-muted flex h-9 w-full items-center justify-between rounded-md border px-3 text-xs"
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
                                    className={`text-muted-foreground ml-2 transition-transform ${effectCondDropdownOpen ? 'rotate-180' : ''}`}
                                  >
                                    ▾
                                  </span>
                                </button>
                                {effectCondDropdownOpen && (
                                  <div className="border-border bg-card absolute z-10 mt-1 w-full rounded-md border py-1 shadow-lg">
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
                                            className="text-foreground hover:bg-muted flex w-full items-center justify-between px-3 py-1.5 text-xs"
                                          >
                                            <span>{dv.value}</span>
                                            {checked && (
                                              <span className="text-muted-foreground">✓</span>
                                            )}
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
                                (newEffectType === 'send_message' &&
                                  (!ec.service ||
                                    !ec.draft_id ||
                                    usableMessagingServices.length === 0 ||
                                    ((messageChannel === 'sms' || messageChannel === 'viber') &&
                                      (phoneContactSteps.length === 0 || !ec.phone_ref)))) ||
                                (newEffectType === 'add_to_spam' &&
                                  (phoneContactSteps.length === 0 || !ec.phone_ref)) ||
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
                                    } else if (newEffectType === 'send_message') {
                                      cfg.channel = messageChannel
                                      cfg.service = ec.service
                                      cfg.draft_id = parseInt(ec.draft_id!, 10)
                                      if (
                                        (messageChannel === 'sms' || messageChannel === 'viber') &&
                                        ec.phone_ref
                                      ) {
                                        cfg.phone_ref = parseInt(ec.phone_ref, 10)
                                      }
                                      if (messageChannel === 'email' && ec.email_ref) {
                                        cfg.email_ref = parseInt(ec.email_ref, 10)
                                      }
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
                                  className="border-border bg-muted text-muted-foreground hover:bg-muted flex h-8 items-center justify-center rounded-md border text-xs disabled:cursor-not-allowed disabled:opacity-50"
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
                            <span className="text-foreground text-xs font-semibold tracking-wide uppercase">
                              {t('pages.chainBuilder.branches')}
                            </span>
                            <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                              {stepBranches.length}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1">
                            {stepBranches.map((br) => (
                              <div
                                key={br.id}
                                className="border-secondary-200 bg-secondary-100 flex items-center justify-between rounded-md border px-2.5 py-1.5"
                              >
                                <span className="text-secondary-800 text-xs font-medium">
                                  →{' '}
                                  {(() => {
                                    const toStep = steps.find((s) => s.id === br.to_step_id)
                                    return toStep
                                      ? `${toStep.step_order}. ${toStep.target_action_name ?? t('pages.chainBuilder.taFallback', { id: toStep.target_action_id })}`
                                      : t('pages.chainBuilder.branchUnknownStep', {
                                          id: br.to_step_id,
                                        })
                                  })()}{' '}
                                  <span className="text-secondary-600 font-normal">
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
                                  className="text-secondary-500 hover:bg-secondary-100 hover:text-secondary-700 ml-2 flex h-4 w-4 items-center justify-center rounded-full"
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
                                className="border-border bg-muted text-muted-foreground hover:bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-md border"
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
                                      className="border-border bg-card text-foreground hover:bg-muted flex h-9 w-full items-center justify-between rounded-md border px-3 text-xs"
                                    >
                                      <span className="truncate">
                                        {newBranchConditions.size > 0
                                          ? Array.from(newBranchConditions)
                                              .map((id) => dvNameById.get(id) ?? `#${id}`)
                                              .join(', ')
                                          : t('pages.chainBuilder.conditionLeaf')}
                                      </span>
                                      <span
                                        className={`text-muted-foreground ml-2 transition-transform ${open ? 'rotate-180' : ''}`}
                                      >
                                        ▾
                                      </span>
                                    </button>
                                    {open && (
                                      <div className="border-border bg-card absolute z-10 mt-1 w-full rounded-md border py-1 shadow-lg">
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
                                                className="text-foreground hover:bg-muted flex w-full items-center justify-between px-3 py-1.5 text-xs"
                                              >
                                                <span>{dv.value}</span>
                                                {checked && (
                                                  <span className="text-muted-foreground">✓</span>
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
                      <div className="border-border border-t" />
                      <p className="text-muted-foreground py-2 text-center text-xs">
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
