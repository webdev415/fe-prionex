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

export function QuickPicksPage() {
  const { t } = useTranslation('common')
  const { user } = useAuthStore()
  const projectId = user?.active_project_id ? parseInt(user.active_project_id) : undefined

  const { data: departmentsData } = useDepartments({
    project_id: projectId,
    is_active: true,
    page_size: 100,
  })
  const departments = departmentsData?.departments ?? []

  const [selectedDeptId, setSelectedDeptId] = useState<string>('')
  const deptId = selectedDeptId ? parseInt(selectedDeptId, 10) : undefined

  const { data: chainsData } = useTAChains({ include_inactive: false })
  const chains = chainsData?.items ?? []

  const { data: tasData } = useTargetActions({ include_hidden: false })
  const taById = useMemo(() => {
    const m = new Map<number, TargetAction>()
    for (const ta of tasData?.items ?? []) m.set(ta.id, ta)
    return m
  }, [tasData])

  const { data: quickPicks, isLoading } = useQuickPicks(deptId)
  const createMut = useCreateQuickPick()
  const deleteMut = useDeleteQuickPick()

  // New template form state
  const [newChainId, setNewChainId] = useState<string>('')
  const [newName, setNewName] = useState('')
  const [newPresets, setNewPresets] = useState<Record<string, string>>({})

  // Get chain detail for step editor
  const newChainIdNum = newChainId ? parseInt(newChainId, 10) : null
  const { data: selectedChain } = useTAChain(newChainIdNum)

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
    <div className="flex w-full flex-col items-start gap-4">
      <h1 className="text-dark-500 text-2xl font-light">{t('pages.quickPicks.title')}</h1>
      <p className="text-sm text-gray-500">{t('pages.quickPicks.description')}</p>

      {/* Department picker */}
      <div className="flex w-full flex-col gap-1 sm:max-w-sm">
        <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
          <SelectTrigger>
            <SelectValue placeholder={t('pages.quickPicks.selectDepartment')} />
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

      {!deptId && (
        <div className="w-full rounded-lg border border-dashed border-gray-300 bg-white/60 p-10 text-center text-base text-gray-600">
          {t('pages.quickPicks.selectDepartmentHint')}
        </div>
      )}

      {deptId && (
        <div className="flex w-full flex-col gap-6 lg:max-w-2xl">
          {/* Existing templates */}
          {isLoading && <p className="text-sm text-gray-500">{t('common.loading')}</p>}

          {quickPicks && quickPicks.length === 0 && (
            <p className="text-sm text-gray-500">{t('pages.quickPicks.empty')}</p>
          )}

          <div className="flex flex-col gap-2">
            {(quickPicks ?? []).map((qp) => (
              <div
                key={qp.id}
                className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-800">
                      {qp.name ?? qp.chain_name ?? `Chain #${qp.chain_id}`}
                    </span>
                    {qp.name && (
                      <span className="text-xs text-gray-500">
                        {qp.chain_name ?? `Chain #${qp.chain_id}`}
                      </span>
                    )}
                  </div>
                  <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_SETTINGS}>
                    <button
                      type="button"
                      onClick={() => handleDelete(qp.id)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      {t('actions.delete')}
                    </button>
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
                          {ta?.name ?? `TA #${taId}`}: {String(val)}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add new template */}
          <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_SETTINGS}>
            <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <span className="text-sm font-semibold text-gray-700">
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
                <Label className="text-xs text-gray-600">{t('pages.quickPicks.selectChain')}</Label>
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
              {selectedChain && selectedChain.steps.length > 0 && (
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
                            {step.step_order}. {ta.name} ({ta.field_type})
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
                onClick={handleAdd}
                disabled={!newChainId || !newName.trim() || createMut.isPending}
              >
                <Icons.Add size={16} strokeWidth={2} />
                {t('pages.quickPicks.addButton')}
              </Button>
            </div>
          </PermissionGuard>
        </div>
      )}
    </div>
  )
}

export default QuickPicksPage
