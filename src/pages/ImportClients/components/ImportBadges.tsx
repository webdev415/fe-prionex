/**
 * Import status/type badges — soft semantic fills that remap correctly in dark themes.
 */

import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

export type ImportUiStatus =
  | 'done'
  | 'failed'
  | 'completed_with_errors'
  | 'in_progress'
  | 'pending'
  | 'cancelled'

const statusBadgeBase =
  'inline-flex h-[33px] items-center gap-1.5 rounded-full px-3 text-xs font-medium'

const typeBadgeBase =
  'inline-flex h-[28px] items-center rounded-full px-2.5 text-[11px] font-medium'

type StatusLabelScope = 'history' | 'details'

/** Map UI status values to camelCase locale keys under pages.imports.*.statuses */
const STATUS_I18N_KEY: Record<ImportUiStatus, string> = {
  done: 'done',
  failed: 'failed',
  completed_with_errors: 'completedWithErrors',
  in_progress: 'inProgress',
  pending: 'pending',
  cancelled: 'cancelled',
}

function statusLabelKey(scope: StatusLabelScope, status: ImportUiStatus): string {
  const prefix =
    scope === 'details' ? 'pages.imports.details.statuses' : 'pages.imports.history.statuses'
  if (status === 'done' && scope === 'details') {
    return `${prefix}.completed`
  }
  return `${prefix}.${STATUS_I18N_KEY[status]}`
}

export function ImportStatusBadge({
  status,
  labelScope = 'history',
}: {
  status: ImportUiStatus
  labelScope?: StatusLabelScope
}) {
  const { t } = useTranslation('common')
  const label = t(statusLabelKey(labelScope, status))

  if (status === 'done') {
    return (
      <span className={cn(statusBadgeBase, 'bg-success-100 text-success-700')}>
        <span className="bg-success-500 h-2 w-2 rounded-full" />
        {label}
      </span>
    )
  }

  if (status === 'completed_with_errors') {
    return (
      <span className={cn(statusBadgeBase, 'bg-warning-100 text-warning-700')}>
        <Icons.Warning size={14} className="text-warning-600 shrink-0" />
        {label}
      </span>
    )
  }

  if (status === 'in_progress') {
    return (
      <span className={cn(statusBadgeBase, 'bg-information-100 text-information-700')}>
        <span className="bg-information-500 h-2 w-2 animate-pulse rounded-full" />
        {label}
      </span>
    )
  }

  if (status === 'pending') {
    return (
      <span className={cn(statusBadgeBase, 'bg-warning-100 text-warning-700')}>
        <span className="bg-warning-500 h-2 w-2 rounded-full" />
        {label}
      </span>
    )
  }

  if (status === 'cancelled') {
    return (
      <span className={cn(statusBadgeBase, 'bg-muted text-muted-foreground')}>
        <span className="bg-muted-foreground h-2 w-2 rounded-full" />
        {label}
      </span>
    )
  }

  return (
    <span className={cn(statusBadgeBase, 'bg-error-100 text-error-700')}>
      <span className="bg-error-500 h-2 w-2 rounded-full" />
      {label}
    </span>
  )
}

export function ImportModalStatusBadge({
  status,
}: {
  status: 'completed' | 'completed_with_errors' | 'failed'
}) {
  const { t } = useTranslation('common')

  if (status === 'completed') {
    return (
      <div className="flex flex-1">
        <span className={cn(statusBadgeBase, 'bg-success-100 text-success-700')}>
          <span className="bg-success-500 h-2 w-2 rounded-full" />
          {t('pages.imports.modal.statuses.completed')}
        </span>
      </div>
    )
  }

  if (status === 'completed_with_errors') {
    return (
      <div className="flex flex-1">
        <span className={cn(statusBadgeBase, 'bg-warning-100 text-warning-700')}>
          <Icons.Warning size={14} className="text-warning-600 shrink-0" />
          {t('pages.imports.modal.statuses.completedWithErrors')}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-1">
      <span className={cn(statusBadgeBase, 'bg-error-100 text-error-700')}>
        <span className="bg-error-500 h-2 w-2 rounded-full" />
        {t('pages.imports.modal.statuses.failed')}
      </span>
    </div>
  )
}

export function ImportTypeBadge({
  importType,
  tagMode,
}: {
  importType: string
  tagMode?: 'assign' | 'remove'
}) {
  const { t } = useTranslation('common')

  const config: Record<string, { label: string; className: string }> = {
    simple: {
      label: t('pages.imports.history.importTypes.simple', 'Simple'),
      className: 'bg-muted text-muted-foreground',
    },
    vendor: {
      label: t('pages.imports.history.importTypes.vendor', 'Vendor Dump'),
      className: 'bg-success-50 text-success-600',
    },
    operator_assignment: {
      label: t('pages.imports.history.importTypes.operatorAssignment', 'Operator Assignment'),
      className: 'bg-warning-50 text-warning-600',
    },
    payment_import: {
      label: t('pages.imports.history.importTypes.paymentImport', 'Payment Import'),
      className: 'bg-information-50 text-information-600',
    },
    writeoff_import: {
      label: t('pages.imports.history.importTypes.writeoffImport', 'Write-off Import'),
      className: 'bg-error-50 text-error-600',
    },
    sale_notes: {
      label: t('pages.imports.history.importTypes.saleNotes', 'Sale Notes'),
      className: 'bg-information-50 text-information-600',
    },
    document: {
      label: t('pages.imports.history.importTypes.document', 'Document Import'),
      className: 'bg-secondary-50 text-secondary-600',
    },
  }

  // Client tags and contact tags share the assign/remove badge shape but name
  // different entities, so the label depends on both the import type and the
  // mode.
  if (importType === 'tag_assignment' || importType === 'contact_tag_assignment') {
    const isRemove = tagMode === 'remove'
    const isContact = importType === 'contact_tag_assignment'
    const label = isRemove
      ? isContact
        ? t('pages.imports.history.importTypes.contactTagRemoval', 'Contact tag removal')
        : t('pages.imports.history.importTypes.tagRemoval', 'Tag removal')
      : isContact
        ? t('pages.imports.history.importTypes.contactTagAssignment', 'Contact tag assignment')
        : t('pages.imports.history.importTypes.tagAssignment', 'Tag assignment')

    return (
      <span
        className={cn(
          typeBadgeBase,
          isRemove ? 'bg-error-50 text-error-600' : 'bg-success-50 text-success-600'
        )}
      >
        {label}
      </span>
    )
  }

  const cfg = config[importType] || config.simple

  return <span className={cn(typeBadgeBase, cfg.className)}>{cfg.label}</span>
}
