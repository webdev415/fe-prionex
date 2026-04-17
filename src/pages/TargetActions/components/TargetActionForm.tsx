/**
 * Target Action create/edit form (KAN-317).
 *
 * Used by both Create and Edit modals. The Edit case passes an `initial` prop
 * and disables the field_type selector (type cannot change after creation).
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Icons } from '@/lib/icons'
import {
  useCreateTargetAction,
  useUpdateTargetAction,
} from '@/features/targetActions/hooks/useTargetActions'
import type {
  TAFieldType,
  TargetAction,
  TADropdownValueIn,
} from '@/features/targetActions/api/types'
import { useDepartments } from '@/features/departments/hooks/useDepartments'
import { useAuthStore } from '@/stores/authStore'
import { getErrorMessage } from '@/lib/errors'

interface TargetActionFormProps {
  formId: string
  initial?: TargetAction
  onSuccess: () => void
}

const FIELD_TYPES: TAFieldType[] = ['text', 'dropdown', 'date', 'amount']

export function TargetActionForm({ formId, initial, onSuccess }: TargetActionFormProps) {
  const { t } = useTranslation('common')
  const { user } = useAuthStore()
  const createMut = useCreateTargetAction()
  const updateMut = useUpdateTargetAction()

  const projectId = user?.active_project_id ? parseInt(user.active_project_id) : undefined
  const { data: departmentsData, isLoading: departmentsLoading } = useDepartments({
    project_id: projectId,
    is_active: true,
    page_size: 100,
  })
  const departments = departmentsData?.departments ?? []

  const [name, setName] = useState(initial?.name ?? '')
  const [fieldType, setFieldType] = useState<TAFieldType>(initial?.field_type ?? 'text')
  const [departmentId, setDepartmentId] = useState<string>(
    initial?.department_id ? String(initial.department_id) : ''
  )
  const [dropdownValues, setDropdownValues] = useState<TADropdownValueIn[]>(
    initial?.dropdown_values?.map((v) => ({
      value: v.value,
      sort_order: v.sort_order,
    })) ?? []
  )
  const [newValue, setNewValue] = useState('')

  const isEdit = !!initial
  const isLocked = !!initial && initial.usage_count > 0

  const addValue = () => {
    const trimmed = newValue.trim()
    if (!trimmed) return
    if (dropdownValues.some((v) => v.value === trimmed)) {
      toast.error(t('pages.targetActions.errors.duplicateValue'))
      return
    }
    setDropdownValues((prev) => [...prev, { value: trimmed, sort_order: prev.length }])
    setNewValue('')
  }

  const removeValue = (value: string) => {
    setDropdownValues((prev) => prev.filter((v) => v.value !== value))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error(t('pages.targetActions.errors.nameRequired'))
      return
    }
    const deptId = parseInt(departmentId, 10)
    if (!deptId || Number.isNaN(deptId)) {
      toast.error(t('pages.targetActions.errors.departmentRequired'))
      return
    }
    if (fieldType === 'dropdown' && dropdownValues.length === 0) {
      toast.error(t('pages.targetActions.errors.dropdownEmpty'))
      return
    }

    try {
      if (isEdit && initial) {
        await updateMut.mutateAsync({
          id: initial.id,
          payload: {
            name: name.trim(),
            department_id: deptId,
            ...(fieldType === 'dropdown' ? { dropdown_values: dropdownValues } : {}),
          },
        })
        toast.success(t('pages.targetActions.toasts.updated'))
      } else {
        await createMut.mutateAsync({
          name: name.trim(),
          field_type: fieldType,
          department_id: deptId,
          ...(fieldType === 'dropdown' ? { dropdown_values: dropdownValues } : {}),
        })
        toast.success(t('pages.targetActions.toasts.created'))
      }
      onSuccess()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-4">
      {isLocked && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
          {t('pages.targetActions.lockedHint')}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <Label htmlFor="ta-name">{t('pages.targetActions.form.name')}</Label>
        <Input
          id="ta-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isLocked}
          maxLength={100}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label>{t('pages.targetActions.form.fieldType')}</Label>
        <Select
          value={fieldType}
          onValueChange={(v) => setFieldType(v as TAFieldType)}
          disabled={isEdit}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_TYPES.map((ft) => (
              <SelectItem key={ft} value={ft}>
                {t(`pages.targetActions.fieldTypes.${ft}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label>{t('pages.targetActions.form.department')}</Label>
        <Select
          value={departmentId}
          onValueChange={(v) => setDepartmentId(v)}
          disabled={isLocked || departmentsLoading}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                departmentsLoading
                  ? t('common.loading')
                  : t('pages.targetActions.form.departmentPlaceholder')
              }
            />
          </SelectTrigger>
          <SelectContent>
            {departments.map((d) => (
              <SelectItem key={d.id} value={String(d.id)}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {fieldType === 'dropdown' && (
        <div className="flex flex-col gap-2">
          <Label>{t('pages.targetActions.form.dropdownValues')}</Label>
          <div className="flex gap-2">
            <Input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder={t('pages.targetActions.form.addValuePlaceholder')}
              disabled={isLocked}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addValue()
                }
              }}
            />
            <button
              type="button"
              onClick={addValue}
              disabled={isLocked}
              className="bg-primary-300 text-dark-500 hover:bg-primary-500 rounded-md px-3 text-sm disabled:opacity-50"
            >
              <Icons.Add size={16} strokeWidth={2} />
            </button>
          </div>
          <ul className="flex flex-col gap-1">
            {dropdownValues.map((v) => (
              <li
                key={v.value}
                className="text-dark-500 flex items-center justify-between rounded border border-gray-200 bg-white px-2 py-1 text-sm"
              >
                <span className="text-dark-500">{v.value}</span>
                {!isLocked && (
                  <button
                    type="button"
                    onClick={() => removeValue(v.value)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    {t('actions.delete')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  )
}
