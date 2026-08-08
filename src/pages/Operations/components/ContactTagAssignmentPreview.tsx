import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import type {
  ContactTagAssignmentPreviewResponse,
  ContactTagPreviewRow,
  ContactTagRowStatus,
} from '@/features/imports/types/contactTagAssignment'

interface Props {
  preview: ContactTagAssignmentPreviewResponse
  onConfirm: () => void
  onCancel: () => void
  isExecuting: boolean
}

type RowWithId = ContactTagPreviewRow & { id: number }

function StatusBadge({ status }: { status: ContactTagRowStatus }) {
  const { t } = useTranslation('common')
  const p = 'pages.imports.contactTagAssignment.preview.statuses'

  const cfg: Record<
    ContactTagRowStatus,
    { icon: typeof Icons.Success; color: string; key: string; label: string }
  > = {
    ready: { icon: Icons.Success, color: 'text-success-600', key: 'ready', label: 'Ready' },
    warning: {
      icon: Icons.Warning,
      color: 'text-warning-500',
      key: 'warning',
      label: 'Partly skipped',
    },
    no_change: {
      icon: Icons.Cancel01,
      color: 'text-gray-400',
      key: 'noChange',
      label: 'No change',
    },
    contact_not_found: {
      icon: Icons.Error,
      color: 'text-error-500',
      key: 'contactNotFound',
      label: 'Contact not found',
    },
    tag_not_found: {
      icon: Icons.Error,
      color: 'text-error-500',
      key: 'tagNotFound',
      label: 'Value not found',
    },
    // Distinct from `system` on purpose: this one is fixable by getting the
    // permission, the other is not fixable at all.
    protected: {
      icon: Icons.Warning,
      color: 'text-warning-500',
      key: 'protected',
      label: 'Permission required',
    },
    system: {
      icon: Icons.Error,
      color: 'text-error-500',
      key: 'system',
      label: 'System-managed',
    },
    multiple_values_single_select: {
      icon: Icons.Error,
      color: 'text-error-500',
      key: 'multipleValuesSingleSelect',
      label: 'Too many values',
    },
    duplicate: {
      icon: Icons.Cancel01,
      color: 'text-gray-400',
      key: 'duplicate',
      label: 'Duplicate',
    },
    invalid: { icon: Icons.Error, color: 'text-error-500', key: 'invalid', label: 'Invalid' },
  }

  // This union is a hand-maintained mirror of a Python enum in another repo, so
  // it goes stale the moment the backend gains a status. Without the fallback
  // an unknown value made `c.icon` throw during render, taking the whole route
  // down right after a successful upload and orphaning the validated job.
  // Falling back to `invalid` degrades one badge instead.
  const c = cfg[status] ?? cfg.invalid
  const StatusIcon = c.icon
  const known = status in cfg
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${c.color}`}>
      <StatusIcon size={14} />
      {known ? t(`${p}.${c.key}`, c.label) : status}
    </span>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${color}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-600">{label}</p>
    </div>
  )
}

function usePreviewColumns(): Column<RowWithId>[] {
  const { t } = useTranslation('common')
  const p = 'pages.imports.contactTagAssignment.preview.columns'

  return useMemo(
    () => [
      { key: 'row_number', header: t(`${p}.rowNumber`, 'Row') },
      {
        key: 'contact',
        header: t(`${p}.contact`, 'Contact'),
        render: (row: RowWithId) => (
          <div className="flex flex-col">
            <span className="text-dark-500 font-medium">{row.contact_value}</span>
            <span className="text-xs text-gray-400">
              {row.client_name ? `${row.client_name} · ` : ''}
              {t(`${p}.tinPrefix`, 'TIN')} {row.tin}
            </span>
          </div>
        ),
      },
      {
        key: 'category',
        header: t(`${p}.category`, 'Category'),
        render: (row: RowWithId) => (
          <div className="flex flex-col">
            <span className="text-dark-500">{row.category}</span>
            {row.selection_type && (
              <span className="text-xs text-gray-400">
                {row.selection_type === 'single'
                  ? t(`${p}.singleSelect`, 'single-select')
                  : t(`${p}.multiSelect`, 'multi-select')}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'tags',
        header: t(`${p}.values`, 'Values'),
        render: (row: RowWithId) => (
          <div className="flex flex-wrap gap-1">
            {row.tag_names.map((name) => {
              const unknown = row.unknown_tag_names.includes(name)
              return (
                <span
                  key={name}
                  className={`rounded-full border px-2 py-0.5 text-xs ${
                    unknown
                      ? 'border-error-300 bg-error-50 text-error-700 line-through'
                      : 'border-secondary-200 bg-secondary-50 text-secondary-800'
                  }`}
                  title={
                    unknown
                      ? t(`${p}.unknownValueTitle`, 'No such value in this category')
                      : undefined
                  }
                >
                  {name}
                </span>
              )
            })}
          </div>
        ),
      },
      {
        // The number operators are most likely to be surprised by: the same
        // phone number is routinely stored several times under one client, and
        // one file row writes to every copy.
        key: 'matched_contacts',
        header: t(`${p}.contacts`, 'Contacts'),
        render: (row: RowWithId) => {
          if (row.matched_contacts <= 1) {
            return <span className="text-sm text-gray-500">{row.matched_contacts}</span>
          }
          return (
            <span
              className="bg-information-50 text-information-700 border-information-200 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold"
              title={t(`${p}.fanOutTitle`, {
                defaultValue:
                  'This number is stored {{count}} times under this client. All copies are updated.',
                count: row.matched_contacts,
              })}
            >
              ×{row.matched_contacts}
            </span>
          )
        },
      },
      {
        key: 'status',
        header: t(`${p}.status`, 'Status'),
        render: (row: RowWithId) => <StatusBadge status={row.status} />,
      },
      {
        key: 'error',
        header: t(`${p}.note`, 'Note'),
        render: (row: RowWithId) => {
          // The backend compares the file against what is currently stored, so
          // this fires only when a value would genuinely be destroyed — not
          // merely because the category is single-select and the row happens to
          // repeat the value already there.
          const replaces =
            row.replaces_existing && (row.status === 'ready' || row.status === 'warning')
          if (!replaces) {
            return <span className="text-xs text-gray-600">{row.error || ''}</span>
          }
          return (
            <span className="text-warning-600 inline-flex items-center gap-1 text-xs font-medium">
              <Icons.Warning size={14} />
              {row.currently_assigned.length > 0
                ? t(`${p}.replacesNamed`, {
                    defaultValue: 'Replaces current value: {{names}}',
                    names: row.currently_assigned.join(', '),
                  })
                : t(`${p}.replaces`, 'Replaces the current value in this category')}
            </span>
          )
        },
      },
    ],
    [t, p]
  )
}

export function ContactTagAssignmentPreview({ preview, onConfirm, onCancel, isExecuting }: Props) {
  const { t } = useTranslation('common')
  const b = 'pages.imports.contactTagAssignment.preview'
  const { summary } = preview
  const isAssign = preview.mode === 'assign'
  const columns = usePreviewColumns()

  const previewRows: RowWithId[] = useMemo(
    () => preview.preview_rows.map((row) => ({ ...row, id: row.row_number })),
    [preview.preview_rows]
  )
  const errorRows: RowWithId[] = useMemo(
    () => preview.errors.map((row) => ({ ...row, id: row.row_number })),
    [preview.errors]
  )

  // From the summary, never from preview_rows: that list is capped at 50 by the
  // backend, so counting it reported "3 rows will be overwritten" for a file
  // that overwrites 900. Of every figure on this screen, this is the one that
  // must not read low.
  const replacingRows = preview.summary.replacing_rows

  const fansOut = summary.contacts_affected > summary.ready

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-dark-500 text-lg font-medium">
            {t(`${b}.title`, 'Review contact tag operation')}
          </h3>
          <p className="text-sm text-gray-600">
            {t(`${b}.fileInfo`, {
              defaultValue: '{{filename}} • {{totalRecords}} rows • Batch {{batchId}}',
              filename: preview.filename,
              totalRecords: preview.total_records,
              batchId: preview.batch_id,
            })}
          </p>
          <p className="mt-1 text-xs">
            {isAssign ? (
              <span className="bg-secondary-50 text-secondary-800 rounded-full px-2 py-0.5 font-medium">
                {t(`${b}.modeAssign`, 'Mode: Assign values')}
              </span>
            ) : (
              <span className="bg-error-50 text-error-700 rounded-full px-2 py-0.5 font-medium">
                {t(`${b}.modeRemove`, 'Mode: Remove values')}
              </span>
            )}
          </p>
        </div>
      </div>

      {preview.warnings.length > 0 && (
        <div className="border-warning-200 bg-warning-50 rounded-lg border p-3">
          <ul className="space-y-1">
            {preview.warnings.map((w) => (
              <li key={w} className="text-warning-700 flex items-start gap-2 text-sm">
                <Icons.Warning size={16} className="mt-0.5 shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Fan-out is the headline number: rows and writes are not the same
          thing, and an operator uploading 1,000 rows should not discover
          ~7,000 writes afterwards. */}
      {fansOut && (
        <div className="border-information-200 bg-information-50 flex items-start gap-2 rounded-lg border p-3">
          <Icons.Info size={18} className="text-information-700 mt-0.5 shrink-0" />
          <p className="text-information-700 text-sm">
            {t(`${b}.fanOutNotice`, {
              defaultValue:
                '{{rows}} rows will update {{contacts}} contact records. The same number can be stored more than once under a client, and every copy is updated.',
              rows: summary.ready,
              contacts: summary.contacts_affected,
            })}
          </p>
        </div>
      )}

      {replacingRows > 0 && (
        <div className="border-warning-200 bg-warning-50 flex items-start gap-2 rounded-lg border p-3">
          <Icons.Warning size={18} className="text-warning-600 mt-0.5 shrink-0" />
          <p className="text-warning-700 text-sm">
            {t(`${b}.replaceNotice`, {
              defaultValue:
                '{{count}} rows target single-select categories and will REPLACE the current value. The previous value is kept only in the audit log.',
              count: replacingRows,
            })}
          </p>
        </div>
      )}

      {/* The five row counts (ready + warning + no change + invalid +
          overridden) add up to total_rows, so an operator can check nothing
          was silently dropped. Contacts affected is deliberately last: it
          counts CONTACTS, not rows, and would break that arithmetic if read
          as part of the same set. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard
          label={t(
            isAssign ? `${b}.readyToAssign` : `${b}.readyToRemove`,
            isAssign ? 'Rows to assign' : 'Rows to remove'
          )}
          value={summary.ready}
          color="bg-success-50 border-success-200 text-success-700"
        />
        <SummaryCard
          label={t(`${b}.warning`, 'Partly skipped')}
          value={summary.warning}
          color="bg-warning-50 border-warning-200 text-warning-700"
        />
        <SummaryCard
          label={t(`${b}.noChange`, 'Already up to date')}
          value={summary.no_change}
          color="bg-gray-50 border-gray-200 text-dark-500"
        />
        <SummaryCard
          label={t(`${b}.invalid`, 'Invalid')}
          value={summary.invalid}
          color="bg-error-50 border-error-200 text-error-700"
        />
        {/* Every duplicate now discards a row, so this is always a warning
            rather than a neutral count. */}
        <SummaryCard
          label={t(`${b}.duplicatesOverridden`, 'Duplicate rows overridden')}
          value={summary.duplicates_overridden}
          color={
            summary.duplicates_overridden > 0
              ? 'bg-warning-50 border-warning-200 text-warning-700'
              : 'bg-gray-50 border-gray-200 text-dark-500'
          }
        />
        <SummaryCard
          label={t(`${b}.contactsAffected`, 'Contacts affected')}
          value={summary.contacts_affected}
          color="bg-information-50 border-information-200 text-information-700"
        />
      </div>

      {summary.duplicates_overridden > 0 && (
        <div className="border-warning-200 bg-warning-50 flex items-start gap-2 rounded-lg border p-3">
          <Icons.Warning size={18} className="text-warning-600 mt-0.5 shrink-0" />
          <p className="text-warning-700 text-sm">
            {t(`${b}.overriddenNotice`, {
              defaultValue:
                '{{count}} rows were discarded. A later row in the file names the same contact and category, and only the last row applies. To set several values at once, list them in one cell: "Telegram,WhatsApp".',
              count: summary.duplicates_overridden,
            })}
          </p>
        </div>
      )}

      {previewRows.length > 0 && (
        <div>
          <h4 className="text-dark-500 mb-2 text-sm font-medium">
            {t(`${b}.previewRows`, {
              defaultValue: 'Preview ({{count}} rows)',
              count: previewRows.length,
            })}
          </h4>
          <DataTable<RowWithId>
            columns={columns}
            data={previewRows}
            emptyMessage={t(`${b}.emptyPreview`, 'No rows ready to apply.')}
          />
        </div>
      )}

      {errorRows.length > 0 && (
        <div>
          <h4 className="text-error-600 mb-2 text-sm font-medium">
            {t(`${b}.errors`, { defaultValue: 'Errors ({{count}})', count: errorRows.length })}
          </h4>
          <DataTable<RowWithId>
            columns={columns}
            data={errorRows}
            emptyMessage={t(`${b}.emptyErrors`, 'No errors.')}
          />
        </div>
      )}

      <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
        <Button variant="cancel" size="md" onClick={onCancel} disabled={isExecuting}>
          {t(`${b}.cancel`, 'Cancel')}
        </Button>
        <Button
          variant={isAssign ? 'secondary' : 'danger'}
          size="md"
          onClick={() => onConfirm()}
          disabled={isExecuting || summary.ready + summary.warning === 0}
          isLoading={isExecuting}
        >
          {isExecuting
            ? t(`${b}.starting`, 'Starting…')
            : isAssign
              ? t(`${b}.confirmAssign`, {
                  defaultValue: 'Assign to {{count}} contacts',
                  count: summary.contacts_affected,
                })
              : t(`${b}.confirmRemove`, {
                  defaultValue: 'Remove from {{count}} contacts',
                  count: summary.contacts_affected,
                })}
        </Button>
      </div>
    </div>
  )
}
