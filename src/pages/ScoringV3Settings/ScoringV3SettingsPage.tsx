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
import { ScoringV3SettingsPageSkeleton } from './ScoringV3SettingsPageSkeleton'

type FieldSpec = {
  key: keyof V3Settings
  label: string
  unit?: string
  hint: string
  /** Computed by the model from another field — shown, never edited. */
  derived?: boolean
  step?: number
  min?: number
  max?: number
  nullable?: boolean
  nullLabel?: string
}

const SECTIONS: { title: string; blurb: string; fields: FieldSpec[] }[] = [
  {
    title: 'When someone promises to pay',
    blurb:
      'A promise is worth acting on around the day it was made for — and worth chasing for a while after it is broken.',
    fields: [
      {
        key: 'ptp_active_window_days',
        label: 'Promise is live for',
        unit: '± days',
        hint: 'They promised the 10th? From the 7th to the 13th, call them today.',
      },
      {
        key: 'ptp_active_max_age_days',
        label: 'Forget a promise after',
        unit: 'days',
        hint: 'An old promise stops counting as a reason to call.',
      },
      {
        key: 'ptp_broken_min_days',
        label: 'Start chasing a broken promise',
        unit: 'days after',
        // Not editable: the model starts the broken window the day the promise
        // window closes, and has no separate setting for it. It was shown as a
        // normal input, so ops could change it, save it, watch it audited — and
        // the scorer ignored it. A read-only derived value is the honest form.
        derived: true,
        hint: 'Set automatically: the day after the promise window closes.',
      },
      {
        key: 'ptp_broken_max_days',
        label: 'Stop chasing it',
        unit: 'days after',
        hint: 'Past this, a broken promise is old news and stops driving priority.',
      },
    ],
  },
  {
    title: 'When someone contacts us',
    blurb:
      'A debtor who reaches out is the warmest lead there is. Call them back while it is still fresh.',
    fields: [
      {
        key: 'inbound_crit_max_days',
        label: 'Call back today if they got in touch within',
        unit: 'days',
        hint: 'The strongest signal in the system.',
      },
      {
        key: 'inbound_high_max_days',
        label: 'Call back this week if within',
        unit: 'days',
        hint: 'Still warm, but no longer urgent.',
      },
    ],
  },
  {
    title: 'When someone is paying bit by bit',
    blurb:
      'A part-payer has a rhythm. Leave them alone while they keep to it — chase them when they miss it.',
    fields: [
      {
        key: 'partial_avg_max_days',
        label: 'Still on track if they paid within',
        unit: 'days',
        hint: 'Do not chase — they are behaving as expected.',
      },
      {
        key: 'partial_high_max_days',
        label: 'Payment is late up to',
        unit: 'days',
        hint: 'Follow up this week. Past this, treat it as urgent.',
      },
      {
        key: 'partial_pay_expire_days',
        label: 'Give up on a lapsed payer after',
        unit: 'days',
        nullable: true,
        nullLabel: 'never',
        hint: 'Leave empty and someone who paid once years ago stays urgent forever — that put 40% of the book in the top bucket.',
      },
    ],
  },
  {
    title: 'Limits and safety nets',
    blurb:
      'One rule stops us over-contacting people. The other two stop us abandoning debtors who are actually engaging.',
    fields: [
      {
        key: 'weekly_contact_cap',
        label: 'Never contact more than',
        unit: 'times / week',
        hint: 'Beyond this the debt drops down the queue. Compliance protection.',
      },
      {
        key: 'floor_min_real_payments',
        label: 'Keep working anyone who has paid at least',
        unit: 'times',
        hint: 'A proven payer never falls to the bottom of the queue.',
      },
      {
        key: 'floor_min_reached_rate',
        label: '…or who answers us at least',
        unit: 'of the time',
        step: 0.05,
        min: 0,
        max: 1,
        hint: '0.5 means they pick up half the time. Reachable people stay workable.',
      },
    ],
  },
]

const pct = (n: number) => `${Math.round(n * 100)}%`
const num = (n: number) => n.toLocaleString()

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
            <span>Queue size</span>
            <span className="text-right">Debts to work</span>
            {/* The two numbers the ticket asks for: the BENEFIT of a bigger queue
                (more payers reached) and its COST in efficiency (each call is less
                likely to find one). Ops trade these off against each other. */}
            <span className="text-right">Payers reached</span>
            <span className="text-right">Calls that pay</span>
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
                  {pct(p.avg_share)} of debts
                  {selected && (
                    <span className="text-muted-foreground ml-2 text-xs font-normal">current</span>
                  )}
                </span>
                <span className="text-foreground text-right text-sm tabular-nums">
                  {p.debts != null ? num(p.debts) : '—'}
                </span>
                <span className="text-foreground text-right text-sm tabular-nums">
                  {p.payers_captured != null ? pct(p.payers_captured) : '—'}
                </span>
                <span className="text-foreground text-right text-sm tabular-nums">
                  {p.pay_lift != null ? `${p.pay_lift.toFixed(2)}×` : '—'}
                </span>
              </button>
            )
          })}
        </div>
      </ScrollX>
      <p className="text-muted-foreground text-xs leading-relaxed">
        <strong className="text-foreground">Payers reached</strong> = how many of the people who
        will pay this month end up in the queue.{' '}
        <strong className="text-foreground">Calls that pay</strong> = how much more often a call
        finds a payer than if you called at random. A bigger queue reaches more payers but each call
        is worth less.{' '}
        {measured
          ? 'Worked out from this brand’s own scores, so these are the numbers you would actually get.'
          : 'Generic reference values — this brand has not been scored yet, so the debt counts are unknown.'}
      </p>
    </div>
  )
}

