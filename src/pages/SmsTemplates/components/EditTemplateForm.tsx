/**
 * EditTemplateForm Component
 *
 * Form for editing an existing SMS template with variable detection and insertion.
 */

import { useMemo, useRef } from 'react'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Alert, AlertTitle } from '@/components/ui/Alert'
import { Icons } from '@/lib/icons'
import type { SmsTemplate } from '../types'
import { useUpdateTemplate } from '@/features/sms'
import { getErrorMessage } from '@/lib/errors'

// Available SMS template variables - descriptions will be translated in component
const AVAILABLE_VARIABLES = [
  { name: 'client_name', key: 'clientFirstName' },
  { name: 'debt_amount', key: 'currentDebtAmount' },
  { name: 'operator_name', key: 'operatorName' },
  { name: 'operator_phone', key: 'operatorPhone' },
  { name: 'due_date', key: 'paymentDueDate' },
  { name: 'contract_number', key: 'contractLoanNumber' },
] as const

type EditTemplateFormData = {
  name: string
  messageText: string
  category: 'Payment Reminder' | 'Urgent Contact' | 'General'
}

interface EditTemplateFormProps {
  template: SmsTemplate
  onSuccess: () => void
  onCancel?: () => void
}

export function EditTemplateForm({ template, onSuccess }: EditTemplateFormProps) {
  const { t } = useTranslation('common')
  const updateTemplateMutation = useUpdateTemplate()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const editTemplateSchema = z.object({
    name: z.string().min(1, t('pages.smsTemplates.forms.validation.templateNameRequired')),
    messageText: z.string().min(1, t('pages.smsTemplates.forms.validation.messageTextRequired')),
    category: z.enum(['Payment Reminder', 'Urgent Contact', 'General']),
  })

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<EditTemplateFormData>({
    resolver: zodResolver(editTemplateSchema),
    defaultValues: {
      name: template.name,
      messageText: template.messageText,
      category: template.category as 'Payment Reminder' | 'Urgent Contact' | 'General',
    },
  })

  // Watch message text for variable detection
  const watchedMessageText = useWatch({
    control,
    name: 'messageText',
  })

  // Detect variables in message text
  const detectedVariables = useMemo(() => {
    if (!watchedMessageText) return []
    const variableRegex = /\{([^}]+)\}/g
    const matches = watchedMessageText.matchAll(variableRegex)
    const variables = Array.from(matches, (match) => match[1])
    return Array.from(new Set(variables)) // Remove duplicates
  }, [watchedMessageText])

  // Insert variable into message text at cursor position
  const insertVariable = (variableName: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = watchedMessageText || ''
    const variable = `{${variableName}}`

    const newText = text.substring(0, start) + variable + text.substring(end)
    setValue('messageText', newText, { shouldValidate: true })

    // Set cursor position after inserted variable
    setTimeout(() => {
      textarea.focus()
      const newPosition = start + variable.length
      textarea.setSelectionRange(newPosition, newPosition)
    }, 0)
  }

  const onSubmit = async (data: EditTemplateFormData) => {
    try {
      await updateTemplateMutation.mutateAsync({
        templateId: template.id,
        template: {
          name: data.name,
          message_text: data.messageText,
          category: data.category,
        },
      })
      toast.success(
        t('pages.smsTemplates.messages.templateUpdated') || 'Template updated successfully'
      )
      onSuccess()
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <form id="edit-template-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Template Name */}
      <div className="space-y-2">
        <Label htmlFor="name">{t('pages.smsTemplates.forms.templateName')}</Label>
        <Input
          id="name"
          {...register('name')}
          placeholder={t('pages.smsTemplates.forms.placeholders.enterTemplateName')}
          error={errors.name?.message}
        />
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label htmlFor="category">{t('pages.smsTemplates.forms.category')}</Label>
        <Controller
          name="category"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="category">
                <SelectValue
                  placeholder={t('pages.smsTemplates.forms.placeholders.selectCategory')}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Payment Reminder">
                  {t('pages.smsTemplates.categories.paymentReminder')}
                </SelectItem>
                <SelectItem value="Urgent Contact">
                  {t('pages.smsTemplates.categories.urgentContact')}
                </SelectItem>
                <SelectItem value="General">
                  {t('pages.smsTemplates.categories.general')}
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        {errors.category && <p className="text-error-500 text-xs">{errors.category.message}</p>}
      </div>

      {/* Message Text */}
      <div className="flex flex-col items-start gap-2 self-stretch">
        <Label htmlFor="messageText" className="text-foreground text-sm font-medium">
          {t('pages.smsTemplates.forms.messageText')}
          <span className="text-error-500 ml-1">*</span>
        </Label>
        <Controller
          name="messageText"
          control={control}
          render={({ field }) => (
            <Textarea
              {...field}
              ref={(e) => {
                textareaRef.current = e
                field.ref(e)
              }}
              id="messageText"
              placeholder={t('pages.smsTemplates.forms.placeholders.enterMessageText')}
              rows={6}
              error={errors.messageText?.message}
            />
          )}
        />
      </div>

      {/* Variables Detected */}
      {detectedVariables.length > 0 && (
        <div className="flex flex-col items-start gap-2 self-stretch">
          <Label className="text-foreground text-sm font-medium">
            {t('pages.smsTemplates.forms.variablesDetected')}:
          </Label>
          <div className="flex flex-wrap gap-2">
            {detectedVariables.map((variable) => (
              <button
                key={variable}
                type="button"
                className="text-foreground bg-card hover:bg-muted inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
              >
                <span>{`{${variable}}`}</span>
                <Icons.PlusSignCircle size={18} className="text-secondary-800" strokeWidth={1.5} />
              </button>
            ))}
          </div>
          <span className="text-muted-foreground w-full text-right text-sm font-light">
            {t('pages.smsTemplates.forms.clickToInsert')}
          </span>
        </div>
      )}

      {/* Available Variables */}
      <div className="flex flex-col items-start gap-2 self-stretch">
        <div className="flex items-start justify-between self-stretch">
          <Label className="text-foreground text-sm font-medium">
            {t('pages.smsTemplates.forms.availableVariables')}:
          </Label>
          <div className="flex items-center justify-center gap-2.5">
            <span className="bg-success-500 h-2 w-2 rounded-full" />
            <span className="text-success-500 text-xs font-medium">
              {t('pages.smsTemplates.forms.active')}
            </span>
          </div>
        </div>
        <div className="border-border bg-card/50 flex flex-col items-start justify-center gap-3 self-stretch rounded-xl border p-5 px-6">
          {AVAILABLE_VARIABLES.map((variable) => (
            <button
              key={variable.name}
              type="button"
              onClick={() => insertVariable(variable.name)}
              className="text-foreground hover:bg-muted flex items-start gap-6 self-stretch rounded-lg px-1 py-0.5 text-left text-xs transition-colors hover:cursor-pointer"
            >
              <span className="w-[130px] font-light">{`{${variable.name}}`}</span>
              <span className="flex-1 font-medium">
                {t(`pages.smsTemplates.variables.${variable.key}`)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* System Template Warning */}

      {/* Error Alert */}
      {Object.keys(errors).length > 0 && (
        <Alert variant="error">
          <AlertTitle>{t('pages.smsTemplates.forms.fixErrorsBeforeSubmitting')}</AlertTitle>
        </Alert>
      )}
    </form>
  )
}
