/**
 * Repayment & Write-off Configuration Page (KAN-246)
 *
 * Admin/Supervisor-only settings window to configure the global repayment
 * order and per-component write-off enable/disable rules.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { Icons } from '@/lib/icons'
import { useHasPermission } from '@/hooks'
import { PERMISSIONS } from '@/constants/permissions'
import {
  repaymentConfigKeys,
  useRepaymentConfig,
  useRepaymentConfigHistory,
  useUpdateRepaymentConfig,
  type Algorithm,
  type RepaymentComponent,
} from '@/features/repaymentConfig'

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const COMPONENTS: RepaymentComponent[] = [
  'principal',
  'interest',
  'commission',
  'penalties',
  'fines',
]

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

function recordsEqual(a: Record<string, boolean>, b: Record<string, boolean>): boolean {
  return Object.keys(a).every((k) => a[k] === b[k])
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

// ──────────────────────────────────────────────────────────────────────────────
// DraggableOrderList sub-component
// ──────────────────────────────────────────────────────────────────────────────

interface DraggableOrderListProps {
  order: RepaymentComponent[]
  labels: Record<RepaymentComponent, string>
  disabled: boolean
  onChange: (newOrder: RepaymentComponent[]) => void
}

function DraggableOrderList({ order, labels, disabled, onChange }: DraggableOrderListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDragIndex(idx)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (idx !== dropIndex) setDropIndex(idx)
  }

  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === idx) {
      setDragIndex(null)
      setDropIndex(null)
      return
    }
    const newOrder = [...order]
    const [moved] = newOrder.splice(dragIndex, 1)
    newOrder.splice(idx, 0, moved)
    onChange(newOrder)
    setDragIndex(null)
    setDropIndex(null)
  }

  const handleDragEnd = () => {
    setDragIndex(null)
    setDropIndex(null)
  }

  const moveUp = (idx: number) => {
    if (idx === 0) return
    const newOrder = [...order]
    ;[newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]]
    onChange(newOrder)
  }

  const moveDown = (idx: number) => {
    if (idx === order.length - 1) return
    const newOrder = [...order]
    ;[newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]]
    onChange(newOrder)
  }

  return (
    <ol className="space-y-2">
      {order.map((component, idx) => (
        <li
          key={component}
          draggable={!disabled}
          onDragStart={(e) => !disabled && handleDragStart(e, idx)}
          onDragOver={(e) => !disabled && handleDragOver(e, idx)}
          onDrop={(e) => !disabled && handleDrop(e, idx)}
          onDragEnd={handleDragEnd}
          className={cn(
            'flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 transition-colors',
            !disabled && 'cursor-grab active:cursor-grabbing',
            dragIndex === idx && 'opacity-40',
            dropIndex === idx && dragIndex !== idx && 'border-primary-500 bg-primary-50',
            disabled && 'opacity-70'
          )}
        >
          {/* Position number */}
          <span className="w-5 text-center text-sm font-semibold text-gray-500">{idx + 1}</span>

          {/* Drag handle */}
          {!disabled && (
            <span className="flex-shrink-0 text-gray-500">
              <Icons.Sorting01Icon size={18} />
            </span>
          )}

          {/* Component label */}
          <span className="text-dark-500 flex-1 text-sm font-medium">{labels[component]}</span>

          {/* Up/Down buttons for keyboard accessibility */}
          {!disabled && (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => moveUp(idx)}
                disabled={idx === 0}
                aria-label={`Move ${labels[component]} up`}
                className={cn(
                  'rounded p-1 transition-colors',
                  idx === 0
                    ? 'cursor-not-allowed opacity-30'
                    : 'hover:bg-gray-100 active:bg-gray-200'
                )}
              >
                <Icons.ArrowUp size={16} />
              </button>
              <button
                type="button"
                onClick={() => moveDown(idx)}
                disabled={idx === order.length - 1}
                aria-label={`Move ${labels[component]} down`}
                className={cn(
                  'rounded p-1 transition-colors',
                  idx === order.length - 1
                    ? 'cursor-not-allowed opacity-30'
                    : 'hover:bg-gray-100 active:bg-gray-200'
                )}
              >
                <Icons.ArrowDown size={16} />
              </button>
            </div>
          )}
        </li>
      ))}
    </ol>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────────────────────────────────────