export function ScoringV3SettingsPage() {
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
            Scoring v3 — <span className="font-semibold">settings</span>
          </h1>
          <p className="text-muted-foreground max-w-3xl text-sm leading-relaxed">
            These rules decide who your operators call first. Changes apply to the{' '}
            <strong className="text-foreground">next scoring run</strong> — nothing already scored
            is redone — and every change is saved in{' '}
            <Link
              to="/dashboard/system-settings/scoring-configuration/history"
              className="text-information-700 underline"
            >
              configuration history
            </Link>
            .
          </p>
          {data?.source === 'default' && (
            <p className="text-muted-foreground text-sm">
              This brand has never saved its own values — everything below is the standard setup.
            </p>
          )}
        </header>

        {/* ── the one decision that matters ── */}
        <section className="border-border bg-card w-full min-w-0 rounded-xl border p-4 sm:p-6">
          <h2 className="text-foreground text-base font-semibold">
            How many debts should operators work?
          </h2>
          <p className="text-muted-foreground mt-1 mb-5 max-w-3xl text-sm leading-relaxed">
            Every debt gets a predicted chance of paying this month. The most likely payers go into
            the working queue; the rest are left for spare capacity. A bigger queue reaches more
            payers but spends more calls finding each one — pick the size your team can handle.
          </p>

          {guide.length > 0 ? (
            <QueuePicker
              guide={guide}
              currentTau={form.tau}
              canEdit={canEdit}
              onPick={(tau) => setDraft({ ...form, tau })}
            />
          ) : (
            <p className="text-muted-foreground text-sm">No queue-size guidance available yet.</p>
          )}

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-muted-foreground mt-4 text-xs underline"
          >
            {showAdvanced ? 'Hide' : 'Show'} the exact cut-off value
          </button>
          {showAdvanced && (
            <label className="mt-3 flex w-full max-w-xs flex-col gap-1">
              <span className="text-foreground text-sm font-medium">
                Cut-off (tau)
                {isChanged('tau') && (
                  <span className="text-warning-700 ml-2 text-xs font-normal">changed</span>
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
                A debt is worked when its pay-chance reaches this number.
                {defaults && ` Standard setup: ${defaults.tau}.`}
              </span>
            </label>
          )}
        </section>

        {/* ── the rules ── */}
        {SECTIONS.map((section) => (
          <section
            key={section.title}
            className="border-border bg-card w-full min-w-0 rounded-xl border p-4 sm:p-6"
          >
            <h2 className="text-foreground text-base font-semibold">{section.title}</h2>
            <p className="text-muted-foreground mt-1 mb-5 max-w-3xl text-sm leading-relaxed">
              {section.blurb}
            </p>

            <div className="divide-border flex flex-col divide-y">
              {section.fields.map((f) => {
                const value = form[f.key]
                const isEmpty = value === null || value === undefined
                return (
                  <div
                    key={String(f.key)}
                    className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-8"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5 sm:max-w-md">
                      <span className="text-foreground text-sm font-medium">
                        {f.label}
                        {isChanged(f.key) && (
                          <span className="text-warning-700 ml-2 text-xs font-normal">changed</span>
                        )}
                      </span>
                      <span className="text-muted-foreground text-xs leading-relaxed">
                        {f.hint}
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
                          placeholder={f.nullLabel ?? ''}
                          disabled={!canEdit}
                          onChange={(e) => setField(f.key, e.target.value, f.nullable)}
                          className={`${FIELD_INPUT} w-24 px-3 py-2 text-right text-sm tabular-nums`}
                        />
                      )}
                      {f.unit && (
                        <span className="text-muted-foreground min-w-0 flex-1 text-xs sm:w-24 sm:flex-none">
                          {isEmpty && f.nullLabel ? f.nullLabel : f.unit}
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
              How long a call outcome counts for
            </h2>
            <p className="text-muted-foreground mt-1 mb-5 max-w-3xl text-sm leading-relaxed">
              After a call, what the operator recorded decides the debt&apos;s priority for a while.
              &ldquo;Refused to pay&rdquo; keeps them low for a month; &ldquo;payment
              possible&rdquo; keeps them high for a week. Leave a row blank to keep the standard
              number.
            </p>
            <div className="border-border max-h-[420px] overflow-auto rounded-lg border">
              <table className="text-foreground w-full min-w-[32rem] text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr className="text-muted-foreground text-left text-xs font-medium">
                    <th className="px-3 py-2">Call outcome</th>
                    <th className="px-3 py-2">Priority it sets</th>
                    <th className="px-3 py-2 text-right">Standard</th>
                    <th className="px-3 py-2 text-right">Your value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.rule_table).map(([code, spec]) => (
                    <tr key={code} className="border-border border-t">
                      <td className="px-3 py-1.5 font-mono text-xs break-all">{code}</td>
                      <td className="px-3 py-1.5 text-xs">{spec.bucket}</td>
                      <td className="text-muted-foreground px-3 py-1.5 text-right text-xs tabular-nums">
                        {spec.ttl_days} days
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
                {dirty ? 'You have unsaved changes.' : 'Everything is saved.'}
              </span>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are you changing this? (saved in history)"
                className={`${FIELD_INPUT} w-full min-w-0 flex-1 px-3 py-2 text-sm`}
              />
              <div className="flex w-full gap-2 sm:w-auto">
                <Button
                  variant="outline"
                  disabled={!dirty || save.isPending}
                  onClick={() => setDraft(null)}
                  className="min-w-0 flex-1 sm:flex-none"
                >
                  Discard
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
                  {save.isPending ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}
