/**
 * ViewTemplateForm Component
 *
 * Read-only form for viewing SMS template details.
 */

import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { SmsTemplate } from '../types'

interface ViewTemplateFormProps {
  template: SmsTemplate
}

export function ViewTemplateForm({ template }: ViewTemplateFormProps) {
  const { t } = useTranslation('common')

  return (
    <div className="space-y-6">
      {/* Template Name */}
      <div className="space-y-2">
        <Label>{t('pages.smsTemplates.forms.templateName')}</Label>
        <div className="text-foreground border-border bg-muted rounded-md border px-3 py-2 text-sm">
          {template.name}
        </div>
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label>{t('pages.smsTemplates.forms.category')}</Label>
        <div className="text-foreground border-border bg-muted rounded-md border px-3 py-2 text-sm">
          {template.category}
        </div>
      </div>

      {/* Status */}
      <div className="space-y-2">
        <Label>{t('pages.smsTemplates.forms.status')}</Label>
        <div>
          <StatusBadge status={template.isEnabled ? 'active' : 'disabled'} />
        </div>
      </div>

      {/* Variables */}
      <div className="space-y-2">
        <Label>
          {t('pages.smsTemplates.forms.variables')} ({template.variables.length})
        </Label>
        <div className="flex flex-wrap gap-2">
          {template.variables.map((variable, index) => (
            <span
              key={index}
              className="text-foreground bg-muted inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
            >
              {'{' + variable + '}'}
            </span>
          ))}
        </div>
      </div>

      {/* Usage Count */}
      <div className="space-y-2">
        <Label>{t('pages.smsTemplates.forms.usageCount')}</Label>
        <div className="text-foreground border-border bg-muted rounded-md border px-3 py-2 text-sm">
          {template.usageCount} {t('pages.smsTemplates.times')}
        </div>
      </div>

      {/* Message Text */}
      <div className="space-y-2">
        <Label>{t('pages.smsTemplates.forms.messageText')}</Label>
        <Textarea value={template.messageText} readOnly rows={6} className="bg-muted" />
      </div>
    </div>
  )
}
