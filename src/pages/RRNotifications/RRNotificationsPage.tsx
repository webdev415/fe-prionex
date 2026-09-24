/**
 * RR Notifications system settings page.
 *
 * Admin configures: enable/disable, days-before array (multiple values
 * supported), and the notification template text with substitution
 * variables. The daily cron in notification-service reads these
 * settings each run.
 */

import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { Icons } from '@/lib/icons'
import { useAuthStore } from '@/stores/authStore'
import {
  useRRNotificationSettings,
  useUpdateRRNotificationSettings,
} from '@/features/notifications/hooks/useRRNotificationSettings'
import { getErrorMessage } from '@/lib/errors'

interface AvailableVar {
  name: 'client_name' | 'amount' | 'due_date' | 'days_left'
  /** i18n key under pages.rrNotifications.variables.* */
  i18nKey: string
}

const AVAILABLE_VARS: AvailableVar[] = [
  { name: 'client_name', i18nKey: 'clientName' },
  { name: 'amount', i18nKey: 'amount' },
  { name: 'due_date', i18nKey: 'dueDate' },
  { name: 'days_left', i18nKey: 'daysLeft' },
]

const SAMPLE_CTX: Record<string, string> = {
  client_name: 'Ivan Petrov',
  amount: '5,000.00',
  due_date: '2026-05-28',
  days_left: '3',
}

function renderTemplate(template: string, ctx: Record<string, string>): string {
  return template.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (m, key) =>
    Object.prototype.hasOwnProperty.call(ctx, key) ? ctx[key] : m
  )
}

