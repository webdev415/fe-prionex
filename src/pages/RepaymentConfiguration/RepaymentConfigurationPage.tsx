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
import { RepaymentConfigurationPageSkeleton } from './RepaymentConfigurationPageSkeleton'

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
    <ol className="grid grid-cols-1 gap-3">
      {order.map((component, idx) => (
        <li
          key={component}
          draggable={!disabled}
          onDragStart={(e) => !disabled && handleDragStart(e, idx)}
          onDragOver={(e) => !disabled && handleDragOver(e, idx)}
          onDrop={(e) => !disabled && handleDrop(e, idx)}
          onDragEnd={handleDragEnd}
          className={cn(
            'border-border bg-card flex min-h-14 items-center gap-3 rounded-lg border px-4 py-3 transition-colors',
            !disabled && 'cursor-grab active:cursor-grabbing',
            dragIndex === idx && 'opacity-40',
            dropIndex === idx && dragIndex !== idx && 'border-primary-500 bg-primary-100',
            disabled && 'opacity-70'
          )}
        >
          <span className="bg-muted text-muted-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
            {idx + 1}
          </span>

          {!disabled && (
            <span className="text-muted-foreground flex shrink-0 items-center">
              <Icons.Sorting01Icon size={18} />
            </span>
          )}

          <span className="text-foreground min-w-0 flex-1 text-sm font-medium">
            {labels[component]}
          </span>

          {!disabled && (
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() => moveUp(idx)}
                disabled={idx === 0}
                aria-label={`Move ${labels[component]} up`}
                className={cn(
                  'text-muted-foreground rounded-md p-1.5 transition-colors',
                  idx === 0
                    ? 'cursor-not-allowed opacity-30'
                    : 'hover:bg-muted hover:text-foreground'
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
                  'text-muted-foreground rounded-md p-1.5 transition-colors',
                  idx === order.length - 1
                    ? 'cursor-not-allowed opacity-30'
                    : 'hover:bg-muted hover:text-foreground'
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
          detail.includes('snapshot') ||
          detail.includes('unsnapshotted')
        ) {
          toast.error(
            t(
              'pages.repaymentConfiguration.algorithm.preconditionError',
              'Strict Order requires payment-allocation snapshotting to be enabled.'
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
    return <RepaymentConfigurationPageSkeleton />
  }

  if (isError || !data) {
    return (
      <div className="text-destructive flex h-64 w-full items-center justify-center text-sm">
        {t('status.error', 'Failed to load configuration')}
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col items-start gap-4">
      {/* Header */}
      <div className="mb-4 flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-foreground text-xl font-light sm:text-2xl">
            {t('pages.repaymentConfiguration.title', 'Repayment & Write-off Configuration')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-light">
            {t(
              'pages.repaymentConfiguration.description',
              'Configure how payments are distributed across debt components and manage write-off rules.'
            )}
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            {t('pages.repaymentConfiguration.lastUpdated', 'Last updated')}{' '}
            {formatDate(data.updated_at)} {t('pages.repaymentConfiguration.by', 'by')}{' '}
            <span className="text-foreground font-medium">{data.updated_by_username}</span>
          </p>
        </div>

        {canEdit && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Button
              variant="white-secondary"
              onClick={handleCancel}
              disabled={!isDirty || updateMutation.isPending}
              className="flex h-10 w-full flex-row items-center justify-center rounded-full text-xs font-medium sm:h-12 sm:w-auto"
            >
              {t('pages.repaymentConfiguration.cancel', 'Cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!isDirty || updateMutation.isPending}
              isLoading={updateMutation.isPending}
              className="flex h-10 w-full flex-row items-center justify-center rounded-full text-xs font-medium sm:h-12 sm:w-auto"
            >
              {updateMutation.isPending
                ? t('pages.repaymentConfiguration.saving', 'Saving...')
                : t('pages.repaymentConfiguration.save', 'Save Changes')}
            </Button>
          </div>
        )}
      </div>

      {!canEdit && (
        <div className="border-warning-200 bg-warning-100/40 text-warning-700 flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-sm">
          <div className="bg-warning-100 text-warning-700 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
            <Icons.Warning size={16} strokeWidth={2} />
          </div>
          <div className="min-w-0 self-center">
            {t(
              'pages.repaymentConfiguration.readOnly',
              'You have view-only access to this configuration.'
            )}
          </div>
        </div>
      )}

      {/* Repayment Order + Write-off Rules — side by side on large screens */}
      <div className="grid w-full grid-cols-1 items-stretch gap-4 md:grid-cols-2">
        {/* Repayment Order */}
        <section className="border-border bg-card/50 flex h-full flex-col gap-4 rounded-xl border p-4 sm:p-6">
          <div>
            <h2 className="text-foreground mb-1 text-base font-semibold sm:text-lg">
              {t('pages.repaymentConfiguration.repaymentOrder.title', 'Repayment Order')}
            </h2>
            <p className="text-muted-foreground text-sm font-light">
              {t(
                'pages.repaymentConfiguration.repaymentOrder.description',
                'Drag to set the order payments fill debt components (each fully before the next). This applies only under Strict Order — Legacy Proportional ignores it and uses a fixed order.'
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

        {/* Write-off Rules */}
        <section className="border-border bg-card/50 flex h-full flex-col gap-4 rounded-xl border p-4 sm:p-6">
          <div>
            <h2 className="text-foreground mb-1 text-base font-semibold sm:text-lg">
              {t('pages.repaymentConfiguration.writeoffRules.title', 'Write-off Rules')}
            </h2>
            <p className="text-muted-foreground text-sm font-light">
              {t(
                'pages.repaymentConfiguration.writeoffRules.description',
                'Enable or disable the creation of new write-off entries per component. Applies to manual operator write-offs only.'
              )}
            </p>
          </div>

          <div className="grid flex-1 grid-cols-1 content-start gap-3">
            {COMPONENTS.map((component) => (
              <div
                key={component}
                className="border-border bg-card flex min-h-14 items-center justify-between gap-3 rounded-lg border px-4 py-3"
              >
                <span className="text-foreground text-sm font-medium">
                  {componentLabels[component]}
                </span>
                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={cn(
                      'inline-flex h-[28px] items-center rounded-full px-2.5 text-xs font-medium',
                      localWriteoff[component]
                        ? 'bg-success-100 text-success-700'
                        : 'bg-muted text-muted-foreground'
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

          <p className="text-muted-foreground mt-auto text-xs font-light">
            {t(
              'pages.repaymentConfiguration.writeoffRules.vendorNote',
              'Note: applies to manual write-offs only. Vendor import write-offs are unaffected.'
            )}
          </p>
        </section>
      </div>

      {/* Allocation Algorithm */}
      <section className="border-border bg-card/50 flex w-full flex-col gap-4 rounded-xl border p-4 sm:p-6">
        <div>
          <h2 className="text-foreground mb-1 text-base font-semibold sm:text-lg">
            {t('pages.repaymentConfiguration.algorithm.title', 'Allocation Algorithm')}
          </h2>
        </div>

        <div className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-foreground text-sm font-medium">
                {localAlgorithm === 'legacy_proportional'
                  ? t(
                      'pages.repaymentConfiguration.algorithm.legacy_proportional',
                      'Legacy Proportional'
                    )
                  : t('pages.repaymentConfiguration.algorithm.strict_order', 'Strict Order')}
              </p>
              <span
                className={cn(
                  'inline-flex h-[28px] items-center rounded-full px-2.5 text-xs font-medium',
                  localAlgorithm === 'strict_order'
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {localAlgorithm === 'strict_order'
                  ? t('pages.repaymentConfiguration.algorithm.activeBadge', 'Active')
                  : t('pages.repaymentConfiguration.algorithm.legacyBadge', 'Legacy')}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 text-sm font-light">
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

          {canEdit &&
            (localAlgorithm === 'legacy_proportional' ? (
              <Button
                variant="secondary"
                size="sm"
                className="w-full shrink-0 rounded-md sm:w-auto"
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
                className="w-full shrink-0 rounded-md sm:w-auto"
                onClick={() => setShowDeactivateModal(true)}
              >
                {t('pages.repaymentConfiguration.algorithm.deactivateButton', 'Revert to Legacy')}
              </Button>
            ))}
        </div>
      </section>

      {/* Config Change History */}
      {historyData && historyData.items.length > 0 && (
        <section className="border-border bg-card/50 flex w-full flex-col gap-4 rounded-xl border p-4 sm:p-6">
          <div>
            <h2 className="text-foreground mb-1 text-base font-semibold sm:text-lg">
              {t('pages.repaymentConfiguration.history.title', 'Recent Changes')}
            </h2>
          </div>

          <div className="border-border bg-card overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[420px] text-left">
              <thead>
                <tr className="border-border bg-muted border-b">
                  <th className="text-muted-foreground px-4 py-3 text-xs font-semibold tracking-wide uppercase">
                    {t('pages.repaymentConfiguration.history.version', 'Version')}
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-xs font-semibold tracking-wide uppercase">
                    {t('pages.repaymentConfiguration.history.changedBy', 'Changed by')}
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-right text-xs font-semibold tracking-wide uppercase">
                    {t('pages.repaymentConfiguration.history.when', 'When')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {historyData.items.map((entry) => (
                  <tr key={entry.id} className="border-border border-b last:border-b-0">
                    <td className="text-foreground px-4 py-3 text-sm font-medium">
                      {entry.config_version}
                    </td>
                    <td className="text-foreground px-4 py-3 text-sm">
                      {entry.changed_by_username}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-right text-xs">
                      {formatDate(entry.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Activate Strict Order confirmation modal */}
      <Modal open={showActivateModal} onClose={() => setShowActivateModal(false)}>
        <ModalHeader
          title={t(
            'pages.repaymentConfiguration.algorithm.activateConfirmTitle',
            'Activate Strict Order?'
          )}
          onClose={() => setShowActivateModal(false)}
        />
        <ModalContent>
          <p className="text-muted-foreground text-sm">
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

      {/* Deactivate (revert to legacy) confirmation modal */}
      <Modal open={showDeactivateModal} onClose={() => setShowDeactivateModal(false)}>
        <ModalHeader
          title={t(
            'pages.repaymentConfiguration.algorithm.deactivateConfirmTitle',
            'Revert to Legacy Proportional?'
          )}
          onClose={() => setShowDeactivateModal(false)}
        />
        <ModalContent>
          <p className="text-muted-foreground text-sm">
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
