/**
 * SegmentFormModal Component
 *
 * Modal for creating and editing segments with condition builder and preview.
 * Uses react-hook-form + zod for validation.
 */

import { useEffect, useCallback, useMemo, useState, useRef } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { useTagConfigStore } from '@/stores/tagConfigStore'
import { toast } from 'sonner'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/Select'
import { Icons } from '@/lib/icons'
import { generateCode } from '@/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/Tooltip'
import { ConditionBuilder } from './ConditionBuilder'
import { useCreateSegment, useUpdateSegment, usePreviewSegment } from '@/features/tags'
import type { Segment, SegmentCondition, SegmentRefreshMode, Tag } from '@/features/tags'

interface SegmentFormModalProps {
  open: boolean
  segment?: Segment
  tags: Tag[]
  onClose: () => void
  onSuccess: () => void
}

// REFRESH_MODE_VALUES and SEGMENT_PRESETS loaded from tagConfigStore inside component

type SegmentFormData = {
  name: string
  code: string
  description: string
  refresh_mode: SegmentRefreshMode
}

/**
 * Small info icon with tooltip for field labels
 */
function FieldTooltip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="bg-muted text-muted-foreground ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full text-[10px] font-bold">
            ?
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function SegmentFormModal({
  open,
  segment,
  tags,
  onClose,
  onSuccess,
}: SegmentFormModalProps) {
  const { t } = useTranslation('common')
  const tagConfig = useTagConfigStore()
  const REFRESH_MODE_VALUES = tagConfig.refreshModes.map((i) => i.value) as SegmentRefreshMode[]
  const SEGMENT_PRESETS = tagConfig.segmentPresets
  const isEdit = !!segment

  const [conditions, setConditions] = useState<SegmentCondition[]>([])
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const codeManuallyEdited = useRef(false)

  const createMutation = useCreateSegment()
  const updateMutation = useUpdateSegment()
  const previewMutation = usePreviewSegment()

  const segmentSchema = useMemo(
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
    formState: { errors, isSubmitting },
    reset,
  } = useForm<SegmentFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(segmentSchema) as any,
    defaultValues: {
      name: '',
      code: '',
      description: '',
      refresh_mode: 'on_demand',
    },
  })

  const nameValue = watch('name') // eslint-disable-line react-hooks/incompatible-library

  // Auto-generate code from name (only for create and when not manually edited)
  useEffect(() => {
    if (!isEdit && !codeManuallyEdited.current) {
      setValue('code', nameValue ? generateCode(nameValue) : '', { shouldValidate: true })
    }
  }, [nameValue, isEdit, setValue])

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      reset({
        name: segment?.name ?? '',
        code: segment?.code ?? '',
        description: segment?.description ?? '',
        refresh_mode: segment?.refresh_mode ?? 'on_demand',
      })
      setConditions(segment?.conditions ?? [])
      setPreviewCount(null)
    }
  }, [open, segment, reset])

  const handlePreview = useCallback(async () => {
    try {
      const stripped = conditions.map(({ id: _id, segment_id: _sid, ...rest }) => rest)
      const result = await previewMutation.mutateAsync(stripped)
      setPreviewCount(result.client_count)
    } catch {
      setPreviewCount(null)
    }
  }, [conditions, previewMutation])

  const handleConditionsChange = useCallback((next: SegmentCondition[]) => {
    setConditions(next)
    setPreviewCount(null)
  }, [])

  const onSubmit = useCallback(
    async (data: SegmentFormData) => {
      // Validate conditions before submitting
      for (const cond of conditions) {
        if (
          (cond.condition_type === 'has_tag' || cond.condition_type === 'not_has_tag') &&
          !cond.tag_code
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
          cond.condition_type === 'tag_payload_field' &&
          (!cond.field_name || !cond.operator || !cond.value)
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

      const stripped = conditions.map(({ id: _id, segment_id: _sid, ...rest }) => rest)

      try {
        if (isEdit && segment) {
          await updateMutation.mutateAsync({
            id: segment.id,
            data: { ...data, conditions: stripped },
          })
        } else {
          await createMutation.mutateAsync({
            ...data,
            conditions: stripped,
          })
        }
        onSuccess()
      } catch (error) {
        console.error('Failed to save segment:', error)
      }
    },
    [isEdit, segment, conditions, createMutation, updateMutation, onSuccess, t]
  )

  const handleClose = useCallback(() => {
    reset()
    setConditions([])
    setPreviewCount(null)
    onClose()
  }, [reset, onClose])

  return (
    <Modal open={open} onClose={handleClose} maxWidth="xl">
      <form onSubmit={handleSubmit(onSubmit)} className="min-w-0">
        <ModalHeader
          icon={
            <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-full">
              {isEdit ? (
                <Icons.PencilEdit size={20} className="text-primary-foreground" strokeWidth={2} />
              ) : (
                <Icons.Add size={20} className="text-primary-foreground" strokeWidth={2} />
              )}
            </div>
          }
          title={
            isEdit
              ? t('pages.tags.segments.editSegment', 'Edit Segment')
              : t('pages.tags.segments.newSegment', 'New Segment')
          }
        />

        <ModalContent>
          <div className="space-y-5">
            {/* Preset Templates (only for create) */}
            {!isEdit && (
              <div className="space-y-1.5">
                <Label>{t('pages.tags.segments.useTemplate', 'Use Template')}</Label>
                <Select
                  value=""
                  onValueChange={(key) => {
                    const preset = SEGMENT_PRESETS.find((p) => p.key === key)
                    if (preset) {
                      reset({
                        name: preset.name,
                        code: preset.code,
                        description: preset.description,
                        refresh_mode: (preset.refresh_mode as SegmentRefreshMode) ?? 'on_demand',
                      })
                      setConditions(preset.conditions as SegmentCondition[])
                      setPreviewCount(null)
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t(
                        'pages.tags.segments.selectTemplate',
                        'Select a debt collection template...'
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {SEGMENT_PRESETS.map((preset) => (
                      <SelectItem key={preset.key} value={preset.key}>
                        {t(`pages.tags.segments.presets.${preset.key}`, preset.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="seg-name" required>
                {t('pages.tags.segments.name', 'Name')}
              </Label>
              <Input
                id="seg-name"
                {...register('name')}
                placeholder={t('pages.tags.segments.namePlaceholder', 'e.g. High Risk Overdue')}
                error={errors.name?.message}
              />
            </div>

            {/* Code */}
            <div className="space-y-1.5">
              <Label htmlFor="seg-code" required>
                {t('pages.tags.segments.code', 'Code')}
                <FieldTooltip
                  text={t(
                    'pages.tags.fields.tooltips.code',
                    'Уникальный идентификатор для API. Генерируется автоматически из названия.'
                  )}
                />
              </Label>
              <Input
                id="seg-code"
                {...register('code')}
                placeholder="high_risk_overdue"
                error={errors.code?.message}
                disabled={isEdit}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="seg-desc">
                {t('pages.tags.segments.description', 'Description')}
              </Label>
              <Textarea
                id="seg-desc"
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

            {/* Refresh Mode */}
            <div className="space-y-1.5">
              <Label>{t('pages.tags.segments.refreshMode', 'Refresh Mode')}</Label>
              <p className="text-muted-foreground text-xs">
                {t('pages.tags.segments.refreshModeHelp', 'How segment membership is recalculated')}
              </p>
              <Controller
                name="refresh_mode"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REFRESH_MODE_VALUES.map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {t(`pages.tags.segments.refreshModes.${mode}`, mode)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Conditions */}
            <div className="space-y-1.5">
              <Label>{t('pages.tags.segments.conditions', 'Conditions')}</Label>
              <p className="text-muted-foreground text-xs">
                {t(
                  'pages.tags.segments.conditionHelp',
                  'Conditions within a group are combined with AND. Groups are combined with OR.'
                )}
              </p>
              <ConditionBuilder
                conditions={conditions}
                tags={tags}
                onChange={handleConditionsChange}
              />
            </div>

            {/* Preview */}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePreview}
                isLoading={previewMutation.isPending}
                disabled={conditions.length === 0}
              >
                {t('pages.tags.segments.preview', 'Preview')}
              </Button>
              {previewCount !== null && (
                <span className="text-muted-foreground text-sm">
                  {t('pages.tags.segments.previewResult', '{{count}} client(s) match', {
                    count: previewCount,
                  })}
                </span>
              )}
            </div>
          </div>
        </ModalContent>

        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}
          >
            {t('actions.cancel', 'Cancel')}
          </Button>
          <Button
            type="submit"
            isLoading={isSubmitting || createMutation.isPending || updateMutation.isPending}
          >
            {isEdit ? t('actions.save', 'Save') : t('actions.create', 'Create')}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
