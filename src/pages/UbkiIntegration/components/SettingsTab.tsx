import { useState } from 'react'
import { MdClose, MdCheck } from 'react-icons/md'
import { Button } from '@/components/ui/Button'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'

// TODO(ubki-backend): no UBKI settings table yet — everything here is local
// state. Wire to a settings GET/PUT endpoint when it exists.

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

export function SettingsTab() {
  const [autoSubmit, setAutoSubmit] = useState(true)
  const [sendOnlyChanged, setSendOnlyChanged] = useState(true)
  const [dailyEmail, setDailyEmail] = useState(true)
  const [failureAlert, setFailureAlert] = useState(true)
  const [freq, setFreq] = useState<'daily' | 'weekdays' | 'custom'>('daily')
  const [skipCodes, setSkipCodes] = useState(['ERR_400', 'ERR_404', 'ERR_422'])
  const [recipients, setRecipients] = useState(['admin@company.ua', 'supervisor@company.ua'])

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="Automatic Submission"
        desc="Configure when UBKI submissions are sent automatically."
      >
        <ToggleRow
          checked={autoSubmit}
          onChange={setAutoSubmit}
          title="Enable automatic submission"
          desc="Automatically send credit updates on schedule."
          note="If disabled, only Manual and Bulk submissions are allowed."
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Send time" hint="Default: 03:00 Europe/Kyiv. Off-peak recommended.">
            <input className={inputCls} defaultValue="08:00" />
          </Field>
          <Field label="Time zone">
            <select className={inputCls} defaultValue="Europe/Kyiv">
              <option>Europe/Kyiv (UTC+3)</option>
              <option>UTC</option>
            </select>
          </Field>
          <Field label="Frequency">
            <div className="flex gap-1">
              {(['daily', 'weekdays', 'custom'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFreq(f)}
                  className={`flex-1 rounded-lg px-2 py-2 text-xs font-medium capitalize ${
                    freq === f
                      ? 'bg-secondary-800 text-white'
                      : 'border border-gray-200 bg-white text-gray-600'
                  }`}
                >
                  {f === 'daily' ? 'Every day' : f === 'weekdays' ? 'Weekdays only' : 'Custom days'}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <ToggleRow
          checked={sendOnlyChanged}
          onChange={setSendOnlyChanged}
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
            <input className={inputCls} defaultValue="3" />
          </Field>
          <Field
            label="Retry interval (minutes)"
            hint="Default: 15 min. Exponential backoff applied."
          >
            <input className={inputCls} defaultValue="15" />
          </Field>
          <Field
            label="Skip retry for these error codes"
            hint="These errors require manual fix, not retry."
          >
            <Chips
              items={skipCodes}
              onRemove={(i) => setSkipCodes((c) => c.filter((_, idx) => idx !== i))}
              onAdd={() => setSkipCodes((c) => [...c, 'ERR_500'])}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Notifications"
        desc="Choose who gets alerted and when for UBKI integration events."
      >
        <ToggleRow
          checked={dailyEmail}
          onChange={setDailyEmail}
          title="Daily summary email"
          desc="Send a daily report with submission stats to all recipients."
        />
        <ToggleRow
          checked={failureAlert}
          onChange={setFailureAlert}
          title="Alert on high failure rate"
          desc="Send an alert when failure rate exceeds the threshold."
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Alert on high failure rate" hint="Default: 10%. Recommended range: 5–20%.">
            <input className={inputCls} defaultValue="20" />
          </Field>
          <Field label="Connection-down alert (minutes)" hint="Default: 15 min.">
            <input className={inputCls} defaultValue="15" />
          </Field>
          <Field
            label="Notification recipients"
            hint="Combination of roles and individuals is supported."
          >
            <Chips
              items={recipients}
              onRemove={(i) => setRecipients((c) => c.filter((_, idx) => idx !== i))}
              onAdd={() => setRecipients((c) => [...c, 'new@company.ua'])}
            />
          </Field>
        </div>
      </SectionCard>

      {/* Save bar — a normal in-flow bar at the end of the form. No fixed/sticky
          positioning, so it never floats over the sidebar or other controls. */}
      <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
        <Button variant="cancel" className="rounded-full px-6">
          Discard changes
        </Button>
        {/* TODO(ubki-backend): persist → PUT settings */}
        <Button
          variant="secondary"
          className="rounded-full px-6"
          leftIcon={
            <span className="bg-primary-300 flex h-4 w-4 items-center justify-center rounded-full">
              <MdCheck size={11} className="text-secondary-900" />
            </span>
          }
        >
          Save changes
        </Button>
      </div>
    </div>
  )
}
