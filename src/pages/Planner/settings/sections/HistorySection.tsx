/**
 * «Історія» (planner story 5.10, AC1; UX C-08): the board's journal from
 * `GET /boards/{code}/history`, newest first — what happened, who did it and
 * from which client, when (on the board's clock), and what changed: the
 * configuration sections, a participant's role, the policy settings, the time
 * zone. The server keeps the last 500 lines; a longer journal says so.
 */
import { useTranslation } from 'react-i18next'
import { intlLocaleForUiLanguage } from '@/lib/i18n'
import { piiProps } from '@/lib/openreplay/pii'
import { usePlannerBoardHistory } from '@/api/planner/plannerQueries'
import type { PlannerBoard, PlannerBoardHistoryEntry } from '@/api/planner/plannerApi'
import { TaskListSkeleton } from '../../components/PlannerStates'
import { personName, usableTimeZone, type PlannerT } from '../../plannerFormat'
import { SectionHeading } from '../settingsUi'

const CONFIG_SECTIONS = ['statuses', 'task_types', 'fields', 'labels', 'priorities', 'defaults']
const SECTION_LABEL: Record<string, string> = {
  statuses: 'settings.sections.statuses',
  task_types: 'settings.sections.types',
  fields: 'settings.sections.fields',
  labels: 'settings.sections.labels',
  priorities: 'settings.sections.priorities',
  defaults: 'settings.sections.defaults',
}
const KNOWN_ACTIONS = [
  'created',
  'member_changed',
  'config_changed',
  'policy_changed',
  'tzid_changed',
]
/** Clients of the contract (`TaskHistoryEntry.client`) in words; others read as sent. */
const KNOWN_CLIENTS = ['crm', 'hub-web', 'hub-mobile', 'system']
const ROLES = ['board_admin', 'board_member', 'board_guest']

type Snapshot = Record<string, unknown> | null

function field(snapshot: Snapshot, key: string): unknown {
  return snapshot && typeof snapshot === 'object' ? snapshot[key] : undefined
}

/** What the line changed, in words; empty when the journal says nothing more. */
function details(entry: PlannerBoardHistoryEntry, t: PlannerT): string {
  const { action, before, after } = entry
  if (action === 'config_changed') {
    const changed = CONFIG_SECTIONS.filter(
      (key) => JSON.stringify(field(before, key)) !== JSON.stringify(field(after, key))
    )
    return changed.length > 0
      ? t('settings.history.sectionsChanged', {
          list: changed.map((key) => t(SECTION_LABEL[key])).join(', '),
        })
      : ''
  }
  if (action === 'member_changed') {
    const role = (snapshot: Snapshot) => {
      const value = field(snapshot, 'role')
      return typeof value === 'string' && ROLES.includes(value)
        ? t(`settings.members.roles.${value}`)
        : '—'
    }
    return t('settings.history.roleChange', { before: role(before), after: role(after) })
  }
  if (action === 'policy_changed') {
    const keys = Object.keys(after ?? before ?? {})
    return keys.length > 0
      ? t('settings.history.policyKeys', {
          list: keys
            .map((key) => t(`settings.history.policyKeyNames.${key}`, { defaultValue: key }))
            .join(', '),
        })
      : ''
  }
  if (action === 'tzid_changed') {
    const zone = (snapshot: Snapshot) => {
      const value = field(snapshot, 'tzid')
      return typeof value === 'string' ? value : '—'
    }
    return t('settings.history.tzidChange', { before: zone(before), after: zone(after) })
  }
  return ''
}

export function HistorySection({ board }: { board: PlannerBoard }) {
  const { t, i18n } = useTranslation('planner')
  const history = usePlannerBoardHistory(board.code)
  const timeZone = usableTimeZone(board.tzid)
  const format = new Intl.DateTimeFormat(intlLocaleForUiLanguage(i18n.language ?? 'uk'), {
    dateStyle: 'short',
    timeStyle: 'short',
    ...(timeZone ? { timeZone } : { timeZone: 'UTC' }),
  })
  const items = [...(history.data?.items ?? [])].sort((a, b) => b.at.localeCompare(a.at))

  return (
    <section className="space-y-3" aria-labelledby="planner-settings-history">
      <SectionHeading id="planner-settings-history" title={t('settings.sections.history')} />
      {history.isPending && <TaskListSkeleton />}
      {history.isError && !history.data && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-foreground text-sm">{t('settings.history.error')}</p>
          <button
            type="button"
            className="text-primary text-sm hover:underline"
            onClick={() => void history.refetch()}
          >
            {t('settings.retry')}
          </button>
        </div>
      )}
      {history.isSuccess && items.length === 0 && (
        <p className="text-muted-foreground text-sm">{t('settings.history.empty')}</p>
      )}
      {items.length > 0 && (
        <ol className="divide-border divide-y text-sm">
          {items.map((entry) => {
            const detail = details(entry, t)
            const at = new Date(entry.at)
            return (
              <li key={entry.id} className="space-y-0.5 py-2">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-foreground font-medium">
                    {KNOWN_ACTIONS.includes(entry.action)
                      ? t(`settings.history.actions.${entry.action}`)
                      : entry.action}
                  </span>
                  <time dateTime={entry.at} className="text-muted-foreground text-xs tabular-nums">
                    {Number.isNaN(at.getTime()) ? entry.at : format.format(at)}
                  </time>
                </div>
                <p className="text-muted-foreground text-xs">
                  <span {...piiProps}>
                    {entry.actor ? personName(entry.actor) : t('settings.history.system')}
                  </span>
                  {entry.client && entry.client !== 'unknown'
                    ? ` · ${
                        KNOWN_CLIENTS.includes(entry.client)
                          ? t(`settings.history.clients.${entry.client}`)
                          : entry.client
                      }`
                    : ''}
                </p>
                {detail && <p className="text-foreground text-xs">{detail}</p>}
              </li>
            )
          })}
        </ol>
      )}
      {history.data?.truncated && (
        <p className="text-muted-foreground text-xs">{t('settings.history.truncated')}</p>
      )}
    </section>
  )
}

export default HistorySection
