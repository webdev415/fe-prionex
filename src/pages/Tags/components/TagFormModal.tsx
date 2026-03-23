/**
 * Tag Form Modal
 *
 * Modal for creating and editing tags with color picker.
 */

import { useEffect, useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Controller } from 'react-hook-form'
import { useCreateTagExtended, useUpdateTag } from '@/features/tags'
import type { Tag, TagDefinition, TagCategory, TagVisibility } from '@/features/tags'
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
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { ColorPickerField } from '@/components/forms'
import { Icons } from '@/lib/icons'

interface TagFormModalProps {
  open: boolean
  tag?: Tag | TagDefinition
  activeProjectName?: string
  onClose: () => void
  onSuccess: () => void
}

const PRESET_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#FFA07A',
  '#98D8C8',
  '#F7DC6F',
  '#BB8FCE',
  '#85C1E2',
  '#80D80A',
  '#FF9D00',
  '#DC2626',
  '#DFDFDF',
]

const CATEGORY_VALUES: TagCategory[] = [
  'custom',
  'status',
  'risk',
  'behavior',
  'communication',
  'system',
]
const VISIBILITY_VALUES: TagVisibility[] = ['ui', 'analytics', 'system']

type TagFormData = {
  name: string
  color: string
  description?: string
  code?: string
  category?: string
  visibility?: string
  default_ttl_hours?: number
  mutex_group?: string
  requires_payload?: boolean
  notification_enabled?: boolean
  notification_template?: string
}

