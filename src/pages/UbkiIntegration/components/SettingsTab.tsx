import { useState } from 'react'
import { MdClose, MdCheck } from 'react-icons/md'
import { Button } from '@/components/ui/Button'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { useUbkiSettings, useUpdateUbkiSettings, type UbkiSettings } from '../api'

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
    </div>
  )
}

function ToggleRow({
  checked,
  onChange,
  title,
  desc,
  note,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  title: string
  desc: string
  note?: string
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <ToggleSwitch checked={checked} onChange={onChange} ariaLabel={title} />
        <div>
          <p className="text-dark-500 text-sm font-medium">{title}</p>
          <p className="text-xs text-gray-500">{desc}</p>
        </div>
      </div>
      {note && <p className="max-w-[220px] text-right text-[11px] text-gray-400">{note}</p>}
    </div>
  )
}

function Chips({
  items,
  onRemove,
  onAdd,
}: {
  items: string[]
  onRemove: (i: number) => void
  onAdd: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5">
      {items.map((c, i) => (
        <span
          key={`${c}-${i}`}
          className="bg-primary-50 text-primary-700 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs"
        >
          {c}
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="text-primary-500 hover:text-primary-700"
          >
            <MdClose size={12} />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="hover:text-dark-500 text-xs font-medium text-gray-500"
      >
        + Add
      </button>
    </div>
  )
}

function SectionCard({
  title,
  desc,
  children,
}: {
  title: string
  desc: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="text-dark-500 text-sm font-semibold">{title}</h2>
      <p className="mb-4 text-xs text-gray-500">{desc}</p>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

const inputCls =
  'h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700 focus:border-primary-500 focus:outline-none'

const WEEKDAYS: { key: string; label: string }[] = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
]

export function SettingsTab() {
  const { data, isLoading, isError } = useUbkiSettings()
  const update = useUpdateUbkiSettings()

  // Controlled form. Seeded from the server once; `saved` holds the last
  // persisted snapshot so we can compute dirty-state and support Discard.
  const [form, setForm] = useState<UbkiSettings | null>(null)
  const [saved, setSaved] = useState<UbkiSettings | null>(null)

  // Seed the editable form from server data once it arrives. Done during
  // render (guarded) rather than in an effect to avoid a cascading re-render.
  if (data && saved === null) {
    setForm(data)
    setSaved(data)
  }

  if (isLoading || !form) {
    return <div className="py-16 text-center text-sm text-gray-500">Loading settings…</div>
  }
  if (isError) {
    return (
      <div className="text-error-600 py-16 text-center text-sm">
        Failed to load settings. Please try again.
      </div>
    )
  }

  const set = (patch: Partial<UbkiSettings>) => setForm((f) => (f ? { ...f, ...patch } : f))
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)

  const handleSave = () => {
    update.mutate(form, {
      onSuccess: (persisted) => {
        setSaved(persisted)
        setForm(persisted)
      },
    })
  }
  const handleDiscard = () => {
    if (saved) setForm(saved)
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="Automatic Submission"
        desc="Configure when UBKI submissions are sent automatically."
      >
        <ToggleRow
          checked={form.auto_submit_enabled}
          onChange={(v) => set({ auto_submit_enabled: v })}
          title="Enable automatic submission"
          desc="Automatically send credit updates on schedule."
          note="If disabled, only Manual and Bulk submissions are allowed."
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Send time" hint="Default: 03:00 Europe/Kyiv. Off-peak recommended.">
            <input
              type="time"
              className={inputCls}
              value={form.send_time}
              onChange={(e) => set({ send_time: e.target.value })}
            />
          </Field>
          <Field label="Time zone">
            <select
              className={inputCls}
              value={form.timezone}
              onChange={(e) => set({ timezone: e.target.value })}
            >
              <option value="Europe/Kyiv">Europe/Kyiv (UTC+3)</option>
              <option value="UTC">UTC</option>
            </select>
          </Field>
          <Field label="Frequency">
            <div className="flex gap-1">
              {(['daily', 'weekdays', 'custom'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() =>
                    set(
                      f === 'custom'
                        ? {
                            frequency: f,
                            // Default to weekdays so "Custom" is never empty by accident.
                            custom_days: form.custom_days.length
                              ? form.custom_days
                              : ['mon', 'tue', 'wed', 'thu', 'fri'],
                          }
                        : { frequency: f }
                    )
                  }
                  className={`flex-1 rounded-lg px-2 py-2 text-xs font-medium capitalize ${
                    form.frequency === f
                      ? 'bg-secondary-800 text-white'
                      : 'border border-gray-200 bg-white text-gray-600'
                  }`}
                >
                  {f === 'daily' ? 'Every day' : f === 'weekdays' ? 'Weekdays only' : 'Custom days'}
                </button>
              ))}
            </div>
            {form.frequency === 'custom' && (
              <div className="mt-2 flex flex-wrap gap-1">
                {WEEKDAYS.map((d) => {
                  const on = form.custom_days.includes(d.key)
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() =>
                        set({
                          custom_days: on
                            ? form.custom_days.filter((x) => x !== d.key)
                            : [...form.custom_days, d.key],
                        })
                      }
                      className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                        on
                          ? 'bg-secondary-800 text-white'
                          : 'border border-gray-200 bg-white text-gray-600'
                      }`}
                    >
                      {d.label}
                    </button>
                  )
                })}
              </div>
            )}
          </Field>
        </div>
        <ToggleRow
          checked={form.send_only_changed}
          onChange={(v) => set({ send_only_changed: v })}
          title="Send only changed credits"
          desc="Only credits with deltas since last send (payment / status / RR change)."
          note="Switching off resends the full portfolio every day."
        />
      </SectionCard>

      <SectionCard
        title="Retry Policy"
        desc="Control how failed submissions are automatically retried."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Max retry attempts" hint="Default: 3. Range: 1–10.">
            <input
              type="number"
              min={1}
              max={10}
              className={inputCls}
              value={form.max_retry_attempts}
              onChange={(e) => set({ max_retry_attempts: Number(e.target.value) })}
            />
          </Field>
          <Field
            label="Retry interval (minutes)"
            hint="Default: 15 min. Exponential backoff applied."
          >
            <input
              type="number"
              min={1}
              max={1440}
              className={inputCls}
              value={form.retry_interval_minutes}
              onChange={(e) => set({ retry_interval_minutes: Number(e.target.value) })}
            />
          </Field>
          <Field
            label="Skip retry for these error codes"
            hint="These errors require manual fix, not retry."
          >
            <Chips
              items={form.skip_retry_error_codes}
              onRemove={(i) =>
                set({
                  skip_retry_error_codes: form.skip_retry_error_codes.filter((_, idx) => idx !== i),
                })
              }
              onAdd={() => {
                const code = window.prompt('Add error code (e.g. ERR_500)')?.trim()
                if (code) set({ skip_retry_error_codes: [...form.skip_retry_error_codes, code] })
              }}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Notifications"
        desc="Choose who gets alerted and when for UBKI integration events."
      >
        <ToggleRow
          checked={form.daily_summary_email}
          onChange={(v) => set({ daily_summary_email: v })}
          title="Daily summary email"
          desc="Send a daily report with submission stats to all recipients."
        />
        <ToggleRow
          checked={form.alert_on_high_failure}
          onChange={(v) => set({ alert_on_high_failure: v })}
          title="Alert on high failure rate"
          desc="Send an alert when failure rate exceeds the threshold."
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field
            label="High failure-rate threshold (%)"
            hint="Default: 10%. Recommended range: 5–20%."
          >
            <input
              type="number"
              min={0}
              max={100}
              className={inputCls}
              value={form.failure_rate_threshold}
              onChange={(e) => set({ failure_rate_threshold: Number(e.target.value) })}
            />
          </Field>
          <Field label="Connection-down alert (minutes)" hint="Default: 15 min.">
            <input
              type="number"
              min={1}
              max={1440}
              className={inputCls}
              value={form.connection_down_alert_minutes}
              onChange={(e) => set({ connection_down_alert_minutes: Number(e.target.value) })}
            />
          </Field>
          <Field
            label="Notification recipients"
            hint="Combination of roles and individuals is supported."
          >
            <Chips
              items={form.notification_recipients}
              onRemove={(i) =>
                set({
                  notification_recipients: form.notification_recipients.filter(
                    (_, idx) => idx !== i
                  ),
                })
              }
              onAdd={() => {
                const who = window.prompt('Add recipient (email or role)')?.trim()
                if (who) set({ notification_recipients: [...form.notification_recipients, who] })
              }}
            />
          </Field>
        </div>
      </SectionCard>

      {update.isError && (
        <p className="text-error-600 text-right text-xs">
          Failed to save. Please check the values and try again.
        </p>
      )}

      {/* Save bar — a normal in-flow bar at the end of the form. */}
      <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
        <Button
          variant="cancel"
          className="rounded-full px-6"
          disabled={!dirty || update.isPending}
          onClick={handleDiscard}
        >
          Discard changes
        </Button>
        <Button
          variant="secondary"
          className="rounded-full px-6"
          disabled={!dirty || update.isPending}
          onClick={handleSave}
          leftIcon={
            <span className="bg-primary-300 flex h-4 w-4 items-center justify-center rounded-full">
              <MdCheck size={11} className="text-secondary-900" />
            </span>
          }
        >
          {update.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  )
}
