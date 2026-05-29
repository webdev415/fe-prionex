import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { MESSAGING_AVAILABLE_VARIABLES } from '../utils/messagingTemplateVariables'

interface MessagingVariablesPaletteProps {
  onInsert: (variableName: string) => void
  disabled?: boolean
  className?: string
}

export function MessagingVariablesPalette({
  onInsert,
  disabled = false,
  className,
}: MessagingVariablesPaletteProps) {
  const { t } = useTranslation('common')

  return (
    <div
      className={cn(
        'rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="text-dark-500 font-medium">
          {t('pages.smsTemplates.forms.availableVariables', 'Available variables')}
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-success-500 h-2 w-2 rounded-full" />
          <span className="text-success-500 text-xs font-medium">
            {t('pages.smsTemplates.forms.active', 'Active')}
          </span>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {MESSAGING_AVAILABLE_VARIABLES.map((variable) => (
          <button
            key={variable.name}
            type="button"
            disabled={disabled}
            onClick={() => onInsert(variable.name)}
            className="text-dark-500 hover:bg-primary-50 flex items-start gap-4 rounded-lg px-2 py-1.5 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <code className="w-44 shrink-0 rounded bg-gray-100 px-2 py-1 font-mono">
              {`{{${variable.name}}}`}
            </code>
            <span className="flex-1 self-center font-medium">
              {t(`pages.smsTemplates.variables.${variable.key}`)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
