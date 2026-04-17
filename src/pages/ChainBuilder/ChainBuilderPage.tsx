/**
 * Visual Chain Builder page (Chain Builder ticket).
 *
 * Two-panel layout:
 *   Left:  React Flow canvas showing steps as nodes, sequential + branch edges
 *   Right: Config panel for selected step/chain (triggers, blockers, effects, branches)
 *
 * Admin picks a chain from a dropdown, the canvas renders its steps and branches.
 */

import { useCallback, useEffect, useState } from 'react'
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
import { useTAChains, useTAChain } from '@/features/taChains/hooks/useTAChains'
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

export function ChainBuilderPage() {
  const { t } = useTranslation('common')
  const { user } = useAuthStore()
  const projectId = user?.active_project_id ? parseInt(user.active_project_id) : undefined

  const { data: chainsData } = useTAChains({ include_inactive: false })
  const chains = chainsData?.items ?? []

  // Reference data for dropdowns
  const { data: tagsList } = useTags(projectId)
  const tags = tagsList ?? []
  const { data: smsTemplatesData } = useSMSTemplates(
    projectId ? { project_id: projectId } : undefined
  )
  const smsTemplates = smsTemplatesData?.templates ?? []

  // Pretty-print config — replace IDs with names where possible
  const formatConfig = (config: Record<string, unknown>): string => {
    if (!config || Object.keys(config).length === 0) return ''
    const parts: string[] = []
    for (const [key, value] of Object.entries(config)) {
      if (key === 'tag_id') {
        const tag = tags.find((t) => t.id === Number(value))
        parts.push(`tag: ${tag?.name ?? `#${value}`}`)
      } else if (key === 'sms_template_id') {
        const tpl = smsTemplates.find((t) => t.id === Number(value))
        parts.push(`template: ${tpl?.name ?? `#${value}`}`)
      } else if (key === 'source_chain_id' || key === 'blocking_chain_id') {
        const c = chains.find((c) => c.id === Number(value))
        parts.push(`chain: ${c?.name ?? `#${value}`}`)
      } else {
        parts.push(`${key}: ${value}`)
      }
    }
    return parts.join(' · ')
  }

  const [selectedChainId, setSelectedChainId] = useState<number | null>(null)
  const { data: chain } = useTAChain(selectedChainId)
  const { data: builderData } = useBuilderData(selectedChainId)

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
  const [newEffectConfig, setNewEffectConfig] = useState<Record<string, string>>({})
  const [newBranchTo, setNewBranchTo] = useState('')

  const steps: TAChainStep[] = chain?.steps ?? []
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
      position: { x: 250, y: idx * 120 + 50 },
      data: {
        label: `${step.step_order}. ${step.target_action_name ?? 'TA #' + step.target_action_id}`,
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
            stroke: br.condition_leaf_id === null ? '#f59e0b' : '#8b5cf6',
            strokeWidth: 2,
            strokeDasharray: '5,5',
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: br.condition_leaf_id === null ? '#f59e0b' : '#8b5cf6',
          },
          label: br.condition_leaf_id === null ? 'else' : `leaf #${br.condition_leaf_id}`,
          labelStyle: { fontSize: 10, fill: '#6b7280' },
        })
      }
    }

    setNodes(flowNodes)
    setEdges(flowEdges)
  }, [chain, builderData, selectedStepId])

  const onNodeClick = useCallback((_: unknown, node: Node) => {
    const stepId = parseInt(node.id.replace('step-', ''), 10)
    setSelectedStepId(stepId)
  }, [])

  const stepEffects = builderData?.effects.filter((e) => e.step_id === selectedStepId) ?? []
  const stepBranches = builderData?.branches.filter((b) => b.from_step_id === selectedStepId) ?? []

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
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('pages.chainBuilder.selectChain')} />
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
                        <span className="text-xs font-medium text-blue-800">{tr.trigger_type}</span>
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
                        title="Remove"
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
                      {TRIGGER_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
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
                        <SelectValue placeholder="Select tag..." />
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
                        <SelectValue placeholder="Select source chain..." />
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
                      placeholder="Result code"
                      value={newTriggerConfig.result_code ?? ''}
                      onChange={(e) => setNewTriggerConfig({ result_code: e.target.value })}
                    />
                  )}
                  {newTriggerType === 'debt_status' && (
                    <input
                      className="h-8 rounded-md border border-gray-200 px-2 text-xs"
                      placeholder="Status (e.g. overdue)"
                      value={newTriggerConfig.status ?? ''}
                      onChange={(e) => setNewTriggerConfig({ status: e.target.value })}
                    />
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      const cfg: Record<string, unknown> = {}
                      if (newTriggerConfig.tag_id) cfg.tag_id = parseInt(newTriggerConfig.tag_id)
                      if (newTriggerConfig.source_chain_id)
                        cfg.source_chain_id = parseInt(newTriggerConfig.source_chain_id)
                      if (newTriggerConfig.result_code)
                        cfg.result_code = newTriggerConfig.result_code
                      if (newTriggerConfig.status) cfg.status = newTriggerConfig.status
                      try {
                        await createTrigger.mutateAsync({
                          trigger_type: newTriggerType,
                          config: cfg,
                        })
                        toast.success('Trigger added')
                        setNewTriggerConfig({})
                      } catch (e) {
                        toast.error(getErrorMessage(e))
                      }
                    }}
                    className="flex h-8 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-xs text-gray-600 hover:bg-gray-100"
                  >
                    + Add trigger
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
                        <span className="text-xs font-medium text-red-800">{bl.blocker_type}</span>
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
                        title="Remove"
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
                      {BLOCKER_TYPES.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {newBlockerType === 'launched_within' && (
                    <input
                      className="h-8 rounded-md border border-gray-200 px-2 text-xs"
                      placeholder="Days (e.g. 30)"
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
                        <SelectValue placeholder="Select blocking chain..." />
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
                        <SelectValue placeholder="Select tag..." />
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
                      if (newBlockerConfig.days) cfg.days = parseInt(newBlockerConfig.days)
                      if (newBlockerConfig.blocking_chain_id)
                        cfg.blocking_chain_id = parseInt(newBlockerConfig.blocking_chain_id)
                      if (newBlockerConfig.tag_id) cfg.tag_id = parseInt(newBlockerConfig.tag_id)
                      try {
                        await createBlocker.mutateAsync({
                          blocker_type: newBlockerType,
                          config: cfg,
                        })
                        toast.success('Blocker added')
                        setNewBlockerConfig({})
                      } catch (e) {
                        toast.error(getErrorMessage(e))
                      }
                    }}
                    className="flex h-8 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-xs text-gray-600 hover:bg-gray-100"
                  >
                    + Add blocker
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
                          {t('pages.chainBuilder.delay')}: {selectedStep.delay_minutes} min
                        </span>
                        <span>
                          {t('pages.chainBuilder.required')}:{' '}
                          {selectedStep.is_required ? 'Yes' : 'No'}
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
                                {ef.effect_type}
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
                              title="Remove"
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
                            {EFFECT_TYPES.map((e) => (
                              <SelectItem key={e} value={e}>
                                {e}
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
                              <SelectValue placeholder="Select tag..." />
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
                        {newEffectType === 'send_sms' && (
                          <Select
                            value={newEffectConfig.sms_template_id ?? ''}
                            onValueChange={(v) =>
                              setNewEffectConfig({ ...newEffectConfig, sms_template_id: v })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select SMS template..." />
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
                            <input
                              className="h-8 rounded-md border border-gray-200 px-2 text-xs text-gray-800"
                              placeholder="Task title"
                              value={newEffectConfig.title ?? ''}
                              onChange={(e) =>
                                setNewEffectConfig({ ...newEffectConfig, title: e.target.value })
                              }
                            />
                            <select
                              className="h-8 rounded-md border border-gray-200 px-2 text-xs text-gray-800"
                              value={newEffectConfig.priority ?? 'medium'}
                              onChange={(e) =>
                                setNewEffectConfig({ ...newEffectConfig, priority: e.target.value })
                              }
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                            </select>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            const cfg: Record<string, unknown> = {}
                            if (newEffectConfig.tag_id)
                              cfg.tag_id = parseInt(newEffectConfig.tag_id)
                            if (newEffectConfig.sms_template_id)
                              cfg.sms_template_id = parseInt(newEffectConfig.sms_template_id)
                            if (newEffectConfig.title) cfg.title = newEffectConfig.title
                            if (newEffectConfig.priority) cfg.priority = newEffectConfig.priority
                            try {
                              await createEffect.mutateAsync({
                                step_id: selectedStep.id,
                                effect_type: newEffectType,
                                config: cfg,
                              })
                              toast.success('Effect added')
                              setNewEffectConfig({})
                            } catch (e) {
                              toast.error(getErrorMessage(e))
                            }
                          }}
                          className="flex h-8 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-xs text-gray-600 hover:bg-gray-100"
                        >
                          + Add effect
                        </button>
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
                              → step #{br.to_step_id}{' '}
                              <span className="font-normal text-purple-600">
                                {br.condition_leaf_id === null
                                  ? '(else)'
                                  : `(leaf #${br.condition_leaf_id})`}
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
                              title="Remove"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
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
                                  {s.step_order}. {s.target_action_name}
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
                              })
                              toast.success('Branch added (else)')
                              setNewBranchTo('')
                            } catch (e) {
                              toast.error(getErrorMessage(e))
                            }
                          }}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"
                        >
                          +
                        </button>
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
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChainBuilderPage
