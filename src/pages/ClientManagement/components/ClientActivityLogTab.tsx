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
import { useQueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { DateSelect } from '@/components/ui/DateSelect'
import { Pagination } from '@/components/ui/Pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { useClientActivityLog } from '@/features/clients/hooks/useClientActivityLog'
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGED_ENTRIES,
  type ActivityEntry,
  type ActivityLogResponse,
  type ActivitySource,
} from '@/features/clients/api/activityLogApi'
import { activityLogQueryKey } from '@/features/clients/hooks/useClientActivityLog'

interface ClientActivityLogTabProps {
  clientId: number | null
  /** The tab is mounted but inactive elsewhere in the card — don't fetch then. */
  isActive: boolean
  /**
   * Play a call's recording. The card owns `CallRecordingModal`, so the tab
   * hands the call up rather than mounting a second copy of it.
   *
   * A link cannot do this job: `recording_path` is a path on the telephony
   * host, and the endpoint that serves it needs a Bearer token an `<a href>`
   * cannot send. Every other screen in the app fetches the bytes through
   * `CallPlayer` for that reason.
   */
  onPlayRecording?: (call: ActivityCallRef) => void
}

/** What the card needs to open the player for one call from this feed. */
export interface ActivityCallRef {
  callId: string
  direction: string | null
  operatorName: string | null
  talkDurationSeconds: number | null
  ts: string
}

const ALL_OPERATORS = '__all__'

const SOURCE_STYLES: Record<ActivitySource, string> = {
  events: 'bg-primary-300/15 text-primary-700',
  audit: 'bg-amber-500/15 text-amber-700',
  calls: 'bg-emerald-500/15 text-emerald-700',
}

/**
 * Audit actions that are reads, not changes.
 *
 * They arrive from the audit service because that is where document access is
 * recorded, but opening a file changes nothing — badging them "Data changes"
 * alongside a status edit or a payment tells the reader the wrong thing. The
 * badge follows what the entry IS, not which service supplied it.
 */
const AUDIT_READ_ACTIONS = new Set(['document.viewed', 'document.downloaded'])

function badgeSource(entry: ActivityEntry): ActivitySource {
  return entry.source === 'audit' && AUDIT_READ_ACTIONS.has(entry.kind) ? 'events' : entry.source
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

/**
 * The call behind this entry, when it has a recording to play.
 *
 * `recording_path` decides whether audio exists at all -- the same signal the
 * Call List uses through the API's `has_recording`. It is never used as a URL:
 * it names a file on the telephony host, and the bytes come from the call
 * service instead.
 */
function playableCall(entry: ActivityEntry): ActivityCallRef | null {
  if (entry.source !== 'calls') return null
  const path = entry.detail?.recording_path
  const callId = entry.detail?.call_id
  if (typeof path !== 'string' || !path) return null
  if (typeof callId !== 'string' || !callId) return null
  const seconds = entry.detail?.talk_duration
  return {
    callId,
    direction: typeof entry.detail?.direction === 'string' ? entry.detail.direction : null,
    operatorName: entry.operator_name,
    talkDurationSeconds: typeof seconds === 'number' ? seconds : null,
    ts: entry.ts,
  }
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
    // Only three entry points are tracked at all now, so a new event always
    // names one of them. `other` survives on rows recorded before that, when
    // every open was logged; those keep the plain sentence rather than
    // claiming a source nobody captured.
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

export function ClientActivityLogTab({
  clientId,
  isActive,
  onPlayRecording,
}: ClientActivityLogTabProps) {
  const { t, i18n } = useTranslation('common')
  const [from, setFrom] = useState<Date | null>(null)
  const [to, setTo] = useState<Date | null>(null)
  const [operator, setOperator] = useState<string>(ALL_OPERATORS)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  // Every filter resets the page. Narrowing the feed while sitting on page 9
  // lands on a page the filtered result no longer has, which renders as "no
  // activity" and reads as a bug. Done in the setters rather than an effect so
  // the change is one render, not a render on the dead page and then a second
  // one -- the effect version also fired a request for that dead page.
  const applyFrom = (value: Date | null) => {
    setFrom(value)
    setPage(1)
  }
  const applyTo = (value: Date | null) => {
    setTo(value)
    setPage(1)
  }
  const applyOperator = (value: string) => {
    setOperator(value)
    setPage(1)
  }
  const applyPageSize = (value: number) => {
    setPageSize(value)
    setPage(1)
  }

  const filters = useMemo(
    () => ({
      fromTs: dayStart(from),
      toTs: dayEnd(to),
      operatorId: operator === ALL_OPERATORS ? null : Number(operator),
      page,
      pageSize,
    }),
    [from, to, operator, page, pageSize]
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

  // A degraded source reports no total, so the count covers only what actually
  // answered. Understating it is the safe direction: every page it offers holds
  // rows, and the banner already says the feed is short.
  //
  // Only page one carries a total -- counting audit's match set is the one
  // expensive part of the request and cannot change within a view, so it is
  // asked for once and kept here. Every filter resets to page one, so a view
  // always starts by learning its own total.
  // Only the first page carries a total: counting audit's match set is the one
  // expensive part of the request, and the number cannot change within a view,
  // so it is asked for once. Read back from the cache rather than mirrored
  // into local state -- the cache already holds it, and a second copy would
  // have to be kept in step with it.
  //
  // Every filter resets to page one, so a view always starts by learning its
  // own total, and `activityLogQueryKey` builds the same key the hook used.
  const cache = useQueryClient()
  const firstPage = cache.getQueryData<ActivityLogResponse>(
    activityLogQueryKey(clientId, { ...filters, page: 1 })
  )
  const total = data?.total ?? firstPage?.total ?? 0
  // Capped at what the endpoint will actually serve. It refuses to read past
  // MAX_PAGED_ENTRIES rows, so offering a page beyond that advertised a click
  // that could only fail.
  const reachablePages = Math.floor(MAX_PAGED_ENTRIES / pageSize)
  const totalPages = Math.max(1, Math.min(Math.ceil(total / pageSize), reachablePages))
  const hasUnreachableHistory = total > MAX_PAGED_ENTRIES

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* One row, one pattern: every control carries a small label above it and
          sits at its own width. The dates used to be `flex-1` with an inline
          label while the operator was a stacked one, so two mostly-empty
          pickers took three quarters of the bar and nothing shared a baseline.

          Reset holds its place instead of appearing with the first filter --
          rendering it conditionally shifted every other control sideways the
          moment an operator picked a date. */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs font-medium">
            {t('pages.clients.detail.activityLog.filters.dateRange')}
          </span>
          {/* Bounded by each other, so the range stays valid without needing a
              validation message. */}
          <div className="flex items-center gap-2">
            <DateSelect
              value={from}
              onChange={({ value }: { value: Date | null }) => applyFrom(value)}
              placeholder={t('pages.clients.detail.activityLog.filters.selectStartDate')}
              max={to ?? undefined}
              allowManualInput
              format="dd.MM.yyyy"
              className="w-36 [&_input]:h-9 [&_input]:text-xs"
            />
            <span className="text-muted-foreground text-sm">-</span>
            <DateSelect
              value={to}
              onChange={({ value }: { value: Date | null }) => applyTo(value)}
              placeholder={t('pages.clients.detail.activityLog.filters.selectEndDate')}
              min={from ?? undefined}
              allowManualInput
              format="dd.MM.yyyy"
              className="w-36 [&_input]:h-9 [&_input]:text-xs"
            />
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs font-medium">
            {t('pages.clients.detail.activityLog.filters.operator')}
          </span>
          <Select value={operator} onValueChange={applyOperator}>
            <SelectTrigger className="h-9 w-48">
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

        <Button
          variant="outline"
          className="h-9"
          disabled={!hasFilters}
          onClick={() => {
            setFrom(null)
            setTo(null)
            setOperator(ALL_OPERATORS)
            setPage(1)
          }}
        >
          {t('pages.clients.detail.activityLog.filters.reset')}
        </Button>

        {/* How much history is behind the filters, before anyone starts paging.
            Sits at the far end so it does not push the controls around as the
            number changes. */}
        {data !== undefined && (
          <span className="text-muted-foreground ml-auto pb-2 text-xs tabular-nums">
            {t('pages.clients.detail.activityLog.entryCount', { count: total })}
          </span>
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
        {(data?.entries ?? []).map((entry) => {
          const call = playableCall(entry)
          return (
            <li
              key={entry.id}
              className="border-border flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2"
            >
              <span
                className={cn(
                  'rounded px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
                  SOURCE_STYLES[badgeSource(entry)]
                )}
              >
                {t(`pages.clients.detail.activityLog.sources.${badgeSource(entry)}`)}
              </span>

              <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
                {formatTimestamp(entry.ts, i18n.language)}
              </span>

              {/* The play control sits with the sentence it acts on, not out
                  past the operator name. Only call rows carry one, so a
                  trailing column would have left it stranded at the row's edge
                  reading as though it belonged to the person rather than the
                  call. */}
              <span className="text-foreground flex min-w-0 flex-1 items-center gap-1.5 text-sm break-words">
                {entrySummary(entry, t)}
                {call && onPlayRecording && (
                  <button
                    type="button"
                    onClick={() => onPlayRecording(call)}
                    aria-label={t('pages.clients.detail.activityLog.recording')}
                    title={t('pages.clients.detail.activityLog.recording')}
                    className="text-secondary-700 hover:bg-secondary-50 inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors"
                  >
                    <Icons.Play size={14} strokeWidth={1.5} />
                  </button>
                )}
              </span>

              {entry.operator_name && (
                <span className="text-muted-foreground text-xs whitespace-nowrap">
                  {entry.operator_name}
                </span>
              )}
            </li>
          )
        })}
      </ul>

      {/* The three sources hold thousands of entries for an active client. A
          feed that stopped at the first page said nothing about the rest, so
          the history it hid read as history that did not exist. */}
      {/* Capping the control silently would have been the same failure the
          feed started with: a history that ends without saying it was cut.
          The date filter is how the rest is reached, so the notice names it. */}
      {hasUnreachableHistory && !isLoading && !isError && (
        <p className="text-muted-foreground text-xs">
          {t('pages.clients.detail.activityLog.pagingLimit', {
            count: MAX_PAGED_ENTRIES,
          })}
        </p>
      )}

      {!isLoading && !isError && totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={applyPageSize}
        />
      )}
    </div>
  )
}
