/**
 * TA Chains management page (KAN-318).
 *
 * Card-style list (matching the second design mockup): each card shows
 * the chain name, type/status badges, description, step count,
 * department, and admin actions (Edit / Clone / Activate-Deactivate).
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { LinkButton } from '@/components/ui/LinkButton'
import { DoubleButton } from '@/components/ui/DoubleButton'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/lib/icons'
import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import {
  useTAChains,
  useCloneTAChain,
  useActivateTAChain,
  useDeactivateTAChain,
} from '@/features/taChains/hooks/useTAChains'
import { useDepartments } from '@/features/departments/hooks/useDepartments'
import { useAuthStore } from '@/stores/authStore'
import type { TAChain } from '@/features/taChains/api/types'
import { CreateTAChainModal, DeleteTAChainModal, EditTAChainModal } from './components'
import { getErrorMessage } from '@/lib/errors'

const TYPE_BADGE: Record<string, string> = {
  manual: 'bg-blue-100 text-blue-700',
  automatic: 'bg-purple-100 text-purple-700',
}

export function TAChainsPage() {
  const { t } = useTranslation('common')
  const { user } = useAuthStore()
  const projectId = user?.active_project_id ? parseInt(user.active_project_id) : undefined

  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [chainToDelete, setChainToDelete] = useState<TAChain | null>(null)

  const { data, isLoading } = useTAChains({ include_inactive: showInactive })
  const { data: deptsData } = useDepartments({
    project_id: projectId,
    page_size: 100,
  })
  const deptNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const d of deptsData?.departments ?? []) m.set(d.id, d.name)
    return m
  }, [deptsData])

  const cloneMut = useCloneTAChain()
  const activateMut = useActivateTAChain()
  const deactivateMut = useDeactivateTAChain()

  const filtered = useMemo(() => {
    const items = data?.items ?? []
    if (!search.trim()) return items
    const q = search.toLowerCase().trim()
    return items.filter((c) => c.name.toLowerCase().includes(q))
  }, [data, search])

  const handleClone = async (c: TAChain) => {
    try {
      await cloneMut.mutateAsync(c.id)
      toast.success(t('pages.taChains.toasts.cloned'))
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const handleToggleActive = async (c: TAChain) => {
    try {
      if (c.is_active) {
        await deactivateMut.mutateAsync(c.id)
        toast.success(t('pages.taChains.toasts.deactivated'))
      } else {
        await activateMut.mutateAsync(c.id)
        toast.success(t('pages.taChains.toasts.activated'))
      }
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const handleDelete = (c: TAChain) => setChainToDelete(c)

  return (
    <div className="flex w-full flex-col items-start gap-4">
      <div className="mb-4 flex w-full flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-dark-500 text-2xl font-light">{t('pages.taChains.title')}</h1>
          <span className="text-sm text-gray-500">{filtered.length}</span>
        </div>

        <div className="flex w-full flex-wrap items-center gap-3 md:w-auto md:flex-nowrap md:justify-end">
          <label className="flex shrink-0 items-center gap-2 text-sm whitespace-nowrap text-gray-700">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            {t('pages.taChains.showInactive')}
          </label>
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('pages.taChains.searchPlaceholder')}
            className="w-full md:w-64"
          />
          <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_SETTINGS}>
            <DoubleButton
              size="md"
              className="shrink-0 whitespace-nowrap"
              icon={<Icons.Add size={20} strokeWidth={2} />}
              iconPosition="left"
              onClick={() => setShowCreate(true)}
            >
              {t('pages.taChains.createButton')}
            </DoubleButton>
          </PermissionGuard>
        </div>
      </div>

      {isLoading && <div className="text-sm text-gray-500">{t('common.loading')}</div>}

      {!isLoading && filtered.length === 0 && (
        <div className="w-full rounded-lg border border-dashed border-gray-300 bg-white/60 p-10 text-center text-base text-gray-600">
          {t('pages.taChains.empty')}
        </div>
      )}

      <ul className="flex w-full flex-col gap-3">
        {filtered.map((chain) => (
          <li
            key={chain.id}
            className={`flex flex-col gap-3 rounded-md border p-4 transition ${
              chain.is_active ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-70'
            }`}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-dark-500 text-base font-semibold">{chain.name}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      TYPE_BADGE[chain.chain_type] ?? 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {t(`pages.taChains.chainTypes.${chain.chain_type}`)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      chain.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {chain.is_active
                      ? t('pages.taChains.status.active')
                      : t('pages.taChains.status.deactivated')}
                  </span>
                  {chain.is_system_hidden && (
                    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
                      {t('pages.taChains.status.systemHidden')}
                    </span>
                  )}
                </div>

                {chain.description && (
                  <p className="mt-2 text-xs text-gray-600">{chain.description}</p>
                )}

                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-700">
                  <span>
                    <strong>{chain.step_count}</strong> {t('pages.taChains.steps.label')}
                  </span>
                  <span className="flex flex-wrap items-center gap-1">
                    <span>{t('pages.taChains.table.department')}:</span>
                    {chain.department_ids.length === 0 ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      chain.department_ids.map((id) => (
                        <span
                          key={id}
                          className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700"
                        >
                          {deptNameById.get(id) ?? `#${id}`}
                        </span>
                      ))
                    )}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-3 md:justify-end">
                <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_SETTINGS}>
                  {chain.is_active && (
                    <LinkButton
                      variant="regular-black"
                      size="xs"
                      onClick={() => setEditId(chain.id)}
                      leftIcon={<Icons.PencilEdit size={16} strokeWidth={1.5} />}
                    >
                      {t('actions.edit')}
                    </LinkButton>
                  )}
                  <LinkButton variant="regular-black" size="xs" onClick={() => handleClone(chain)}>
                    {t('pages.taChains.actions.clone')}
                  </LinkButton>
                  <LinkButton
                    variant="regular-black"
                    size="xs"
                    onClick={() => handleToggleActive(chain)}
                  >
                    {chain.is_active
                      ? t('pages.taChains.actions.deactivate')
                      : t('pages.taChains.actions.activate')}
                  </LinkButton>
                </PermissionGuard>
                <PermissionGuard permission={PERMISSIONS.TA_CHAINS.DELETE}>
                  <LinkButton
                    variant="regular-black"
                    size="xs"
                    onClick={() => handleDelete(chain)}
                    leftIcon={<Icons.Delete size={16} strokeWidth={1.5} />}
                  >
                    {t('pages.taChains.actions.delete', 'Delete')}
                  </LinkButton>
                </PermissionGuard>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {showCreate && (
        <CreateTAChainModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onSuccess={() => setShowCreate(false)}
        />
      )}

      {editId !== null && (
        <EditTAChainModal
          open={editId !== null}
          chainId={editId}
          onClose={() => setEditId(null)}
          onSuccess={() => setEditId(null)}
        />
      )}

      <DeleteTAChainModal
        open={chainToDelete !== null}
        chain={chainToDelete}
        onClose={() => setChainToDelete(null)}
      />
    </div>
  )
}

export default TAChainsPage
