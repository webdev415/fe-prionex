/**
 * RR Periodicity system settings page (KAN-785 Part 1).
 *
 * Admin toggles which built-in payment-frequency options appear in the RR
 * creation form's "Payment Frequency" dropdown. Per project (the backend keys
 * off the caller's active project). Disabling all three leaves the operator to
 * enter every payment date manually.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import {
  useRRPeriodicitySettings,
  useUpdateRRPeriodicitySettings,
} from '@/features/clients/hooks/useRRPeriodicitySettings'
import {
  CANONICAL_PERIODICITY_TYPES,
  type PeriodicityType,
} from '@/features/clients/utils/rrSchedule'
import { getErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'

interface TypeMeta {
  key: PeriodicityType
  /** i18n key suffix under pages.rrPeriodicity.types.* */
  i18nKey: string
  labelFallback: string
  hintFallback: string
}

const TYPE_META: TypeMeta[] = [
  {
    key: 'every_n_days',
    i18nKey: 'everyNDays',
    labelFallback: 'Every N days',
    hintFallback: 'Operator sets an interval (e.g. every 14 days).',
  },
  {
    key: 'monthly_same_day',
    i18nKey: 'monthlySameDay',
    labelFallback: 'Monthly (same day)',
    hintFallback: 'Same day of month as the first payment date.',
  },
  {
    key: 'monthly_nth_day',
    i18nKey: 'monthlyNthDay',
    labelFallback: 'Every Nth of month',
    hintFallback: 'Operator picks a day of month (1–30 or last day).',
  },
]

export function RRPeriodicityPage() {
  const { t } = useTranslation('common')

  const { data: settings, isPending } = useRRPeriodicitySettings()
  const updateMut = useUpdateRRPeriodicitySettings()

  // Derived-state form: ``edits`` is null until the admin toggles something,
  // then it takes over as the controlled value. Reset to null after a
  // successful save so the freshly-refetched server state shows through.
  const [edits, setEdits] = useState<PeriodicityType[] | null>(null)
  const enabledTypes = edits ?? settings?.enabled_types ?? []

  const isEnabled = (key: PeriodicityType) => enabledTypes.includes(key)
  const toggle = (key: PeriodicityType, on: boolean) => {
    const next = on ? [...enabledTypes, key] : enabledTypes.filter((k) => k !== key)
    // Keep canonical order for a stable payload / comparison.
    setEdits(CANONICAL_PERIODICITY_TYPES.filter((k) => next.includes(k)))
  }

  const serverTypes = settings?.enabled_types ?? []
  // Dirty when the admin has actually changed the selection. Keyed off `edits`
  // (not `settings != null`) so Save still works when no row exists yet — the
  // PUT get-or-creates it — instead of staying dead-disabled.
  const isDirty =
    edits !== null &&
    JSON.stringify([...enabledTypes].sort()) !== JSON.stringify([...serverTypes].sort())
  const isSaveDisabled = !isDirty || updateMut.isPending

  const handleCancel = () => setEdits(null)

  const handleSave = async () => {
    try {
      await updateMut.mutateAsync({ enabled_types: enabledTypes })
      setEdits(null)
      toast.success(t('pages.rrPeriodicity.saved', 'Payment periodicity options saved'), {
        description: t(
          'pages.rrPeriodicity.savedDescription',
          'Operators will see the updated frequency options next time they create a Restructuring Agreement.'
        ),
      })
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <div className="flex w-full flex-col items-start gap-4">
      <div className="mb-4 flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="text-foreground text-xl font-light sm:text-2xl">
            {t('pages.rrPeriodicity.title', 'RR Payment Periodicity')}
          </h1>
          <p className="text-muted-foreground max-w-2xl text-sm font-light">
            {t(
              'pages.rrPeriodicity.description',
              'Choose which payment-frequency options operators can use to auto-fill the schedule when creating a Restructuring Agreement.'
            )}
          </p>
        </div>

        {isDirty && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCancel}
              disabled={updateMut.isPending}
            >
              {t('actions.cancel', 'Cancel')}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={isSaveDisabled}
            >
              {updateMut.isPending ? t('common.saving', 'Saving…') : t('actions.save', 'Save')}
            </Button>
          </div>
        )}
      </div>

      {isPending ? (
        <div className="border-border bg-card text-muted-foreground w-full rounded-xl border p-6 text-sm shadow-sm">
          {t('common.loading')}
        </div>
      ) : (
        <>
          {enabledTypes.length === 0 && (
            <div className="border-warning-200 bg-warning-100/40 text-warning-700 flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-sm">
              <div className="bg-warning-100 text-warning-700 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                !
              </div>
              <p className="pt-1">
                {t(
                  'pages.rrPeriodicity.allDisabledHint',
                  'With every option off, operators enter each payment date manually.'
                )}
              </p>
            </div>
          )}

          <section className="border-border bg-card/50 flex w-full flex-col gap-4 rounded-xl border p-4 shadow-sm sm:p-6">
            <div>
              <h2 className="text-foreground mb-1 text-base font-semibold sm:text-lg">
                {t('pages.rrPeriodicity.optionsTitle', 'Frequency options')}
              </h2>
              <p className="text-muted-foreground text-sm font-light">
                {t(
                  'pages.rrPeriodicity.optionsDescription',
                  'Enabled options appear in the Payment Frequency dropdown on the RR creation form.'
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {TYPE_META.map((meta) => {
                const on = isEnabled(meta.key)
                const label = t(
                  `pages.rrPeriodicity.types.${meta.i18nKey}.label`,
                  meta.labelFallback
                )
                return (
                  <div
                    key={meta.key}
                    className="border-border bg-card flex min-h-14 items-center justify-between gap-3 rounded-lg border px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground text-sm font-medium">{label}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs font-light">
                        {t(`pages.rrPeriodicity.types.${meta.i18nKey}.hint`, meta.hintFallback)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span
                        className={cn(
                          'inline-flex h-[28px] items-center rounded-full px-2.5 text-xs font-medium',
                          on ? 'bg-success-100 text-success-700' : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {on
                          ? t('pages.rrPeriodicity.enabled', 'Enabled')
                          : t('pages.rrPeriodicity.disabled', 'Disabled')}
                      </span>
                      <ToggleSwitch
                        checked={on}
                        onChange={(v) => toggle(meta.key, v)}
                        ariaLabel={label}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
