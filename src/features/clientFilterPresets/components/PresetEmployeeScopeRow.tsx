/**
 * An employee filter inside the preset editor (#1100) — "interaction created
 * by" and "responsible employee".
 *
 * The scope is the saved value, not the people it currently covers. "My group"
 * follows the group as it changes; only "Custom" freezes a list, because only
 * then did the operator actually pick names. The explicit multi-select is
 * therefore shown for that one scope and nothing else — offering it alongside
 * "My group" would imply the two combine, which they do not.
 */

import { useTranslation } from 'react-i18next'

import { CheckboxMultiSelect } from '@/components/ui/CheckboxMultiSelect'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'

import { ANY_EMPLOYEE_SCOPE, type EmployeeScope, type EmployeeScopeParam } from '../types'

const SCOPES: EmployeeScope[] = [
  'any',
  'myGroup',
  'myDepartment',
  'everyoneExceptMe',
  'everyoneExceptMyGroup',
  'everyoneExceptMyDepartment',
  'custom',
]

export interface PresetEmployeeOption {
  id: number
  name: string
}

export interface PresetEmployeeScopeRowProps {
  label: string
  value?: EmployeeScopeParam
  /** `undefined` means "this filter is unset" — scope is Any. */
  onChange: (next: EmployeeScopeParam | undefined) => void
  options: PresetEmployeeOption[]
}

export function PresetEmployeeScopeRow({
  label,
  value,
  onChange,
  options,
}: PresetEmployeeScopeRowProps) {
  const { t } = useTranslation('common')

  const param = value ?? ANY_EMPLOYEE_SCOPE

  const scopeLabel = (scope: EmployeeScope): string => {
    switch (scope) {
      case 'any':
        return t('pages.profile.presets.employees.scopes.any', 'Anyone')
      case 'myGroup':
        return t('pages.profile.presets.employees.scopes.myGroup', 'My group')
      case 'myDepartment':
        return t('pages.profile.presets.employees.scopes.myDepartment', 'My department')
      case 'everyoneExceptMe':
        return t('pages.profile.presets.employees.scopes.everyoneExceptMe', 'Everyone except me')
      case 'everyoneExceptMyGroup':
        return t(
          'pages.profile.presets.employees.scopes.everyoneExceptMyGroup',
          'Everyone except my group'
        )
      case 'everyoneExceptMyDepartment':
        return t(
          'pages.profile.presets.employees.scopes.everyoneExceptMyDepartment',
          'Everyone except my department'
        )
      case 'custom':
        return t('pages.profile.presets.employees.scopes.custom', 'Selected employees')
    }
  }

  const setScope = (scope: EmployeeScope) => {
    if (scope === 'any') {
      onChange(undefined)
      return
    }
    // Ids belong to "custom" alone; carrying them into a relative scope would
    // store a list nothing reads, then hand it back if the operator returns.
    onChange(scope === 'custom' ? { scope, employeeIds: param.employeeIds ?? [] } : { scope })
  }

  return (
    <fieldset className="flex w-full flex-col gap-2 self-stretch">
      <legend className="text-foreground text-sm font-medium">{label}</legend>
      <div className="flex w-full flex-col gap-3 self-stretch sm:flex-row">
        <div className="min-w-0 flex-1">
          <Select value={param.scope} onValueChange={(s) => setScope(s as EmployeeScope)}>
            <SelectTrigger aria-label={label}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCOPES.map((scope) => (
                <SelectItem key={scope} value={scope}>
                  {scopeLabel(scope)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {param.scope === 'custom' && (
          <div className="min-w-0 flex-1">
            <CheckboxMultiSelect<number>
              options={options.map((o) => ({ value: o.id, label: o.name }))}
              selected={param.employeeIds ?? []}
              onChange={(employeeIds) => onChange({ scope: 'custom', employeeIds })}
              allLabel={t('pages.profile.presets.employees.allLabel', 'All employees')}
              ariaLabel={`${label} — ${scopeLabel('custom')}`}
              testId="preset-employee-ids"
            />
          </div>
        )}
      </div>
    </fieldset>
  )
}
