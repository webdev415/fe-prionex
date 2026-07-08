import { useMemo, useState } from 'react'
import { MdOutlineFileUpload, MdAdd, MdDeleteOutline, MdOutlinePersonOff } from 'react-icons/md'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import {
  MultiCheckboxDropdown,
  type MultiCheckboxOption,
} from '@/pages/Training/components/MultiCheckboxDropdown'
import { MOCK_OPTOUT, type OptOutClient, type OptOutReason } from '../mockData'

const REASON_STYLES: Record<OptOutReason, string> = {
  'Legal request': 'text-success-700',
  'Data dispute': 'text-information-600',
  'Test client': 'text-warning-700',
  Other: 'text-gray-600',
}

const REASON_OPTIONS: MultiCheckboxOption<OptOutReason>[] = [
  { value: 'Legal request', label: 'Legal request' },
  { value: 'Data dispute', label: 'Data dispute' },
  { value: 'Test client', label: 'Test client' },
  { value: 'Other', label: 'Other' },
]

export function OptOutTab() {
  const [search, setSearch] = useState('')
  const [reasons, setReasons] = useState<OptOutReason[]>([])
  const [admins, setAdmins] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<number | string>>(new Set())

  // Administrators come straight from the data (distinct "Set by" values).
  const adminOptions = useMemo<MultiCheckboxOption<string>[]>(() => {
    const seen = new Set<string>()
    const opts: MultiCheckboxOption<string>[] = []
    for (const r of MOCK_OPTOUT) {
      if (seen.has(r.setBy)) continue
      seen.add(r.setBy)
      opts.push({ value: r.setBy, label: r.setBy })
    }
    return opts
  }, [])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return MOCK_OPTOUT.filter((r) => {
      if (reasons.length && !reasons.includes(r.reason)) return false
      if (admins.length && !admins.includes(r.setBy)) return false
      if (
        q &&
        !r.clientName.toLowerCase().includes(q) &&
        !r.tin.includes(q) &&
        !r.clientRef.toLowerCase().includes(q)
      )
        return false
      return true
    })
  }, [search, reasons, admins])

  const columns: Column<OptOutClient>[] = [
    {
      key: 'client',
      header: 'Client',
      render: (r) => (
        <div className="text-xs">
          <div className="text-dark-500 font-medium">{r.clientName}</div>
          <div className="text-gray-500">{r.clientRef}</div>
        </div>
      ),
    },
    {
      key: 'tin',
      header: 'TIN',
      render: (r) => <span className="text-xs text-gray-700">{r.tin}</span>,
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (r) => (
        <span className={`text-xs font-medium ${REASON_STYLES[r.reason]}`}>{r.reason}</span>
      ),
    },
    {
      key: 'setBy',
      header: 'Set by',
      render: (r) => <span className="text-xs text-gray-700">{r.setBy}</span>,
    },
    {
      key: 'dateAdded',
      header: 'Date added',
      render: (r) => <span className="text-xs text-gray-500">{r.dateAdded}</span>,
    },
    {
      key: 'note',
      header: 'Note',
      render: (r) => <span className="text-xs text-gray-600">{r.note}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: () => (
        // TODO(ubki-backend): remove → POST /opt-out/bulk (unset)
        <button
          type="button"
          className="text-error-600 inline-flex items-center gap-1 text-xs font-medium hover:underline"
        >
          <MdDeleteOutline size={14} /> Remove
        </button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        {/* Card header — title + actions, inside the card (matches design). */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-dark-500 flex items-center gap-2 text-sm font-semibold">
            Opt-out clients
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
              {MOCK_OPTOUT.length}
            </span>
          </h2>
          <div className="flex gap-2">
            {/* TODO(ubki-backend): CSV import endpoint */}
            <Button variant="secondary" size="sm" leftIcon={<MdOutlineFileUpload size={14} />}>
              Import from CSV
            </Button>
            {/* TODO(ubki-backend): add → POST /opt-out/bulk */}
            <Button variant="primary" size="sm" leftIcon={<MdAdd size={14} />}>
              Add to opt-out
            </Button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-dark-500 text-xs font-medium">Selected: {selected.size}</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client / TIN / contract…"
            className="focus:border-primary-500 h-[45px] min-w-[220px] flex-1 rounded-full border border-gray-400 bg-white px-4 text-xs text-gray-700 focus:outline-none"
          />
          <div className="w-44">
            <MultiCheckboxDropdown
              options={REASON_OPTIONS}
              selected={reasons}
              onChange={setReasons}
              allLabel="All reasons"
            />
          </div>
          <div className="w-52">
            <MultiCheckboxDropdown
              options={adminOptions}
              selected={admins}
              onChange={setAdmins}
              allLabel="All administrators"
            />
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <MdOutlinePersonOff size={28} className="text-gray-400" />
            <p className="text-dark-500 text-sm font-medium">No opt-out clients</p>
            <p className="text-xs text-gray-500">
              Clients added to the opt-out list won't receive UBKI submissions.
            </p>
            <div className="mt-1 flex gap-2">
              <Button variant="secondary" size="sm" leftIcon={<MdOutlineFileUpload size={14} />}>
                Import from CSV
              </Button>
              <Button variant="primary" size="sm" leftIcon={<MdAdd size={14} />}>
                Add client
              </Button>
            </div>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            enableBulkSelection
            selectedItems={selected}
            onSelectionChange={setSelected}
            className="w-full"
          />
        )}
      </div>
    </div>
  )
}
