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
import { Label } from '@/components/ui/Label'
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-2 border-b border-gray-100 pb-4">
        <h1 className="text-dark-500 text-2xl font-light">
          {t('pages.rrPeriodicity.title', 'RR Payment Periodicity')}
        </h1>
        <p className="max-w-2xl text-sm text-gray-500">
          {t(
            'pages.rrPeriodicity.description',
            'Choose which payment-frequency options operators can use to auto-fill the schedule when creating a Restructuring Agreement.'
          )}
        </p>
      </div>

      {isPending ? (
        <div className="rounded-md border border-gray-200 bg-white p-6 text-sm text-gray-500">
          {t('common.loading')}
        </div>
      ) : (
        <div className="flex flex-col gap-5 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          {TYPE_META.map((meta) => (
            <div key={meta.key} className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <Label className="text-sm font-medium text-gray-800">
                  {t(`pages.rrPeriodicity.types.${meta.i18nKey}.label`, meta.labelFallback)}
                </Label>
                <span className="text-xs text-gray-500">
                  {t(`pages.rrPeriodicity.types.${meta.i18nKey}.hint`, meta.hintFallback)}
                </span>
              </div>
              <ToggleSwitch
                checked={isEnabled(meta.key)}
                onChange={(v) => toggle(meta.key, v)}
                aria-label={t(
                  `pages.rrPeriodicity.types.${meta.i18nKey}.label`,
                  meta.labelFallback
                )}
              />
            </div>
          ))}

          {enabledTypes.length === 0 && (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {t(
                'pages.rrPeriodicity.allDisabledHint',
                'With every option off, operators enter each payment date manually.'
              )}
            </div>
          )}

          <div className="flex justify-end border-t border-gray-100 pt-4">
            <Button
              variant="primary"
              size="sm"
              disabled={isSaveDisabled}
              onClick={handleSave}
              className="rounded-md"
            >
              {updateMut.isPending ? t('common.saving', 'Saving…') : t('actions.save', 'Save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
