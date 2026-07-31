/**
 * Scoring v3 — per-brand settings (KAN-792).
 *
 * Every tunable the rules layer reads, editable without a deploy. The ticket's
 * reason for existing: tau and the rule windows have to be re-picked against
 * real operator capacity once the shadow run produces numbers, and that must not
 * require a release.
 *
 * Two things this screen deliberately does NOT do:
 *
 *   * It does not validate before saving. The scoring job reads the STORED
 *     values, so the server's schema is the only validation that counts; the
 *     form surfaces the server's rejection verbatim instead of maintaining a
 *     second, drifting copy of the rules.
 *   * It does not re-score anything. Values apply on the next run — stated on
 *     screen, because "saved" reading as "applied retroactively" would be a
 *     dangerous misunderstanding for someone tuning a live queue.
 *
 * Separate from the legacy Scoring Configuration screen on purpose: that one
 * tunes the 0-100 score, this one tunes the v3 model. Sharing a page would
 * suggest the two sets of numbers interact.
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
import type { V3Settings } from '@/features/scoring/api/types'

type FieldSpec = {
  key: keyof V3Settings
  label: string
  hint: string
  step?: number
  min?: number
  max?: number
  nullable?: boolean
}

const SECTIONS: { title: string; blurb: string; fields: FieldSpec[] }[] = [
  {
    title: 'Promise to pay',
    blurb:
      'A promise is “active” around the promised day and “broken” for a window after it, unless a payment lands.',
    fields: [
      {
        key: 'ptp_active_window_days',
        label: 'Active window (± days)',
        hint: 'Promised day ± this many days counts as an active promise → CRIT',
      },
      {
        key: 'ptp_active_max_age_days',
        label: 'Promise max age (days)',
        hint: 'Older promises are stale and stop counting',
      },
      {
        key: 'ptp_broken_min_days',
        label: 'Broken from (days after)',
        hint: 'Start of the broken-promise window → HIGH',
      },
      {
        key: 'ptp_broken_max_days',
        label: 'Broken until (days after)',
        hint: 'End of the broken-promise window',
      },
    ],
  },
  {
    title: 'Inbound contact',
    blurb: 'The debtor reached out — call them back while it is still fresh.',
    fields: [
      {
        key: 'inbound_crit_max_days',
        label: 'CRIT up to (days ago)',
        hint: '0 to this many days since they contacted us → CRIT',
      },
      {
        key: 'inbound_high_max_days',
        label: 'HIGH up to (days ago)',
        hint: 'Beyond the CRIT band and up to this → HIGH',
      },
    ],
  },
  {
    title: 'Partial-payment cadence',
    blurb:
      'A paying debtor is on a rhythm. Urgency rises as the next expected payment becomes overdue — it does not fall.',
    fields: [
      {
        key: 'partial_avg_max_days',
        label: 'On cadence up to (days)',
        hint: 'Recently paid → AVG, do not chase',
      },
      {
        key: 'partial_high_max_days',
        label: 'Late up to (days)',
        hint: 'Payment is late → HIGH; beyond this → CRIT',
      },
      {
        key: 'partial_pay_expire_days',
        label: 'Signal expires after (days)',
        hint: 'Empty = a lapsed payer stays CRIT forever. On this portfolio that put 40% of the book in CRIT.',
        nullable: true,
      },
    ],
  },
  {
    title: 'Compliance & floors',
    blurb:
      'The weekly cap de-prioritises over-contacted debtors; the floor stops engaged debtors sinking to LOW.',
    fields: [
      {
        key: 'weekly_contact_cap',
        label: 'Weekly contact cap',
        hint: 'More contacts than this in 7 days → LOW',
      },
      {
        key: 'floor_min_real_payments',
        label: 'Floor: lifetime payments ≥',
        hint: 'This many real payments pins the debt up to AVG',
      },
      {
        key: 'floor_min_reached_rate',
        label: 'Floor: reached rate ≥',
        hint: 'Share of interactions where the debtor was actually reached (0–1)',
        step: 0.05,
        min: 0,
        max: 1,
      },
    ],
  },
]

function pct(n: number) {
  return `${Math.round(n * 100)}%`
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

  const saved = data?.settings ?? null
  const form = draft ?? saved
  const dirty = draft !== null && !!saved && JSON.stringify(draft) !== JSON.stringify(saved)

  if (isLoading || !form) {
    return <div className="p-6 text-sm text-gray-500">Loading settings…</div>
  }

  const defaults = data?.defaults
  const setField = (key: keyof V3Settings, raw: string, nullable?: boolean) => {
    const value = raw === '' ? (nullable ? null : 0) : Number(raw)
    setDraft({ ...form, [key]: value } as V3Settings)
  }

  const isChanged = (key: keyof V3Settings) =>
    defaults !== undefined && JSON.stringify(form[key]) !== JSON.stringify(defaults[key])

  return (
    <PermissionGuard permission={PERMISSIONS.SCORING_CONFIG.VIEW}>
      <div className="flex w-full flex-col gap-5">
        <header className="flex flex-col gap-2">
          <h1 className="text-dark-500 text-xl font-light sm:text-2xl">
            Scoring v3 — <span className="font-semibold">settings</span>
          </h1>
          <p className="max-w-3xl text-sm text-gray-600">
            These values are read at the start of every scoring run. Saving does not re-score
            anything: changes take effect on the <strong>next run</strong>. Every change is recorded
            in{' '}
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
              This brand has never saved its own values — everything below is the default.
            </p>
          )}
        </header>

        {/* tau + the capacity guide */}
        <section className="rounded-xl border border-[#EBECE8] bg-white p-5">
          <h2 className="text-dark-500 mb-1 text-base font-semibold">tau — the LOW / AVG cutoff</h2>
          <p className="mb-4 max-w-3xl text-sm text-gray-600">
            The ML layer's only threshold: a debt whose predicted pay-chance reaches tau goes to
            AVG, otherwise LOW. Lower tau means a bigger AVG queue and a weaker average signal —
            pick it against how many debts your operators can actually work.
          </p>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">tau</span>
              <input
                type="number"
                step={0.0001}
                min={0}
                max={1}
                value={form.tau}
                disabled={!canEdit}
                onChange={(e) => setField('tau', e.target.value)}
                className="w-40 rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50"
              />
              {defaults && <span className="text-xs text-gray-500">default {defaults.tau}</span>}
            </label>

            {!!data?.tau_capacity_guide?.length && (
              <div className="overflow-x-auto">
                <table className="min-w-[320px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500">
                      <th className="py-1 pr-6 font-medium">AVG share</th>
                      <th className="py-1 pr-6 font-medium">tau</th>
                      <th className="py-1 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.tau_capacity_guide.map((p) => (
                      <tr key={p.tau} className="border-t border-[#EBECE8]">
                        <td className="py-1.5 pr-6">{pct(p.avg_share)}</td>
                        <td className="py-1.5 pr-6 font-mono">{p.tau}</td>
                        <td className="py-1.5">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => setDraft({ ...form, tau: p.tau })}
                              className="text-information-700 text-xs underline"
                            >
                              use
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* rule windows */}
        {SECTIONS.map((section) => (
          <section key={section.title} className="rounded-xl border border-[#EBECE8] bg-white p-5">
            <h2 className="text-dark-500 mb-1 text-base font-semibold">{section.title}</h2>
            <p className="mb-4 max-w-3xl text-sm text-gray-600">{section.blurb}</p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {section.fields.map((f) => {
                const value = form[f.key]
                return (
                  <label key={String(f.key)} className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-gray-700">
                      {f.label}
                      {isChanged(f.key) && (
                        <span className="ml-2 text-xs font-normal text-[#B36F00]">changed</span>
                      )}
                    </span>
                    <input
                      type="number"
                      step={f.step ?? 1}
                      min={f.min ?? 0}
                      max={f.max}
                      value={value === null || value === undefined ? '' : String(value)}
                      placeholder={f.nullable ? 'never' : undefined}
                      disabled={!canEdit}
                      onChange={(e) => setField(f.key, e.target.value, f.nullable)}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50"
                    />
                    <span className="text-xs text-gray-500">{f.hint}</span>
                    {defaults && (
                      <span className="text-xs text-gray-400">
                        default {String(defaults[f.key] ?? 'never')}
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          </section>
        ))}

        {/* per-result-code TTLs */}
        {data?.rule_table && (
          <section className="rounded-xl border border-[#EBECE8] bg-white p-5">
            <h2 className="text-dark-500 mb-1 text-base font-semibold">Interaction-result TTLs</h2>
            <p className="mb-4 max-w-3xl text-sm text-gray-600">
              After an interaction, its result decides the bucket for this many days. Leave a row
              blank to keep the package default. The bucket itself is not editable — it is part of
              the approved rule table.
            </p>
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-xs text-gray-500">
                    <th className="py-2 font-medium">Result code</th>
                    <th className="py-2 font-medium">Bucket</th>
                    <th className="py-2 font-medium">Default TTL</th>
                    <th className="py-2 font-medium">Override</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.rule_table).map(([code, spec]) => (
                    <tr key={code} className="border-t border-[#EBECE8]">
                      <td className="py-1.5 font-mono text-xs">{code}</td>
                      <td className="py-1.5">{spec.bucket}</td>
                      <td className="py-1.5 text-gray-500">{spec.ttl_days}d</td>
                      <td className="py-1.5">
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
                          className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-sm disabled:bg-gray-50"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* save */}
        {canEdit && (
          <div className="sticky bottom-0 flex flex-col gap-3 rounded-xl border border-[#EBECE8] bg-white p-4 sm:flex-row sm:items-center">
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you changing this? (recorded in history)"
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
                    // otherwise the form would keep showing local state and
                    // "dirty" would never clear.
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
        )}
      </div>
    </PermissionGuard>
  )
}
