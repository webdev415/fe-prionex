/**
 * Quick Picks management page — admin configures preset chain shortcuts.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
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
import { useTAChains } from '@/features/taChains/hooks/useTAChains'
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

  const { data: quickPicks, isLoading } = useQuickPicks(deptId)
  const createMut = useCreateQuickPick()
  const deleteMut = useDeleteQuickPick()

  const [newChainId, setNewChainId] = useState<string>('')

  const handleAdd = async () => {
    if (!newChainId || !deptId) return
    try {
      await createMut.mutateAsync({
        chain_id: parseInt(newChainId, 10),
        department_id: deptId,
      })
      setNewChainId('')
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

  // Chains already added as quick picks
  const pickedChainIds = new Set((quickPicks ?? []).map((qp) => qp.chain_id))
  const availableChains = chains.filter((c) => !pickedChainIds.has(c.id))

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
        <div className="flex w-full flex-col gap-4 sm:max-w-lg">
          {/* Current quick picks */}
          {isLoading && <p className="text-sm text-gray-500">{t('common.loading')}</p>}

          {quickPicks && quickPicks.length === 0 && (
            <p className="text-sm text-gray-500">{t('pages.quickPicks.empty')}</p>
          )}

          <div className="flex flex-col gap-2">
            {(quickPicks ?? []).map((qp) => (
              <div
                key={qp.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
                <span className="text-sm font-medium text-gray-800">
                  {qp.chain_name ?? `Chain #${qp.chain_id}`}
                </span>
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
            ))}
          </div>

          {/* Add new */}
          <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_SETTINGS}>
            <div className="flex gap-2">
              <Select value={newChainId} onValueChange={setNewChainId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={t('pages.quickPicks.selectChain')} />
                </SelectTrigger>
                <SelectContent>
                  {availableChains.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="primary"
                onClick={handleAdd}
                disabled={!newChainId || createMut.isPending}
              >
                <Icons.Add size={16} strokeWidth={2} />
              </Button>
            </div>
          </PermissionGuard>
        </div>
      )}
    </div>
  )
}

export default QuickPicksPage
