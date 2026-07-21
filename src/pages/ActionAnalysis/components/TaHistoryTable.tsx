import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { formatDate, formatDateTime, formatMoneyKopeckTight } from '@/lib/formatters'
import type { TAInteraction } from '@/features/taInteractions/api/types'
import type { TAChain } from '@/features/taChains/api/types'
import type { TargetAction } from '@/features/targetActions/api/types'

type Row = TAInteraction & { id: number }

interface Props {
  data: TAInteraction[]
  chains: TAChain[]
  tasById: Map<number, TargetAction>
  userTimezone?: string | null
}

interface ResultEntry {
  value: string
  followUps: string[]
}

function normalizeStepValue(raw: unknown): string {
  const v = typeof raw === 'object' && raw !== null ? (raw as { value?: unknown }).value : raw
  return v != null ? String(v) : ''
}

function buildResultEntries(
  row: TAInteraction,
  chains: TAChain[],
  tasById: Map<number, TargetAction>,
  userTimezone?: string | null
): ResultEntry[] {
  const formatStepValue = (fieldType: string | undefined, val: string): string => {
    if (fieldType === 'credit') {
      return val
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((id) => {
          const numId = parseInt(id, 10)
          return Number.isNaN(numId) ? id : `#${numId}`
        })
        .join(', ')
    }
    if (fieldType === 'amount') return formatMoneyKopeckTight(val)
    if (fieldType === 'date') return formatDateTime(val, userTimezone ?? undefined)
    return val
  }

  const entries: ResultEntry[] = []
  let consumedPromiseDate = false
  let consumedPromiseAmount = false
  let consumedCredit = false

  if (row.step_data && Object.keys(row.step_data).length > 0) {
    const chain = chains.find((c) => c.id === row.chain_id)
    const stepsOrdered = chain?.steps
      ? [...chain.steps].sort((a, b) => a.step_order - b.step_order)
      : []

    if (stepsOrdered.length > 0) {
      for (const step of stepsOrdered) {
        const sd = row.step_data as Record<string, unknown>
        const val = normalizeStepValue(
          sd[String(step.step_order)] ?? sd[String(step.target_action_id)]
        )
        if (!val) continue
        // Phone (contact-type) values render in a dedicated way on the per-client
        // page; here we just include them inline since we have no Phone column.
        const ta = tasById.get(step.target_action_id)
        const followUps: string[] = []

        if (ta?.field_type === 'dropdown') {
          const picked = ta.dropdown_values.find((dv) => dv.value === val)
          if (picked) {
            if (picked.require_promise_date && row.promise_date && !consumedPromiseDate) {
              followUps.push(formatDate(row.promise_date))
              consumedPromiseDate = true
            }
            if (picked.require_promise_amount && row.promise_amount && !consumedPromiseAmount) {
              followUps.push(formatMoneyKopeckTight(row.promise_amount))
              consumedPromiseAmount = true
            }
            if (picked.require_credit && row.credit_id && !consumedCredit) {
              followUps.push(`#${row.credit_id}`)
              consumedCredit = true
            }
          }
        }

        entries.push({
          value: formatStepValue(step.target_action_field_type ?? undefined, val),
          followUps,
        })
      }
    } else {
      for (const [, raw] of Object.entries(row.step_data as Record<string, unknown>)) {
        const val = normalizeStepValue(raw)
        if (val) entries.push({ value: val, followUps: [] })
      }
    }
  }

  const orphan: string[] = []
  if (row.promise_date && !consumedPromiseDate) orphan.push(formatDate(row.promise_date))
  if (row.promise_amount && !consumedPromiseAmount) {
    orphan.push(formatMoneyKopeckTight(row.promise_amount))
  }
  if (row.credit_id && !consumedCredit) orphan.push(`#${row.credit_id}`)
  if (orphan.length > 0) {
    if (entries.length > 0) entries[entries.length - 1].followUps.push(...orphan)
    else entries.push({ value: '', followUps: orphan })
  }

  return entries
}

export function TaHistoryTable({ data, chains, tasById, userTimezone }: Props) {
  const { t } = useTranslation('common')

  const rows: Row[] = data.map((i) => ({ ...i, id: i.id }))

  const columns: Column<Row>[] = [
    {
      key: 'date',
      header: t('pages.actionAnalysis.columns.dateTime', 'Date / Time'),
      render: (r) => (
        <span className="text-foreground text-sm">{formatDateTime(r.created_at)}</span>
      ),
    },
    {
      key: 'clientId',
      header: t('pages.actionAnalysis.columns.clientId', 'Client ID'),
      render: (r) => (
        <Link
          to={`/dashboard/clients/${r.client_id}`}
          className="text-primary-600 text-sm font-medium hover:underline"
        >
          #{r.client_id}
        </Link>
      ),
    },
    {
      key: 'chain',
      header: t('pages.actionAnalysis.columns.chain', 'Chain'),
      render: (r) => <span className="text-foreground text-sm">{r.chain_name ?? '—'}</span>,
    },
    {
      key: 'result',
      header: t('pages.actionAnalysis.columns.result', 'Result'),
      render: (r) => {
        const entries = buildResultEntries(r, chains, tasById, userTimezone)
        if (entries.length === 0) {
          const fallback =
            r.dropdown_value_name ??
            r.leaf_node_name ??
            (r.dictionary_path.length > 0 ? r.dictionary_path.join(' > ') : '—')
          return <span className="text-foreground text-sm">{fallback}</span>
        }
        return (
          <span className="text-foreground text-sm">
            {entries.map((e, i) => (
              <span key={i}>
                {e.value}
                {e.followUps.length > 0 && (
                  <span className="text-muted-foreground"> ({e.followUps.join(', ')})</span>
                )}
                {i < entries.length - 1 && ' -> '}
              </span>
            ))}
          </span>
        )
      },
    },
    {
      key: 'createdBy',
      header: t('pages.actionAnalysis.columns.createdBy', 'Created by'),
      render: (r) => (
        <span className="text-foreground text-sm">
          {r.recorded_by_full_name ?? r.recorded_by_name ?? '—'}
        </span>
      ),
    },
    {
      key: 'responsibleAtCreation',
      header: t('pages.actionAnalysis.columns.responsibleAtCreation', 'Responsible at creation'),
      render: (r) => (
        <span className="text-foreground text-sm">{r.assigned_operator_name ?? '—'}</span>
      ),
    },
    {
      key: 'currentResponsible',
      header: t('pages.actionAnalysis.columns.currentResponsible', 'Current responsible'),
      render: (r) => (
        <span className="text-foreground text-sm">{r.current_responsible_name ?? '—'}</span>
      ),
    },
    {
      key: 'notes',
      header: t('pages.actionAnalysis.columns.notes', 'Notes'),
      render: (r) => (
        <span className="text-muted-foreground text-sm" title={r.notes ?? undefined}>
          {r.notes ? (r.notes.length > 60 ? `${r.notes.slice(0, 60)}…` : r.notes) : '—'}
        </span>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyMessage={t(
        'pages.actionAnalysis.taHistoryEmpty',
        'No TA interactions match the current filters'
      )}
    />
  )
}
