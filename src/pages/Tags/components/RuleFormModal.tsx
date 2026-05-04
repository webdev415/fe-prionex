/**
 * RuleFormModal Component
 *
 * Modal for creating and editing tag automation rules.
 * Supports event-based, schedule-based, and other trigger types.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import {
  useInteractionResults,
  useInteractionSubtypes,
  useInteractionTypes,
} from '@/features/clients/hooks/useNoteInteraction'
import { DEFAULT_EVENT_LABELS, useTagConfigStore, type ConfigItem } from '@/stores/tagConfigStore'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/Select'
import { Icons } from '@/lib/icons'
import { useCreateRule, useUpdateRule } from '@/features/tags'
import type { TagRule, RuleTriggerType, RuleActionType, Tag } from '@/features/tags'

interface RuleFormModalProps {
  open: boolean
  rule?: TagRule
  tags: Tag[]
  onClose: () => void
  onSuccess: () => void
}

/** Convert a cron expression to a human-readable string using i18n */
function humanizeCronLocal(
  expr: string,
  t: (key: string, fallback: string, opts?: Record<string, string>) => string
): string {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return expr

  const [min, hour, dom, mon, dow] = parts

  if (min.startsWith('*/') && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
    return t('pages.tags.rules.cronHumanize.everyNMin', `Every ${min.slice(2)} min`, {
      n: min.slice(2),
    })
  }

  if (/^\d+$/.test(min) && /^\d+$/.test(hour)) {
    const time = `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`
    if (dom === '*' && mon === '*' && dow === '*') {
      return t('pages.tags.rules.cronHumanize.dailyAt', `Daily at ${time}`, { time })
    }
    if (dom === '*' && mon === '*' && /^\d+$/.test(dow)) {
      const dayName = t(`pages.tags.rules.cronHumanize.days.${dow}`, dow)
      return t('pages.tags.rules.cronHumanize.dayAt', `${dayName} at ${time}`, {
        day: dayName,
        time,
      })
    }
  }

  return expr
}

function CronPreview({
  expression,
  t,
}: {
  expression: string
  t: (key: string, fallback: string, opts?: Record<string, string>) => string
}) {
  const humanized = humanizeCronLocal(expression, t)
  if (humanized === expression) return null
  return <p className="text-xs text-green-600">{humanized}</p>
}

// Dropdown options loaded from tagConfigStore (manageable via Settings tab)

// Rule presets loaded from tagConfigStore (manageable via Settings tab)

function getEventDisplayLabel(
  eventValue: string,
  eventLabel: string,
  t: (key: string, fallback: string) => string
): string {
  const defaultLabel = DEFAULT_EVENT_LABELS[eventValue]
  if (defaultLabel && eventLabel === defaultLabel) {
    return t(`pages.tags.rules.events.${eventValue}`, eventLabel)
  }

  return eventLabel
}

function mergeOptions(...groups: Array<ConfigItem[] | undefined>): ConfigItem[] {
  const deduped = new Map<string, ConfigItem>()

  for (const group of groups) {
    for (const item of group ?? []) {
      const value = item.value.trim()
      if (!value || deduped.has(value)) continue
      deduped.set(value, {
        value,
        label: item.label.trim() || value,
      })
    }
  }

  return Array.from(deduped.values())
}

type RuleFormData = {
  name: string
  description: string
  trigger_type: RuleTriggerType
  trigger_event: string
  cron_expression: string
  conditions: { field: string; op: string; value: string }[]
  action_type: RuleActionType
  target_tag_code: string
  replace_tag_code: string
  priority: number
  is_active: boolean
}

