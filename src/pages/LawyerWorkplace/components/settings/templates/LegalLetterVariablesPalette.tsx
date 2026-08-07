import { useTranslation } from 'react-i18next'
import {
  LEGAL_LETTER_TEMPLATE_VARIABLES,
  LEGAL_LETTER_VARIABLE_GROUP_ORDER,
} from '@/features/lawyerWorkplace/utils/letterTemplateVariables'
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

      <div className="mt-3 flex flex-col gap-4">
        {LEGAL_LETTER_VARIABLE_GROUP_ORDER.map((group) => {
          const variables = LEGAL_LETTER_TEMPLATE_VARIABLES.filter(
            (variable) => variable.group === group
          )
          if (variables.length === 0) return null

          return (
            <div key={group} className="flex flex-col gap-2">
              <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                {t(`pages.lawyerWorkplace.settings.templates.variableGroups.${group}`, group)}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {variables.map((variable) => (
                  <button
                    key={variable.name}
                    type="button"
                    disabled={disabled}
                    onClick={() => onInsert(variable.name)}
                    title={t(
                      `pages.lawyerWorkplace.settings.templates.variableDescriptions.${variable.name}`,
                      ''
                    )}
                    className="text-foreground hover:bg-primary/10 border-border flex items-center gap-2 rounded-lg border px-2 py-1 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-[11px]">
                      {`{{${variable.name}}}`}
                    </code>
                    <span className="font-medium">
                      {t(
                        `pages.lawyerWorkplace.settings.templates.variables.${variable.name}`,
                        variable.name
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
