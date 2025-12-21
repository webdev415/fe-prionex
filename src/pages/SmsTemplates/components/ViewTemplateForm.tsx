/**
 * ViewTemplateForm Component
 *
 * Read-only form for viewing SMS template details.
 */

import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { SmsTemplate } from '../types'

interface ViewTemplateFormProps {
  template: SmsTemplate
}

export function ViewTemplateForm({ template }: ViewTemplateFormProps) {
  return (
    <div className="space-y-6">
      {/* Template Name */}
      <div className="space-y-2">
        <Label>Template Name</Label>
        <div className="text-dark-500 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm">
          {template.name}
        </div>
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label>Category</Label>
        <div className="text-dark-500 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm">
          {template.category}
        </div>
      </div>

      {/* Status */}
      <div className="space-y-2">
        <Label>Status</Label>
        <div>
          <StatusBadge status={template.isEnabled ? 'active' : 'disabled'} />
          {template.isSystem && (
            <span className="ml-2 text-xs text-gray-500">(System Template)</span>
          )}
        </div>
      </div>

      {/* Variables */}
      <div className="space-y-2">
        <Label>Variables ({template.variables.length})</Label>
        <div className="flex flex-wrap gap-2">
          {template.variables.map((variable, index) => (
            <span
              key={index}
              className="text-dark-500 inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium"
            >
              {'{' + variable + '}'}
            </span>
          ))}
        </div>
      </div>

      {/* Usage Count */}
      <div className="space-y-2">
        <Label>Usage Count</Label>
        <div className="text-dark-500 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm">
          {template.usageCount} times
        </div>
      </div>

      {/* Message Text */}
      <div className="space-y-2">
        <Label>Message Text</Label>
        <Textarea value={template.messageText} readOnly rows={6} className="bg-gray-50" />
      </div>
    </div>
  )
}