export function RuleFormModal({ open, rule, tags, onClose, onSuccess }: RuleFormModalProps) {
  const { t, i18n } = useTranslation('common')
  const isEdit = !!rule
  const tagConfig = useTagConfigStore()

  const TRIGGER_TYPE_VALUES = tagConfig.triggerTypes.map((i) => i.value) as RuleTriggerType[]
  const ACTION_TYPE_VALUES = tagConfig.actionTypes.map((i) => i.value) as RuleActionType[]
  const AVAILABLE_EVENTS = tagConfig.availableEvents
  const RULE_OPERATOR_VALUES = tagConfig.operators.map((i) => i.value)
  const RULE_PRESETS = tagConfig.rulePresets

  const createMutation = useCreateRule()
  const updateMutation = useUpdateRule()
  const { data: interactionResults = [] } = useInteractionResults()
  const { data: interactionTypes = [] } = useInteractionTypes()
  const { data: interactionSubtypes = [] } = useInteractionSubtypes()

  const ruleSchema = useMemo(
    () =>
      z
        .object({
          name: z
            .string()
            .min(1, t('pages.tags.rules.validation.nameRequired', 'Name is required'))
            .max(100, t('pages.tags.rules.validation.nameMax', 'Max 100 characters')),
          description: z.string().max(500).optional().default(''),
          trigger_type: z.enum([
            'event',
            'schedule',
            'tag_expired',
            'scoring_change',
            'import_complete',
          ]),
          trigger_event: z.string().optional().default(''),
          cron_expression: z.string().optional().default(''),
          conditions: z.array(
            z.object({
              field: z.string().min(1, 'Field is required'),
              op: z.string().min(1, 'Operator is required'),
              value: z.string(),
            })
          ),
          action_type: z.enum(['add_tag', 'remove_tag', 'replace_tag']),
          target_tag_code: z
            .string()
            .min(1, t('pages.tags.rules.validation.targetRequired', 'Target tag is required')),
          replace_tag_code: z.string().optional().default(''),
          priority: z.coerce.number().int().min(1).max(1000).default(1),
          is_active: z.boolean().default(true),
        })
        .superRefine((data, ctx) => {
          if (data.trigger_type === 'event' && !data.trigger_event) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t(
                'pages.tags.rules.validation.eventRequired',
                'Event name is required for event triggers'
              ),
              path: ['trigger_event'],
            })
          }
          if (data.trigger_type === 'schedule' && !data.cron_expression) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t(
                'pages.tags.rules.validation.cronRequired',
                'Cron expression is required for schedule triggers'
              ),
              path: ['cron_expression'],
            })
          }
        }),
    [t]
  )

  const [isCustomEvent, setIsCustomEvent] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<RuleFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(ruleSchema) as any,
    defaultValues: {
      name: '',
      description: '',
      trigger_type: 'event',
      trigger_event: '',
      cron_expression: '',
      conditions: [],
      action_type: 'add_tag',
      target_tag_code: '',
      replace_tag_code: '',
      priority: 1,
      is_active: true,
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'conditions' })

  const triggerType = watch('trigger_type')

  // Dynamic condition fields — based on selected event's payload
  const triggerEventValue = watch('trigger_event')
  const selectedEventConfig = AVAILABLE_EVENTS.find((e) => e.value === triggerEventValue)
  const CONDITION_FIELD_OPTIONS = useMemo(() => {
    const TAG_CONDITION_FIELDS: ConfigItem[] = [
      { value: 'has_tag', label: t('pages.tags.rules.conditionFields.has_tag', 'Has Tag') },
      {
        value: 'not_has_tag',
        label: t('pages.tags.rules.conditionFields.not_has_tag', 'Not Has Tag'),
      },
    ]
    if (selectedEventConfig?.fields?.length) {
      const eventFields = selectedEventConfig.fields.map((field) => ({
        value: field.value,
        label: t(`pages.tags.rules.eventPayloadFields.${field.value}`, field.label || field.value),
      }))
      return [...eventFields, ...TAG_CONDITION_FIELDS]
    }
    return tagConfig.conditionFields.map((f) => ({
      value: f.value,
      label: t(`pages.tags.rules.conditionFields.${f.value}`, f.label),
    }))
  }, [selectedEventConfig, tagConfig.conditionFields, t])

  // Get possible values for a condition field (if it's a select type)
  const getFieldOptions = (fieldName: string): ConfigItem[] | undefined => {
    const field = selectedEventConfig?.fields?.find((f) => f.value === fieldName)
    if (field?.type !== 'select') return undefined

    const configuredOptions = field.options ?? []
    const lang = i18n?.language || 'en'

    // Apply persisted translations from store for current language
    const applyTranslations = (items: ConfigItem[]): ConfigItem[] => {
      if (lang === 'en') return items
      return items.map((item) => {
        const translated =
          item.translations?.[lang] ||
          t(`pages.tags.rules.eventOptions.${triggerEventValue}.${fieldName}.${item.value}`, '')
        return translated ? { ...item, label: translated } : item
      })
    }

    switch (field.optionsSource) {
      case 'interactionResults':
        return applyTranslations(
          mergeOptions(
            configuredOptions,
            interactionResults.map((item) => ({
              value: item.name,
              label: item.name,
            }))
          )
        )
      case 'interactionTypes':
        return applyTranslations(
          mergeOptions(
            configuredOptions,
            interactionTypes.map((item) => ({
              value: item.code,
              label: item.code,
            }))
          )
        )
      case 'interactionChannels':
        return applyTranslations(
          mergeOptions(
            configuredOptions,
            interactionSubtypes.map((item) => ({
              value: item.code.toLowerCase(),
              label: item.code.toLowerCase(),
            }))
          )
        )
      case 'interactionDirections':
        return applyTranslations(
          mergeOptions(configuredOptions, [
            {
              value: 'inbound',
              label: t('pages.tags.rules.eventPayloadFields.inbound', 'Входящий'),
            },
            {
              value: 'outbound',
              label: t('pages.tags.rules.eventPayloadFields.outbound', 'Исходящий'),
            },
            {
              value: 'system',
              label: t('pages.tags.rules.eventPayloadFields.system', 'Системный'),
            },
          ])
        )
      default:
        return applyTranslations(configuredOptions)
    }
  }
  const actionType = watch('action_type')
  const cronValue = watch('cron_expression')

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      reset({
        name: rule?.name ?? '',
        description: rule?.description ?? '',
        trigger_type: rule?.trigger_type ?? 'event',
        trigger_event: rule?.trigger_event ?? '',
        cron_expression: rule?.cron_expression ?? '',
        conditions: (rule?.conditions ?? []).map((c) => ({
          field: c.field,
          op: c.op,
          value: String(c.value ?? ''),
        })),
        action_type: rule?.action_type ?? 'add_tag',
        target_tag_code: rule?.target_tag_code ?? '',
        replace_tag_code: rule?.replace_tag_code ?? '',
        priority: rule?.priority ?? 1,
        is_active: rule?.is_active ?? true,
      })
      setIsCustomEvent(
        rule?.trigger_event ? !AVAILABLE_EVENTS.some((e) => e.value === rule.trigger_event) : false
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rule, reset])

  const onSubmit = useCallback(
    async (data: RuleFormData) => {
      const payload = {
        name: data.name,
        description: data.description || undefined,
        trigger_type: data.trigger_type,
        trigger_event: data.trigger_type === 'event' ? data.trigger_event || undefined : undefined,
        cron_expression:
          data.trigger_type === 'schedule' ? data.cron_expression || undefined : undefined,
        conditions: data.conditions.map((c) => ({
          field: c.field,
          op: c.op,
          value: c.value,
        })),
        action_type: data.action_type,
        target_tag_code: data.target_tag_code,
        replace_tag_code:
          data.action_type === 'replace_tag' ? data.replace_tag_code || undefined : undefined,
        priority: data.priority,
        is_active: data.is_active,
      }

      try {
        if (isEdit && rule) {
          await updateMutation.mutateAsync({ id: rule.id, data: payload })
        } else {
          await createMutation.mutateAsync(payload)
        }
        onSuccess()
      } catch (error) {
        console.error('Failed to save rule:', error)
      }
    },
    [isEdit, rule, createMutation, updateMutation, onSuccess]
  )

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  // Build tag code options from tags
  const tagCodeOptions = useMemo(
    () =>
      tags.map((tag) => ({
        value: (tag as { code?: string }).code ?? tag.name,
        label: tag.name,
      })),
    [tags]
  )

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
              ? t('pages.tags.rules.editRule', 'Edit Rule')
              : t('pages.tags.rules.newRule', 'New Rule')
          }
        />

        <ModalContent>
          <div className="space-y-5">
            {/* Preset Templates (only for create) */}
            {!isEdit && (
              <div className="space-y-1.5">
                <Label>{t('pages.tags.rules.useTemplate', 'Use Template')}</Label>
                <Select
                  value=""
                  onValueChange={(key) => {
                    const preset = RULE_PRESETS.find((p) => p.key === key)
                    if (preset) {
                      setIsCustomEvent(
                        preset.trigger_event
                          ? !AVAILABLE_EVENTS.some((event) => event.value === preset.trigger_event)
                          : false
                      )
                      reset({
                        name: preset.name,
                        description: preset.description,
                        trigger_type: preset.trigger_type as RuleTriggerType,
                        trigger_event: preset.trigger_event ?? '',
                        cron_expression: preset.cron_expression ?? '',
                        conditions: preset.conditions,
                        action_type: preset.action_type as RuleActionType,
                        target_tag_code: preset.target_tag_code,
                        replace_tag_code: preset.replace_tag_code ?? '',
                        priority: 1,
                        is_active: true,
                      })
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t(
                        'pages.tags.rules.selectTemplate',
                        'Select a debt collection template...'
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_PRESETS.map((preset) => (
                      <SelectItem key={preset.key} value={preset.key}>
                        {t(`pages.tags.rules.presets.${preset.key}`, preset.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="rule-name" required>
                {t('pages.tags.rules.name', 'Name')}
              </Label>
              <Input
                id="rule-name"
                {...register('name')}
                placeholder={t('pages.tags.rules.namePlaceholder', 'e.g. High risk of overdue')}
                error={errors.name?.message}
              />
            </div>

            {/* Code field hidden — backend rule schema does not persist `code` yet.
                Will be re-introduced in PR4 (feature/KAN-tags-rule-safety-dryrun)
                together with the migration that adds tag_rules.code. */}

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="rule-desc">{t('pages.tags.rules.description', 'Description')}</Label>
              <Textarea
                id="rule-desc"
                {...register('description')}
                placeholder={t(
                  'pages.tags.rules.descriptionPlaceholder',
                  'Describe what this rule does...'
                )}
                rows={2}
                textareaSize="sm"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Trigger Type */}
              <div className="space-y-1.5">
                <Label required>{t('pages.tags.rules.triggerType', 'Trigger Type')}</Label>
                <Controller
                  name="trigger_type"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRIGGER_TYPE_VALUES.map((tt) => (
                          <SelectItem key={tt} value={tt}>
                            {t(`pages.tags.rules.triggerTypes.${tt}`, tt)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <p className="text-xs text-gray-500">
                  {t(`pages.tags.rules.triggerHelpers.${triggerType}`, '')}
                </p>
              </div>

              {/* Trigger Event (if event) */}
              {triggerType === 'event' && (
                <div className="space-y-1.5">
                  <Label>{t('pages.tags.rules.eventName', 'Название события')}</Label>
                  <select
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    value={isCustomEvent ? '__custom__' : watch('trigger_event') || ''}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setIsCustomEvent(true)
                        setValue('trigger_event', '')
                      } else {
                        setIsCustomEvent(false)
                        setValue('trigger_event', e.target.value)
                      }
                    }}
                  >
                    <option value="">
                      {t('pages.tags.rules.selectEvent', 'Выберите событие...')}
                    </option>
                    {AVAILABLE_EVENTS.map((ev) => (
                      <option key={ev.value} value={ev.value}>
                        {getEventDisplayLabel(ev.value, ev.label, t)}
                      </option>
                    ))}
                    <option value="__custom__">
                      {t('pages.tags.rules.customEvent', 'Своё значение...')}
                    </option>
                  </select>
                  {isCustomEvent && (
                    <Input
                      {...register('trigger_event')}
                      placeholder={t(
                        'pages.tags.fields.triggerEventPlaceholder',
                        'напр. client.payment_missed'
                      )}
                      className="mt-2"
                    />
                  )}
                  {errors.trigger_event?.message && (
                    <p className="text-error-500 text-xs">{errors.trigger_event.message}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    {t('pages.tags.rules.eventHint', 'Выберите системное событие или введите своё')}
                  </p>
                </div>
              )}

              {/* Cron Expression (if schedule) */}
              {triggerType === 'schedule' && (
                <div className="space-y-1.5">
                  <Label htmlFor="rule-cron">
                    {t('pages.tags.rules.cronExpression', 'Cron Expression')}
                  </Label>
                  <Input
                    id="rule-cron"
                    {...register('cron_expression')}
                    placeholder="0 9 * * *"
                    error={errors.cron_expression?.message}
                    helperText={t(
                      'pages.tags.rules.cronHelp',
                      'Standard cron format (min hour dom mon dow)'
                    )}
                  />
                  {cronValue && <CronPreview expression={cronValue} t={t} />}
                </div>
              )}
            </div>

            {/* Conditions */}
            <div className="space-y-1.5">
              <Label>{t('pages.tags.rules.conditions', 'Conditions')}</Label>
              <p className="text-xs text-gray-500">
                {t(
                  'pages.tags.rules.conditionsHelp',
                  'All conditions must be true for the rule to fire (AND logic). Leave empty to always fire.'
                )}
              </p>
              <div className="space-y-2">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-start gap-2">
                    <Controller
                      name={`conditions.${index}.field`}
                      control={control}
                      render={({ field: fieldCtrl }) => (
                        <div className="min-w-0">
                          <Select value={fieldCtrl.value} onValueChange={fieldCtrl.onChange}>
                            <SelectTrigger className="h-9 w-40 shrink-0 text-xs">
                              <SelectValue
                                placeholder={t('pages.tags.rules.selectField', 'Select field')}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {CONDITION_FIELD_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {errors.conditions?.[index]?.field?.message && (
                            <p className="text-error-500 mt-1 text-xs">
                              {errors.conditions?.[index]?.field?.message}
                            </p>
                          )}
                        </div>
                      )}
                    />
                    <Controller
                      name={`conditions.${index}.op`}
                      control={control}
                      render={({ field: opField }) => (
                        <Select value={opField.value} onValueChange={opField.onChange}>
                          <SelectTrigger className="h-9 w-28 shrink-0 text-xs">
                            <SelectValue placeholder={t('pages.tags.rules.operator', 'Op')} />
                          </SelectTrigger>
                          <SelectContent>
                            {RULE_OPERATOR_VALUES.map((op) => (
                              <SelectItem key={op} value={op}>
                                {t(`pages.tags.segments.operators.${op}`, op)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {(() => {
                      const fieldName = watch(`conditions.${index}.field`)
                      // Tag selector for has_tag / not_has_tag
                      if (fieldName === 'has_tag' || fieldName === 'not_has_tag') {
                        return (
                          <Controller
                            name={`conditions.${index}.value`}
                            control={control}
                            render={({ field: valField }) => (
                              <Select value={valField.value} onValueChange={valField.onChange}>
                                <SelectTrigger className="h-9 min-w-[140px] flex-1 text-xs">
                                  <SelectValue
                                    placeholder={t('pages.tags.rules.selectTag', 'Select tag')}
                                  />
                                </SelectTrigger>
                                <SelectContent
                                  searchable
                                  searchPlaceholder={t('pages.tags.searchTags', 'Поиск...')}
                                >
                                  {tagCodeOptions.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                      {o.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        )
                      }
                      const opts = getFieldOptions(fieldName)
                      if (opts && opts.length > 0) {
                        return (
                          <Controller
                            name={`conditions.${index}.value`}
                            control={control}
                            render={({ field: valField }) => (
                              <Select value={valField.value} onValueChange={valField.onChange}>
                                <SelectTrigger className="h-9 min-w-[140px] flex-1 text-xs">
                                  <SelectValue
                                    placeholder={t(
                                      'pages.tags.rules.valuePlaceholder',
                                      'Выберите...'
                                    )}
                                  />
                                </SelectTrigger>
                                <SelectContent
                                  searchable
                                  searchPlaceholder={t('pages.tags.searchTags', 'Поиск...')}
                                >
                                  {opts.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                      {o.label || o.value}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        )
                      }
                      return (
                        <Input
                          inputSize="sm"
                          className="h-9 text-xs"
                          placeholder={t('pages.tags.rules.valuePlaceholder', 'e.g. 80')}
                          {...register(`conditions.${index}.value`)}
                        />
                      )
                    })()}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="mt-0.5 shrink-0 text-gray-400 hover:text-red-500"
                      onClick={() => remove(index)}
                      aria-label={t('actions.remove', 'Remove')}
                    >
                      <Icons.Cancel01 size={14} />
                    </Button>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="text-xs text-gray-500 hover:text-gray-700"
                  onClick={() => append({ field: '', op: 'eq', value: '' })}
                  leftIcon={<Icons.Add size={12} />}
                >
                  {t('pages.tags.rules.addCondition', 'Add condition')}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Action Type */}
              <div className="space-y-1.5">
                <Label required>{t('pages.tags.rules.actionType', 'Action')}</Label>
                <Controller
                  name="action_type"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTION_TYPE_VALUES.map((at) => (
                          <SelectItem key={at} value={at}>
                            {t(`pages.tags.rules.actionTypes.${at}`, at)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {/* Target Tag Code */}
              <div className="space-y-1.5">
                <Label required>{t('pages.tags.rules.targetTag', 'Target Tag')}</Label>
                <Controller
                  name="target_tag_code"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('pages.tags.rules.selectTag', 'Select tag')} />
                      </SelectTrigger>
                      <SelectContent
                        searchable
                        searchPlaceholder={t('pages.tags.searchTags', 'Search tags...')}
                      >
                        {tagCodeOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.target_tag_code && (
                  <p className="text-error-500 text-xs">{errors.target_tag_code.message}</p>
                )}
              </div>
            </div>

            {/* Replace Tag Code (if replace_tag) */}
            {actionType === 'replace_tag' && (
              <div className="space-y-1.5">
                <Label>{t('pages.tags.rules.replaceTag', 'Replace With Tag')}</Label>
                <Controller
                  name="replace_tag_code"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('pages.tags.rules.selectTag', 'Select tag')} />
                      </SelectTrigger>
                      <SelectContent
                        searchable
                        searchPlaceholder={t('pages.tags.searchTags', 'Search tags...')}
                      >
                        {tagCodeOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Priority */}
              <div className="space-y-1.5">
                <Label htmlFor="rule-priority">{t('pages.tags.rules.priority', 'Priority')}</Label>
                <Input
                  id="rule-priority"
                  type="number"
                  {...register('priority', { valueAsNumber: true })}
                  placeholder="1"
                  error={errors.priority?.message}
                  helperText={t('pages.tags.rules.priorityHelp', '1-1000, lower = higher priority')}
                />
              </div>

              {/* Is Active */}
              <div className="space-y-1.5">
                <Label>{t('pages.tags.rules.isActive', 'Active')}</Label>
                <div className="flex h-[45px] items-center">
                  <Controller
                    name="is_active"
                    control={control}
                    render={({ field }) => (
                      <ToggleSwitch
                        checked={field.value ?? true}
                        onChange={field.onChange}
                        ariaLabel={t('pages.tags.rules.isActive', 'Active')}
                      />
                    )}
                  />
                </div>
              </div>
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