export function RRNotificationsPage() {
  const { t } = useTranslation('common')
  const { user } = useAuthStore()
  const projectId = user?.active_project_id ? parseInt(user.active_project_id, 10) : undefined

  const { data: settings, isPending } = useRRNotificationSettings(projectId)
  const updateMut = useUpdateRRNotificationSettings(projectId)

  // Derived-state form pattern. ``edits`` is null until the user
  // touches a field; once they do, we switch to fully-controlled
  // values from ``edits``. After a successful save the mutation
  // invalidates the query, settings refetches, and we reset edits to
  // null so the form reflects the fresh server state. This avoids a
  // useEffect-driven sync (lint rule react-hooks/set-state-in-effect).
  type FormState = {
    enabled: boolean
    daysBefore: number[]
    templateText: string
    penaltyTemplateText: string
  }
  const [edits, setEdits] = useState<FormState | null>(null)
  const [dayInput, setDayInput] = useState('')

  const enabled = edits?.enabled ?? settings?.enabled ?? false
  const daysBefore = edits?.daysBefore ?? settings?.days_before ?? [3]
  const templateText = edits?.templateText ?? settings?.template_text ?? ''
  // KAN-785 Part 2 — separate template for the overdue-penalty reminder.
  const penaltyTemplateText = edits?.penaltyTemplateText ?? settings?.penalty_template_text ?? ''

  const setEnabled = (v: boolean) =>
    setEdits({ enabled: v, daysBefore, templateText, penaltyTemplateText })
  const setDaysBefore = (v: number[]) =>
    setEdits({ enabled, daysBefore: v, templateText, penaltyTemplateText })
  const setTemplateText = (v: string) =>
    setEdits({ enabled, daysBefore, templateText: v, penaltyTemplateText })
  const setPenaltyTemplateText = (v: string) =>
    setEdits({ enabled, daysBefore, templateText, penaltyTemplateText: v })

  const previewBody = useMemo(() => renderTemplate(templateText, SAMPLE_CTX), [templateText])

  // Variables currently used in the template — surfaced as chips so
  // the admin can confirm at a glance which placeholders are wired.
  const detectedVariables = useMemo(() => {
    const found = new Set<string>()
    for (const m of templateText.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)) {
      found.add(m[1])
    }
    return Array.from(found)
  }, [templateText])

  // Click-to-insert: pop ``{varname}`` into the textarea at the
  // current caret. Mirrors the SMS Templates form pattern so admins
  // get the same muscle memory across both settings pages.
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const insertVariable = (name: string) => {
    const ta = textareaRef.current
    const token = `{${name}}`
    if (!ta) {
      setTemplateText(templateText + token)
      return
    }
    const start = ta.selectionStart ?? templateText.length
    const end = ta.selectionEnd ?? templateText.length
    const next = templateText.substring(0, start) + token + templateText.substring(end)
    setTemplateText(next)
    setTimeout(() => {
      ta.focus()
      const pos = start + token.length
      ta.setSelectionRange(pos, pos)
    }, 0)
  }

  const addDay = () => {
    const n = parseInt(dayInput, 10)
    if (!Number.isFinite(n) || n < 1 || n > 365) return
    if (daysBefore.includes(n)) {
      setDayInput('')
      return
    }
    if (daysBefore.length >= 10) {
      toast.error(t('pages.rrNotifications.maxDaysReached', 'Max 10 entries'))
      return
    }
    setDaysBefore([...daysBefore, n].sort((a, b) => b - a))
    setDayInput('')
  }

  const removeDay = (n: number) => setDaysBefore(daysBefore.filter((d) => d !== n))

  const isDirty =
    settings == null ||
    enabled !== settings.enabled ||
    templateText !== settings.template_text ||
    penaltyTemplateText !== (settings.penalty_template_text ?? '') ||
    JSON.stringify(daysBefore) !== JSON.stringify(settings.days_before)

  const isSaveDisabled =
    !isDirty || daysBefore.length === 0 || !templateText.trim() || updateMut.isPending

  const handleSave = async () => {
    try {
      await updateMut.mutateAsync({
        enabled,
        days_before: daysBefore,
        template_text: templateText,
        // Blank penalty template -> null so the cron falls back to the
        // installment template.
        penalty_template_text: penaltyTemplateText.trim() || null,
      })
      // Drop local edits so the form reflects the freshly-refetched
      // server state on the next render. Query invalidation in the
      // hook triggers the refetch automatically.
      setEdits(null)
      toast.success(t('pages.rrNotifications.saved', 'Saved'))
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <div className="flex w-full flex-col items-start gap-4">
      <div className="flex flex-col gap-2 pb-4">
        <h1 className="text-foreground text-xl font-light sm:text-2xl">
          {t('pages.rrNotifications.title', 'RR Notifications')}
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm font-light">
          {t(
            'pages.rrNotifications.description',
            'Configure bell reminders for the responsible operator before each scheduled Restructuring Agreement payment. Sent daily by the system.'
          )}
        </p>
      </div>

      {isPending ? (
        <div className="border-border bg-card text-muted-foreground w-full rounded-xl border p-6 text-sm shadow-sm">
          {t('common.loading')}
        </div>
      ) : (
        <div className="border-border bg-card/50 flex w-full flex-col gap-5 rounded-xl border p-4 shadow-sm sm:p-6">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <Label className="text-foreground text-sm font-medium">
                {t('pages.rrNotifications.enable', 'Enable RR notifications')}
              </Label>
              <span className="text-muted-foreground text-xs">
                {t(
                  'pages.rrNotifications.enableHint',
                  'When off, no reminders are sent — pending notifications remain in the bell.'
                )}
              </span>
            </div>
            <ToggleSwitch
              checked={enabled}
              onChange={setEnabled}
              ariaLabel={t('pages.rrNotifications.enable', 'Enable RR notifications')}
            />
          </div>

          {/* Days before */}
          <div className="flex flex-col gap-2">
            <Label className="text-foreground text-sm font-medium">
              {t('pages.rrNotifications.daysBefore', 'Days before due date')}
            </Label>
            <span className="text-muted-foreground text-xs">
              {t(
                'pages.rrNotifications.daysBeforeHint',
                'Add one or more values (1–365). One reminder per value per payment.'
              )}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {daysBefore.map((n) => (
                <span
                  key={n}
                  className="bg-info-100 text-info-700 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
                >
                  {t('pages.rrNotifications.daysChip', '{{n}} days', { n })}
                  <button
                    type="button"
                    onClick={() => removeDay(n)}
                    className="hover:bg-info-100 rounded-full"
                    aria-label={t('actions.remove', 'Remove')}
                  >
                    <Icons.Close size={12} strokeWidth={2.5} />
                  </button>
                </span>
              ))}
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={dayInput}
                  onChange={(e) => setDayInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addDay()
                    }
                  }}
                  placeholder="3"
                  className="h-8 w-20 text-xs"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={addDay}
                  disabled={!dayInput}
                >
                  {t('actions.add', 'Add')}
                </Button>
              </div>
            </div>
            {daysBefore.length === 0 && (
              <span className="text-warning-600 text-xs">
                {t('pages.rrNotifications.daysRequired', 'Add at least one days-before value.')}
              </span>
            )}
          </div>

          {/* Template text */}
          <div className="flex flex-col gap-2">
            <Label className="text-foreground text-sm font-medium">
              {t('pages.rrNotifications.template', 'Notification text')}
            </Label>
            <Textarea
              ref={(el) => {
                textareaRef.current = el
              }}
              value={templateText}
              onChange={(e) => setTemplateText(e.target.value)}
              rows={4}
              className="text-sm"
              placeholder={t('pages.rrNotifications.templatePlaceholder')}
            />

            {/* Variables detected — chips showing which vars are
                currently used in the template. The × removes every
                ``{var}`` occurrence at once; for finer control the
                admin can also edit the textarea directly. */}
            {detectedVariables.length > 0 && (
              <div className="flex flex-col gap-1">
                <Label className="text-muted-foreground text-xs font-medium">
                  {t('pages.rrNotifications.variablesDetected', 'Variables detected')}:
                </Label>
                <div className="flex flex-wrap gap-2">
                  {detectedVariables.map((v) => {
                    const token = `{${v}}`
                    // Count occurrences so we can show "× 3" when the
                    // same variable is used multiple times — makes it
                    // obvious to the admin that there's more than one.
                    const count = templateText.split(token).length - 1
                    return (
                      <span
                        key={v}
                        className="border-border bg-card text-foreground inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium"
                      >
                        {token}
                        {count > 1 && (
                          <span className="bg-muted text-muted-foreground rounded px-1.5 text-[10px]">
                            ×{count}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            // Remove only the LAST occurrence — "undo
                            // the most-recently-inserted" intuition.
                            // To remove all, the admin clicks × until
                            // the chip disappears, OR edits the text
                            // directly.
                            const idx = templateText.lastIndexOf(token)
                            if (idx < 0) return
                            setTemplateText(
                              templateText.substring(0, idx) +
                                templateText.substring(idx + token.length)
                            )
                          }}
                          className="text-muted-foreground hover:bg-muted hover:text-foreground ml-0.5 rounded-full"
                          aria-label={t('actions.remove', 'Remove')}
                          title={t('pages.rrNotifications.removeVariable', 'Remove one occurrence')}
                        >
                          <Icons.Close size={12} strokeWidth={2.5} />
                        </button>
                      </span>
                    )
                  })}
                </div>
                <span className="text-muted-foreground text-[11px]">
                  {t(
                    'pages.rrNotifications.removeHint',
                    'Click × on a chip to remove all occurrences, or edit the text directly.'
                  )}
                </span>
              </div>
            )}

            {/* Available variables — clickable list that inserts
                at the textarea caret. */}
            <div className="border-border bg-muted flex flex-col gap-2 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <Label className="text-foreground text-xs font-medium">
                  {t('pages.rrNotifications.availableVariables', 'Available variables')}:
                </Label>
                <span className="text-muted-foreground text-[11px]">
                  {t('pages.rrNotifications.clickToInsert', 'Click to insert')}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {AVAILABLE_VARS.map((v) => (
                  <button
                    key={v.name}
                    type="button"
                    onClick={() => insertVariable(v.name)}
                    className="hover:bg-card flex items-start gap-4 self-stretch rounded px-2 py-1.5 text-left text-xs transition-colors"
                  >
                    <code className="text-foreground w-[120px] shrink-0 font-mono">
                      {`{${v.name}}`}
                    </code>
                    <span className="text-muted-foreground flex-1">
                      {t(`pages.rrNotifications.variables.${v.i18nKey}`)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Live preview */}
            <div className="border-border bg-card rounded border border-dashed px-3 py-2 text-xs">
              <span className="text-muted-foreground font-medium">
                {t('pages.rrNotifications.preview', 'Preview')}:{' '}
              </span>
              <span className="text-foreground">{previewBody}</span>
            </div>
          </div>

          {/* Penalty reminder template (KAN-785 Part 2) — optional override */}
          <div className="border-border flex flex-col gap-2 border-t pt-5">
            <Label className="text-foreground text-sm font-medium">
              {t('pages.rrNotifications.penaltyTemplate', 'Penalty reminder template')}
            </Label>
            <span className="text-muted-foreground text-xs">
              {t(
                'pages.rrNotifications.penaltyTemplateHint',
                'Used only for the overdue-penalty reminder. Leave blank to reuse the installment template above.'
              )}
            </span>
            <Textarea
              value={penaltyTemplateText}
              onChange={(e) => setPenaltyTemplateText(e.target.value)}
              rows={3}
              className="text-sm"
              placeholder={t(
                'pages.rrNotifications.penaltyTemplatePlaceholder',
                '{client_name}: penalty {amount} due {due_date}'
              )}
            />
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_VARS.map((v) => (
                <button
                  key={v.name}
                  type="button"
                  onClick={() => setPenaltyTemplateText(penaltyTemplateText + `{${v.name}}`)}
                  className="border-border bg-card text-foreground hover:bg-muted rounded-full border px-2 py-1 font-mono text-[11px]"
                >
                  {`{${v.name}}`}
                </button>
              ))}
            </div>
            {penaltyTemplateText.trim() && (
              <div className="border-border bg-card rounded border border-dashed px-3 py-2 text-xs">
                <span className="text-muted-foreground font-medium">
                  {t('pages.rrNotifications.preview', 'Preview')}:{' '}
                </span>
                <span className="text-foreground">
                  {renderTemplate(penaltyTemplateText, SAMPLE_CTX)}
                </span>
              </div>
            )}
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <Button variant="primary" onClick={handleSave} disabled={isSaveDisabled}>
              {updateMut.isPending ? t('actions.saving', 'Saving...') : t('actions.save', 'Save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default RRNotificationsPage
