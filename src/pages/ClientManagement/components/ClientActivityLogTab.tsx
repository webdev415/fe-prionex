/**
 * Client activity tab — one merged feed of who opened this client, what they
 * did in it, the calls, and the data changes.
 *
 * The three underlying stores are merged server-side, so this component renders
 * a flat list. It does have to handle a partial answer: the response names any
 * source that failed in `degraded`, and showing an incomplete feed as if it
 * were complete would be worse than showing nothing.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { useClientActivityLog } from '@/features/clients/hooks/useClientActivityLog'
import type { ActivityEntry, ActivitySource } from '@/features/clients/api/activityLogApi'

interface ClientActivityLogTabProps {
  clientId: number | null
  /** The tab is mounted but inactive elsewhere in the card — don't fetch then. */
  isActive: boolean
}

const ALL_OPERATORS = '__all__'

const SOURCE_STYLES: Record<ActivitySource, string> = {
  events: 'bg-primary-300/15 text-primary-700',
  audit: 'bg-amber-500/15 text-amber-700',
  calls: 'bg-emerald-500/15 text-emerald-700',
}

/** A date input gives a bare day. Widen it to cover the whole day, in UTC. */
function dayStart(value: string): string | null {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : null
}

function dayEnd(value: string): string | null {
  return value ? new Date(`${value}T23:59:59.999Z`).toISOString() : null
}

function formatTimestamp(ts: string, locale: string): string {
  const parsed = new Date(ts)
  if (Number.isNaN(parsed.getTime())) return ts
  return parsed.toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function recordingPath(entry: ActivityEntry): string | null {
  const value = entry.detail?.recording_path
  return typeof value === 'string' && value ? value : null
}

export function ClientActivityLogTab({ clientId, isActive }: ClientActivityLogTabProps) {
  const { t, i18n } = useTranslation('common')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [operator, setOperator] = useState<string>(ALL_OPERATORS)

  const filters = useMemo(
    () => ({
      fromTs: dayStart(from),
      toTs: dayEnd(to),
      operatorId: operator === ALL_OPERATORS ? null : Number(operator),
    }),
    [from, to, operator]
  )

  const { data, isLoading, isError } = useClientActivityLog(clientId, filters, isActive)

  // The operator list is built from what the feed actually contains rather than
  // fetched: only people who touched this client can appear in it anyway, and a
  // separate user lookup would list hundreds who never did.
  const operators = useMemo(() => {
    const seen = new Map<number, string>()
    for (const entry of data?.entries ?? []) {
      if (entry.operator_id != null && !seen.has(entry.operator_id)) {
        seen.set(entry.operator_id, entry.operator_name ?? String(entry.operator_id))
      }
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [data?.entries])

  const hasFilters = from !== '' || to !== '' || operator !== ALL_OPERATORS

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs font-medium">
            {t('pages.clients.detail.activityLog.filters.from')}
          </span>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs font-medium">
            {t('pages.clients.detail.activityLog.filters.to')}
          </span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs font-medium">
            {t('pages.clients.detail.activityLog.filters.operator')}
          </span>
          <Select value={operator} onValueChange={setOperator}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_OPERATORS}>
                {t('pages.clients.detail.activityLog.filters.allOperators')}
              </SelectItem>
              {operators.map(([id, name]) => (
                <SelectItem key={id} value={String(id)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        {hasFilters && (
          <Button
            variant="outline"
            onClick={() => {
              setFrom('')
              setTo('')
              setOperator(ALL_OPERATORS)
            }}
          >
            {t('pages.clients.detail.activityLog.filters.reset')}
          </Button>
        )}
      </div>

      {data && data.degraded.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
          {t('pages.clients.detail.activityLog.degraded', {
            sources: data.degraded
              .map((s) => t(`pages.clients.detail.activityLog.sources.${s}`))
              .join(', '),
          })}
        </div>
      )}

      {isLoading && (
        <div className="text-muted-foreground py-8 text-center text-sm">
          <Icons.Spinner className="mx-auto mb-2" />
        </div>
      )}

      {isError && (
        <div className="py-8 text-center text-sm text-red-600">
          {t('pages.clients.detail.activityLog.loadError')}
        </div>
      )}

      {!isLoading && !isError && (data?.entries.length ?? 0) === 0 && (
        <div className="text-muted-foreground py-8 text-center text-sm">
          {t('pages.clients.detail.activityLog.empty')}
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {(data?.entries ?? []).map((entry, index) => {
          const recording = recordingPath(entry)
          return (
            <li
              key={`${entry.source}-${entry.ts}-${index}`}
              className="border-border flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2"
            >
              <span
                className={cn(
                  'rounded px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
                  SOURCE_STYLES[entry.source]
                )}
              >
                {t(`pages.clients.detail.activityLog.sources.${entry.source}`)}
              </span>

              <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
                {formatTimestamp(entry.ts, i18n.language)}
              </span>

              <span className="text-foreground min-w-0 flex-1 text-sm break-words">
                {entry.summary ?? entry.kind}
              </span>

              {entry.operator_name && (
                <span className="text-muted-foreground text-xs whitespace-nowrap">
                  {entry.operator_name}
                </span>
              )}

              {recording && (
                <a
                  href={recording}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary-700 text-xs underline"
                >
                  {t('pages.clients.detail.activityLog.recording')}
                </a>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
