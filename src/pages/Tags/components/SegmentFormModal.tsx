/**
 * SegmentFormModal Component
 *
 * Modal for creating and editing segments with condition builder and preview.
 * Uses react-hook-form + zod for validation.
 */

import { useEffect, useCallback, useMemo, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
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

const REFRESH_MODE_VALUES: SegmentRefreshMode[] = ['on_demand', 'scheduled', 'realtime']

const SEGMENT_PRESETS = [
  {
    key: 'high_risk',
    name: 'High Risk Active Debtors',
    code: 'high_risk_active',
    description: 'Clients with high risk and active debt status',
    conditions: [
      {
        condition_type: 'has_tag' as const,
        tag_code: 'high_risk',
        group_index: 0,
        operator: 'eq',
        value: '',
      },
      {
        condition_type: 'has_tag' as const,
        tag_code: 'active_debtor',
        group_index: 0,
        operator: 'eq',
        value: '',
      },
    ],
  },
  {
    key: 'promise_to_pay',
    name: 'Promise to Pay',
    code: 'promise_to_pay',
    description: 'Clients who promised to pay but have not paid off yet',
    conditions: [
      {
        condition_type: 'has_tag' as const,
        tag_code: 'promise_to_pay',
        group_index: 0,
        operator: 'eq',
        value: '',
      },
      {
        condition_type: 'not_has_tag' as const,
        tag_code: 'paid_off',
        group_index: 0,
        operator: 'eq',
        value: '',
      },
    ],
  },
  {
    key: 'no_contact',
    name: 'No Contact',
    code: 'no_contact_active',
    description: 'Active debtors who could not be reached',
    conditions: [
      {
        condition_type: 'has_tag' as const,
        tag_code: 'no_contact',
        group_index: 0,
        operator: 'eq',
        value: '',
      },
      {
        condition_type: 'has_tag' as const,
        tag_code: 'active_debtor',
        group_index: 0,
        operator: 'eq',
        value: '',
      },
    ],
  },
  {
    key: 'refuses_to_pay',
    name: 'Refuses to Pay',
    code: 'refuses_to_pay',
    description: 'Clients who refuse to pay, not yet in legal proceedings',
    conditions: [
      {
        condition_type: 'has_tag' as const,
        tag_code: 'refuses_to_pay',
        group_index: 0,
        operator: 'eq',
        value: '',
      },
      {
        condition_type: 'not_has_tag' as const,
        tag_code: 'legal_proceedings',
        group_index: 0,
        operator: 'eq',
        value: '',
      },
    ],
  },
  {
    key: 'legal',
    name: 'Legal Proceedings',
    code: 'legal_proceedings',
    description: 'Clients currently in legal proceedings',
    conditions: [
      {
        condition_type: 'has_tag' as const,
        tag_code: 'legal_proceedings',
        group_index: 0,
        operator: 'eq',
        value: '',
      },
    ],
  },
  {
    key: 'new_no_risk',
    name: 'New Without Risk',
    code: 'new_no_risk',
    description: 'New clients without high or medium risk assessment',
    conditions: [
      {
        condition_type: 'has_tag' as const,
        tag_code: 'new_client',
        group_index: 0,
        operator: 'eq',
        value: '',
      },
      {
        condition_type: 'not_has_tag' as const,
        tag_code: 'high_risk',
        group_index: 0,
        operator: 'eq',
        value: '',
      },
      {
        condition_type: 'not_has_tag' as const,
        tag_code: 'medium_risk',
        group_index: 0,
        operator: 'eq',
        value: '',
      },
    ],
  },
]

/** Generate a slug code from a name string */
function generateCode(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 50)
}

type SegmentFormData = {
  name: string
  code: string
  description: string
  refresh_mode: SegmentRefreshMode
}

export function SegmentFormModal({
  open,
  segment,
  tags,
  onClose,
  onSuccess,
}: SegmentFormModalProps) {
  const { t } = useTranslation('common')
  const isEdit = !!segment

  const [conditions, setConditions] = useState<SegmentCondition[]>([])
  const [previewCount, setPreviewCount] = useState<number | null>(null)

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

  // Auto-generate code from name (only for create)
  useEffect(() => {
    if (!isEdit && nameValue) {
      setValue('code', generateCode(nameValue), { shouldValidate: true })
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

  const onSubmit = useCallback(
    async (data: SegmentFormData) => {
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
    [isEdit, segment, conditions, createMutation, updateMutation, onSuccess]
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
                        refresh_mode: 'on_demand',
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
              <p className="text-xs text-gray-500">
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
              <p className="text-xs text-gray-500">
                {t(
                  'pages.tags.segments.conditionHelp',
                  'Conditions within a group are combined with AND. Groups are combined with OR.'
                )}
              </p>
              <ConditionBuilder conditions={conditions} tags={tags} onChange={setConditions} />
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
                <span className="text-sm text-gray-600">
                  {t('pages.tags.segments.previewResult', '{{count}} client(s) match', {
                    count: previewCount,
                  })}
                </span>
              )}
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