export function RepaymentConfigurationPage() {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()

  const canEdit = useHasPermission(PERMISSIONS.REPAYMENT_CONFIG.EDIT)

  const { data, isLoading, isError } = useRepaymentConfig()
  const { data: historyData } = useRepaymentConfigHistory({ page: 1, page_size: 5 })
  const updateMutation = useUpdateRepaymentConfig()

  // ── Local form state ──────────────────────────────────────────────────────

  const [localOrder, setLocalOrder] = useState<RepaymentComponent[]>(COMPONENTS)
  const [localWriteoff, setLocalWriteoff] = useState<Record<RepaymentComponent, boolean>>(
    Object.fromEntries(COMPONENTS.map((c) => [c, true])) as Record<RepaymentComponent, boolean>
  )
  const [localAlgorithm, setLocalAlgorithm] = useState<Algorithm>('legacy_proportional')
  const [showActivateModal, setShowActivateModal] = useState(false)
  const [showDeactivateModal, setShowDeactivateModal] = useState(false)

  // Track which server version we have initialised local state from.
  // Calling setState during render (when the condition changes) is the React-
  // recommended pattern for "derived state": React re-renders immediately
  // without committing the intermediate DOM. See:
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [syncedVersion, setSyncedVersion] = useState<number | null>(null)
  if (data && data.version !== syncedVersion) {
    setSyncedVersion(data.version)
    setLocalOrder(data.repayment_order)
    setLocalWriteoff(data.writeoff_enabled)
    setLocalAlgorithm(data.algorithm)
  }

  // ── Dirty detection ───────────────────────────────────────────────────────

  const isDirty =
    data != null &&
    (!arraysEqual(localOrder, data.repayment_order) ||
      !recordsEqual(localWriteoff, data.writeoff_enabled) ||
      localAlgorithm !== data.algorithm)

  // ── Labels ────────────────────────────────────────────────────────────────

  const componentLabels: Record<RepaymentComponent, string> = {
    principal: t('pages.repaymentConfiguration.repaymentOrder.component_principal', 'Principal'),
    interest: t('pages.repaymentConfiguration.repaymentOrder.component_interest', 'Interest'),
    commission: t('pages.repaymentConfiguration.repaymentOrder.component_commission', 'Commission'),
    penalties: t('pages.repaymentConfiguration.repaymentOrder.component_penalties', 'Penalties'),
    fines: t('pages.repaymentConfiguration.repaymentOrder.component_fines', 'Fines'),
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleWriteoffToggle = (component: RepaymentComponent, checked: boolean) => {
    setLocalWriteoff((prev) => ({ ...prev, [component]: checked }))
  }

  const handleCancel = () => {
    if (data) {
      setLocalOrder(data.repayment_order)
      setLocalWriteoff(data.writeoff_enabled)
      setLocalAlgorithm(data.algorithm)
    }
  }

  const handleSave = async () => {
    if (!data) return
    try {
      await updateMutation.mutateAsync({
        algorithm: localAlgorithm,
        repayment_order: localOrder,
        writeoff_enabled: localWriteoff,
        version: data.version,
      })
      toast.success(
        t('pages.repaymentConfiguration.saveSuccess', 'Configuration saved successfully')
      )
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number; data?: { detail?: string } } })
        ?.response?.status
      const detail = String(
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? ''
      ).toLowerCase()

      if (status === 409) {
        if (
          detail.includes('precondition') ||
          detail.includes('activation') ||
          detail.includes('cannot activate') ||
          detail.includes('readiness') ||
          detail.includes('backfill') ||
          detail.includes('snapshot') ||
          detail.includes('unsnapshotted')
        ) {
          toast.error(
            t(
              'pages.repaymentConfiguration.algorithm.preconditionError',
              'Strict Order cannot be activated: snapshotting must be globally enabled and all existing payments must be backfilled.'
            )
          )
          // Revert local algorithm if the error is an activation guard
          setLocalAlgorithm('legacy_proportional')
        } else {
          toast.error(
            t(
              'pages.repaymentConfiguration.conflictError',
              'Configuration was changed by another user. Reloading latest version.'
            )
          )
          queryClient.invalidateQueries({ queryKey: repaymentConfigKeys.all })
        }
      } else {
        toast.error(t('pages.repaymentConfiguration.saveError', 'Failed to save configuration'))
      }
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Icons.Spinner />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-red-500">
        {t('status.error', 'Failed to load configuration')}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-dark-500 text-xl font-light sm:text-2xl">
            {t('pages.repaymentConfiguration.title', 'Repayment & Write-off Configuration')}
          </h1>
          <p className="text-dark-400 mt-1 text-sm font-light">
            {t(
              'pages.repaymentConfiguration.description',
              'Configure how payments are distributed across debt components and manage write-off rules.'
            )}
          </p>
          <p className="mt-2 text-xs text-gray-500">
            {t('pages.repaymentConfiguration.lastUpdated', 'Last updated')}{' '}
            {formatDate(data.updated_at)} {t('pages.repaymentConfiguration.by', 'by')}{' '}
            <span className="font-medium">{data.updated_by_username}</span>
          </p>
        </div>
      </div>

      {!canEdit && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {t(
            'pages.repaymentConfiguration.readOnly',
            'You have view-only access to this configuration.'
          )}
        </div>
      )}

      {/* ── Repayment Order ── */}
      <section className="space-y-4 rounded-xl border border-gray-200 bg-white/50 p-6">
        <div>
          <h2 className="text-dark-500 text-base font-medium sm:text-lg">
            {t('pages.repaymentConfiguration.repaymentOrder.title', 'Repayment Order')}
          </h2>
          <p className="text-dark-400 mt-1 text-sm font-light">
            {t(
              'pages.repaymentConfiguration.repaymentOrder.description',
              'Drag to reorder how payments are distributed across debt components. Each component is fully consumed before moving to the next.'
            )}
          </p>
        </div>

        <DraggableOrderList
          order={localOrder}
          labels={componentLabels}
          disabled={!canEdit}
          onChange={setLocalOrder}
        />
      </section>

      {/* ── Write-off Rules ── */}
      <section className="space-y-4 rounded-xl border border-gray-200 bg-white/50 p-6">
        <div>
          <h2 className="text-dark-500 text-base font-medium sm:text-lg">
            {t('pages.repaymentConfiguration.writeoffRules.title', 'Write-off Rules')}
          </h2>
          <p className="text-dark-400 mt-1 text-sm font-light">
            {t(
              'pages.repaymentConfiguration.writeoffRules.description',
              'Enable or disable the creation of new write-off entries per component. Applies to manual operator write-offs only.'
            )}
          </p>
        </div>

        <div className="space-y-3">
          {COMPONENTS.map((component) => (
            <div
              key={component}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
            >
              <span className="text-dark-500 text-sm font-medium">
                {componentLabels[component]}
              </span>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'text-sm font-medium',
                    localWriteoff[component] ? 'text-success-600' : 'text-gray-400'
                  )}
                >
                  {localWriteoff[component]
                    ? t('pages.repaymentConfiguration.writeoffRules.enabled', 'Enabled')
                    : t('pages.repaymentConfiguration.writeoffRules.disabled', 'Disabled')}
                </span>
                <ToggleSwitch
                  checked={localWriteoff[component] ?? true}
                  onChange={(checked) => handleWriteoffToggle(component, checked)}
                  disabled={!canEdit}
                  ariaLabel={`Toggle write-off for ${componentLabels[component]}`}
                />
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-500">
          {t(
            'pages.repaymentConfiguration.writeoffRules.vendorNote',
            'Note: applies to manual write-offs only. Vendor import write-offs are unaffected.'
          )}
        </p>
      </section>

      {/* ── Allocation Algorithm ── */}
      <section className="space-y-4 rounded-xl border border-gray-200 bg-white/50 p-6">
        <div>
          <h2 className="text-dark-500 text-base font-medium sm:text-lg">
            {t('pages.repaymentConfiguration.algorithm.title', 'Allocation Algorithm')}
          </h2>
        </div>

        <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3">
          <div className="flex-1">
            <p className="text-dark-500 text-sm font-medium">
              {localAlgorithm === 'legacy_proportional'
                ? t(
                    'pages.repaymentConfiguration.algorithm.legacy_proportional',
                    'Legacy Proportional'
                  )
                : t('pages.repaymentConfiguration.algorithm.strict_order', 'Strict Order')}
            </p>
            <p className="text-dark-400 mt-0.5 text-sm font-light">
              {localAlgorithm === 'legacy_proportional'
                ? t(
                    'pages.repaymentConfiguration.algorithm.legacyDescription',
                    'Payments use the legacy proportional algorithm. Activate Strict Order to apply the configured sequence to future snapshots.'
                  )
                : t(
                    'pages.repaymentConfiguration.algorithm.strictDescription',
                    'Payments are distributed in the configured order above. Each component is fully consumed before the next.'
                  )}
            </p>
          </div>

          {canEdit && (
            <div>
              {localAlgorithm === 'legacy_proportional' ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-md"
                  onClick={() => setShowActivateModal(true)}
                >
                  {t(
                    'pages.repaymentConfiguration.algorithm.activateButton',
                    'Activate Strict Order'
                  )}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-md"
                  onClick={() => setShowDeactivateModal(true)}
                >
                  {t('pages.repaymentConfiguration.algorithm.deactivateButton', 'Revert to Legacy')}
                </Button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Config Change History (last 5) ── */}
      {historyData && historyData.items.length > 0 && (
        <section className="space-y-3 rounded-xl border border-gray-200 bg-white/50 p-6">
          <h2 className="text-dark-500 text-base font-medium sm:text-lg">
            {t('pages.repaymentConfiguration.history.title', 'Recent Changes')}
          </h2>
          <div className="space-y-2">
            {historyData.items.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm"
              >
                <span className="text-gray-500">
                  {t('pages.repaymentConfiguration.history.version', 'Version')}{' '}
                  {entry.config_version}
                </span>
                <span className="text-dark-500 font-medium">{entry.changed_by_username}</span>
                <span className="text-gray-500">{formatDate(entry.created_at)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Save / Cancel ── */}
      {canEdit && (
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
          <Button
            variant="cancel"
            className="rounded-md"
            onClick={handleCancel}
            disabled={!isDirty || updateMutation.isPending}
          >
            {t('pages.repaymentConfiguration.cancel', 'Cancel')}
          </Button>
          <Button
            variant="primary"
            className="rounded-md"
            onClick={handleSave}
            disabled={!isDirty || updateMutation.isPending}
            isLoading={updateMutation.isPending}
          >
            {updateMutation.isPending
              ? t('pages.repaymentConfiguration.saving', 'Saving...')
              : t('pages.repaymentConfiguration.save', 'Save Changes')}
          </Button>
        </div>
      )}

      {/* ── Activate Strict Order confirmation modal ── */}
      <Modal open={showActivateModal} onClose={() => setShowActivateModal(false)}>
        <ModalHeader
          title={t(
            'pages.repaymentConfiguration.algorithm.activateConfirmTitle',
            'Activate Strict Order?'
          )}
          onClose={() => setShowActivateModal(false)}
        />
        <ModalContent>
          <p className="text-sm">
            {t(
              'pages.repaymentConfiguration.algorithm.activateConfirmMessage',
              'This will change how future payments are allocated. All payments snapshotted after this change will use the order configured above. Previously snapshotted payments are unaffected. This action requires product and finance sign-off.'
            )}
          </p>
        </ModalContent>
        <ModalFooter>
          <Button variant="cancel" onClick={() => setShowActivateModal(false)}>
            {t('actions.cancel', 'Cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setLocalAlgorithm('strict_order')
              setShowActivateModal(false)
            }}
          >
            {t('pages.repaymentConfiguration.algorithm.activateConfirmButton', 'Activate')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* ── Deactivate (revert to legacy) confirmation modal ── */}
      <Modal open={showDeactivateModal} onClose={() => setShowDeactivateModal(false)}>
        <ModalHeader
          title={t(
            'pages.repaymentConfiguration.algorithm.deactivateConfirmTitle',
            'Revert to Legacy Proportional?'
          )}
          onClose={() => setShowDeactivateModal(false)}
        />
        <ModalContent>
          <p className="text-sm">
            {t(
              'pages.repaymentConfiguration.algorithm.deactivateConfirmMessage',
              'Future payment snapshots will use the legacy proportional algorithm. Already-snapshotted payments are unaffected.'
            )}
          </p>
        </ModalContent>
        <ModalFooter>
          <Button variant="cancel" onClick={() => setShowDeactivateModal(false)}>
            {t('actions.cancel', 'Cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setLocalAlgorithm('legacy_proportional')
              setShowDeactivateModal(false)
            }}
          >
            {t('pages.repaymentConfiguration.algorithm.deactivateConfirmButton', 'Revert')}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
