/**
 * Editable list of TA Chain steps.
 *
 * Operates on local state controlled by the parent. Each step picks a
 * Target Action from the (active, non-hidden) TA list scoped to the
 * chain's department, lets the admin set delay and required flags,
 * and supports reordering.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { useTargetActions } from '@/features/targetActions/hooks/useTargetActions'
import type { TAChainStepIn } from '@/features/taChains/api/types'

interface ChainStepsEditorProps {
  departmentId: number | null
  steps: TAChainStepIn[]
  onChange: (next: TAChainStepIn[]) => void
  disabled?: boolean
}

export function ChainStepsEditor({
  departmentId,
  steps,
  onChange,
  disabled,
}: ChainStepsEditorProps) {
  const { t } = useTranslation('common')

  // Pull the full list of active TAs (the form's department picker decides
  // which subset is contextually relevant; we still allow any active TA so
  // an admin can re-use generic TAs across departments).
  const { data } = useTargetActions({ include_hidden: false })
  const allTAs = data?.items ?? []

  const tasInDept = useMemo(() => {
    if (departmentId == null) return allTAs
    return allTAs.filter((ta) => ta.department_id === departmentId || allTAs.length === 0)
  }, [allTAs, departmentId])

  const update = (index: number, patch: Partial<TAChainStepIn>) => {
    const next = steps.map((s, i) => (i === index ? { ...s, ...patch } : s))
    onChange(next)
  }

  const remove = (index: number) => {
    onChange(steps.filter((_, i) => i !== index))
  }

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= steps.length) return
    const next = steps.slice()
    const tmp = next[index]
    next[index] = next[target]
    next[target] = tmp
    onChange(next)
  }

  const addStep = () => {
    const firstTA = tasInDept[0]
    if (!firstTA) return
    onChange([
      ...steps,
      {
        target_action_id: firstTA.id,
        is_required: true,
        delay_minutes: 0,
        not_in_the_past: false,
      },
    ])
  }

  if (allTAs.length === 0) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
        {t('pages.taChains.noTargetActionsHint')}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{t('pages.taChains.steps.title')}</span>
        {!disabled && (
          <button
            type="button"
            onClick={addStep}
            className="bg-primary-300 text-dark-500 hover:bg-primary-500 flex items-center gap-1 rounded-md px-3 py-1 text-xs"
          >
            <Icons.Add size={14} strokeWidth={2} />
            {t('pages.taChains.steps.add')}
          </button>
        )}
      </div>

      {steps.length === 0 && (
        <div className="rounded-md border border-dashed border-gray-300 p-4 text-center text-xs text-gray-500">
          {t('pages.taChains.steps.empty')}
        </div>
      )}

      <ol className="flex flex-col gap-3">
        {steps.map((step, index) => {
          const ta = allTAs.find((x) => x.id === step.target_action_id)
          return (
            <li
              key={index}
              className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-dark-500 text-xs font-semibold">
                  {t('pages.taChains.steps.stepLabel', { index: index + 1 })}
                </span>
                {!disabled && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      className="text-dark-500 rounded border border-gray-200 px-2 py-0.5 text-xs disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === steps.length - 1}
                      className="text-dark-500 rounded border border-gray-200 px-2 py-0.5 text-xs disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
                    >
                      {t('actions.delete')}
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-600">
                    {t('pages.taChains.steps.targetAction')}
                  </label>
                  <Select
                    value={String(step.target_action_id)}
                    onValueChange={(v) => update(index, { target_action_id: parseInt(v, 10) })}
                    disabled={disabled}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('pages.taChains.steps.selectTA')} />
                    </SelectTrigger>
                    <SelectContent>
                      {allTAs.map((opt) => (
                        <SelectItem key={opt.id} value={String(opt.id)}>
                          {opt.name} ({opt.field_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-600">
                    {t('pages.taChains.steps.delayMinutes')}
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={String(step.delay_minutes ?? 0)}
                    onChange={(e) =>
                      update(index, {
                        delay_minutes: Math.max(0, parseInt(e.target.value || '0', 10)),
                      })
                    }
                    disabled={disabled}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-700">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={step.is_required ?? true}
                    onChange={(e) => update(index, { is_required: e.target.checked })}
                    disabled={disabled}
                  />
                  {t('pages.taChains.steps.required')}
                </label>
                {ta?.field_type === 'date' && (
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={step.not_in_the_past ?? false}
                      onChange={(e) => update(index, { not_in_the_past: e.target.checked })}
                      disabled={disabled}
                    />
                    {t('pages.taChains.steps.notInPast')}
                  </label>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
