/**
 * Scoring v3 — per-brand settings (KAN-792).
 *
 * Every knob the rules layer reads, editable without a deploy. The audience is
 * collections ops, not the people who built the model, so the page is written in
 * their vocabulary: "call back today", "give up on", "how many debts a month".
 * The model's own words (tau, hazard) appear only where unavoidable, and then
 * with the plain meaning beside them.
 *
 * Three rules this screen holds to:
 *
 *   * **Say what a change costs.** tau is meaningless on its own; the number ops
 *     weigh is how many debts land in the queue. So queue size leads and tau is
 *     tucked behind "show the exact cut-off".
 *   * **Don't validate here.** The scoring job reads the STORED values, so the
 *     server's schema is the only validation that counts; a second copy in the
 *     form would drift. Server rejections are surfaced verbatim.
 *   * **Don't imply it is retroactive.** Values apply on the next run. Saying so
 *     on screen prevents the dangerous reading of "saved".
 *
 * Separate from the legacy Scoring Configuration screen on purpose: that one
 * tunes the 0-100 score, this tunes the v3 model. One page would suggest the two
 * sets of numbers interact.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { PermissionGuard } from '@/components/auth'
import { useHasPermission } from '@/hooks'
import { PERMISSIONS } from '@/constants/permissions'
import {
  useActiveProjectId,
  useUpdateV3Settings,
  useV3Settings,
} from '@/features/scoring/hooks/useV3Scores'
import type { TauCapacityPoint, V3Settings } from '@/features/scoring/api/types'
import { uiDecimal, uiLocale } from '@/lib/formatters'
import { ScoringV3SettingsPageSkeleton } from './ScoringV3SettingsPageSkeleton'

type FieldSpec = {
  key: keyof V3Settings
  /** Computed by the model from another field — shown, never edited. */
  derived?: boolean
  step?: number
  min?: number
  max?: number
  nullable?: boolean
}

const SECTIONS: { id: 'promise' | 'contact' | 'partial' | 'limits'; fields: FieldSpec[] }[] = [
  {
    id: 'promise',
    fields: [
      { key: 'ptp_active_window_days' },
      { key: 'ptp_active_max_age_days' },
      {
        key: 'ptp_broken_min_days',
        // Not editable: the model starts the broken window the day the promise
        // window closes, and has no separate setting for it. It was shown as a
        // normal input, so ops could change it, save it, watch it audited — and
        // the scorer ignored it. A read-only derived value is the honest form.
        derived: true,
      },
      { key: 'ptp_broken_max_days' },
    ],
  },
  {
    id: 'contact',
    fields: [{ key: 'inbound_crit_max_days' }, { key: 'inbound_high_max_days' }],
  },
  {
    id: 'partial',
    fields: [
      { key: 'partial_avg_max_days' },
      { key: 'partial_high_max_days' },
      { key: 'partial_pay_expire_days', nullable: true },
    ],
  },
  {
    id: 'limits',
    fields: [
      { key: 'weekly_contact_cap' },
      { key: 'floor_min_real_payments' },
      { key: 'floor_min_reached_rate', step: 0.05, min: 0, max: 1 },
    ],
  },
]

const pct = (n: number) => `${Math.round(n * 100)}%`
const num = (n: number) => n.toLocaleString(uiLocale())

const FIELD_INPUT =
  'rounded-lg border border-input-border bg-input text-foreground disabled:bg-muted disabled:text-muted-foreground'

/** Shared by the header and the rows so the labels stay over their own numbers:
 *  as two independent grids their `auto` columns sized to their own content. */
const QUEUE_GRID =
  'grid grid-cols-[1rem_minmax(6.5rem,1fr)_5.5rem_5.5rem_5.5rem] items-center gap-x-3 md:grid-cols-[1rem_1fr_6.5rem_6.5rem_6.5rem] md:gap-x-6'

/** Horizontal scroll so the queue grid never blows out narrow viewports. */
function ScrollX({ children, minWidth }: { children: React.ReactNode; minWidth: string }) {
  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <div className="w-full" style={{ minWidth }}>
        {children}
      </div>
    </div>
  )
}

