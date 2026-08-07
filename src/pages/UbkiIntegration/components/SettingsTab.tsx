import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { MdClose, MdCheck, MdSend } from 'react-icons/md'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/Select'
import { timezoneOptions } from '@/features/users/schemas/userSchemas'
import {
  useUbkiSettings,
  useUpdateUbkiSettings,
  useRunAutoSubmitNow,
  type UbkiSettings,
} from '../api'

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
      <label className="text-muted-foreground mb-1 block text-xs font-medium">{label}</label>
      {children}
      {hint && <p className="text-muted-foreground mt-1 text-[11px]">{hint}</p>}
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
          <p className="text-foreground text-sm font-medium">{title}</p>
          <p className="text-muted-foreground text-xs">{desc}</p>
        </div>
      </div>
      {note && (
        <p className="text-muted-foreground text-right text-[11px] whitespace-nowrap">{note}</p>
      )}
    </div>
  )
}

function Chips({
  items,
  onRemove,
  onAdd,
  placeholder,
}: {
  items: string[]
  onRemove: (i: number) => void
  onAdd: (value: string) => void
  placeholder?: string
}) {
  const { t } = useTranslation('common')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commit = () => {
    const value = draft.trim()
    if (value && !items.includes(value)) onAdd(value)
    setDraft('')
  }
  const close = () => {
    setDraft('')
    setEditing(false)
  }

  return (
    <div className="border-border bg-card flex flex-wrap items-center gap-2 rounded-lg border px-2 py-1.5">
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
      {editing ? (
        <span className="inline-flex items-center gap-1">
          <input
            ref={inputRef}
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commit()
              } else if (e.key === 'Escape') {
                close()
              }
            }}
            onBlur={() => {
              commit()
              setEditing(false)
            }}
            className="focus:border-primary-500 border-border text-foreground min-w-[8rem] flex-1 rounded-md border px-2 py-0.5 text-xs focus:outline-none"
          />
          <button
            type="button"
            // Keep the input focused so onBlur doesn't fire before this click,
            // which would otherwise commit twice / close the field.
            onMouseDown={(e) => e.preventDefault()}
            onClick={commit}
            aria-label={t('pages.ubkiIntegration.settings.chips.addAriaLabel', 'Add')}
            className="bg-primary-600 hover:bg-primary-700 inline-flex h-5 w-5 items-center justify-center rounded-md text-white"
          >
            <MdCheck size={12} />
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="hover:text-foreground text-muted-foreground text-xs font-medium"
        >
          {t('pages.ubkiIntegration.settings.chips.addButton', '+ Add')}
        </button>
      )}
    </div>
  )
}

