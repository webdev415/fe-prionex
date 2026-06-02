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
import type { StepValueEntry } from '../lib/taHistoryUrlState'

interface StepValueRowProps {
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

export function StepValueRow({ step, ta, value, onChange }: StepValueRowProps) {
  const { t } = useTranslation('common')
  const fieldType = ta?.field_type ?? null
  const minDate = parseYmd(value.min)
  const maxDate = parseYmd(value.max)
  const stepLabel = `${step.step_order}. ${step.target_action_name ?? ta?.name ?? t('pages.actionAnalysis.filters.chainStep', 'Step')}`

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <span
        className="text-dark-500 truncate text-xs font-medium tracking-[-0.24px] sm:w-44 sm:shrink-0 sm:text-sm sm:tracking-[-0.28px]"
        title={stepLabel}
      >
        {stepLabel}
      </span>
      <div className="flex min-w-0 flex-1 flex-row items-center gap-2 sm:gap-3">
        {fieldType === 'date' && (
          <>
            <DateSelect
              value={minDate}
              onChange={({ value: v }) => onChange({ min: formatYmd(v) ?? undefined })}
              placeholder={t('pages.actionAnalysis.filters.selectStartDate', 'Select start date')}
              max={maxDate ?? undefined}
              format="yyyy-MM-dd"
              className="min-w-0 flex-1 [&_input]:h-[45px]"
            />
            <DateSelect
              value={maxDate}
              onChange={({ value: v }) => onChange({ max: formatYmd(v) ?? undefined })}
              placeholder={t('pages.actionAnalysis.filters.selectEndDate', 'Select end date')}
              min={minDate ?? undefined}
              format="yyyy-MM-dd"
              className="min-w-0 flex-1 [&_input]:h-[45px]"
            />
          </>
        )}
        {fieldType === 'amount' && (
          <>
            <Input
              type="number"
              className="h-[45px] min-w-0 flex-1"
              placeholder={t('pages.actionAnalysis.filters.stepValueMin', 'Step value min')}
              value={value.min ?? ''}
              onChange={(e) => {
                const v = e.target.value
                onChange({ min: v === '' ? undefined : v })
              }}
            />
            <Input
              type="number"
              className="h-[45px] min-w-0 flex-1"
              placeholder={t('pages.actionAnalysis.filters.stepValueMax', 'Step value max')}
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
            <SelectTrigger className="h-[45px] w-full">
              <SelectValue
                placeholder={t('pages.actionAnalysis.filters.allStepValues', 'All values')}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('pages.actionAnalysis.filters.allStepValues', 'All values')}
              </SelectItem>
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
            className="h-[45px] w-full"
            placeholder={t('pages.actionAnalysis.filters.stepValuePlaceholder', 'Search…')}
            value={value.eq ?? ''}
            onChange={(e) => {
              const v = e.target.value
              onChange({ eq: v === '' ? undefined : v })
            }}
          />
        )}
        {fieldType === null && (
          <span className="text-xs text-gray-500 italic">
            {t(
              'pages.actionAnalysis.filters.stepValueUnsupported',
              'No value filter available for this step.'
            )}
          </span>
        )}
      </div>
    </div>
  )
}