export function TagFormModal({
  open,
  tag,
  activeProjectName,
  onClose,
  onSuccess,
}: TagFormModalProps) {
  const { t, i18n } = useTranslation('common')
  const isEdit = !!tag
  const isSystemTag = (tag as TagDefinition)?.origin === 'system'
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  // Form validation schema - defined inside component to use translations
  const tagSchema = useMemo(
    () =>
      z
        .object({
          name: z
            .string()
            .min(1, t('pages.tags.fields.validation.nameRequired', 'Name is required'))
            .max(
              50,
              t('pages.tags.fields.validation.nameMaxLength', 'Name must be 50 characters or less')
            ),
          color: z
            .string()
            .regex(
              /^#[0-9A-F]{6}$/i,
              t(
                'pages.tags.fields.validation.colorFormat',
                'Please enter a valid color in hex format (#RRGGBB)'
              )
            ),
          description: z
            .string()
            .max(
              200,
              t(
                'pages.tags.fields.validation.descriptionMaxLength',
                'Description must be 200 characters or less'
              )
            )
            .optional(),
        })
        .passthrough(),
    // i18n.language is needed to recalculate schema when language changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language]
  )

  const createMutation = useCreateTagExtended()
  const updateMutation = useUpdateTag()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<TagFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(tagSchema) as any,
    defaultValues: {
      name: tag?.name || '',
      color: tag?.color || '#80D80A',
      description: tag?.description || '',
      code: (tag as TagDefinition)?.code || '',
      category: (tag as TagDefinition)?.category || 'custom',
      visibility: (tag as TagDefinition)?.visibility || 'ui',
      default_ttl_hours: (tag as TagDefinition)?.default_ttl_hours ?? undefined,
      mutex_group: (tag as TagDefinition)?.mutex_group || '',
      requires_payload: (tag as TagDefinition)?.requires_payload ?? false,
      notification_enabled: (tag as TagDefinition)?.notification_enabled ?? false,
      notification_template: (tag as TagDefinition)?.notification_template || '',
    },
  })

  // Watch color value for preview
  const selectedColor = watch('color')

  // Reset form when modal opens/closes or tag changes
  useEffect(() => {
    if (open) {
      const tagDef = tag as TagDefinition | undefined
      reset({
        name: tag?.name || '',
        color: tag?.color || '#80D80A',
        description: tag?.description || '',
        code: tagDef?.code || '',
        category: tagDef?.category || 'custom',
        visibility: tagDef?.visibility || 'ui',
        default_ttl_hours: tagDef?.default_ttl_hours ?? undefined,
        mutex_group: tagDef?.mutex_group || '',
        requires_payload: tagDef?.requires_payload ?? false,
        notification_enabled: tagDef?.notification_enabled ?? false,
        notification_template: tagDef?.notification_template || '',
      })
    }
  }, [open, tag, reset])

  const onSubmit = useCallback(
    async (data: TagFormData) => {
      try {
        if (isEdit && tag) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await updateMutation.mutateAsync({ id: tag.id, data: data as any })
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await createMutation.mutateAsync(data as any)
        }
        onSuccess()
      } catch (error) {
        console.error('Failed to save tag:', error)
      }
    },
    [isEdit, tag, updateMutation, createMutation, onSuccess]
  )

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  return (
    <Modal open={open} onClose={handleClose} className="max-w-3xl">
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
          title={isEdit ? t('pages.tags.editTag', 'Edit Tag') : t('pages.tags.newTag', 'New Tag')}
        />

        <ModalContent className="overflow-x-hidden">
          <div className="min-w-0 space-y-6">
            {/* Project (Read-only) */}
            {(tag?.project_name || activeProjectName) && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">
                    {t('pages.tags.fields.project', 'Project')}:
                  </span>
                  <span className="text-sm text-gray-900">
                    {tag?.project_name || activeProjectName}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {t(
                    'pages.tags.fields.projectNote',
                    'Tags are automatically assigned to your active project'
                  )}
                </p>
              </div>
            )}

            {/* Tag Name */}
            <div className="space-y-2">
              <Label htmlFor="name">{t('pages.tags.fields.name', 'Name')}</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder={t('pages.tags.fields.namePlaceholder', 'Enter tag name')}
                error={errors.name?.message}
                aria-label={t('pages.tags.fields.name', 'Name')}
              />
            </div>

            {/* Color Picker */}
            <ColorPickerField
              value={selectedColor}
              onChange={(color) => setValue('color', color)}
              label={t('pages.tags.fields.color', 'Color')}
              error={errors.color?.message}
              presetColors={PRESET_COLORS}
              showPreview
              previewText={watch('name') || t('pages.tags.fields.tagName', 'Tag Name')}
            />

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">
                {t('pages.tags.fields.description', 'Description')} (
                {t('pages.tags.fields.optional', 'Optional')})
              </Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder={t('pages.tags.fields.descriptionPlaceholder', 'Enter tag description')}
                error={errors.description?.message}
                rows={3}
                aria-label={t('pages.tags.fields.description', 'Description')}
                disabled={isSystemTag}
              />
            </div>

            {/* Category & Visibility */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('pages.tags.fields.category', 'Category')}</Label>
                <Controller
                  name="category"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isSystemTag}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('pages.tags.fields.category', 'Category')} />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_VALUES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {t(`pages.tags.categories.${c}`, c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('pages.tags.fields.visibility', 'Visibility')}</Label>
                <Controller
                  name="visibility"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isSystemTag}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t('pages.tags.fields.visibility', 'Visibility')}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {VISIBILITY_VALUES.map((v) => (
                          <SelectItem key={v} value={v}>
                            {t(`pages.tags.visibilities.${v}`, v)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            {/* Collapsible: TTL Settings */}
            <div className="rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => toggleSection('ttl')}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <span>{t('pages.tags.fields.ttlSettings', 'TTL Settings')}</span>
                <span className="text-gray-400">{expandedSections.ttl ? '−' : '+'}</span>
              </button>
              {expandedSections.ttl && (
                <div className="border-t border-gray-200 px-4 py-3">
                  <div className="space-y-2">
                    <Label htmlFor="default_ttl_hours">
                      {t('pages.tags.fields.ttlHours', 'Default TTL (hours)')}
                    </Label>
                    <Input
                      id="default_ttl_hours"
                      type="number"
                      {...register('default_ttl_hours', { valueAsNumber: true })}
                      placeholder="e.g. 24, 48, 168"
                      disabled={isSystemTag}
                    />
                    <p className="text-xs text-gray-500">
                      {t(
                        'pages.tags.fields.ttlNote',
                        'Leave empty for no auto-expiration. Tag will be automatically removed after this many hours.'
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Collapsible: Mutex */}
            <div className="rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => toggleSection('mutex')}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <span>{t('pages.tags.fields.mutexGroup', 'Mutual Exclusion Group')}</span>
                <span className="text-gray-400">{expandedSections.mutex ? '−' : '+'}</span>
              </button>
              {expandedSections.mutex && (
                <div className="border-t border-gray-200 px-4 py-3">
                  <div className="space-y-2">
                    <Label htmlFor="mutex_group">
                      {t('pages.tags.fields.mutexGroupName', 'Group Name')}
                    </Label>
                    <Input
                      id="mutex_group"
                      {...register('mutex_group')}
                      placeholder="e.g. risk_level, payment_status"
                      disabled={isSystemTag}
                    />
                    <p className="text-xs text-gray-500">
                      {t(
                        'pages.tags.fields.mutexNote',
                        'Tags in the same mutex group are mutually exclusive — assigning one removes others in the group.'
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Collapsible: Notifications */}
            <div className="rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => toggleSection('notifications')}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <span>{t('pages.tags.fields.notifications', 'Notifications')}</span>
                <span className="text-gray-400">{expandedSections.notifications ? '−' : '+'}</span>
              </button>
              {expandedSections.notifications && (
                <div className="space-y-4 border-t border-gray-200 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Controller
                      name="notification_enabled"
                      control={control}
                      render={({ field }) => (
                        <ToggleSwitch
                          checked={field.value ?? false}
                          onChange={field.onChange}
                          disabled={isSystemTag}
                        />
                      )}
                    />
                    <Label>
                      {t('pages.tags.fields.enableNotifications', 'Enable notifications')}
                    </Label>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notification_template">
                      {t('pages.tags.fields.notificationTemplate', 'Template')}
                    </Label>
                    <Textarea
                      id="notification_template"
                      {...register('notification_template')}
                      placeholder="e.g. Tag '{tag_name}' assigned to client {client_id}"
                      rows={2}
                      disabled={isSystemTag}
                    />
                  </div>
                </div>
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
