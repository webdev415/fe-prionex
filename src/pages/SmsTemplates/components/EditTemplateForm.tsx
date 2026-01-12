/**
 * EditTemplateForm Component
 *
 * Form for editing an existing SMS template.
 */

import { useForm, Controller } from 'react-hook-form'
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
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/Alert'
import type { SmsTemplate } from '../types'
import { useUpdateTemplate } from '@/features/sms'
import { getErrorMessage } from '@/lib/errors'

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

  const editTemplateSchema = z.object({
    name: z.string().min(1, t('pages.smsTemplates.forms.validation.templateNameRequired')),
    messageText: z.string().min(1, t('pages.smsTemplates.forms.validation.messageTextRequired')),
    category: z.enum(['Payment Reminder', 'Urgent Contact', 'General']),
  })

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<EditTemplateFormData>({
    resolver: zodResolver(editTemplateSchema),
    defaultValues: {
      name: template.name,
      messageText: template.messageText,
      category: template.category as 'Payment Reminder' | 'Urgent Contact' | 'General',
    },
  })

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
        {errors.category && <p className="text-xs text-red-500">{errors.category.message}</p>}
      </div>

      {/* Message Text */}
      <div className="space-y-2">
        <Label htmlFor="messageText">{t('pages.smsTemplates.forms.messageText')}</Label>
        <Textarea
          id="messageText"
          {...register('messageText')}
          placeholder={t('pages.smsTemplates.forms.placeholders.enterMessageText')}
          rows={6}
          error={errors.messageText?.message}
        />
        <p className="text-xs text-gray-500">{t('pages.smsTemplates.forms.useVariableFormat')}</p>
      </div>

      {/* System Template Warning */}
      {template.isSystem && (
        <Alert variant="warning">
          <AlertTitle>{t('pages.smsTemplates.forms.systemTemplate')}</AlertTitle>
          <AlertDescription>
            {t('pages.smsTemplates.forms.systemTemplateDescription')}
          </AlertDescription>
        </Alert>
      )}

      {/* Error Alert */}
      {Object.keys(errors).length > 0 && (
        <Alert variant="error">
          <AlertTitle>{t('pages.smsTemplates.forms.fixErrorsBeforeSubmitting')}</AlertTitle>
        </Alert>
      )}
    </form>
  )
}
