/**
 * Client activity tab — one merged feed of who opened this client, what they
 * did in it, the calls, and the data changes.
 *
 * The three underlying stores are merged server-side, so this component renders
 * a flat list. It does have to handle a partial answer: the response names any
 * source that failed in `degraded`, and showing an incomplete feed as if it
 * were complete would be worse than showing nothing.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { DateSelect } from '@/components/ui/DateSelect'
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

/** The picker yields a bare day. Widen it to cover the whole of that day. */
function dayStart(value: Date | null): string | null {
  if (!value) return null
  const d = new Date(value)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function dayEnd(value: Date | null): string | null {
  if (!value) return null
  const d = new Date(value)
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
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

/**
 * Tab identifiers as stored in the event, mapped to the label the operator
 * actually sees on the tab. The raw values ("documents", "call-sms-history")
 * are internal state names and mean nothing to a reader of this feed. Reusing
 * the tab strip's own translation keys keeps the two from drifting apart, and
 * gives the feed a Ukrainian rendering for free.
 */
const TAB_LABEL_KEYS: Record<string, string> = {
  // Main card sections
  loans: 'pages.clients.detail.tabs.loans',
  payments: 'pages.clients.detail.payments',
  recommenders: 'pages.clients.detail.tabs.recommenders',
  operators: 'pages.clients.detail.operators',
  'call-sms-history': 'pages.clients.detail.tabs.callSms',
  tasks: 'pages.clients.detail.tabs.tasks',
  documents: 'pages.clients.detail.tabs.docs',
  activity: 'pages.clients.detail.tabs.activity',
  // Personal-details sub-tabs
  personal: 'pages.clients.detail.tabs.personal',
  related: 'pages.clients.detail.tabs.relatedTags',
  passport: 'pages.clients.detail.tabs.passport',
  work: 'pages.clients.detail.tabs.work',
}

/**
 * Render a UI event in the reader's language, falling back to the summary the
 * backend built for anything not recognised here.
 */
function entrySummary(entry: ActivityEntry, t: TFunction): string {
  const meta = (entry.detail?.meta ?? {}) as Record<string, unknown>
  const p = 'pages.clients.detail.activityLog'

  const tabValue =
    entry.kind === 'client_card_section_open'
      ? meta.section
      : entry.kind === 'client_card_tab_switch'
        ? meta.tab
        : null

  if (typeof tabValue === 'string') {
    const labelKey = TAB_LABEL_KEYS[tabValue]
    // An unmapped tab shows its raw value rather than nothing — a tab added
    // later should still be legible here before anyone updates this map.
    return t(`${p}.openedTab`, { tab: labelKey ? t(labelKey) : tabValue })
  }

  if (entry.kind === 'client_modal_open') {
    const modal = typeof meta.modal === 'string' ? meta.modal : null
    // `defaultValue` keeps an unlabelled modal legible as its raw key rather
    // than rendering the translation path itself.
    const label = modal ? t(`${p}.modals.${modal}`, { defaultValue: modal }) : null
    if (label) return t(`${p}.openedModal`, { modal: label })
  }

  if (entry.kind === 'client_card_open') {
    // `other` and older events without an origin both fall back to the plain
    // sentence — only the three tagged entry points claim a source.
    const origin = typeof meta.origin === 'string' ? meta.origin : null
    if (origin && origin !== 'other') {
      return t(`${p}.openedCardFrom`, { origin: t(`${p}.origins.${origin}`, origin) })
    }
    return t(`${p}.openedCard`)
  }
  if (entry.kind === 'interaction_form_open') return t(`${p}.openedForm`)
  if (entry.kind === 'interaction_form_submit') return t(`${p}.submittedForm`)

  return entry.summary ?? entry.kind
}

export function ClientActivityLogTab({ clientId, isActive }: ClientActivityLogTabProps) {
  const { t, i18n } = useTranslation('common')
  const [from, setFrom] = useState<Date | null>(null)
  const [to, setTo] = useState<Date | null>(null)
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

  // The operator list comes from what the feed contains rather than a user
  // lookup: only people who touched this client can appear in it anyway, and
  // fetching users would list hundreds who never did.
  //
  // It ACCUMULATES rather than being rebuilt per response. Selecting an
  // operator narrows the feed to that person, so a list derived from the
  // current response would collapse to the one already chosen — leaving no way
  // to switch to anyone else without clearing the filter first. A date range
  // does the same. The first load is unfiltered, so the list starts complete.
  const seenOperators = useRef(new Map<number, string>())
  const [operators, setOperators] = useState<[number, string][]>([])

  useEffect(() => {
    const seen = seenOperators.current
    let added = false
    for (const entry of data?.entries ?? []) {
      if (entry.operator_id != null && !seen.has(entry.operator_id)) {
        seen.set(entry.operator_id, entry.operator_name ?? String(entry.operator_id))
        added = true
      }
    }
    if (added) {
      setOperators([...seen.entries()].sort((a, b) => a[1].localeCompare(b[1])))
    }
  }, [data?.entries])

  const hasFilters = from !== null || to !== null || operator !== ALL_OPERATORS

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-end gap-3">
        {/* Same shape as the Action Analysis filter bar — a labelled pair of
            DateSelects bounded by each other, so the range stays valid without
            a validation message. */}
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <span className="text-foreground shrink-0 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
            {t('pages.clients.detail.activityLog.filters.dateRange')}:
          </span>
          <div className="flex flex-1 items-center gap-2">
            <DateSelect
              value={from}
              onChange={({ value }: { value: Date | null }) => setFrom(value)}
              placeholder={t('pages.clients.detail.activityLog.filters.selectStartDate')}
              max={to ?? undefined}
              allowManualInput
              format="dd.MM.yyyy"
              className="flex-1 [&_input]:h-9 [&_input]:text-xs"
            />
            <span className="text-foreground text-base leading-[150%] font-medium tracking-[-0.28px]">
              -
            </span>
            <DateSelect
              value={to}
              onChange={({ value }: { value: Date | null }) => setTo(value)}
              placeholder={t('pages.clients.detail.activityLog.filters.selectEndDate')}
              min={from ?? undefined}
              allowManualInput
              format="dd.MM.yyyy"
              className="flex-1 [&_input]:h-9 [&_input]:text-xs"
            />
          </div>
        </div>

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
              setFrom(null)
              setTo(null)
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
                {entrySummary(entry, t)}
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
