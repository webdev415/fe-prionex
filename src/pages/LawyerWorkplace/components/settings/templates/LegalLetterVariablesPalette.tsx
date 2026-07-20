import { useTranslation } from 'react-i18next'
import { LEGAL_LETTER_TEMPLATE_VARIABLES } from '@/features/lawyerWorkplace/utils/letterTemplateVariables'
import { cn } from '@/lib/utils'

interface LegalLetterVariablesPaletteProps {
  onInsert: (variableName: string) => void
  disabled?: boolean
  className?: string
}

export function LegalLetterVariablesPalette({
  onInsert,
  disabled = false,
  className,
}: LegalLetterVariablesPaletteProps) {
  const { t } = useTranslation('common')

  return (
    <div
      className={cn(
        'border-border bg-card text-muted-foreground rounded-xl border p-4 text-sm',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="text-foreground font-medium">
          {t('pages.lawyerWorkplace.settings.templates.availableVariables', 'Available variables')}
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-success-500 h-2 w-2 rounded-full" />
          <span className="text-success-500 text-xs font-medium">
            {t('pages.smsTemplates.forms.active', 'Active')}
          </span>
        </div>
      </div>
      <p className="text-muted-foreground mt-2 text-[11px]">
        {t(
          'pages.lawyerWorkplace.settings.templates.variablesHint',
          'Click a variable to insert it at the cursor in the template body.'
        )}
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {LEGAL_LETTER_TEMPLATE_VARIABLES.map((variable) => (
          <button
            key={variable.name}
            type="button"
            disabled={disabled}
            onClick={() => onInsert(variable.name)}
            className="text-foreground hover:bg-primary/10 flex items-start gap-4 rounded-lg px-2 py-1.5 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <code className="bg-muted w-44 shrink-0 rounded px-2 py-1 font-mono">
              {`{{${variable.name}}}`}
            </code>
            <span className="flex-1 self-center font-medium">
              {t(
                `pages.lawyerWorkplace.settings.templates.variables.${variable.labelKey}`,
                variable.name
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
