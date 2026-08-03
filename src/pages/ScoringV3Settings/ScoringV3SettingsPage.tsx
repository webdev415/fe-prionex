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

type FieldSpec = {
  key: keyof V3Settings
  label: string
  unit?: string
  hint: string
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
        hint: 'The money did not arrive — begin following up this many days later.',
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
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 px-4 text-xs font-medium text-gray-500">
        <span className="w-4" />
        <span>Queue size</span>
        <span className="text-right">Debts to work each month</span>
      </div>
      {guide.map((p) => {
        const selected = p.tau === closest.tau
        return (
          <button
            key={p.tau}
            type="button"
            disabled={!canEdit}
            onClick={() => onPick(p.tau)}
            className={`grid grid-cols-[auto_1fr_auto] items-center gap-x-4 rounded-lg border px-4 py-3 text-left transition-colors ${
              selected
                ? 'border-primary-600 bg-[#F0F7E6]'
                : 'border-[#EBECE8] bg-white hover:bg-gray-50'
            } ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                selected ? 'border-primary-600' : 'border-gray-300'
              }`}
            >
              {selected && <span className="bg-primary-600 h-2 w-2 rounded-full" />}
            </span>
            <span className="text-dark-500 text-sm font-medium">
              {pct(p.avg_share)} of debts
              {selected && <span className="ml-2 text-xs font-normal text-gray-500">current</span>}
            </span>
            <span className="text-dark-500 text-right text-sm tabular-nums">
              {p.debts != null ? num(p.debts) : '—'}
            </span>
          </button>
        )
      })}
      <p className="text-xs text-gray-500">
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
    return <div className="p-6 text-sm text-gray-500">Loading settings…</div>
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
      <div className="flex w-full flex-col gap-6 pb-28">
        <header className="flex flex-col gap-2">
          <h1 className="text-dark-500 text-xl font-light sm:text-2xl">
            Scoring v3 — <span className="font-semibold">settings</span>
          </h1>
          <p className="max-w-3xl text-sm text-gray-600">
            These rules decide who your operators call first. Changes apply to the{' '}
            <strong>next scoring run</strong> — nothing already scored is redone — and every change
            is saved in{' '}
            <Link
              to="/dashboard/system-settings/scoring-configuration/history"
              className="text-information-700 underline"
            >
              configuration history
            </Link>
            .
          </p>
          {data?.source === 'default' && (
            <p className="text-sm text-gray-500">
              This brand has never saved its own values — everything below is the standard setup.
            </p>
          )}
        </header>

        {/* ── the one decision that matters ── */}
        <section className="rounded-xl border border-[#EBECE8] bg-white p-5 sm:p-6">
          <h2 className="text-dark-500 text-base font-semibold">
            How many debts should operators work?
          </h2>
          <p className="mt-1 mb-5 max-w-3xl text-sm text-gray-600">
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
            <p className="text-sm text-gray-500">No queue-size guidance available yet.</p>
          )}

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="mt-4 text-xs text-gray-500 underline"
          >
            {showAdvanced ? 'Hide' : 'Show'} the exact cut-off value
          </button>
          {showAdvanced && (
            <label className="mt-3 flex max-w-xs flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">
                Cut-off (tau)
                {isChanged('tau') && (
                  <span className="ml-2 text-xs font-normal text-[#B36F00]">changed</span>
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
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm tabular-nums disabled:bg-gray-50"
              />
              <span className="text-xs text-gray-500">
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
            className="rounded-xl border border-[#EBECE8] bg-white p-5 sm:p-6"
          >
            <h2 className="text-dark-500 text-base font-semibold">{section.title}</h2>
            <p className="mt-1 mb-5 max-w-3xl text-sm text-gray-600">{section.blurb}</p>

            <div className="flex flex-col divide-y divide-[#EBECE8]">
              {section.fields.map((f) => {
                const value = form[f.key]
                const isEmpty = value === null || value === undefined
                return (
                  <div
                    key={String(f.key)}
                    className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-8"
                  >
                    <div className="flex flex-col gap-0.5 sm:max-w-md">
                      <span className="text-dark-500 text-sm font-medium">
                        {f.label}
                        {isChanged(f.key) && (
                          <span className="ml-2 text-xs font-normal text-[#B36F00]">changed</span>
                        )}
                      </span>
                      <span className="text-xs text-gray-500">{f.hint}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <input
                        type="number"
                        step={f.step ?? 1}
                        min={f.min ?? 0}
                        max={f.max}
                        value={isEmpty ? '' : String(value)}
                        placeholder={f.nullLabel ?? ''}
                        disabled={!canEdit}
                        onChange={(e) => setField(f.key, e.target.value, f.nullable)}
                        className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-right text-sm tabular-nums disabled:bg-gray-50"
                      />
                      {f.unit && (
                        <span className="w-24 text-xs text-gray-500">
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
          <section className="rounded-xl border border-[#EBECE8] bg-white p-5 sm:p-6">
            <h2 className="text-dark-500 text-base font-semibold">
              How long a call outcome counts for
            </h2>
            <p className="mt-1 mb-5 max-w-3xl text-sm text-gray-600">
              After a call, what the operator recorded decides the debt&apos;s priority for a while.
              &ldquo;Refused to pay&rdquo; keeps them low for a month; &ldquo;payment
              possible&rdquo; keeps them high for a week. Leave a row blank to keep the standard
              number.
            </p>
            <div className="max-h-[420px] overflow-y-auto rounded-lg border border-[#EBECE8]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="text-left text-xs font-medium text-gray-500">
                    <th className="px-3 py-2">Call outcome</th>
                    <th className="px-3 py-2">Priority it sets</th>
                    <th className="px-3 py-2 text-right">Standard</th>
                    <th className="px-3 py-2 text-right">Your value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.rule_table).map(([code, spec]) => (
                    <tr key={code} className="border-t border-[#EBECE8]">
                      <td className="px-3 py-1.5 font-mono text-xs">{code}</td>
                      <td className="px-3 py-1.5 text-xs">{spec.bucket}</td>
                      <td className="px-3 py-1.5 text-right text-xs text-gray-500 tabular-nums">
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
                          className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-right text-sm tabular-nums disabled:bg-gray-50"
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
          <div className="fixed right-0 bottom-0 left-0 z-10 border-t border-[#EBECE8] bg-white/95 px-4 py-3 backdrop-blur sm:px-8">
            <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center">
              <span className="shrink-0 text-sm text-gray-600">
                {dirty ? 'You have unsaved changes.' : 'Everything is saved.'}
              </span>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are you changing this? (saved in history)"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={!dirty || save.isPending}
                  onClick={() => setDraft(null)}
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
