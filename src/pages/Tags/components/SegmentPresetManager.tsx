import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useTagConfigStore, type SegmentPreset } from '@/stores/tagConfigStore'
import type { SegmentCondition, SegmentRefreshMode, TagDefinition } from '@/features/tags'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Icons } from '@/lib/icons'
import { generateCode } from '@/lib/utils'
import { ConditionBuilder } from './ConditionBuilder'

interface SegmentPresetManagerProps {
  tags: TagDefinition[]
}

type SegmentPresetFormData = {
  name: string
  code: string
  description: string
  refresh_mode: SegmentRefreshMode
}

const DEFAULT_REFRESH_MODE: SegmentRefreshMode = 'on_demand'

const OPERATOR_SYMBOLS: Record<string, string> = {
  eq: '=',
  ne: '!=',
  neq: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  contains: '~',
  in: 'in',
  not_in: '!in',
}

export function SegmentPresetManager({ tags }: SegmentPresetManagerProps) {
  const { t } = useTranslation('common')
  const segmentPresets = useTagConfigStore((state) => state.segmentPresets)
  const addSegmentPreset = useTagConfigStore((state) => state.addSegmentPreset)
  const updateSegmentPreset = useTagConfigStore((state) => state.updateSegmentPreset)
  const removePreset = useTagConfigStore((state) => state.removePreset)

  const [editingPreset, setEditingPreset] = useState<SegmentPreset | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)

  const existingKeys = useMemo(() => segmentPresets.map((preset) => preset.key), [segmentPresets])
  const tagNameByCode = useMemo(() => new Map(tags.map((tag) => [tag.code, tag.name])), [tags])
  const sortedPresets = useMemo(
    () => [...segmentPresets].sort((a, b) => a.name.localeCompare(b.name)),
    [segmentPresets]
  )

  const openCreate = useCallback(() => {
    setEditingPreset(null)
    setIsEditorOpen(true)
  }, [])

  const openEdit = useCallback((preset: SegmentPreset) => {
    setEditingPreset(preset)
    setIsEditorOpen(true)
  }, [])

  const handleCloseEditor = useCallback(() => {
    setEditingPreset(null)
    setIsEditorOpen(false)
  }, [])

  const handleSavePreset = useCallback(
    (preset: SegmentPreset) => {
      if (editingPreset) {
        updateSegmentPreset(editingPreset.key, preset)
      } else {
        addSegmentPreset(preset)
      }
      handleCloseEditor()
    },
    [addSegmentPreset, editingPreset, handleCloseEditor, updateSegmentPreset]
  )

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-medium text-gray-900">
            {t('pages.tags.settings.segmentPresets', 'Segment Templates')}
          </h4>
          <p className="mt-0.5 text-xs text-gray-500">
            {t(
              'pages.tags.settings.segmentPresetsDesc',
              'Templates for quickly creating segments with ready-made groups and conditions.'
            )}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={openCreate}>
          <Icons.Add size={14} strokeWidth={2} className="mr-1" />
          {t('pages.tags.settings.addTemplate', 'Add template')}
        </Button>
      </div>

      <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
        {sortedPresets.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-gray-400">
            {t('pages.tags.settings.noTemplates', 'No templates')}
          </p>
        )}

        {sortedPresets.map((preset) => (
          <div key={preset.key} className="px-3 py-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-gray-900">{preset.name}</p>
                  <code className="rounded bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-600">
                    {preset.code}
                  </code>
                </div>
                {preset.description && (
                  <p className="mt-1 text-xs text-gray-500">{preset.description}</p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                  {preset.conditions.length}{' '}
                  {t('pages.tags.settings.conditionsCount', 'conditions')}
                </span>
                <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">
                  {t(
                    `pages.tags.segments.refreshModes.${preset.refresh_mode}`,
                    preset.refresh_mode
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => openEdit(preset)}
                  className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                  title={t('pages.tags.settings.editTemplate', 'Edit template')}
                >
                  <Icons.PencilEdit size={14} strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  onClick={() => removePreset('segmentPresets', preset.key)}
                  className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-500"
                  title={t('actions.delete', 'Delete')}
                >
                  <Icons.Cancel01 size={14} strokeWidth={1.5} />
                </button>
              </div>
            </div>

            {preset.conditions.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {buildConditionPreview({
                  conditions: preset.conditions,
                  tagNameByCode,
                  t,
                }).map((item) => (
                  <span key={item.key}>{item.node}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {isEditorOpen && (
        <SegmentPresetEditorModal
          open={isEditorOpen}
          tags={tags}
          existingKeys={existingKeys}
          preset={editingPreset}
          onClose={handleCloseEditor}
          onSave={handleSavePreset}
        />
      )}
    </div>
  )
}

function buildConditionPreview({
  conditions,
  tagNameByCode,
  t,
}: {
  conditions: SegmentPreset['conditions']
  tagNameByCode: Map<string, string>
  t: (key: string, fallback: string) => string
}) {
  const groups = conditions.reduce<Record<number, SegmentPreset['conditions']>>(
    (acc, condition) => {
      if (!acc[condition.group_index]) {
        acc[condition.group_index] = []
      }
      acc[condition.group_index].push(condition)
      return acc
    },
    {}
  )

  const entries: Array<{ key: string; node: React.ReactNode }> = []

  Object.entries(groups).forEach(([groupIndex, groupConditions], groupOrder) => {
    if (groupOrder > 0) {
      entries.push({
        key: `or-${groupIndex}`,
        node: (
          <span className="rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-600">
            {t('pages.tags.segments.orLabel', 'OR')}
          </span>
        ),
      })
    }

    groupConditions.forEach((condition, conditionIndex) => {
      if (conditionIndex > 0) {
        entries.push({
          key: `and-${groupIndex}-${conditionIndex}`,
          node: (
            <span className="text-[10px] text-gray-400">
              {t('pages.tags.segments.andLabel', 'AND')}
            </span>
          ),
        })
      }

      const tagName = condition.tag_code
        ? (tagNameByCode.get(condition.tag_code) ?? condition.tag_code)
        : undefined

      if (condition.condition_type === 'has_tag') {
        entries.push({
          key: `condition-${groupIndex}-${conditionIndex}`,
          node: (
            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">
              {tagName ?? '—'}
            </span>
          ),
        })
        return
      }

      if (condition.condition_type === 'not_has_tag') {
        entries.push({
          key: `condition-${groupIndex}-${conditionIndex}`,
          node: (
            <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700">
              {t('pages.tags.segments.conditionTypes.not_has_tag', 'NOT')} {tagName ?? '—'}
            </span>
          ),
        })
        return
      }

      const operator = OPERATOR_SYMBOLS[condition.operator ?? 'eq'] ?? condition.operator ?? '='
      const fieldLabel = condition.field_name
        ? `${condition.field_name} ${operator} ${condition.value ?? '—'}`
        : `${condition.condition_type} ${operator} ${condition.value ?? '—'}`
      const label = tagName ? `${tagName}: ${fieldLabel}` : fieldLabel

      entries.push({
        key: `condition-${groupIndex}-${conditionIndex}`,
        node: (
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-700">
            {label}
          </span>
        ),
      })
    })
  })

  return entries
}

function SegmentPresetEditorModal({
  open,
  tags,
  existingKeys,
  preset,
  onClose,
  onSave,
}: {
  open: boolean
  tags: TagDefinition[]
  existingKeys: string[]
  preset: SegmentPreset | null
  onClose: () => void
  onSave: (preset: SegmentPreset) => void
}) {
  const { t } = useTranslation('common')
  const refreshModes = useTagConfigStore((state) => state.refreshModes).map(
    (item) => item.value
  ) as SegmentRefreshMode[]
  const isEdit = !!preset
  const [conditions, setConditions] = useState<SegmentCondition[]>([])
  const codeManuallyEdited = useRef(false)

  const presetSchema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .min(1, t('pages.tags.segments.validation.nameRequired', 'Name is required'))
          .max(100, t('pages.tags.segments.validation.nameMax', 'Max 100 characters')),
        code: z
          .string()
          .min(1, t('pages.tags.segments.validation.codeRequired', 'Code is required'))
          .max(50, t('pages.tags.segments.validation.codeMax', 'Max 50 characters'))
          .regex(
            /^[a-z0-9_]+$/,
            t(
              'pages.tags.segments.validation.codeFormat',
              'Only lowercase letters, numbers, underscores'
            )
          ),
        description: z.string().max(500).optional().default(''),
        refresh_mode: z.enum(['on_demand', 'scheduled', 'realtime']),
      }),
    [t]
  )

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SegmentPresetFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(presetSchema) as any,
    defaultValues: {
      name: '',
      code: '',
      description: '',
      refresh_mode: DEFAULT_REFRESH_MODE,
    },
  })

  const nameValue = watch('name') // eslint-disable-line react-hooks/incompatible-library

  useEffect(() => {
    if (!isEdit && !codeManuallyEdited.current) {
      setValue('code', nameValue ? generateCode(nameValue) : '', { shouldValidate: true })
    }
  }, [isEdit, nameValue, setValue])

  useEffect(() => {
    if (open) {
      codeManuallyEdited.current = !!preset
      reset({
        name: preset?.name ?? '',
        code: preset?.code ?? '',
        description: preset?.description ?? '',
        refresh_mode: (preset?.refresh_mode as SegmentRefreshMode) ?? DEFAULT_REFRESH_MODE,
      })
      setConditions(
        (preset?.conditions ?? []).map(
          (condition): SegmentCondition => ({
            ...condition,
            condition_type: condition.condition_type as SegmentCondition['condition_type'],
            operator: condition.operator ?? 'eq',
          })
        )
      )
    }
  }, [open, preset, reset])

  const handleClose = useCallback(() => {
    reset()
    setConditions([])
    onClose()
  }, [onClose, reset])

  const onSubmit = useCallback(
    (data: SegmentPresetFormData) => {
      if (conditions.length === 0) {
        toast.error(
          t(
            'pages.tags.segments.validation.conditionsRequired',
            'Please add at least one condition group'
          )
        )
        return
      }

      const nextKey = data.code.trim()
      const keyAlreadyExists = existingKeys.includes(nextKey) && (!preset || preset.key !== nextKey)

      if (keyAlreadyExists) {
        toast.error(
          t('pages.tags.settings.templateCodeExists', 'A template with this code already exists')
        )
        return
      }

      for (const condition of conditions) {
        if (
          (condition.condition_type === 'has_tag' || condition.condition_type === 'not_has_tag') &&
          !condition.tag_code
        ) {
          toast.error(
            t(
              'pages.tags.segments.validation.tagCodeRequired',
              'Please select a tag for all conditions'
            )
          )
          return
        }

        if (
          condition.condition_type === 'tag_payload_field' &&
          (!condition.tag_code || !condition.field_name || !condition.operator || !condition.value)
        ) {
          toast.error(
            t(
              'pages.tags.segments.validation.payloadFieldRequired',
              'Please fill in all payload field condition values'
            )
          )
          return
        }
      }

      onSave({
        key: nextKey,
        name: data.name.trim(),
        code: nextKey,
        description: data.description.trim(),
        refresh_mode: data.refresh_mode,
        conditions: conditions.map(({ id: _id, segment_id: _segmentId, ...condition }) => ({
          ...condition,
          tag_code: condition.tag_code?.trim() || undefined,
          field_name: condition.field_name?.trim() || undefined,
          value: condition.value?.trim() || undefined,
          operator: condition.operator ?? 'eq',
        })),
      })
    },
    [conditions, existingKeys, onSave, preset, t]
  )

  return (
    <Modal open={open} onClose={handleClose} className="max-w-4xl">
      <form onSubmit={handleSubmit(onSubmit)} className="min-w-0">
        <ModalHeader
          icon={
            <div className="bg-primary-400 flex h-8 w-8 items-center justify-center rounded-full">
              {isEdit ? (
                <Icons.PencilEdit size={20} className="text-dark-500" strokeWidth={2} />
              ) : (
                <Icons.Add size={20} className="text-dark-500" strokeWidth={2} />
              )}
            </div>
          }
          title={
            isEdit
              ? t('pages.tags.settings.editSegmentTemplate', 'Edit segment template')
              : t('pages.tags.settings.newSegmentTemplate', 'New segment template')
          }
        />

        <ModalContent>
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="segment-template-name" required>
                  {t('pages.tags.segments.name', 'Name')}
                </Label>
                <Input
                  id="segment-template-name"
                  {...register('name')}
                  placeholder={t('pages.tags.segments.namePlaceholder', 'e.g. High Risk Overdue')}
                  error={errors.name?.message}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="segment-template-code" required>
                  {t('pages.tags.segments.code', 'Code')}
                </Label>
                <Input
                  id="segment-template-code"
                  {...register('code', {
                    onChange: () => {
                      codeManuallyEdited.current = true
                    },
                  })}
                  placeholder="high_risk_overdue"
                  error={errors.code?.message}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="segment-template-description">
                {t('pages.tags.segments.description', 'Description')}
              </Label>
              <Textarea
                id="segment-template-description"
                {...register('description')}
                placeholder={t(
                  'pages.tags.segments.descriptionPlaceholder',
                  'Describe this segment...'
                )}
                error={errors.description?.message}
                rows={2}
                textareaSize="sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t('pages.tags.segments.refreshMode', 'Refresh Mode')}</Label>
              <Controller
                name="refresh_mode"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {refreshModes.map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {t(`pages.tags.segments.refreshModes.${mode}`, mode)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t('pages.tags.segments.conditions', 'Conditions')}</Label>
              <p className="text-xs text-gray-500">
                {t(
                  'pages.tags.segments.conditionHelp',
                  'Conditions within a group are combined with AND. Groups are combined with OR.'
                )}
              </p>
              <ConditionBuilder conditions={conditions} tags={tags} onChange={setConditions} />
            </div>
          </div>
        </ModalContent>

        <ModalFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            {t('actions.cancel', 'Cancel')}
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {isEdit ? t('actions.save', 'Save') : t('actions.create', 'Create')}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
