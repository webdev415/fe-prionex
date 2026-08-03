/**
 * Tag Form Modal
 *
 * Modal for creating and editing tags with color picker.
 */

import { useEffect, useCallback, useMemo, useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { useTagConfigStore } from '@/stores/tagConfigStore'
import { Controller } from 'react-hook-form'
import { useCreateTagExtended, useUpdateTag } from '@/features/tags'
import type { Tag, TagDefinition, TagCategory, TagVisibility } from '@/features/tags'
import { useRoles } from '@/features/roles'
import { useAuthStore } from '@/stores/authStore'
import { useDepartments } from '@/features/departments/hooks/useDepartments'
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
import { generateCode } from '@/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/Tooltip'

interface TagFormModalProps {
  open: boolean
  tag?: Tag | TagDefinition
  activeProjectName?: string
  onClose: () => void
  onSuccess: () => void
}

// Dropdown options loaded from tagConfigStore (manageable via Settings tab)

type TagFormData = {
  name: string
  color: string
  description?: string
  code?: string
  category?: string
  visibility?: string
  default_ttl_hours?: number
  default_expires_at?: string
  mutex_group?: string
  requires_payload?: boolean
  notification_enabled?: boolean
  notification_template?: string
  is_protected?: boolean
  protected_removal_roles?: string[]
  expiry_type?: string
  is_related_tag?: boolean
  sort_order?: number
  skip_weekends?: boolean
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

export function TagFormModal({
  open,
  tag,
  activeProjectName,
  onClose,
  onSuccess,
}: TagFormModalProps) {
  const { t, i18n } = useTranslation('common')
  const tagConfig = useTagConfigStore()
  const isEdit = !!tag
  const isSystemTag = (tag as TagDefinition)?.origin === 'system'

  const CATEGORY_VALUES = tagConfig.categories.map((i) => i.value) as TagCategory[]
  const VISIBILITY_VALUES = tagConfig.visibilities.map((i) => i.value) as TagVisibility[]
  const EXPIRY_TYPES = tagConfig.expiryTypes.map((i) => i.value)
  const PRESET_COLORS = tagConfig.presetColors
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const templateRef = useRef<HTMLTextAreaElement>(null)

  const { user } = useAuthStore()
  const projectId = user?.active_project_id ? parseInt(user.active_project_id, 10) : undefined
  const { data: departmentsData } = useDepartments({
    project_id: projectId,
    is_active: true,
    page_size: 100,
  })
  const departments = useMemo(() => departmentsData?.departments ?? [], [departmentsData])

  const [departmentIds, setDepartmentIds] = useState<number[]>([])

  // Roles for protected-removal checkboxes: active project only, unique by name.
  const { data: rolesData } = useRoles({
    is_active: true,
    page_size: 100,
    project_id: projectId,
  })
  const availableRoles = useMemo(() => {
    const seen = new Set<string>()
    const unique: { id: number; name: string }[] = []
    for (const role of rolesData?.roles ?? []) {
      if (!role.is_active || seen.has(role.name)) {
        continue
      }
      seen.add(role.name)
      unique.push({ id: role.id, name: role.name })
    }
    return unique.sort((a, b) => a.name.localeCompare(b.name))
  }, [rolesData])

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
          default_expires_at: z.string().optional(),
          sort_order: z
            .number({
              error: t('pages.tags.fields.validation.sortOrderRequired', 'Sort order is required'),
            })
            .int(
              t(
                'pages.tags.fields.validation.sortOrderPositiveInteger',
                'Sort order must be a positive integer'
              )
            )
            .min(
              1,
              t(
                'pages.tags.fields.validation.sortOrderPositiveInteger',
                'Sort order must be a positive integer'
              )
            ),
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
    getValues,
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
      default_expires_at: '',
      mutex_group: (tag as TagDefinition)?.mutex_group || '',
      requires_payload: (tag as TagDefinition)?.requires_payload ?? false,
      notification_enabled: (tag as TagDefinition)?.notification_enabled ?? false,
      notification_template: (tag as TagDefinition)?.notification_template || '',
      is_protected: (tag as TagDefinition)?.is_protected ?? false,
      protected_removal_roles: (tag as TagDefinition)?.protected_removal_roles ?? [],
      expiry_type: (tag as TagDefinition)?.expiry_type ?? 'permanent',
      is_related_tag: (tag as TagDefinition)?.is_related_tag ?? false,
      sort_order: (tag as TagDefinition)?.sort_order ?? 100,
      skip_weekends: (tag as TagDefinition)?.skip_weekends ?? false,
    },
  })

  // Watch color value for preview
  const selectedColor = watch('color')

  // Auto-generate code from name (only for new tags, not editing)
  const watchedName = watch('name')
  const codeManuallyEdited = useRef(false)
  useEffect(() => {
    if (!tag && !codeManuallyEdited.current) {
      setValue('code', watchedName ? generateCode(watchedName) : '', { shouldValidate: false })
    }
  }, [watchedName, tag, setValue])

  // Reset form when modal opens/closes or tag changes
  useEffect(() => {
    if (open) {
      codeManuallyEdited.current = !!tag // if editing, treat as manually set
      const tagDef = tag as TagDefinition | undefined
      reset({
        name: tag?.name || '',
        color: tag?.color || '#80D80A',
        description: tag?.description || '',
        code: tagDef?.code || '',
        category: tagDef?.category || 'custom',
        visibility: tagDef?.visibility || 'ui',
        default_ttl_hours: tagDef?.default_ttl_hours ?? undefined,
        default_expires_at: '',
        mutex_group: tagDef?.mutex_group || '',
        requires_payload: tagDef?.requires_payload ?? false,
        notification_enabled: tagDef?.notification_enabled ?? false,
        notification_template: tagDef?.notification_template || '',
        is_protected: tagDef?.is_protected ?? false,
        protected_removal_roles: tagDef?.protected_removal_roles ?? [],
        expiry_type: tagDef?.expiry_type ?? 'permanent',
        is_related_tag: tagDef?.is_related_tag ?? false,
        sort_order: tagDef?.sort_order ?? 100,
        skip_weekends: tagDef?.skip_weekends ?? false,
      })
    }
  }, [open, tag, reset])

  useEffect(() => {
    if (!open) return
    const tagDef = tag as TagDefinition | undefined
    setDepartmentIds(tagDef?.department_ids?.length ? [...tagDef.department_ids] : [])
  }, [open, tag])

  const toggleDepartment = (id: number) => {
    if (isSystemTag) return
    setDepartmentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const onSubmit = useCallback(
    async (data: TagFormData) => {
      // Clean empty strings -> undefined so backend stores NULL not ""
      const cleaned = {
        ...data,
        code: data.code || undefined,
        description: data.description || undefined,
        mutex_group: data.mutex_group || undefined,
        notification_template: data.notification_template || undefined,
        default_ttl_hours:
          data.default_ttl_hours && !Number.isNaN(data.default_ttl_hours)
            ? data.default_ttl_hours
            : undefined,
        default_expires_at: data.default_expires_at || undefined,
        sort_order: data.sort_order && !Number.isNaN(data.sort_order) ? data.sort_order : 100,
        department_ids: departmentIds.length > 0 ? departmentIds : null,
      }

      try {
        if (isEdit && tag) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await updateMutation.mutateAsync({ id: tag.id, data: cleaned as any })
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await createMutation.mutateAsync(cleaned as any)
        }
        onSuccess()
      } catch (error) {
        console.error('Failed to save tag:', error)
      }
    },
    [isEdit, tag, updateMutation, createMutation, onSuccess, departmentIds]
  )

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  const insertVariable = (variable: string) => {
    const el = templateRef.current
    if (!el) return
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    const current = getValues('notification_template') || ''
    const newValue = current.slice(0, start) + variable + current.slice(end)
    setValue('notification_template', newValue, { shouldDirty: true })
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + variable.length, start + variable.length)
    }, 0)
  }

  // Minimum datetime for the TTL datepicker (current time)
  const minDatetime = new Date().toISOString().slice(0, 16)

  return (
    <Modal open={open} onClose={handleClose} className="max-w-3xl">
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
          title={isEdit ? t('pages.tags.editTag', 'Edit Tag') : t('pages.tags.newTag', 'New Tag')}
        />

        <ModalContent className="overflow-x-hidden">
          <div className="min-w-0 space-y-6">
            {/* Info Banner */}
            <div className="bg-information-50 text-information-700 mb-4 flex items-center gap-2 rounded-lg p-3 text-sm">
              <span>ℹ️</span>
              <span>{t('pages.tags.helpBanner', 'Нужна помощь с настройкой тегов?')}</span>
              <a
                href="https://prionex.atlassian.net/wiki"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto underline"
              >
                {t('pages.tags.helpLink', 'Документация')}
              </a>
            </div>

            {/* Project (Read-only) */}
            {(tag?.project_name || activeProjectName) && (
              <div className="border-border bg-muted rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <span className="text-foreground text-sm font-medium">
                    {t('pages.tags.fields.project', 'Project')}:
                  </span>
                  <span className="text-foreground text-sm">
                    {tag?.project_name || activeProjectName}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {t(
                    'pages.tags.fields.projectNote',
                    'Tags are automatically assigned to your active project'
                  )}
                </p>
              </div>
            )}

            {/* Tag Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                {t('pages.tags.fields.name', 'Name')}
                <FieldTooltip text={t('pages.tags.fields.tooltips.name', 'Displayed tag name')} />
              </Label>
              <Input
                id="name"
                {...register('name')}
                placeholder={t('pages.tags.fields.namePlaceholder', 'Enter tag name')}
                error={errors.name?.message}
                aria-label={t('pages.tags.fields.name', 'Name')}
              />
            </div>

            {/* Code (auto-generated from name) */}
            <div className="space-y-2">
              <Label htmlFor="code">
                {t('pages.tags.fields.code', 'Code')}
                <FieldTooltip
                  text={t(
                    'pages.tags.fields.tooltips.code',
                    'Unique ID for API. Auto-generated from name'
                  )}
                />
              </Label>
              <Input
                id="code"
                {...register('code', {
                  onChange: () => {
                    codeManuallyEdited.current = true
                  },
                })}
                placeholder={t('pages.tags.fields.codePlaceholder', 'e.g. high_risk')}
                disabled={isSystemTag}
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

            {/* Sort Order */}
            <div className="space-y-2">
              <Label htmlFor="sort_order">
                {t('pages.tags.fields.sortOrder', 'Sort Order')}
                <FieldTooltip
                  text={t(
                    'pages.tags.fields.tooltips.sortOrder',
                    'Lower number = higher position in tag lists. Default is 100.'
                  )}
                />
              </Label>
              <Input
                id="sort_order"
                type="number"
                min={1}
                step={1}
                {...register('sort_order', { valueAsNumber: true })}
                placeholder={t('pages.tags.fields.sortOrderPlaceholder', 'e.g. 1, 10, 100')}
                error={errors.sort_order?.message}
                disabled={isSystemTag}
              />
            </div>

            {/* Category & Visibility */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  {t('pages.tags.fields.category', 'Category')}
                  <FieldTooltip
                    text={t(
                      'pages.tags.fields.tooltips.category',
                      'Groups by purpose: status, risk, etc.'
                    )}
                  />
                </Label>
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
                <Label>
                  {t('pages.tags.fields.visibility', 'Visibility')}
                  <FieldTooltip
                    text={t(
                      'pages.tags.fields.tooltips.visibility',
                      'UI = operators, Analytics = reports, System = hidden'
                    )}
                  />
                </Label>
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

            {/* Department scope (empty = all departments) */}
            {!isSystemTag && (
              <div className="border-border space-y-2 rounded-lg border px-4 py-3">
                <Label>
                  {t('pages.tags.fields.departments', 'Departments')}
                  <FieldTooltip
                    text={t(
                      'pages.tags.fields.tooltips.departments',
                      'Leave empty for all departments. Otherwise only operators in selected departments see this tag in the picker.'
                    )}
                  />
                </Label>
                <p className="text-muted-foreground text-xs">
                  {t(
                    'pages.tags.fields.departmentsHint',
                    'No selection = visible to every department (same as today).'
                  )}
                </p>
                <div className="border-border bg-card max-h-44 space-y-2 overflow-y-auto rounded border p-2">
                  {departments.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      {t('pages.tags.fields.noDepartments', 'No departments in this project.')}
                    </p>
                  ) : (
                    departments.map((d) => (
                      <label
                        key={d.id}
                        className="text-foreground flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="border-border h-4 w-4 rounded"
                          checked={departmentIds.includes(d.id)}
                          onChange={() => toggleDepartment(d.id)}
                        />
                        <span>{d.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Expiry Type */}
            <div className="border-border rounded-lg border px-4 py-3">
              <Label className="mb-2 block">
                {t('pages.tags.fields.expiryType', 'Expiry Type')}
                <FieldTooltip
                  text={t(
                    'pages.tags.fields.tooltips.expiryType',
                    'Permanent = forever. TTL = auto-remove. Loan closure = on loan close'
                  )}
                />
              </Label>
              <div className="flex flex-wrap gap-4">
                {EXPIRY_TYPES.map((type) => (
                  <label key={type} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      value={type}
                      {...register('expiry_type')}
                      className="border-border text-information-600 focus:ring-primary h-4 w-4"
                      disabled={isSystemTag}
                    />
                    <span className="text-foreground text-sm">
                      {t(`pages.tags.expiryTypes.${type}`, type)}
                    </span>
                  </label>
                ))}
              </div>
              {watch('expiry_type') === 'ttl' && (
                <div className="mt-3 space-y-3">
                  {/* Datetime picker for TTL */}
                  <div className="space-y-2">
                    <Label htmlFor="default_expires_at">
                      {t('pages.tags.fields.expiresAt', 'Expires at')}
                    </Label>
                    <Input
                      id="default_expires_at"
                      type="datetime-local"
                      {...register('default_expires_at')}
                      min={minDatetime}
                      disabled={isSystemTag}
                    />
                  </div>
                  {/* Hours input as secondary option */}
                  <div className="space-y-2">
                    <Label htmlFor="default_ttl_hours" className="text-muted-foreground text-xs">
                      {t('pages.tags.fields.ttlHoursAlt', 'or duration in hours')}
                    </Label>
                    <Input
                      id="default_ttl_hours"
                      type="number"
                      className="max-w-48"
                      {...register('default_ttl_hours', { valueAsNumber: true })}
                      placeholder={t(
                        'pages.tags.fields.ttlHoursPlaceholder',
                        'e.g. 24, 48, 168, 720'
                      )}
                      disabled={isSystemTag}
                    />
                  </div>
                  {/* Skip Weekends */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="skip_weekends"
                      {...register('skip_weekends')}
                      className="border-border h-4 w-4 rounded"
                      disabled={isSystemTag}
                    />
                    <Label htmlFor="skip_weekends" className="cursor-pointer text-sm font-normal">
                      {t('pages.tags.fields.skipWeekends', 'Skip weekends')}
                      <FieldTooltip
                        text={t(
                          'pages.tags.fields.tooltips.skipWeekends',
                          'When enabled, the TTL countdown pauses on Saturday and Sunday. For example, a 48-hour TTL assigned on Friday at 18:00 will expire on Tuesday at 18:00, not Sunday.'
                        )}
                      />
                    </Label>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {t(
                      'pages.tags.fields.ttlNote',
                      'Tag will be automatically removed after this period'
                    )}
                  </p>
                </div>
              )}
              {watch('expiry_type') === 'loan_closure' && (
                <p className="text-warning-600 mt-2 text-xs">
                  {t(
                    'pages.tags.fields.loanClosureNote',
                    "Tag will be automatically removed when the client's loan is closed"
                  )}
                </p>
              )}
              {/* target_action_date — the expiry comes from a date field
                  inside the TA that triggers the tag effect. The fixed-
                  date and TTL-hours inputs are intentionally hidden:
                  they're ignored by the backend for this type, and the
                  date-field selection happens in the chain effect
                  editor (not here in the tag definition). */}
              {watch('expiry_type') === 'target_action_date' && (
                <p className="text-warning-600 mt-2 text-xs">
                  {t(
                    'pages.tags.fields.targetActionDateNote',
                    'Expiry is set from a date field in the Target Action that triggers this tag. Tags of this type cannot be assigned manually by operators — only via chain effects.'
                  )}
                </p>
              )}
            </div>

            {/* Related Tag */}
            <div className="border-border rounded-lg border px-4 py-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_related_tag"
                  {...register('is_related_tag')}
                  className="border-border h-4 w-4 rounded"
                  disabled={isSystemTag}
                />
                <Label htmlFor="is_related_tag">
                  {t('pages.tags.fields.isRelatedTag', 'Related Tag')}
                  <FieldTooltip
                    text={t(
                      'pages.tags.fields.tooltips.relatedTag',
                      'When enabled, this tag appears on linked clients who share a phone number'
                    )}
                  />
                </Label>
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                {t(
                  'pages.tags.relatedTagHint',
                  'Shown in the Related Tags tab on profiles of clients linked by shared phone numbers.'
                )}
              </p>
            </div>

            {/* Protected Tag */}
            <div className="border-border rounded-lg border px-4 py-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_protected"
                  {...register('is_protected')}
                  className="border-border h-4 w-4 rounded"
                  disabled={isSystemTag}
                />
                <Label htmlFor="is_protected">
                  {t('pages.tags.fields.isProtected', 'Protected Tag')}
                  <FieldTooltip
                    text={t(
                      'pages.tags.fields.tooltips.protectedTag',
                      'Only selected roles can remove'
                    )}
                  />
                </Label>
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                {t('pages.tags.protectedWarning', 'Removal requires manager approval')}
              </p>
              {watch('is_protected') && (
                <div className="mt-3 space-y-2">
                  <Label>{t('pages.tags.fields.protectedRoles', 'Roles allowed to remove')}</Label>
                  <div className="flex flex-wrap gap-2">
                    {availableRoles.map((role) => (
                      <label key={role.id} className="flex cursor-pointer items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={(watch('protected_removal_roles') || []).includes(role.name)}
                          onChange={(e) => {
                            const current = watch('protected_removal_roles') || []
                            if (e.target.checked) {
                              setValue('protected_removal_roles', [...current, role.name])
                            } else {
                              setValue(
                                'protected_removal_roles',
                                current.filter((r: string) => r !== role.name)
                              )
                            }
                          }}
                          className="border-border h-3.5 w-3.5 rounded"
                          disabled={isSystemTag}
                        />
                        <span className="text-foreground text-sm">{role.name}</span>
                      </label>
                    ))}
                    {availableRoles.length === 0 && (
                      <span className="text-muted-foreground text-xs">
                        {t('pages.tags.fields.noRolesAvailable', 'No roles available')}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Collapsible: Notifications */}
            <div className="border-border rounded-lg border">
              <button
                type="button"
                onClick={() => toggleSection('notifications')}
                className="text-foreground hover:bg-muted flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
              >
                <span>{t('pages.tags.fields.notifications', 'Notifications')}</span>
                <span className="text-muted-foreground">
                  {expandedSections.notifications ? '−' : '+'}
                </span>
              </button>
              {expandedSections.notifications && (
                <div className="border-border space-y-4 border-t px-4 py-3">
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
                      {...(() => {
                        const { ref: registerRef, ...registerRest } =
                          register('notification_template')
                        return {
                          ...registerRest,
                          ref: (e: HTMLTextAreaElement | null) => {
                            registerRef(e)
                            templateRef.current = e
                          },
                        }
                      })()}
                      placeholder={t(
                        'pages.tags.fields.notificationTemplatePlaceholder',
                        "e.g. Tag '{tag_name}' assigned to client {client_id}"
                      )}
                      rows={2}
                      disabled={isSystemTag}
                    />
                    {/* Available variables */}
                    <div className="mt-2 space-y-1">
                      <p className="text-muted-foreground text-xs">
                        {t('pages.tags.fields.availableVariables', 'Доступные переменные:')}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { var: '{client_id}', label: 'client_id' },
                          { var: '{client_name}', label: 'client_name' },
                          { var: '{tag_name}', label: 'tag_name' },
                          { var: '{tag_code}', label: 'tag_code' },
                          { var: '{action}', label: 'action' },
                        ].map((v) => (
                          <button
                            key={v.var}
                            type="button"
                            className="bg-muted text-foreground hover:bg-muted/80 rounded px-2 py-0.5 font-mono text-xs transition-colors"
                            onClick={() => insertVariable(v.var)}
                            title={t(
                              `pages.tags.fields.var${v.label.charAt(0).toUpperCase() + v.label.slice(1).replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())}`,
                              v.label
                            )}
                          >
                            {v.var}
                          </button>
                        ))}
                      </div>
                    </div>
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
