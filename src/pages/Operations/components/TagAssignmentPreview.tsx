import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import type {
  TagPreviewResponse,
  TagPreviewRow,
  TagRowStatus,
} from '@/features/imports/types/tagAssignment'

interface Props {
  preview: TagPreviewResponse
  onConfirm: () => void
  onCancel: () => void
  isExecuting: boolean
}

type TagPreviewRowWithId = TagPreviewRow & { id: number }

function StatusBadge({ status }: { status: TagRowStatus }) {
  const { t } = useTranslation('common')

  const statusConfig: Record<
    TagRowStatus,
    { icon: typeof Icons.Success; color: string; labelKey: string; defaultLabel: string }
  > = {
    ready: {
      icon: Icons.Success,
      color: 'text-success-600',
      labelKey: 'pages.imports.tagAssignment.preview.statuses.ready',
      defaultLabel: 'Ready',
    },
    no_change: {
      icon: Icons.Cancel01,
      color: 'text-muted-foreground',
      labelKey: 'pages.imports.tagAssignment.preview.statuses.noChange',
      defaultLabel: 'No change',
    },
    warning: {
      icon: Icons.Warning,
      color: 'text-warning-500',
      labelKey: 'pages.imports.tagAssignment.preview.statuses.warning',
      defaultLabel: 'Warning',
    },
    error: {
      icon: Icons.Error,
      color: 'text-error-500',
      labelKey: 'pages.imports.tagAssignment.preview.statuses.error',
      defaultLabel: 'Error',
    },
  }

  const cfg = statusConfig[status]
  const StatusIcon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
      <StatusIcon size={14} />
      {t(cfg.labelKey, cfg.defaultLabel)}
    </span>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${color}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  )
}

function usePreviewColumns(): Column<TagPreviewRowWithId>[] {
  const { t } = useTranslation('common')
  const p = 'pages.imports.tagAssignment.preview.columns'

  return useMemo(
    () => [
      {
        key: 'row_number',
        header: t(`${p}.rowNumber`, 'Row'),
      },
      {
        key: 'client',
        header: t(`${p}.client`, 'Client'),
        obscured: true,
        render: (row: TagPreviewRowWithId) => (
          <>
            <span className="text-foreground font-medium">
              {row.client_name || `TIN: ${row.tax_id}`}
            </span>
            <span className="text-muted-foreground ml-1 text-xs">({row.tax_id})</span>
          </>
        ),
      },
      {
        key: 'tags',
        header: t(`${p}.tags`, 'Tags'),
        render: (row: TagPreviewRowWithId) => (
          <div className="flex flex-wrap gap-1">
            {row.tag_names.map((name) => {
              const unknown = row.unknown_tag_names.includes(name)
              const blocked = row.protected_blocked_names?.includes(name) ?? false
              const struck = unknown || blocked
              const title = unknown
                ? t(`${p}.unknownTagTitle`, 'Tag not found in this project')
                : blocked
                  ? t(
                      `${p}.blockedProtectedTagTitle`,
                      'You do not have permission to remove this protected tag'
                    )
                  : undefined
              return (
                <span
                  key={name}
                  className={`rounded-full border px-2 py-0.5 text-xs ${
                    struck
                      ? 'border-error-300 bg-error-50 text-error-700 line-through'
                      : 'border-border bg-muted text-foreground'
                  }`}
                  title={title}
                >
                  {name}
                </span>
              )
            })}
          </div>
        ),
      },
      {
        key: 'status',
        header: t(`${p}.status`, 'Status'),
        render: (row: TagPreviewRowWithId) => <StatusBadge status={row.status} />,
      },
      {
        key: 'error',
        header: t(`${p}.note`, 'Note'),
        render: (row: TagPreviewRowWithId) => {
          const hasAllowed = !!row.protected_allowed_names && row.protected_allowed_names.length > 0
          const hasBlocked = !!row.protected_blocked_names && row.protected_blocked_names.length > 0
          if (!hasAllowed && !hasBlocked) {
            return <span className="text-muted-foreground text-xs">{row.error || ''}</span>
          }
          return (
            <div className="flex flex-col gap-0.5 text-xs">
              {hasAllowed && (
                <span className="text-muted-foreground">
                  {t(`${p}.protectedTagNote`, 'Protected tag: {{names}}', {
                    names: row.protected_allowed_names.join(', '),
                  })}
                </span>
              )}
              {hasBlocked && (
                <span className="text-error-600 font-medium">
                  {t(`${p}.requirePermissionNote`, 'Require permission! Protected tag: {{names}}', {
                    names: row.protected_blocked_names.join(', '),
                  })}
                </span>
              )}
            </div>
          )
        },
      },
    ],
    [t, p]
  )
}

