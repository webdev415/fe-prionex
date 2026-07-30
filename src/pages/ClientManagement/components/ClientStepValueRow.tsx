/**
 * Per-step value filter row for the Client list bar.
 *
 * Self-contained — no imports from `pages/ActionAnalysis/`. The row is a
 * single label-left + control cell sized to fill its container; the
 * parent ClientFiltersBar lays the rows out two-per-line on lg+ screens.
 * The input flavor (date min/max, amount min/max, dropdown eq,
 * text/credit/contact eq) follows the step's target_action field_type.
 */
import { useTranslation } from 'react-i18next'
import type { TAChainStep } from '@/features/taChains/api/types'
import type { TargetAction } from '@/features/targetActions/api/types'
import { DateSelect } from '@/components/ui/DateSelect'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'

/**
 * Per-step value bounds, stored on the Client filter state.
 *
 * - ``eq`` carries exact-match input for dropdown / text / credit /
 *   contact field types.
 * - ``min`` / ``max`` carry range bounds for date / amount field types.
 *
 * Defined locally (not imported from TA History) so the Client dashboard
 * has zero cross-page coupling.
 */
export interface StepValueEntry {
  eq?: string
  min?: string
  max?: string
}

interface ClientStepValueRowProps {
  step: TAChainStep
  ta: TargetAction | null
  value: StepValueEntry
  onChange: (patch: Partial<StepValueEntry>) => void
}

function parseYmd(dateStr: string | undefined): Date | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

function formatYmd(d: Date | null): string | undefined {
  if (!d) return undefined
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Override the default Input focus styling on step-value inputs so they read
// like the Chain/Step Select triggers in the row above them — no green ring
// glow on focus, padding tightened to px-3 to match SelectTrigger. Without
// this the focused Credit input grows a primary-500 focus ring while the
// adjacent dropdowns stay flat, which looks inconsistent.
const STEP_VALUE_INPUT_CLASS = 'px-3 focus:border-border focus:ring-0 focus:ring-offset-0'

export function ClientStepValueRow({ step, ta, value, onChange }: ClientStepValueRowProps) {
  const { t } = useTranslation('common')
  const fieldType = ta?.field_type ?? null
  const stepName = step.target_action_name ?? ta?.name ?? ''
  const labelText = `${step.step_order}. ${stepName}`

  const minPlaceholder = t('pages.clients.filters.min')
  const maxPlaceholder = t('pages.clients.filters.max')
  const searchPlaceholder = t('pages.clients.filters.stepValuePlaceholder', 'Search…')
  const allValuesPlaceholder = t('pages.clients.filters.allStepValues', 'All values')
  const noFilterLabel = t(
    'pages.clients.filters.stepValueUnsupported',
    'No value filter available for this step.'
  )

  return (
    <div className="flex w-full flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:gap-3">
      <label
        className="text-foreground w-full shrink-0 truncate text-xs leading-[150%] font-medium tracking-[-0.24px] sm:max-w-[9.5rem] sm:min-w-[7.25rem] sm:text-sm sm:tracking-[-0.28px]"
        title={labelText}
      >
        {labelText}
      </label>
      <div className="flex w-full flex-1 items-center gap-2">
        {fieldType === 'date' && (
          <>
            <DateSelect
              value={parseYmd(value.min)}
              onChange={({ value: v }) => onChange({ min: formatYmd(v) ?? undefined })}
              placeholder={minPlaceholder}
              allowManualInput
              format="dd.MM.yyyy"
              className="flex flex-1 flex-col gap-2"
            />
            <span className="text-foreground text-sm leading-[155%] font-medium tracking-[-0.28px] sm:text-base sm:tracking-[-0.32px]">
              -
            </span>
            <DateSelect
              value={parseYmd(value.max)}
              onChange={({ value: v }) => onChange({ max: formatYmd(v) ?? undefined })}
              placeholder={maxPlaceholder}
              allowManualInput
              format="dd.MM.yyyy"
              className="flex flex-1 flex-col gap-2"
            />
          </>
        )}
        {fieldType === 'amount' && (
          <>
            <Input
              type="number"
              className={`flex-1 ${STEP_VALUE_INPUT_CLASS}`}
              placeholder={minPlaceholder}
              value={value.min ?? ''}
              onChange={(e) => {
                const v = e.target.value
                onChange({ min: v === '' ? undefined : v })
              }}
            />
            <span className="text-foreground text-sm leading-[155%] font-medium tracking-[-0.28px] sm:text-base sm:tracking-[-0.32px]">
              -
            </span>
            <Input
              type="number"
              className={`flex-1 ${STEP_VALUE_INPUT_CLASS}`}
              placeholder={maxPlaceholder}
              value={value.max ?? ''}
              onChange={(e) => {
                const v = e.target.value
                onChange({ max: v === '' ? undefined : v })
              }}
            />
          </>
        )}
        {fieldType === 'dropdown' && (
          <Select
            value={value.eq ?? 'all'}
            onValueChange={(v) => onChange({ eq: v === 'all' ? undefined : v })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={allValuesPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{allValuesPlaceholder}</SelectItem>
              {(ta?.dropdown_values ?? [])
                .filter((dv) => !dv.is_hidden)
                .map((dv) => (
                  <SelectItem key={dv.id} value={dv.value}>
                    {dv.value}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}
        {(fieldType === 'text' || fieldType === 'credit' || fieldType === 'contact') && (
          <Input
            type="text"
            className={`w-full ${STEP_VALUE_INPUT_CLASS}`}
            placeholder={searchPlaceholder}
            value={value.eq ?? ''}
            onChange={(e) => {
              const v = e.target.value
              onChange({ eq: v === '' ? undefined : v })
            }}
          />
        )}
        {fieldType === null && (
          <span className="text-muted-foreground text-xs italic">{noFilterLabel}</span>
        )}
      </div>
    </div>
  )
}
