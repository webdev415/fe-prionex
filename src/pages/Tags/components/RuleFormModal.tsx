/**
 * RuleFormModal Component
 *
 * Modal for creating and editing tag automation rules.
 * Supports event-based, schedule-based, and other trigger types.
 */

import { useEffect, useCallback, useMemo } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
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

const TRIGGER_TYPE_VALUES: RuleTriggerType[] = [
  'event',
  'schedule',
  'tag_expired',
  'scoring_change',
  'import_complete',
]
const ACTION_TYPE_VALUES: RuleActionType[] = ['add_tag', 'remove_tag', 'replace_tag']
const RULE_OPERATOR_VALUES = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in', 'not_in']
const CONDITION_FIELD_OPTIONS = [
  { value: 'risk_score', label: 'risk_score' },
  { value: 'days_past_due', label: 'days_past_due' },
  { value: 'total_debt', label: 'total_debt' },
  { value: 'remaining_debt', label: 'remaining_debt' },
  { value: 'debt_count', label: 'debt_count' },
  { value: 'status', label: 'status' },
  { value: 'has_tag', label: 'has_tag' },
  { value: 'not_has_tag', label: 'not_has_tag' },
]

const RULE_PRESETS = [
  {
    key: 'auto_high_risk',
    name: 'Auto-tag High Risk',
    description: 'Automatically tag clients as high risk when scoring exceeds threshold',
    trigger_type: 'scoring_change' as RuleTriggerType,
    conditions: [{ field: 'risk_score', op: 'gte', value: '80' }],
    action_type: 'add_tag' as RuleActionType,
    target_tag_code: 'high_risk',
  },
  {
    key: 'remove_high_risk',
    name: 'Remove High Risk',
    description: 'Remove high risk tag when scoring drops below threshold',
    trigger_type: 'scoring_change' as RuleTriggerType,
    conditions: [{ field: 'risk_score', op: 'lt', value: '80' }],
    action_type: 'remove_tag' as RuleActionType,
    target_tag_code: 'high_risk',
  },
  {
    key: 'mark_active_debtor',
    name: 'Mark Active Debtors',
    description: 'Daily: tag clients with past-due balances as active debtors',
    trigger_type: 'schedule' as RuleTriggerType,
    cron_expression: '0 6 * * *',
    conditions: [{ field: 'days_past_due', op: 'gt', value: '0' }],
    action_type: 'add_tag' as RuleActionType,
    target_tag_code: 'active_debtor',
  },
  {
    key: 'mark_paid_off',
    name: 'Mark Paid Off',
    description: 'Tag client as paid off when full payment is received',
    trigger_type: 'event' as RuleTriggerType,
    trigger_event: 'payment.completed',
    conditions: [{ field: 'remaining_debt', op: 'eq', value: '0' }],
    action_type: 'add_tag' as RuleActionType,
    target_tag_code: 'paid_off',
  },
  {
    key: 'broken_promise',
    name: 'Broken Promise to Pay',
    description:
      'Daily: replace promise_to_pay with refuses_to_pay when client has promise tag and >30 days past due',
    trigger_type: 'schedule' as RuleTriggerType,
    cron_expression: '0 8 * * *',
    conditions: [
      { field: 'has_tag', op: 'eq', value: 'promise_to_pay' },
      { field: 'days_past_due', op: 'gt', value: '30' },
    ],
    action_type: 'replace_tag' as RuleActionType,
    target_tag_code: 'refuses_to_pay',
    replace_tag_code: 'promise_to_pay',
  },
  {
    key: 'no_contact_retry',
    name: 'Retry No Contact',
    description: 'Daily: clear no_contact tag after 7+ days past due to retry contact attempts',
    trigger_type: 'schedule' as RuleTriggerType,
    cron_expression: '0 9 * * *',
    conditions: [
      { field: 'has_tag', op: 'eq', value: 'no_contact' },
      { field: 'days_past_due', op: 'gt', value: '7' },
    ],
    action_type: 'remove_tag' as RuleActionType,
    target_tag_code: 'no_contact',
  },
]

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
  const { t } = useTranslation('common')
  const isEdit = !!rule

  const createMutation = useCreateRule()
  const updateMutation = useUpdateRule()

  const ruleSchema = useMemo(
    () =>
      z.object({
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
        cron_expression: z
          .string()
          .optional()
          .default('')
          .refine(
            (val) => !val || /^(\S+\s){4}\S+$/.test(val.trim()),
            t(
              'pages.tags.rules.validation.cronInvalid',
              'Invalid cron expression (expected 5-part format)'
            )
          ),
        conditions: z.array(
          z.object({
            field: z
              .string()
              .min(1, t('pages.tags.rules.validation.fieldRequired', 'Field is required')),
            op: z
              .string()
              .min(1, t('pages.tags.rules.validation.operatorRequired', 'Operator is required')),
            value: z.string(),
          })
        ),
        action_type: z.enum(['add_tag', 'remove_tag', 'replace_tag']),
        target_tag_code: z
          .string()
          .min(1, t('pages.tags.rules.validation.targetRequired', 'Target tag is required')),
        replace_tag_code: z.string().optional().default(''),
        priority: z.coerce.number().int().min(1).max(1000).default(100),
        is_active: z.boolean().default(true),
      }),
    [t]
  )

  const {
    register,
    handleSubmit,
    control,
    watch,
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
      priority: 100,
      is_active: true,
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'conditions' })

  const triggerType = watch('trigger_type') // eslint-disable-line react-hooks/incompatible-library
  const actionType = watch('action_type')

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
        priority: rule?.priority ?? 0,
        is_active: rule?.is_active ?? true,
      })
    }
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
                      reset({
                        name: preset.name,
                        description: preset.description,
                        trigger_type: preset.trigger_type,
                        trigger_event: preset.trigger_event ?? '',
                        cron_expression: preset.cron_expression ?? '',
                        conditions: preset.conditions,
                        action_type: preset.action_type,
                        target_tag_code: preset.target_tag_code,
                        replace_tag_code: preset.replace_tag_code ?? '',
                        priority: 100,
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
                placeholder={t('pages.tags.rules.namePlaceholder', 'e.g. Auto-tag overdue clients')}
                error={errors.name?.message}
              />
            </div>

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
              </div>

              {/* Trigger Event (if event) */}
              {triggerType === 'event' && (
                <div className="space-y-1.5">
                  <Label htmlFor="rule-event">
                    {t('pages.tags.rules.triggerEvent', 'Event Name')}
                  </Label>
                  <Input
                    id="rule-event"
                    {...register('trigger_event')}
                    placeholder={t(
                      'pages.tags.rules.triggerEventPlaceholder',
                      'e.g. client.payment_missed'
                    )}
                    error={errors.trigger_event?.message}
                  />
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
                </div>
              )}
            </div>

            {/* Conditions */}
            <div className="space-y-1.5">
              <Label>{t('pages.tags.rules.conditions', 'Conditions')}</Label>
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
                                  {t(`pages.tags.rules.conditionFields.${opt.value}`, opt.label)}
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
                    <Input
                      inputSize="sm"
                      className="h-9 text-xs"
                      placeholder={t('pages.tags.rules.valuePlaceholder', 'e.g. 80')}
                      {...register(`conditions.${index}.value`)}
                    />
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
                  placeholder="0"
                  error={errors.priority?.message}
                  helperText={t(
                    'pages.tags.rules.priorityHelp',
                    '0-1000, lower number = higher priority'
                  )}
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