/** Queue size is the decision; tau is the implementation detail. */
function QueuePicker({
  guide,
  currentTau,
  canEdit,
  onPick,
}: {
  guide: TauCapacityPoint[]
  currentTau: number
  canEdit: boolean
  onPick: (tau: number) => void
}) {
  const { t } = useTranslation('common')
  // "Selected" is the CLOSEST option, so a hand-typed tau still highlights the
  // row it behaves like rather than leaving every row unselected.
  const closest = guide.reduce(
    (best, p) => (Math.abs(p.tau - currentTau) < Math.abs(best.tau - currentTau) ? p : best),
    guide[0]
  )
  const measured = guide.some((p) => p.debts != null)

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <ScrollX minWidth="40rem">
        <div className="flex flex-col gap-2">
          <div
            className={`${QUEUE_GRID} text-muted-foreground border border-transparent px-3 text-xs font-medium md:px-4`}
          >
            <span className="w-4" />
            <span>{t('pages.scoringV3.settings.queue.queueSize')}</span>
            <span className="text-right">{t('pages.scoringV3.settings.queue.debtsToWork')}</span>
            {/* The two numbers the ticket asks for: the BENEFIT of a bigger queue
                (more payers reached) and its COST in efficiency (each call is less
                likely to find one). Ops trade these off against each other. */}
            <span className="text-right">{t('pages.scoringV3.settings.queue.payersReached')}</span>
            <span className="text-right">{t('pages.scoringV3.settings.queue.callsThatPay')}</span>
          </div>
          {guide.map((p) => {
            const selected = p.tau === closest.tau
            return (
              <button
                key={p.tau}
                type="button"
                disabled={!canEdit}
                onClick={() => onPick(p.tau)}
                className={`${QUEUE_GRID} rounded-lg border px-3 py-3 text-left transition-colors md:px-4 ${
                  selected
                    ? 'border-primary-600 bg-primary/10'
                    : 'border-border bg-card hover:bg-muted'
                } ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                    selected ? 'border-primary-600' : 'border-border'
                  }`}
                >
                  {selected && <span className="bg-primary-600 h-2 w-2 rounded-full" />}
                </span>
                <span className="text-foreground text-sm font-medium">
                  {t('pages.scoringV3.settings.queue.ofDebts', { share: pct(p.avg_share) })}
                  {selected && (
                    <span className="text-muted-foreground ml-2 text-xs font-normal">
                      {t('pages.scoringV3.settings.queue.current')}
                    </span>
                  )}
                </span>
                <span className="text-foreground text-right text-sm tabular-nums">
                  {p.debts != null ? num(p.debts) : '—'}
                </span>
                <span className="text-foreground text-right text-sm tabular-nums">
                  {p.payers_captured != null ? pct(p.payers_captured) : '—'}
                </span>
                <span className="text-foreground text-right text-sm tabular-nums">
                  {p.pay_lift != null ? `${uiDecimal(p.pay_lift.toFixed(2))}×` : '—'}
                </span>
              </button>
            )
          })}
        </div>
      </ScrollX>
      <p className="text-muted-foreground text-xs leading-relaxed">
        <strong className="text-foreground">
          {t('pages.scoringV3.settings.queue.payersReached')}
        </strong>{' '}
        {t('pages.scoringV3.settings.queue.payersReachedExplain')}{' '}
        <strong className="text-foreground">
          {t('pages.scoringV3.settings.queue.callsThatPay')}
        </strong>{' '}
        {t('pages.scoringV3.settings.queue.callsThatPayExplain')}{' '}
        {measured
          ? t('pages.scoringV3.settings.queue.measured')
          : t('pages.scoringV3.settings.queue.generic')}
      </p>
    </div>
  )
}

