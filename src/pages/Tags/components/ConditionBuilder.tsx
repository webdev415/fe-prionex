/**
 * ConditionBuilder Component
 *
 * Groups ConditionRow components into AND/OR logic groups.
 * Same group_index = AND. Different groups = OR.
 */

import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { ConditionRow } from './ConditionRow'
import type { SegmentCondition, Tag } from '@/features/tags'

export interface ConditionBuilderProps {
  conditions: SegmentCondition[]
  tags: Tag[]
  onChange: (conditions: SegmentCondition[]) => void
}

export function ConditionBuilder({ conditions, tags, onChange }: ConditionBuilderProps) {
  const { t } = useTranslation('common')

  // Group conditions by group_index
  const groups = useMemo(() => {
    const map = new Map<number, SegmentCondition[]>()
    for (const cond of conditions) {
      const existing = map.get(cond.group_index) ?? []
      existing.push(cond)
      map.set(cond.group_index, existing)
    }
    // Sort by group_index
    return Array.from(map.entries()).sort(([a], [b]) => a - b)
  }, [conditions])

  const handleConditionChange = useCallback(
    (groupIndex: number, condIndex: number, updated: SegmentCondition) => {
      const groupConditions = conditions.filter((c) => c.group_index === groupIndex)
      const target = groupConditions[condIndex]
      const flatIndex = conditions.indexOf(target)
      if (flatIndex === -1) return
      const newConditions = [...conditions]
      newConditions[flatIndex] = updated
      onChange(newConditions)
    },
    [conditions, onChange]
  )

  const handleRemoveCondition = useCallback(
    (groupIndex: number, condIndex: number) => {
      const groupConditions = conditions.filter((c) => c.group_index === groupIndex)
      const conditionToRemove = groupConditions[condIndex]
      const newConditions = conditions.filter((c) => c !== conditionToRemove)
      onChange(newConditions)
    },
    [conditions, onChange]
  )

  const handleAddCondition = useCallback(
    (groupIndex: number) => {
      const newCondition: SegmentCondition = {
        group_index: groupIndex,
        condition_type: 'has_tag',
        operator: 'eq',
      }
      onChange([...conditions, newCondition])
    },
    [conditions, onChange]
  )

  const handleAddGroup = useCallback(() => {
    const maxGroup = conditions.length > 0 ? Math.max(...conditions.map((c) => c.group_index)) : -1
    const newCondition: SegmentCondition = {
      group_index: maxGroup + 1,
      condition_type: 'has_tag',
      operator: 'eq',
    }
    onChange([...conditions, newCondition])
  }, [conditions, onChange])

  return (
    <div className="space-y-3">
      {groups.map(([groupIndex, groupConditions], gIdx) => (
        <div key={groupIndex}>
          {/* OR divider between groups */}
          {gIdx > 0 && (
            <div className="my-3 flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="bg-warning-100 text-warning-600 rounded px-2 py-0.5 text-xs font-medium">
                {t('pages.tags.segments.orLabel', 'OR')}
              </span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
          )}

          {/* Group container */}
          <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3">
            <div className="space-y-2">
              {groupConditions.map((cond, cIdx) => (
                <div key={`${groupIndex}-${cIdx}`}>
                  {/* AND label between rows in same group */}
                  {cIdx > 0 && (
                    <div className="my-1.5 flex items-center gap-2 pl-2">
                      <span className="bg-information-100 text-information-600 rounded px-1.5 py-0.5 text-[10px] font-medium">
                        {t('pages.tags.segments.andLabel', 'AND')}
                      </span>
                    </div>
                  )}
                  <ConditionRow
                    condition={cond}
                    tags={tags}
                    onChange={(updated) => handleConditionChange(groupIndex, cIdx, updated)}
                    onRemove={() => handleRemoveCondition(groupIndex, cIdx)}
                  />
                </div>
              ))}
            </div>

            {/* Add condition to this group */}
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="mt-2 text-xs text-gray-500 hover:text-gray-700"
              onClick={() => handleAddCondition(groupIndex)}
              leftIcon={<Icons.Add size={12} />}
            >
              {t('pages.tags.segments.addCondition', 'Add AND condition')}
            </Button>
          </div>
        </div>
      ))}

      {/* Empty state */}
      {groups.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center">
          <p className="text-sm text-gray-500">
            {t(
              'pages.tags.segments.noConditions',
              'No conditions defined. Add a condition group to get started.'
            )}
          </p>
        </div>
      )}

      {/* Add new OR group */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAddGroup}
        leftIcon={<Icons.Add size={14} />}
      >
        {t('pages.tags.segments.addGroup', 'Add OR group')}
      </Button>
    </div>
  )
}
