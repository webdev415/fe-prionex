/**
 * CreateTemplateForm Component
 *
 * Form for creating a new SMS template with variable detection and insertion.
 */

import { useMemo, useRef } from 'react'
import { useForm, Controller, useWatch } from 'react-hook-form'
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
import { Alert } from '@/components/ui/Alert'
import { Icons } from '@/lib/icons'

const createTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  messageText: z.string().min(1, 'Message text is required'),
  category: z.enum(['Payment Reminder', 'Urgent Contact', 'General']),
})

type CreateTemplateFormData = z.infer<typeof createTemplateSchema>

interface CreateTemplateFormProps {
  onSuccess: () => void
  onCancel?: () => void
}

// Available SMS template variables
const AVAILABLE_VARIABLES = [
  { name: 'client_name', description: "Client's first name" },
  { name: 'debt_amount', description: 'Current debt amount' },
  { name: 'operator_name', description: "Operator's name" },
  { name: 'operator_phone', description: "Operator's phone" },
  { name: 'due_date', description: 'Payment due date' },
  { name: 'contract_number', description: 'Contract/Loan number' },
] as const

// Cyrillic character limit for SMS
const CYRILLIC_SMS_LIMIT = 70

export function CreateTemplateForm({ onSuccess }: CreateTemplateFormProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<CreateTemplateFormData>({
    resolver: zodResolver(createTemplateSchema),
    defaultValues: {
      category: 'General',
      messageText: '',
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

  // Calculate character count
  const characterCount = useMemo(() => {
    return watchedMessageText?.length || 0
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

  const onSubmit = async (data: CreateTemplateFormData) => {
    // TODO: Replace with actual API call
    console.log('Creating template:', data)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500))
    onSuccess()
  }

  return (
    <form id="create-template-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Template Name */}
      <div className="flex flex-col items-start gap-2 self-stretch">
        <Label htmlFor="name" className="text-dark-500 text-sm font-medium">
          Template Name<span className="text-error-500 ml-1">*</span>
        </Label>
        <Input
          id="name"
          {...register('name')}
          placeholder="Enter template name"
          error={errors.name?.message}
        />
      </div>

      {/* Category */}
      <div className="flex flex-col items-start gap-2 self-stretch">
        <Label htmlFor="category" className="text-dark-500 text-sm font-medium">
          Category:
        </Label>
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
      <div className="flex flex-col items-start gap-2 self-stretch">
        <Label htmlFor="messageText" className="text-dark-500 text-sm font-medium">
          Message Text<span className="text-error-500 ml-1">*</span>
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
              placeholder="Enter message text. Use {variable_name} for variables."
              rows={6}
              error={errors.messageText?.message}
            />
          )}
        />
        {/* Character Counter */}
        <div className="flex items-center justify-end gap-1 self-stretch">
          <span className="bg-success-500 h-2 w-2 rounded-full" />
          <span className="text-dark-500 text-sm font-light">
            {characterCount}/{CYRILLIC_SMS_LIMIT} characters(Cyrillic limit: {CYRILLIC_SMS_LIMIT})
          </span>
        </div>
      </div>

      {/* Variables Detected */}
      {detectedVariables.length > 0 && (
        <div className="flex flex-col items-start gap-2 self-stretch">
          <Label className="text-dark-500 text-sm font-medium">Variables Detected:</Label>
          <div className="flex flex-wrap gap-2">
            {detectedVariables.map((variable) => (
              <button
                key={variable}
                type="button"
                className="text-dark-500 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium transition-colors hover:bg-gray-50"
              >
                <span>{`{${variable}}`}</span>
                <Icons.PlusSignCircle size={18} className="text-secondary-800" strokeWidth={1.5} />
              </button>
            ))}
          </div>
          <span className="text-dark-500 w-full text-right text-sm font-light">
            Click to insert
          </span>
        </div>
      )}

      {/* Available Variables */}
      <div className="flex flex-col items-start gap-2 self-stretch">
        <div className="flex items-start justify-between self-stretch">
          <Label className="text-dark-500 text-sm font-medium">Available Variables:</Label>
          <div className="flex items-center justify-center gap-2.5">
            <span className="bg-success-500 h-2 w-2 rounded-full" />
            <span className="text-success-500 text-xs font-medium">Active</span>
          </div>
        </div>
        <div className="flex flex-col items-start justify-center gap-3 self-stretch rounded-xl border border-white bg-white/50 p-5 px-6">
          {AVAILABLE_VARIABLES.map((variable) => (
            <button
              key={variable.name}
              type="button"
              onClick={() => insertVariable(variable.name)}
              className="text-dark-500 flex items-start gap-6 self-stretch text-left text-xs transition-colors hover:cursor-pointer"
            >
              <span className="w-[130px] font-light">{`{${variable.name}}`}</span>
              <span className="flex-1 font-medium">{variable.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Error Alert */}
      {Object.keys(errors).length > 0 && (
        <Alert variant="error" title="Please fix the errors above before submitting." />
      )}
    </form>
  )
}
