/**
 * ConditionRow Component
 *
 * A single row in the segment condition builder.
 * Renders dynamic fields based on condition_type selection.
 */

import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useTagConfigStore } from '@/stores/tagConfigStore'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/Select'
import { Icons } from '@/lib/icons'
import type { ConditionType, SegmentCondition, Tag } from '@/features/tags'

export interface ConditionRowProps {
  condition: SegmentCondition
  tags: Tag[]
  onChange: (updated: SegmentCondition) => void
  onRemove: () => void
}

// client_field is excluded until client-service adds a /filter endpoint
const CONDITION_TYPE_VALUES: ConditionType[] = ['has_tag', 'not_has_tag', 'tag_payload_field']

export const ConditionRow = memo(function ConditionRow({
  condition,
  tags,
  onChange,
  onRemove,
}: ConditionRowProps) {
  const { t } = useTranslation('common')
  const OPERATOR_VALUES = useTagConfigStore((s) => s.operators).map((i) => i.value)

  const isTagType =
    condition.condition_type === 'has_tag' || condition.condition_type === 'not_has_tag'
  const needsFieldAndValue =
    condition.condition_type === 'tag_payload_field' || condition.condition_type === 'client_field'

  const handleTypeChange = (value: string) => {
    onChange({
      ...condition,
      condition_type: value as ConditionType,
      tag_code: undefined,
      field_name: undefined,
      value: undefined,
      operator: 'eq',
    })
  }

  return (
    <div className="flex items-start gap-2">
      {/* Condition Type */}
      <div className="w-48 shrink-0">
        <Select value={condition.condition_type} onValueChange={handleTypeChange}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder={t('pages.tags.segments.conditionType', 'Condition type')} />
          </SelectTrigger>
          <SelectContent>
            {CONDITION_TYPE_VALUES.map((ct) => (
              <SelectItem key={ct} value={ct}>
                {t(`pages.tags.segments.conditionTypes.${ct}`, ct)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tag Code selector (for has_tag / not_has_tag) */}
      {isTagType && (
        <div className="w-44 shrink-0">
          <Select
            value={condition.tag_code ?? ''}
            onValueChange={(v) => onChange({ ...condition, tag_code: v })}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder={t('pages.tags.segments.selectTag', 'Select tag')} />
            </SelectTrigger>
            <SelectContent
              searchable
              searchPlaceholder={t('pages.tags.searchTags', 'Search tags...')}
            >
              {tags.map((tag) => {
                const code = (tag as { code?: string }).code
                if (!code) return null
                return (
                  <SelectItem key={tag.id} value={code}>
                    {tag.name}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Tag Code selector (for tag_payload_field) */}
      {condition.condition_type === 'tag_payload_field' && (
        <div className="w-36 shrink-0">
          <Select
            value={condition.tag_code ?? ''}
            onValueChange={(v) => onChange({ ...condition, tag_code: v })}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder={t('pages.tags.segments.selectTag', 'Select tag')} />
            </SelectTrigger>
            <SelectContent searchable>
              {tags.map((tag) => {
                const code = (tag as { code?: string }).code
                if (!code) return null
                return (
                  <SelectItem key={tag.id} value={code}>
                    {tag.name}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Field Name (for tag_payload_field / client_field) */}
      {needsFieldAndValue && (
        <div className="w-36 shrink-0">
          <Input
            inputSize="sm"
            className="h-9 text-xs"
            placeholder={t('pages.tags.segments.fieldName', 'Field name')}
            value={condition.field_name ?? ''}
            onChange={(e) => onChange({ ...condition, field_name: e.target.value })}
          />
        </div>
      )}

      {/* Operator (for field-based conditions) */}
      {needsFieldAndValue && (
        <div className="w-28 shrink-0">
          <Select
            value={condition.operator}
            onValueChange={(v) => onChange({ ...condition, operator: v })}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATOR_VALUES.map((op) => (
                <SelectItem key={op} value={op}>
                  {t(`pages.tags.segments.operators.${op}`, op)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Value (for field-based conditions) */}
      {needsFieldAndValue && (
        <div className="min-w-0 flex-1">
          <Input
            inputSize="sm"
            className="h-9 text-xs"
            placeholder={t('pages.tags.segments.value', 'Value')}
            value={condition.value ?? ''}
            onChange={(e) => onChange({ ...condition, value: e.target.value })}
          />
        </div>
      )}

      {/* Remove button */}
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="mt-0.5 shrink-0 text-gray-400 hover:text-red-500"
        onClick={onRemove}
        aria-label={t('actions.remove', 'Remove')}
      >
        <Icons.Cancel01 size={14} />
      </Button>
    </div>
  )
})