export function TagAssignmentPreview({ preview, onConfirm, onCancel, isExecuting }: Props) {
  const { t } = useTranslation('common')
  const { summary } = preview
  const columns = usePreviewColumns()

  const previewRowsWithId: TagPreviewRowWithId[] = useMemo(
    () => preview.preview_rows.map((row) => ({ ...row, id: row.row_number })),
    [preview.preview_rows]
  )
  const errorRowsWithId: TagPreviewRowWithId[] = useMemo(
    () => preview.errors.map((row) => ({ ...row, id: row.row_number })),
    [preview.errors]
  )

  const isAssign = preview.mode === 'assign'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-foreground text-lg font-medium">
            {t('pages.imports.tagAssignment.preview.title', 'Review tag operation')}
          </h3>
          <p className="text-muted-foreground text-sm">
            {t('pages.imports.tagAssignment.preview.fileInfo', {
              defaultValue: '{{filename}} • {{totalRecords}} records • Batch {{batchId}}',
              filename: preview.filename,
              totalRecords: preview.total_records,
              batchId: preview.batch_id,
            })}
          </p>
          <p className="mt-1 text-xs">
            {isAssign ? (
              <span className="bg-success-100 text-success-700 rounded-full px-2 py-0.5 font-medium">
                {t('pages.imports.tagAssignment.preview.modeAssign', 'Mode: Assign tags')}
              </span>
            ) : (
              <span className="bg-error-100 text-error-700 rounded-full px-2 py-0.5 font-medium">
                {t('pages.imports.tagAssignment.preview.modeRemove', 'Mode: Remove tags')}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          label={t(
            isAssign
              ? 'pages.imports.tagAssignment.preview.readyToAssign'
              : 'pages.imports.tagAssignment.preview.readyToRemove',
            isAssign ? 'Ready to assign' : 'Ready to remove'
          )}
          value={summary.ready}
          color="bg-success-50 border-success-200 text-success-700"
        />
        <SummaryCard
          label={t('pages.imports.tagAssignment.preview.noChange', 'No change')}
          value={summary.no_change}
          color="bg-muted border-border text-foreground"
        />
        <SummaryCard
          label={t('pages.imports.tagAssignment.preview.invalid', 'Invalid')}
          value={summary.invalid}
          color="bg-error-50 border-error-200 text-error-700"
        />
        <SummaryCard
          label={t('pages.imports.tagAssignment.preview.uniqueTags', 'Unique tags')}
          value={summary.unique_tags}
          color="bg-information-50 border-information-200 text-information-700"
        />
      </div>

      {previewRowsWithId.length > 0 && (
        <div>
          <h4 className="text-foreground mb-2 text-sm font-medium">
            {t('pages.imports.tagAssignment.preview.previewRows', {
              defaultValue: 'Preview ({{count}} rows)',
              count: Math.min(previewRowsWithId.length, 50),
            })}
          </h4>
          <DataTable<TagPreviewRowWithId>
            columns={columns}
            data={previewRowsWithId}
            emptyMessage={t(
              'pages.imports.tagAssignment.preview.emptyPreview',
              'No rows ready to apply.'
            )}
          />
        </div>
      )}

      {errorRowsWithId.length > 0 && (
        <div>
          <h4 className="text-error-600 mb-2 text-sm font-medium">
            {t('pages.imports.tagAssignment.preview.errors', {
              defaultValue: 'Errors ({{count}})',
              count: errorRowsWithId.length,
            })}
          </h4>
          <DataTable<TagPreviewRowWithId>
            columns={columns}
            data={errorRowsWithId}
            emptyMessage={t('pages.imports.tagAssignment.preview.emptyErrors', 'No errors.')}
          />
        </div>
      )}

      <div className="border-border flex items-center justify-end gap-3 border-t pt-4">
        <Button variant="cancel" size="md" onClick={onCancel} disabled={isExecuting}>
          {t('pages.imports.tagAssignment.preview.cancel', 'Cancel')}
        </Button>
        <Button
          variant={isAssign ? 'secondary' : 'danger'}
          size="md"
          onClick={() => onConfirm()}
          disabled={isExecuting || summary.ready === 0}
          isLoading={isExecuting}
        >
          {isExecuting
            ? t('pages.imports.tagAssignment.preview.starting', 'Starting…')
            : isAssign
              ? t('pages.imports.tagAssignment.preview.confirmAssign', {
                  defaultValue: 'Assign tags to {{count}} Clients',
                  count: summary.ready,
                })
              : t('pages.imports.tagAssignment.preview.confirmRemove', {
                  defaultValue: 'Remove tags from {{count}} Clients',
                  count: summary.ready,
                })}
        </Button>
      </div>
    </div>
  )
}
