/**
 * Quick Picks management page — admin creates named templates with pre-filled step values.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Icons } from '@/lib/icons'
import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import { useTAChains, useTAChain } from '@/features/taChains/hooks/useTAChains'
import { useTargetActions } from '@/features/targetActions/hooks/useTargetActions'
import type { TargetAction } from '@/features/targetActions/api/types'
import { useDepartments } from '@/features/departments/hooks/useDepartments'
import {
  useQuickPicks,
  useCreateQuickPick,
  useDeleteQuickPick,
} from '@/features/quickPicks/hooks/useQuickPicks'
import { useAuthStore } from '@/stores/authStore'
import { getErrorMessage } from '@/lib/errors'

function QuickPicksListSkeleton({ ariaLabel }: { ariaLabel: string }) {
  return (
    <div
      className="flex min-h-[280px] flex-col gap-2"
      role="status"
      aria-busy="true"
      aria-label={ariaLabel}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="h-[18px] w-[58%] max-w-xs animate-pulse rounded-md bg-gray-200" />
              <div className="h-3 w-[42%] max-w-[200px] animate-pulse rounded bg-gray-100" />
            </div>
            <div className="h-4 w-12 shrink-0 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="h-5 w-[4.5rem] animate-pulse rounded bg-gray-100" />
            <div className="h-5 w-24 animate-pulse rounded bg-gray-100" />
            <div className="h-5 w-20 animate-pulse rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

function QuickPicksPresetsSkeleton({ ariaLabel }: { ariaLabel: string }) {
  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-dashed border-gray-200 bg-white/90 p-3 shadow-inner"
      role="status"
      aria-busy="true"
      aria-label={ariaLabel}
    >
      <div className="h-3 w-48 animate-pulse rounded bg-gray-200" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="h-2.5 w-[72%] max-w-md animate-pulse rounded bg-gray-100" />
          <div className="h-8 w-full animate-pulse rounded-md border border-gray-200/80 bg-gradient-to-r from-gray-50 via-gray-100/80 to-gray-50" />
        </div>
      ))}
    </div>
  )
}

export function QuickPicksPage() {
  const { t } = useTranslation('common')
  const { user } = useAuthStore()
  const projectId = user?.active_project_id ? parseInt(user.active_project_id, 10) : undefined

  const { data: departmentsData, isPending: departmentsPending } = useDepartments({
    project_id: projectId,
    is_active: true,
    page_size: 100,
  })
  const departments = departmentsData?.departments ?? []

  const [selectedDeptId, setSelectedDeptId] = useState<string>('')
  const deptId = selectedDeptId ? parseInt(selectedDeptId, 10) : undefined

  const { data: chainsData } = useTAChains({ include_inactive: false })
  const chains = useMemo(() => chainsData?.items ?? [], [chainsData?.items])

  const { data: tasData } = useTargetActions({ include_hidden: false })
  const taById = useMemo(() => {
    const m = new Map<number, TargetAction>()
    for (const ta of tasData?.items ?? []) m.set(ta.id, ta)
    return m
  }, [tasData])

  const { data: quickPicks, isPending: quickPicksPending } = useQuickPicks(deptId)
  const createMut = useCreateQuickPick()
  const deleteMut = useDeleteQuickPick()

  // New template form state
  const [newChainId, setNewChainId] = useState<string>('')
  const [newName, setNewName] = useState('')
  const [newPresets, setNewPresets] = useState<Record<string, string>>({})

  // Get chain detail for step editor
  const newChainIdNum = newChainId ? parseInt(newChainId, 10) : null
  const { data: selectedChain, isPending: chainStepsPending } = useTAChain(newChainIdNum)

  const handleChainSelect = (chainId: string) => {
    setNewChainId(chainId)
    setNewPresets({})
    setNewName('')
  }

  const handleAdd = async () => {
    if (!newChainId || !deptId || !newName.trim()) return
    try {
      // Filter out empty preset values
      const presets: Record<string, string> = {}
      for (const [k, v] of Object.entries(newPresets)) {
        if (v.trim()) presets[k] = v.trim()
      }
      await createMut.mutateAsync({
        chain_id: parseInt(newChainId, 10),
        department_id: deptId,
        name: newName.trim(),
        preset_values: Object.keys(presets).length > 0 ? presets : undefined,
      })
      setNewChainId('')
      setNewName('')
      setNewPresets({})
      toast.success(t('pages.quickPicks.toasts.added'))
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteMut.mutateAsync(id)
      toast.success(t('pages.quickPicks.toasts.removed'))
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <div className="mx-auto flex w-full flex-col gap-6">
      {/* Title + intro + department — uses horizontal space on large screens */}
      <div className="flex flex-col gap-4 border-b border-gray-100 pb-6">
        <h1 className="text-dark-500 text-2xl font-light">{t('pages.quickPicks.title')}</h1>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
          <p className="max-w-3xl text-sm leading-relaxed text-gray-500">
            {t('pages.quickPicks.description')}
          </p>
          <div className="w-full shrink-0 lg:max-w-xs">
            <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    departmentsPending && departments.length === 0
                      ? t('pages.quickPicks.loadingDepartments')
                      : t('pages.quickPicks.selectDepartment')
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {!deptId && (
        <div className="w-full rounded-lg border border-dashed border-gray-300 bg-gradient-to-br from-gray-50/80 to-white p-10 text-center text-base text-gray-600">
          {t('pages.quickPicks.selectDepartmentHint')}
        </div>
      )}

      {deptId && (
        <div className="flex w-full flex-col gap-8 xl:flex-row xl:items-start xl:gap-10">
          {/* Templates list — grows; on xl sits beside the form */}
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {quickPicksPending && (
              <QuickPicksListSkeleton ariaLabel={t('pages.quickPicks.loadingTemplates')} />
            )}

            {!quickPicksPending && quickPicks && quickPicks.length === 0 && (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-6 py-10 text-center">
                <p className="text-sm text-gray-500">{t('pages.quickPicks.empty')}</p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {(quickPicks ?? []).map((qp) => (
                <div
                  key={qp.id}
                  className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 flex-col">
                      <span className="text-sm font-medium text-gray-800">
                        {qp.name ??
                          qp.chain_name ??
                          t('pages.quickPicks.chainFallback', { id: qp.chain_id })}
                      </span>
                      {qp.name && (
                        <span className="text-xs text-gray-500">
                          {qp.chain_name ??
                            t('pages.quickPicks.chainFallback', { id: qp.chain_id })}
                        </span>
                      )}
                    </div>
                    <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_SETTINGS}>
                      <Button
                        type="button"
                        variant="danger"
                        size="xs"
                        className="shrink-0 self-start sm:self-auto"
                        onClick={() => handleDelete(qp.id)}
                        disabled={deleteMut.isPending}
                      >
                        {t('actions.delete')}
                      </Button>
                    </PermissionGuard>
                  </div>
                  {qp.preset_values && Object.keys(qp.preset_values).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(qp.preset_values).map(([taId, val]) => {
                        const ta = taById.get(parseInt(taId, 10))
                        return (
                          <span
                            key={taId}
                            className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600"
                          >
                            {t('pages.quickPicks.presetChip', {
                              label: ta?.name ?? t('pages.quickPicks.taFallback', { id: taId }),
                              value: String(val),
                            })}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Add new template — fixed comfortable width on xl; hidden if no permission */}
          <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_SETTINGS}>
            <div className="w-full shrink-0 xl:sticky xl:top-2 xl:w-[min(100%,24rem)]">
              <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50/90 p-5 shadow-sm">
                <span className="text-sm font-semibold text-gray-800">
                  {t('pages.quickPicks.addTemplate')}
                </span>

                {/* Template name */}
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-gray-600">
                    {t('pages.quickPicks.templateName')}
                  </Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={t('pages.quickPicks.templateNamePlaceholder')}
                    maxLength={150}
                  />
                </div>

                {/* Chain picker */}
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-gray-600">
                    {t('pages.quickPicks.selectChain')}
                  </Label>
                  <Select value={newChainId} onValueChange={handleChainSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('pages.quickPicks.selectChain')} />
                    </SelectTrigger>
                    <SelectContent>
                      {chains.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Step preset values */}
                {newChainId && chainStepsPending && (
                  <QuickPicksPresetsSkeleton ariaLabel={t('pages.quickPicks.loadingStepPresets')} />
                )}

                {selectedChain && selectedChain.steps.length > 0 && !chainStepsPending && (
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs text-gray-600">
                      {t('pages.quickPicks.presetValues')}
                    </Label>
                    {selectedChain.steps
                      .sort((a, b) => a.step_order - b.step_order)
                      .map((step) => {
                        const ta = taById.get(step.target_action_id)
                        if (!ta) return null
                        const taIdStr = String(step.target_action_id)
                        return (
                          <div key={step.id} className="flex flex-col gap-1">
                            <label className="text-[11px] text-gray-500">
                              {step.step_order}. {ta.name} (
                              {t(`pages.targetActions.fieldTypes.${ta.field_type}`, {
                                defaultValue: ta.field_type,
                              })}
                              )
                            </label>
                            {ta.field_type === 'dropdown' ? (
                              <select
                                value={newPresets[taIdStr] ?? ''}
                                onChange={(e) =>
                                  setNewPresets((prev) => ({ ...prev, [taIdStr]: e.target.value }))
                                }
                                className="h-8 rounded border border-gray-200 px-2 text-xs text-gray-700"
                              >
                                <option value="">{t('pages.quickPicks.leaveEmpty')}</option>
                                {ta.dropdown_values
                                  .filter((dv) => !dv.is_hidden)
                                  .map((dv) => (
                                    <option key={dv.id} value={dv.value}>
                                      {dv.value}
                                    </option>
                                  ))}
                              </select>
                            ) : ta.field_type === 'date' ? (
                              <Input
                                type="date"
                                value={newPresets[taIdStr] ?? ''}
                                onChange={(e) =>
                                  setNewPresets((prev) => ({ ...prev, [taIdStr]: e.target.value }))
                                }
                                className="h-8 text-xs"
                              />
                            ) : ta.field_type === 'amount' ? (
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                placeholder={t('pages.quickPicks.leaveEmpty')}
                                value={newPresets[taIdStr] ?? ''}
                                onChange={(e) =>
                                  setNewPresets((prev) => ({ ...prev, [taIdStr]: e.target.value }))
                                }
                                className="h-8 text-xs"
                              />
                            ) : ta.field_type === 'credit' ? (
                              <span className="text-[10px] text-gray-400 italic">
                                {t('pages.quickPicks.creditAutoFill')}
                              </span>
                            ) : (
                              <Input
                                type="text"
                                placeholder={t('pages.quickPicks.leaveEmpty')}
                                value={newPresets[taIdStr] ?? ''}
                                onChange={(e) =>
                                  setNewPresets((prev) => ({ ...prev, [taIdStr]: e.target.value }))
                                }
                                className="h-8 text-xs"
                              />
                            )}
                          </div>
                        )
                      })}
                  </div>
                )}

                <Button
                  variant="primary"
                  className="w-full"
                  onClick={handleAdd}
                  disabled={!newChainId || !newName.trim() || createMut.isPending}
                >
                  <Icons.Add size={16} strokeWidth={2} />
                  {t('pages.quickPicks.addButton')}
                </Button>
              </div>
            </div>
          </PermissionGuard>
        </div>
      )}
    </div>
  )
}

export default QuickPicksPage