export function ScoringV3SettingsPage() {
  const { t } = useTranslation('common')
  const projectId = useActiveProjectId()
  const { data, isLoading } = useV3Settings(projectId)
  const save = useUpdateV3Settings()
  const canEdit = useHasPermission(PERMISSIONS.SCORING_CONFIG.EDIT)

  // The server's values are the source of truth; `draft` holds edits-in-progress
  // and stays null until someone types. Deriving the form this way (rather than
  // copying server data into state in an effect) means a refetch cannot silently
  // overwrite unsaved edits, and there is no cascading render on load.
  const [draft, setDraft] = useState<V3Settings | null>(null)
  const [reason, setReason] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const saved = data?.settings ?? null
  const form = draft ?? saved
  const dirty = draft !== null && !!saved && JSON.stringify(draft) !== JSON.stringify(saved)

  if (isLoading || !form) {
    return (
      <PermissionGuard permission={PERMISSIONS.SCORING_CONFIG.VIEW}>
        <ScoringV3SettingsPageSkeleton />
      </PermissionGuard>
    )
  }

  const defaults = data?.defaults
  const guide = data?.tau_capacity_guide ?? []

  const setField = (key: keyof V3Settings, raw: string, nullable?: boolean) => {
    const value = raw === '' ? (nullable ? null : 0) : Number(raw)
    setDraft({ ...form, [key]: value } as V3Settings)
  }
  const isChanged = (key: keyof V3Settings) =>
    defaults !== undefined && JSON.stringify(form[key]) !== JSON.stringify(defaults[key])

  return (
    <PermissionGuard permission={PERMISSIONS.SCORING_CONFIG.VIEW}>
      <div className="flex w-full min-w-0 flex-col gap-4 pb-36 sm:gap-6 sm:pb-28">
        <header className="flex min-w-0 flex-col gap-2">
          <h1 className="text-foreground text-xl font-light sm:text-2xl">
            {t('pages.scoringV3.titlePrefix')}{' '}
            <span className="font-semibold">{t('pages.scoringV3.settings.titleEmphasis')}</span>
          </h1>
          <p className="text-muted-foreground max-w-3xl text-sm leading-relaxed">
            {t('pages.scoringV3.settings.introBefore')}{' '}
            <strong className="text-foreground">
              {t('pages.scoringV3.settings.introNextRun')}
            </strong>{' '}
            {t('pages.scoringV3.settings.introMiddle')}{' '}
            <Link
              to="/dashboard/system-settings/scoring-configuration/history"
              className="text-information-700 underline"
            >
              {t('pages.scoringV3.settings.introLink')}
            </Link>
            .
          </p>
          {data?.source === 'default' && (
            <p className="text-muted-foreground text-sm">
              {t('pages.scoringV3.settings.defaultSource')}
            </p>
          )}
        </header>

        {/* ── the one decision that matters ── */}
        <section className="border-border bg-card w-full min-w-0 rounded-xl border p-4 sm:p-6">
          <h2 className="text-foreground text-base font-semibold">
            {t('pages.scoringV3.settings.queue.title')}
          </h2>
          <p className="text-muted-foreground mt-1 mb-5 max-w-3xl text-sm leading-relaxed">
            {t('pages.scoringV3.settings.queue.description')}
          </p>

          {guide.length > 0 ? (
            <QueuePicker
              guide={guide}
              currentTau={form.tau}
              canEdit={canEdit}
              onPick={(tau) => setDraft({ ...form, tau })}
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              {t('pages.scoringV3.settings.queue.noGuidance')}
            </p>
          )}

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-muted-foreground mt-4 text-xs underline"
          >
            {showAdvanced
              ? t('pages.scoringV3.settings.queue.hideCutoff')
              : t('pages.scoringV3.settings.queue.showCutoff')}
          </button>
          {showAdvanced && (
            <label className="mt-3 flex w-full max-w-xs flex-col gap-1">
              <span className="text-foreground text-sm font-medium">
                {t('pages.scoringV3.settings.queue.cutoffLabel')}
                {isChanged('tau') && (
                  <span className="text-warning-700 ml-2 text-xs font-normal">
                    {t('pages.scoringV3.settings.changed')}
                  </span>
                )}
              </span>
              <input
                type="number"
                step={0.0001}
                min={0}
                max={1}
                value={form.tau}
                disabled={!canEdit}
                onChange={(e) => setField('tau', e.target.value)}
                className={`${FIELD_INPUT} w-full px-3 py-2 text-sm tabular-nums`}
              />
              <span className="text-muted-foreground text-xs leading-relaxed">
                {t('pages.scoringV3.settings.queue.cutoffHint')}
                {defaults &&
                  ` ${t('pages.scoringV3.settings.queue.standardSetup', { value: defaults.tau })}`}
              </span>
            </label>
          )}
        </section>

        {/* ── the rules ── */}
        {SECTIONS.map((section) => (
          <section
            key={section.id}
            className="border-border bg-card w-full min-w-0 rounded-xl border p-4 sm:p-6"
          >
            <h2 className="text-foreground text-base font-semibold">
              {t(`pages.scoringV3.settings.sections.${section.id}.title`)}
            </h2>
            <p className="text-muted-foreground mt-1 mb-5 max-w-3xl text-sm leading-relaxed">
              {t(`pages.scoringV3.settings.sections.${section.id}.blurb`)}
            </p>

            <div className="divide-border flex flex-col divide-y">
              {section.fields.map((f) => {
                const value = form[f.key]
                const isEmpty = value === null || value === undefined
                const fieldKey = `pages.scoringV3.settings.fields.${String(f.key)}`
                const unit = t(`${fieldKey}.unit`)
                const nullLabel = f.nullable ? t(`${fieldKey}.nullLabel`) : undefined
                return (
                  <div
                    key={String(f.key)}
                    className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-8"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5 sm:max-w-md">
                      <span className="text-foreground text-sm font-medium">
                        {t(`${fieldKey}.label`)}
                        {isChanged(f.key) && (
                          <span className="text-warning-700 ml-2 text-xs font-normal">
                            {t('pages.scoringV3.settings.changed')}
                          </span>
                        )}
                      </span>
                      <span className="text-muted-foreground text-xs leading-relaxed">
                        {t(`${fieldKey}.hint`)}
                      </span>
                    </div>
                    <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
                      {f.derived ? (
                        <span className="border-border bg-muted text-foreground w-24 rounded-lg border border-dashed px-3 py-2 text-right text-sm tabular-nums">
                          {isEmpty ? '—' : String(value)}
                        </span>
                      ) : (
                        <input
                          type="number"
                          step={f.step ?? 1}
                          min={f.min ?? 0}
                          max={f.max}
                          value={isEmpty ? '' : String(value)}
                          placeholder={nullLabel ?? ''}
                          disabled={!canEdit}
                          onChange={(e) => setField(f.key, e.target.value, f.nullable)}
                          className={`${FIELD_INPUT} w-24 px-3 py-2 text-right text-sm tabular-nums`}
                        />
                      )}
                      {unit && (
                        <span className="text-muted-foreground min-w-0 flex-1 text-xs sm:w-24 sm:flex-none">
                          {isEmpty && nullLabel ? nullLabel : unit}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}

        {/* ── per-outcome cooldowns ── */}
        {data?.rule_table && (
          <section className="border-border bg-card w-full min-w-0 rounded-xl border p-4 sm:p-6">
            <h2 className="text-foreground text-base font-semibold">
              {t('pages.scoringV3.settings.outcomes.title')}
            </h2>
            <p className="text-muted-foreground mt-1 mb-5 max-w-3xl text-sm leading-relaxed">
              {t('pages.scoringV3.settings.outcomes.description')}
            </p>
            <div className="border-border max-h-[420px] overflow-auto rounded-lg border">
              <table className="text-foreground w-full min-w-[32rem] text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr className="text-muted-foreground text-left text-xs font-medium">
                    <th className="px-3 py-2">
                      {t('pages.scoringV3.settings.outcomes.callOutcome')}
                    </th>
                    <th className="px-3 py-2">
                      {t('pages.scoringV3.settings.outcomes.prioritySets')}
                    </th>
                    <th className="px-3 py-2 text-right">
                      {t('pages.scoringV3.settings.outcomes.standard')}
                    </th>
                    <th className="px-3 py-2 text-right">
                      {t('pages.scoringV3.settings.outcomes.yourValue')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.rule_table).map(([code, spec]) => (
                    <tr key={code} className="border-border border-t">
                      <td className="px-3 py-1.5 font-mono text-xs break-all">{code}</td>
                      <td className="px-3 py-1.5 text-xs">{spec.bucket}</td>
                      <td className="text-muted-foreground px-3 py-1.5 text-right text-xs tabular-nums">
                        {t('pages.scoringV3.settings.outcomes.days', { count: spec.ttl_days })}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <input
                          type="number"
                          min={0}
                          disabled={!canEdit}
                          value={form.result_ttls?.[code] ?? ''}
                          placeholder="—"
                          onChange={(e) => {
                            const next = { ...(form.result_ttls ?? {}) }
                            if (e.target.value === '') delete next[code]
                            else next[code] = Number(e.target.value)
                            setDraft({ ...form, result_ttls: next })
                          }}
                          className={`${FIELD_INPUT} w-20 px-2 py-1 text-right text-sm tabular-nums`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── save ── */}
        {canEdit && (
          <div className="border-border bg-card/95 fixed right-0 bottom-0 left-0 z-10 border-t px-4 py-3 backdrop-blur sm:px-8">
            <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
              <span className="text-muted-foreground shrink-0 text-sm">
                {dirty
                  ? t('pages.scoringV3.settings.save.unsaved')
                  : t('pages.scoringV3.settings.save.allSaved')}
              </span>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('pages.scoringV3.settings.save.reasonPlaceholder')}
                className={`${FIELD_INPUT} w-full min-w-0 flex-1 px-3 py-2 text-sm`}
              />
              <div className="flex w-full gap-2 sm:w-auto">
                <Button
                  variant="outline"
                  disabled={!dirty || save.isPending}
                  onClick={() => setDraft(null)}
                  className="min-w-0 flex-1 sm:flex-none"
                >
                  {t('pages.scoringV3.settings.save.discard')}
                </Button>
                <Button
                  variant="primary"
                  disabled={!dirty || save.isPending}
                  onClick={() =>
                    projectId &&
                    save.mutate(
                      { projectId, settings: form, reason: reason || undefined },
                      // Drop the draft so the refetched server values take over —
                      // otherwise the form keeps showing local state and "dirty"
                      // never clears.
                      {
                        onSuccess: () => {
                          setDraft(null)
                          setReason('')
                        },
                      }
                    )
                  }
                  className="min-w-0 flex-1 sm:flex-none"
                >
                  {save.isPending ? t('pages.scoringV3.saving') : t('common.save')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}
