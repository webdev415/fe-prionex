import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '@/components/ui/Checkbox'
import { Button } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/lib/icons'
import type { OperatorUser } from '@/features/users/api/usersApi'

export interface EmployeeScopeValue {
  departmentId: number | null
  employeeIds: number[]
}

interface Props {
  operators: OperatorUser[]
  value: EmployeeScopeValue
  onChange: (next: EmployeeScopeValue) => void
}

function departmentOptions(operators: OperatorUser[]) {
  const map = new Map<number, string>()
  for (const o of operators) {
    if (o.department_id != null) {
      const label = o.department_name?.trim() || `ID ${o.department_id}`
      if (!map.has(o.department_id)) map.set(o.department_id, label)
    }
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

export function EmployeeScopeFilter({ operators, value, onChange }: Props) {
  const { t } = useTranslation('common')
  const deptOpts = useMemo(() => departmentOptions(operators), [operators])

  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [draftIds, setDraftIds] = useState<number[]>(value.employeeIds)

  const handleMenuOpenChange = (open: boolean) => {
    setMenuOpen(open)
    if (!open) setDraftIds([...value.employeeIds])
  }

  const filteredOperators = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return operators
    return operators.filter((o) => o.full_name.toLowerCase().includes(q))
  }, [operators, search])

  const deptSelectValue = value.departmentId != null ? String(value.departmentId) : 'all'

  const triggerLabel =
    value.departmentId != null
      ? deptOpts.find((d) => d.id === value.departmentId)?.name ??
        t('pages.actionAnalysis.filters.department', 'Department')
      : value.employeeIds.length === 0
        ? t('pages.actionAnalysis.filters.allEmployees', 'All employees')
        : t('pages.actionAnalysis.filters.employeesCount', '{{count}} selected', {
            count: value.employeeIds.length,
          })

  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
          {t('pages.actionAnalysis.filters.department', 'Department')}
        </span>
        <Select
          value={deptSelectValue}
          onValueChange={(v) => {
            if (v === 'all') {
              onChange({ departmentId: null, employeeIds: value.employeeIds })
            } else {
              onChange({ departmentId: Number(v), employeeIds: [] })
            }
          }}
        >
          <SelectTrigger className="h-10 w-full min-w-[140px]">
            <SelectValue
              placeholder={t('pages.actionAnalysis.filters.allDepartments', 'All departments')}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t('pages.actionAnalysis.filters.allDepartments', 'All departments')}
            </SelectItem>
            {deptOpts.map((d) => (
              <SelectItem key={d.id} value={String(d.id)}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
          {t('pages.actionAnalysis.filters.employees', 'Employees')}
        </span>
        <DropdownMenu open={menuOpen} onOpenChange={handleMenuOpenChange} modal={false}>
          <DropdownMenuTrigger asChild disabled={value.departmentId != null}>
            <Button
              type="button"
              variant="outline"
              className="text-dark-500 h-10 w-full justify-between font-light"
              disabled={value.departmentId != null}
            >
              <span className="truncate">{triggerLabel}</span>
              <Icons.ArrowDown size={16} className="ml-1 shrink-0 opacity-60" strokeWidth={1.5} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={8}
            className="w-[min(100vw-2rem,320px)] rounded-lg border border-gray-200 bg-white p-0 shadow-lg"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <div className="border-b border-gray-200 p-3">
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t(
                  'pages.actionAnalysis.filters.searchEmployees',
                  'Search by name…'
                )}
                className="h-9 text-sm"
              />
            </div>
            <div className="max-h-[220px] overflow-y-auto p-2">
              {filteredOperators.length === 0 ? (
                <div className="text-dark-500 py-4 text-center text-sm font-light">
                  {t('pages.actionAnalysis.filters.noOperatorsMatch', 'No matches')}
                </div>
              ) : (
                filteredOperators.map((op) => (
                  <label
                    key={op.id}
                    className="hover:bg-primary-50/40 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5"
                  >
                    <Checkbox
                      checked={draftIds.includes(op.id)}
                      onCheckedChange={(checked) => {
                        setDraftIds((prev) =>
                          checked === true
                            ? [...prev, op.id]
                            : prev.filter((id) => id !== op.id)
                        )
                      }}
                    />
                    <span className="text-dark-500 truncate text-sm font-light">{op.full_name}</span>
                  </label>
                ))
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraftIds([])
                }}
              >
                {t('pages.actionAnalysis.filters.clearEmployees', 'Clear')}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  onChange({ departmentId: null, employeeIds: [...draftIds] })
                  setMenuOpen(false)
                }}
              >
                {t('pages.actionAnalysis.filters.applyEmployees', 'Apply')}
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