function SectionCard({
  title,
  desc,
  children,
  action,
}: {
  title: string
  desc: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="border-border bg-card rounded-2xl border p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-foreground text-sm font-semibold">{title}</h2>
          <p className="text-muted-foreground text-xs">{desc}</p>
        </div>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

const inputCls =
  'h-10 w-full rounded-lg border border-border bg-card px-3 text-xs text-foreground focus:border-primary-500 focus:outline-none'

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
  const { t } = useTranslation('common')
  const { data, isLoading, isError } = useUbkiSettings()
  const update = useUpdateUbkiSettings()
  const runNow = useRunAutoSubmitNow()

  const handleSendNow = () => {
    runNow.mutate(undefined, {
      onSuccess: () =>
        toast.success(
          t(
            'pages.ubkiIntegration.settings.sendNow.successToast',
            'Submission started — check the Overview log for results.'
          )
        ),
      onError: () =>
        toast.error(
          t(
            'pages.ubkiIntegration.settings.sendNow.errorToast',
            'Could not start submission. Please try again.'
          )
        ),
    })
  }

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
    return (
      <div className="text-muted-foreground py-16 text-center text-sm">
        {t('pages.ubkiIntegration.settings.loading', 'Loading settings…')}
      </div>
    )
  }
  if (isError) {
    return (
      <div className="text-error-600 py-16 text-center text-sm">
        {t(
          'pages.ubkiIntegration.settings.loadError',
          'Failed to load settings. Please try again.'
        )}
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
        title={t('pages.ubkiIntegration.settings.section.autoSubmit.title', 'Automatic Submission')}
        desc={t(
          'pages.ubkiIntegration.settings.section.autoSubmit.desc',
          'Configure when UBKI submissions are sent automatically.'
        )}
        action={
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<MdSend size={14} />}
            isLoading={runNow.isPending}
            disabled={!form.auto_submit_enabled || runNow.isPending}
            onClick={handleSendNow}
            title={
              form.auto_submit_enabled
                ? t(
                    'pages.ubkiIntegration.settings.sendNow.enabledTitle',
                    'Run the automatic submission now (ignores the schedule)'
                  )
                : t(
                    'pages.ubkiIntegration.settings.sendNow.disabledTitle',
                    'Enable automatic submission to use Send now'
                  )
            }
          >
            {t('pages.ubkiIntegration.settings.sendNow.button', 'Send now')}
          </Button>
        }
      >
        <ToggleRow
          checked={form.auto_submit_enabled}
          onChange={(v) => set({ auto_submit_enabled: v })}
          title={t(
            'pages.ubkiIntegration.settings.autoSubmit.toggleTitle',
            'Enable automatic submission'
          )}
          desc={t(
            'pages.ubkiIntegration.settings.autoSubmit.toggleDesc',
            'Automatically send credit updates on schedule.'
          )}
          note={t(
            'pages.ubkiIntegration.settings.autoSubmit.toggleNote',
            'If disabled, only Manual and Bulk submissions are allowed.'
          )}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field
            label={t('pages.ubkiIntegration.settings.sendTime.label', 'Send time')}
            hint={t(
              'pages.ubkiIntegration.settings.sendTime.hint',
              'Default: 03:00 Europe/Kyiv. Off-peak recommended.'
            )}
          >
            <input
              type="time"
              className={inputCls}
              value={form.send_time}
              onChange={(e) => set({ send_time: e.target.value })}
            />
          </Field>
          <Field label={t('pages.ubkiIntegration.settings.timezone.label', 'Time zone')}>
            <Select value={form.timezone} onValueChange={(v) => set({ timezone: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timezoneOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('pages.ubkiIntegration.settings.frequency.label', 'Frequency')}>
            <div className="border-border bg-muted flex gap-1 rounded-xl border p-1">
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
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    form.frequency === f
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f === 'daily'
                    ? t('pages.ubkiIntegration.settings.frequency.everyDay', 'Every day')
                    : f === 'weekdays'
                      ? t('pages.ubkiIntegration.settings.frequency.weekdaysOnly', 'Weekdays only')
                      : t('pages.ubkiIntegration.settings.frequency.customDays', 'Custom days')}
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
                          ? 'bg-primary-600 text-white'
                          : 'border-border bg-card text-muted-foreground border'
                      }`}
                    >
                      {t(`pages.ubkiIntegration.settings.weekdays.${d.key}`, d.label)}
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
          title={t(
            'pages.ubkiIntegration.settings.sendOnlyChanged.title',
            'Send only changed credits'
          )}
          desc={t(
            'pages.ubkiIntegration.settings.sendOnlyChanged.desc',
            'Only credits with deltas since last send (payment / status / RR change).'
          )}
          note={t(
            'pages.ubkiIntegration.settings.sendOnlyChanged.note',
            'Switching off resends the full portfolio every day.'
          )}
        />
      </SectionCard>

      <SectionCard
        title={t('pages.ubkiIntegration.settings.section.retry.title', 'Retry Policy')}
        desc={t(
          'pages.ubkiIntegration.settings.section.retry.desc',
          'Control how failed submissions are automatically retried.'
        )}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field
            label={t(
              'pages.ubkiIntegration.settings.retry.maxAttempts.label',
              'Max retry attempts'
            )}
            hint={t(
              'pages.ubkiIntegration.settings.retry.maxAttempts.hint',
              'Default: 3. Range: 1–10.'
            )}
          >
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
            label={t(
              'pages.ubkiIntegration.settings.retry.interval.label',
              'Retry interval (minutes)'
            )}
            hint={t(
              'pages.ubkiIntegration.settings.retry.interval.hint',
              'Default: 15 min. Fixed gap between retries.'
            )}
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
            label={t(
              'pages.ubkiIntegration.settings.retry.skipCodes.label',
              'Skip retry for these error codes'
            )}
            hint={t(
              'pages.ubkiIntegration.settings.retry.skipCodes.hint',
              'These errors require manual fix, not retry.'
            )}
          >
            <Chips
              items={form.skip_retry_error_codes}
              placeholder={t(
                'pages.ubkiIntegration.settings.retry.skipCodes.placeholder',
                'e.g. ERR_500'
              )}
              onRemove={(i) =>
                set({
                  skip_retry_error_codes: form.skip_retry_error_codes.filter((_, idx) => idx !== i),
                })
              }
              onAdd={(code) =>
                set({ skip_retry_error_codes: [...form.skip_retry_error_codes, code] })
              }
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title={t('pages.ubkiIntegration.settings.section.notifications.title', 'Notifications')}
        desc={t(
          'pages.ubkiIntegration.settings.section.notifications.desc',
          'Choose who gets alerted and when for UBKI integration events.'
        )}
      >
        <ToggleRow
          checked={form.daily_summary_email}
          onChange={(v) => set({ daily_summary_email: v })}
          title={t(
            'pages.ubkiIntegration.settings.notifications.dailySummary.title',
            'Daily summary email'
          )}
          desc={t(
            'pages.ubkiIntegration.settings.notifications.dailySummary.desc',
            'Send a daily report with submission stats to all recipients.'
          )}
        />
        <ToggleRow
          checked={form.alert_on_high_failure}
          onChange={(v) => set({ alert_on_high_failure: v })}
          title={t(
            'pages.ubkiIntegration.settings.notifications.highFailureAlert.title',
            'Alert on high failure rate'
          )}
          desc={t(
            'pages.ubkiIntegration.settings.notifications.highFailureAlert.desc',
            'Send an alert when failure rate exceeds the threshold.'
          )}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field
            label={t(
              'pages.ubkiIntegration.settings.notifications.threshold.label',
              'High failure-rate threshold (%)'
            )}
            hint={t(
              'pages.ubkiIntegration.settings.notifications.threshold.hint',
              'Default: 10%. Recommended range: 5–20%.'
            )}
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
          <Field
            label={t(
              'pages.ubkiIntegration.settings.notifications.connectionDown.label',
              'Connection-down alert (minutes)'
            )}
            hint={t(
              'pages.ubkiIntegration.settings.notifications.connectionDown.hint',
              'Default: 15 min.'
            )}
          >
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
            label={t(
              'pages.ubkiIntegration.settings.notifications.recipients.label',
              'Notification recipients'
            )}
            hint={t(
              'pages.ubkiIntegration.settings.notifications.recipients.hint',
              'Combination of roles and individuals is supported.'
            )}
          >
            <Chips
              items={form.notification_recipients}
              placeholder={t(
                'pages.ubkiIntegration.settings.notifications.recipients.placeholder',
                'email or role'
              )}
              onRemove={(i) =>
                set({
                  notification_recipients: form.notification_recipients.filter(
                    (_, idx) => idx !== i
                  ),
                })
              }
              onAdd={(who) =>
                set({ notification_recipients: [...form.notification_recipients, who] })
              }
            />
          </Field>
        </div>
      </SectionCard>

      {update.isError && (
        <p className="text-error-600 text-right text-xs">
          {t(
            'pages.ubkiIntegration.settings.saveError',
            'Failed to save. Please check the values and try again.'
          )}
        </p>
      )}

      {/* Save bar — a normal in-flow bar at the end of the form. */}
      <div className="border-border flex justify-end gap-3 border-t pt-4">
        <Button
          variant="cancel"
          className="rounded-full px-6"
          disabled={!dirty || update.isPending}
          onClick={handleDiscard}
        >
          {t('pages.ubkiIntegration.settings.discardButton', 'Discard changes')}
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
          {update.isPending
            ? t('pages.ubkiIntegration.settings.savingButton', 'Saving…')
            : t('pages.ubkiIntegration.settings.saveButton', 'Save changes')}
        </Button>
      </div>
    </div>
  )
}
