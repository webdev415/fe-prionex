import { useTranslation } from 'react-i18next'
import type { CallMonitoringPeriod } from '@/features/actionAnalysis'
import type { OperatorUser } from '@/features/users/api/usersApi'
import type {
  InteractionContactTypeResponse,
  InteractionResultResponse,
} from '@/features/clients/api/types'
import { Input } from '@/components/ui/Input'
import { DateSelect } from '@/components/ui/DateSelect'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import type { InteractionBarState } from '../lib/interactionsUrlState'
import { EmployeeScopeFilter } from './EmployeeScopeFilter'

const PERIODS: CallMonitoringPeriod[] = ['today', 'yesterday', 'last_7d', 'last_30d', 'custom']

const FILTER_SURFACE = 'rounded-xl bg-white/50 p-4 shadow-sm sm:p-6'

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

interface Props {
  state: InteractionBarState
  operators: OperatorUser[]
  results: InteractionResultResponse[]
  contactTypes: InteractionContactTypeResponse[]
  onChange: (next: Partial<InteractionBarState>) => void
}

export function InteractionFiltersBar({
  state,
  operators,
  results,
  contactTypes,
  onChange,
}: Props) {
  const { t } = useTranslation('common')

  const period = state.period ?? 'last_7d'
  const isCustom = period === 'custom'
  const selectedResultId = state.result_ids?.[0]
  const selectedContactTypeId = state.contact_type_ids?.[0]

  return (
    <div className={FILTER_SURFACE}>
      <div className="flex w-full flex-col gap-4 lg:gap-5">
        <EmployeeScopeFilter
          operators={operators}
          value={{
            departmentId: state.departmentId,
            employeeIds: state.employeeIds,
          }}
          onChange={(scope) =>
            onChange({
              departmentId: scope.departmentId,
              employeeIds: scope.employeeIds,
            })
          }
        />

        <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.period', 'Period')}
            </span>
            <Select
              value={period}
              onValueChange={(v) => onChange({ period: v as CallMonitoringPeriod })}
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {t(`pages.actionAnalysis.filters.periods.${p}`, p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.contactType', 'Contact type')}
            </span>
            <Select
              value={selectedContactTypeId != null ? String(selectedContactTypeId) : 'all'}
              onValueChange={(v) =>
                onChange({ contact_type_ids: v === 'all' ? undefined : [Number(v)] })
              }
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue
                  placeholder={t('pages.actionAnalysis.filters.allContactTypes', 'All')}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('pages.actionAnalysis.filters.allContactTypes', 'All')}</SelectItem>
                {contactTypes.map((ct) => (
                  <SelectItem key={ct.id} value={String(ct.id)}>
                    {ct.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.result', 'Result')}
            </span>
            <Select
              value={selectedResultId != null ? String(selectedResultId) : 'all'}
              onValueChange={(v) =>
                onChange({ result_ids: v === 'all' ? undefined : [Number(v)] })
              }
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder={t('pages.actionAnalysis.filters.allResults', 'All')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('pages.actionAnalysis.filters.allResults', 'All')}</SelectItem>
                {results.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {t(`interactionResults.${r.code}`, { defaultValue: r.name })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.promiseMin', 'Promise min')}
            </span>
            <Input
              type="number"
              min={0}
              step="0.01"
              className="h-10"
              value={state.promise_amount_min ?? ''}
              onChange={(e) => {
                const v = e.target.value
                onChange({ promise_amount_min: v === '' ? undefined : Number(v) })
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.promiseMax', 'Promise max')}
            </span>
            <Input
              type="number"
              min={0}
              step="0.01"
              className="h-10"
              value={state.promise_amount_max ?? ''}
              onChange={(e) => {
                const v = e.target.value
                onChange({ promise_amount_max: v === '' ? undefined : Number(v) })
              }}
            />
          </div>
        </div>

        {isCustom && (
          <div className="grid w-full gap-3 border-t border-gray-200/80 pt-4 sm:grid-cols-2 lg:max-w-2xl lg:gap-4">
            <DateSelect
              label={t('pages.actionAnalysis.filters.dateFrom', 'From')}
              value={parseYmd(state.customFromDate)}
              onChange={({ value }) => onChange({ customFromDate: formatYmd(value) ?? '' })}
              placeholder={t('pages.actionAnalysis.filters.selectDate', 'Select date')}
              format="yyyy-MM-dd"
            />
            <DateSelect
              label={t('pages.actionAnalysis.filters.dateTo', 'To')}
              value={parseYmd(state.customToDate)}
              onChange={({ value }) => onChange({ customToDate: formatYmd(value) ?? '' })}
              placeholder={t('pages.actionAnalysis.filters.selectDate', 'Select date')}
              format="yyyy-MM-dd"
            />
          </div>
        )}
      </div>
    </div>
  )
}
