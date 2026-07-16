import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { MdOutlineFileUpload, MdAdd, MdDeleteOutline, MdOutlinePersonOff } from 'react-icons/md'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/Select'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { formatDateTime } from '@/lib/formatters'
import { useAuthStore } from '@/stores/authStore'
import {
  MultiCheckboxDropdown,
  type MultiCheckboxOption,
} from '@/pages/Training/components/MultiCheckboxDropdown'
import {
  useOptOutClients,
  useAddOptOut,
  useRemoveOptOut,
  useImportOptOut,
  type OptOutClientItem,
} from '../api'

const REASONS = ['Legal request', 'Data dispute', 'Test client', 'Other'] as const
type Reason = (typeof REASONS)[number]

const REASON_STYLES: Record<string, string> = {
  'Legal request': 'text-success-700',
  'Data dispute': 'text-information-600',
  'Test client': 'text-warning-700',
  Other: 'text-gray-600',
}

interface Row {
  id: number
  clientName: string
  clientRef: string
  tin: string
  reason: string | null
  setBy: string
  dateAdded: string
  note: string
}

export function OptOutTab() {
  const { t } = useTranslation('common')
  const { data, isLoading, isError } = useOptOutClients()
  const addMut = useAddOptOut()
  const removeMut = useRemoveOptOut()
  const importMut = useImportOptOut()

  const [search, setSearch] = useState('')
  const [reasons, setReasons] = useState<string[]>([])
  const [admins, setAdmins] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<number | string>>(new Set())

  // Add dialog state
  const [addOpen, setAddOpen] = useState(false)
  const [addIds, setAddIds] = useState('')
  const [addReason, setAddReason] = useState<Reason>('Legal request')
  const [addNote, setAddNote] = useState('')

  const fileRef = useRef<HTMLInputElement>(null)
  const userTimezone = useAuthStore((s) => s.user?.timezone)

  const items = useMemo(() => data ?? [], [data])

  const reasonLabel = (code: string) => {
    switch (code) {
      case 'Legal request':
        return t('pages.ubkiIntegration.optOut.reasons.legalRequest', 'Legal request')
      case 'Data dispute':
        return t('pages.ubkiIntegration.optOut.reasons.dataDispute', 'Data dispute')
      case 'Test client':
        return t('pages.ubkiIntegration.optOut.reasons.testClient', 'Test client')
      case 'Other':
        return t('pages.ubkiIntegration.optOut.reasons.other', 'Other')
      default:
        return code
    }
  }

  const reasonOptions = useMemo<MultiCheckboxOption<string>[]>(
    () => REASONS.map((r) => ({ value: r, label: reasonLabel(r) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t]
  )

  const rows = useMemo<Row[]>(
    () =>
      items.map((c: OptOutClientItem) => ({
        id: c.client_id,
        clientName:
          c.client_name ??
          t('pages.ubkiIntegration.optOut.clientFallback', {
            defaultValue: 'Client #{{id}}',
            id: c.client_id,
          }),
        clientRef: `#${c.client_id}`,
        tin: c.tax_id ?? '—',
        reason: c.reason,
        setBy:
          c.set_by != null
            ? t('pages.ubkiIntegration.optOut.userFallback', {
                defaultValue: 'User #{{id}}',
                id: c.set_by,
              })
            : '—',
        dateAdded: c.set_at ? formatDateTime(c.set_at, userTimezone) : '—',
        note: c.note ?? '—',
      })),
    [items, userTimezone, t]
  )

  const adminOptions = useMemo<MultiCheckboxOption<string>[]>(() => {
    const seen = new Set<string>()
    const opts: MultiCheckboxOption<string>[] = []
    for (const r of rows) {
      if (r.setBy === '—' || seen.has(r.setBy)) continue
      seen.add(r.setBy)
      opts.push({ value: r.setBy, label: r.setBy })
    }
    return opts
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (reasons.length && !(r.reason && reasons.includes(r.reason))) return false
      if (admins.length && !admins.includes(r.setBy)) return false
      if (
        q &&
        !r.clientName.toLowerCase().includes(q) &&
        !r.tin.toLowerCase().includes(q) &&
        !r.clientRef.toLowerCase().includes(q)
      )
        return false
      return true
    })
  }, [rows, search, reasons, admins])

  const columns: Column<Row>[] = [
    {
      key: 'client',
      header: t('pages.ubkiIntegration.optOut.columns.client', 'Client'),
      render: (r) => (
        <div className="text-xs">
          <div className="text-dark-500 font-medium">{r.clientName}</div>
          <div className="text-gray-500">{r.clientRef}</div>
        </div>
      ),
    },
    {
      key: 'tin',
      header: t('pages.ubkiIntegration.optOut.columns.tin', 'TIN'),
      render: (r) => <span className="text-xs text-gray-700">{r.tin}</span>,
    },
    {
      key: 'reason',
      header: t('pages.ubkiIntegration.optOut.columns.reason', 'Reason'),
      render: (r) => (
        <span
          className={`text-xs font-medium ${r.reason ? (REASON_STYLES[r.reason] ?? 'text-gray-600') : 'text-gray-400'}`}
        >
          {r.reason ? reasonLabel(r.reason) : '—'}
        </span>
      ),
    },
    {
      key: 'setBy',
      header: t('pages.ubkiIntegration.optOut.columns.setBy', 'Set by'),
      render: (r) => <span className="text-xs text-gray-700">{r.setBy}</span>,
    },
    {
      key: 'dateAdded',
      header: t('pages.ubkiIntegration.optOut.columns.dateAdded', 'Date added'),
      render: (r) => <span className="text-xs text-gray-500">{r.dateAdded}</span>,
    },
    {
      key: 'note',
      header: t('pages.ubkiIntegration.optOut.columns.note', 'Note'),
      render: (r) => <span className="text-xs text-gray-600">{r.note}</span>,
    },
    {
      key: 'actions',
      header: t('pages.ubkiIntegration.optOut.columns.actions', 'Actions'),
      align: 'right',
      render: (r) => (
        <button
          type="button"
          disabled={removeMut.isPending}
          onClick={() => removeMut.mutate([r.id])}
          className="text-error-600 inline-flex items-center gap-1 text-xs font-medium hover:underline disabled:opacity-50"
        >
          <MdDeleteOutline size={14} /> {t('pages.ubkiIntegration.optOut.remove', 'Remove')}
        </button>
      ),
    },
  ]

  const submitAdd = () => {
    const tins = addIds
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (!tins.length) return
    addMut.mutate(
      { tins, reason: addReason, note: addNote.trim() || undefined },
      {
        onSuccess: () => {
          setAddOpen(false)
          setAddIds('')
          setAddNote('')
        },
      }
    )
  }

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    importMut.mutate(
      { file, reason: 'Other' },
      {
        onSuccess: (res) => {
          const parts = [
            t('pages.ubkiIntegration.optOut.import.imported', {
              defaultValue: 'Imported {{count}}',
              count: res.imported_count,
            }),
          ]
          if (res.skipped_count)
            parts.push(
              t('pages.ubkiIntegration.optOut.import.skipped', {
                defaultValue: 'skipped {{count}} (no matching client)',
                count: res.skipped_count,
              })
            )
          toast.success(
            `${parts.join(', ')}.` +
              (res.not_found.length
                ? `\n${t('pages.ubkiIntegration.optOut.import.notFound', {
                    defaultValue: 'Not found: {{list}}',
                    list: res.not_found.slice(0, 10).join(', '),
                  })}`
                : '')
          )
        },
        onError: () =>
          toast.error(
            t(
              'pages.ubkiIntegration.optOut.import.error',
              'Import failed. Make sure the file is a CSV of TINs.'
            )
          ),
      }
    )
  }

  const removeSelected = () => {
    const ids = [...selected].map(Number).filter((n) => Number.isInteger(n))
    if (!ids.length) return
    removeMut.mutate(ids, { onSuccess: () => setSelected(new Set()) })
  }

  return (
    <div className="flex flex-col gap-4">
      <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onFilePicked} />

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        {/* Card header — title + actions, inside the card. */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-dark-500 flex items-center gap-2 text-sm font-semibold">
            {t('pages.ubkiIntegration.optOut.title', 'Opt-out clients')}
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
              {items.length}
            </span>
          </h2>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<MdOutlineFileUpload size={14} />}
              disabled={importMut.isPending}
              onClick={() => fileRef.current?.click()}
            >
              {importMut.isPending
                ? t('pages.ubkiIntegration.optOut.import.importing', 'Importing…')
                : t('pages.ubkiIntegration.optOut.import.button', 'Import from CSV')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<MdAdd size={14} />}
              onClick={() => setAddOpen(true)}
            >
              {t('pages.ubkiIntegration.optOut.add.button', 'Add to opt-out')}
            </Button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-dark-500 text-xs font-medium">
            {t('pages.ubkiIntegration.optOut.selected', {
              defaultValue: 'Selected: {{count}}',
              count: selected.size,
            })}
          </span>
          {selected.size > 0 && (
            <Button
              variant="danger"
              size="sm"
              leftIcon={<MdDeleteOutline size={14} />}
              disabled={removeMut.isPending}
              onClick={removeSelected}
            >
              {t('pages.ubkiIntegration.optOut.removeSelected', 'Remove selected')}
            </Button>
          )}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(
              'pages.ubkiIntegration.optOut.searchPlaceholder',
              'Search by client / TIN / contract…'
            )}
            className="focus:border-primary-500 h-[45px] min-w-[220px] flex-1 rounded-full border border-gray-400 bg-white px-4 text-xs text-gray-700 focus:outline-none"
          />
          <div className="w-44">
            <MultiCheckboxDropdown
              options={reasonOptions}
              selected={reasons}
              onChange={setReasons}
              allLabel={t('pages.ubkiIntegration.optOut.filters.allReasons', 'All reasons')}
            />
          </div>
          <div className="w-52">
            <MultiCheckboxDropdown
              options={adminOptions}
              selected={admins}
              onChange={setAdmins}
              allLabel={t(
                'pages.ubkiIntegration.optOut.filters.allAdministrators',
                'All administrators'
              )}
            />
          </div>
        </div>

        {isLoading ? (
          <TableSkeleton columns={7} rows={5} />
        ) : isError ? (
          <div className="text-error-600 py-16 text-center text-sm">
            {t('pages.ubkiIntegration.optOut.loadError', 'Failed to load opt-out clients.')}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <MdOutlinePersonOff size={28} className="text-gray-400" />
            <p className="text-dark-500 text-sm font-medium">
              {t('pages.ubkiIntegration.optOut.empty', 'No opt-out clients')}
            </p>
            <p className="text-xs text-gray-500">
              {t(
                'pages.ubkiIntegration.optOut.emptyHint',
                "Clients added to the opt-out list won't receive UBKI submissions."
              )}
            </p>
            <div className="mt-1 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<MdOutlineFileUpload size={14} />}
                onClick={() => fileRef.current?.click()}
              >
                {t('pages.ubkiIntegration.optOut.import.button', 'Import from CSV')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<MdAdd size={14} />}
                onClick={() => setAddOpen(true)}
              >
                {t('pages.ubkiIntegration.optOut.add.clientButton', 'Add client')}
              </Button>
            </div>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            enableBulkSelection
            selectedItems={selected}
            onSelectionChange={setSelected}
            className="w-full"
          />
        )}
      </div>

      {/* Add-to-opt-out dialog */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label={t('pages.ubkiIntegration.optOut.closeDialog', 'Close dialog')}
            className="absolute inset-0 bg-black/40"
            onClick={() => setAddOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
          >
            <h3 className="text-dark-500 text-sm font-semibold">
              {t('pages.ubkiIntegration.optOut.add.dialogTitle', 'Add clients to opt-out')}
            </h3>
            <p className="mb-4 text-xs text-gray-500">
              {t(
                'pages.ubkiIntegration.optOut.add.dialogHint',
                'Their credits will stop being sent to UBKI.'
              )}
            </p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  {t('pages.ubkiIntegration.optOut.add.clientTins', 'Client TINs')}
                </label>
                <input
                  value={addIds}
                  onChange={(e) => setAddIds(e.target.value)}
                  placeholder={t(
                    'pages.ubkiIntegration.optOut.add.tinsPlaceholder',
                    'e.g. 2288805863, 3328719312'
                  )}
                  className="focus:border-primary-500 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-xs text-gray-700 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-gray-400">
                  {t('pages.ubkiIntegration.optOut.add.tinsHelp', 'Comma or space separated.')}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  {t('pages.ubkiIntegration.optOut.add.reason', 'Reason')}
                </label>
                <Select value={addReason} onValueChange={(v) => setAddReason(v as Reason)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {reasonLabel(r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  {t('pages.ubkiIntegration.optOut.add.note', 'Note (optional)')}
                </label>
                <input
                  value={addNote}
                  onChange={(e) => setAddNote(e.target.value)}
                  placeholder={t(
                    'pages.ubkiIntegration.optOut.add.notePlaceholder',
                    'Why are these clients excluded?'
                  )}
                  className="focus:border-primary-500 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-xs text-gray-700 focus:outline-none"
                />
              </div>
            </div>
            {addMut.isError && (
              <p className="text-error-600 mt-2 text-xs">
                {t('pages.ubkiIntegration.optOut.add.error', 'Failed to add. Check the TINs.')}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="cancel"
                size="sm"
                className="rounded-full px-5"
                onClick={() => setAddOpen(false)}
              >
                {t('pages.ubkiIntegration.optOut.cancel', 'Cancel')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="rounded-full px-5"
                disabled={!addIds.trim() || addMut.isPending}
                onClick={submitAdd}
              >
                {addMut.isPending
                  ? t('pages.ubkiIntegration.optOut.add.adding', 'Adding…')
                  : t('pages.ubkiIntegration.optOut.add.button', 'Add to opt-out')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
