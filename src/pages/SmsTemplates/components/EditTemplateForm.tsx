/**
 * EditTemplateForm Component
 *
 * Form for editing an existing SMS template.
 */

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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

const editTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  messageText: z.string().min(1, 'Message text is required'),
  category: z.enum(['Payment Reminder', 'Urgent Contact', 'General']),
})

type EditTemplateFormData = z.infer<typeof editTemplateSchema>

interface EditTemplateFormProps {
  template: SmsTemplate
  onSuccess: () => void
  onCancel?: () => void
}

export function EditTemplateForm({ template, onSuccess }: EditTemplateFormProps) {
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
    // TODO: Replace with actual API call
    console.log('Updating template:', template.id, data)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500))
    onSuccess()
  }

  return (
    <form id="edit-template-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Template Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Template Name</Label>
        <Input
          id="name"
          {...register('name')}
          placeholder="Enter template name"
          error={errors.name?.message}
        />
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Controller
          name="category"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Payment Reminder">Payment Reminder</SelectItem>
                <SelectItem value="Urgent Contact">Urgent Contact</SelectItem>
                <SelectItem value="General">General</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        {errors.category && <p className="text-xs text-red-500">{errors.category.message}</p>}
      </div>

      {/* Message Text */}
      <div className="space-y-2">
        <Label htmlFor="messageText">Message Text</Label>
        <Textarea
          id="messageText"
          {...register('messageText')}
          placeholder="Enter message text. Use {variable_name} for variables."
          rows={6}
          error={errors.messageText?.message}
        />
        <p className="text-xs text-gray-500">
          Use {'{variable_name}'} format for variables (e.g., {'{debt_amount}'}, {'{client_name}'})
        </p>
      </div>

      {/* System Template Warning */}
      {template.isSystem && (
        <Alert variant="warning">
          <AlertTitle>System Template</AlertTitle>
          <AlertDescription>
            This is a system template. Some fields may be restricted.
          </AlertDescription>
        </Alert>
      )}

      {/* Error Alert */}
      {Object.keys(errors).length > 0 && (
        <Alert variant="error">
          <AlertTitle>Please fix the errors above before submitting.</AlertTitle>
        </Alert>
      )}
    </form>
  )
}
