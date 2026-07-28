/**
 * Supervisor Analysis tab (KAN-379, design: supervisor-07).
 *
 * A KPI strip derived from the live per-operator stats, a preset + status
 * filter, the per-operator table (with a utilization ProgressBar), and a
 * per-SIM statistics sub-table (ticket §12.2).
 *
 * Reuses the ReportsDashboard per-operator table + ProgressBar cell pattern.
 * Stats poll live via useOperatorStats / useSimStats.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTable, type Column } from '@/components/ui/DataTable'
import { ProgressBar } from '@/components/ui/ProgressBar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { useDialerQueues, useOperatorStats, type OperatorDialerStats } from '@/features/dialer'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

import { DialerKpiStrip } from '../DialerKpiStrip'

const ALL = 'all'
type StatusFilter = 'all' | 'in_conversation' | 'awaiting_call'

type OperatorRow = OperatorDialerStats & { id: number }

function fmtDuration(seconds: number): string {
  if (!seconds) return '0m'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  return `${m}m`
}

function fmtClock(seconds?: number | null): string {
  if (!seconds && seconds !== 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function fmtTime(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

export function AnalysisTab() {
  const { t } = useTranslation('common')

  const { data: queues } = useDialerQueues()
  const [queueId, setQueueId] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const { data: stats, isLoading } = useOperatorStats(queueId ? { queue_id: queueId } : {})

  const rows: OperatorRow[] = useMemo(
    () => (stats ?? []).map((s) => ({ ...s, id: s.operator_id })),
    [stats]
  )

  // KPI aggregates (derived from all rows, before the status filter).
  const kpi = useMemo(() => {
    const inConversation = rows.filter((r) => r.status === 'in_conversation').length
    const waiting = rows.filter((r) => r.status === 'awaiting_call').length
    const totalTalk = rows.reduce((sum, r) => sum + (r.talk_time_seconds || 0), 0)
    const processed = rows.reduce((sum, r) => sum + (r.processed || 0), 0)
    return { operators: rows.length, inConversation, waiting, totalTalk, processed }
  }, [rows])

  const filteredRows = useMemo(
    () => (statusFilter === 'all' ? rows : rows.filter((r) => r.status === statusFilter)),
    [rows, statusFilter]
  )

  const operatorColumns: Column<OperatorRow>[] = useMemo(
    () => [
      {
        key: 'operator',
        header: t('dialer.analysis.operator', 'Operator'),
        render: (r) => (
          <div className="flex items-center gap-2">
            <span className="bg-muted text-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
              {initials(r.operator_name)}
            </span>
            <div className="min-w-0">
              <p className="text-foreground truncate text-sm font-medium">{r.operator_name}</p>
              {r.operator_email && (
                <p className="text-muted-foreground truncate text-xs">{r.operator_email}</p>
              )}
            </div>
          </div>
        ),
      },
      {
        key: 'status',
        header: t('dialer.analysis.status', 'Status'),
        render: (r) => {
          const inConv = r.status === 'in_conversation'
          return (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
                inConv ? 'bg-success-50 text-success-600' : 'bg-amber-50 text-amber-600'
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  inConv ? 'bg-success-500' : 'bg-amber-500'
                )}
              />
              {inConv
                ? t('dialer.analysis.inConversation', 'In conversation')
                : t('dialer.analysis.awaitingCall', 'Awaiting call')}
            </span>
          )
        },
      },
      {
        key: 'in_line_since',
        header: t('dialer.analysis.inLineWith', 'In line with'),
        render: (r) => fmtTime(r.in_line_since),
      },
      {
        key: 'time_in_line_seconds',
        header: t('dialer.analysis.timeInLine', 'Time in Line'),
        render: (r) => fmtDuration(r.time_in_line_seconds),
      },
      {
        key: 'talk_time_seconds',
        header: t('dialer.analysis.talkTime', 'Talk Time'),
        render: (r) => fmtDuration(r.talk_time_seconds),
      },
      {
        key: 'utilization_pct',
        header: t('dialer.analysis.utilization', 'Utilization'),
        render: (r) => (
          <div className="flex items-center gap-2">
            <ProgressBar
              percentage={r.utilization_pct}
              height="sm"
              className="w-24"
              barClassName={r.utilization_pct >= 75 ? 'bg-success-500' : 'bg-amber-400'}
            />
            <span className="text-muted-foreground w-9 text-right text-xs">
              {Math.round(r.utilization_pct)}%
            </span>
          </div>
        ),
      },
      {
        key: 'processed',
        header: t('dialer.analysis.processed', 'Processed'),
        align: 'right',
        render: (r) => r.processed.toLocaleString(),
      },
      {
        key: 'current_call',
        header: t('dialer.analysis.currentCall', 'Current call'),
        align: 'right',
        render: (r) =>
          r.current_call_phone ? (
            <div className="text-right">
              <p className="text-foreground text-sm">{r.current_call_phone}</p>
              <p className="text-muted-foreground text-xs">
                {fmtClock(r.current_call_duration_seconds)}
              </p>
            </div>
          ) : (
            '—'
          ),
      },
    ],
    [t]
  )

  return (
    <div className="flex flex-col gap-4">
      {/* KPI strip (design: supervisor-07) — same surface as Queue of Numbers. */}
      <DialerKpiStrip
        items={[
          {
            icon: <Icons.Headset size={20} />,
            label: t('dialer.analysis.operatorsInLine', 'Operators in Line'),
            value: kpi.operators,
          },
          {
            icon: <Icons.CallRinging04 size={20} />,
            label: t('dialer.analysis.currentlyInConversation', 'Currently in Conversation'),
            value: kpi.inConversation,
          },
          {
            icon: <Icons.CallIncoming01 size={20} />,
            label: t('dialer.analysis.waitingForCall', 'Waiting for a Call'),
            value: kpi.waiting,
          },
          {
            icon: <Icons.TimeQuarter02 size={20} />,
            label: t('dialer.analysis.totalTalkTime', 'Total Talk Time'),
            value: fmtDuration(kpi.totalTalk),
          },
          {
            icon: <Icons.UserCheck02 size={20} />,
            label: t('dialer.analysis.clientsProcessed', 'Clients Processed'),
            value: kpi.processed.toLocaleString(),
          },
        ]}
      />

      {/* Toolbar: preset + status filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:w-56">
          <Select
            value={queueId ? String(queueId) : ALL}
            onValueChange={(v) => setQueueId(v === ALL ? null : Number(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('dialer.analysis.allPresets', 'All presets')}</SelectItem>
              {(queues ?? []).map((q) => (
                <SelectItem key={q.id} value={String(q.id)}>
                  {q.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Status filter — segmented switch (same style as the Queue List). */}
        <div className="inline-flex items-center gap-1 rounded-lg bg-white p-1 shadow-[0px_1px_3px_0px_#0000001A,0px_1px_2px_0px_#0000000F]">
          {(
            [
              [
                'in_conversation',
                t('dialer.analysis.inConversation', 'In conversation'),
                kpi.inConversation,
              ],
              ['awaiting_call', t('dialer.analysis.waiting', 'Waiting'), kpi.waiting],
            ] as const
          ).map(([key, label, count]) => {
            const active = statusFilter === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(active ? 'all' : key)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-medium transition-colors',
                  active ? 'bg-secondary-800 text-white' : 'text-foreground hover:bg-muted'
                )}
              >
                {label}
                <span
                  className={cn(
                    'flex h-4 min-w-4 items-center justify-center rounded-full px-1.5 text-[10px] font-medium',
                    active ? 'bg-primary-300 text-primary-foreground' : 'bg-gray-100 text-gray-800'
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Operator table */}
      {isLoading ? (
        <div className="text-muted-foreground border-border rounded-xl border bg-white p-10 text-center text-sm">
          {t('common.loading', 'Loading...')}
        </div>
      ) : (
        <div className="dialer-analysis-card overflow-hidden rounded-xl bg-white/50 shadow-[0px_1px_3px_0px_#00000012]">
          <DataTable
            columns={operatorColumns}
            data={filteredRows}
            emptyMessage={t('dialer.analysis.empty', 'No operators connected.')}
          />
        </div>
      )}
    </div>
  )
}

export default AnalysisTab
