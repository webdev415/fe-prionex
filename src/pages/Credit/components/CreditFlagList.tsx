/**
 * Список признаков «что-то не так» в заявке.
 *
 * Две группы РАЗДЕЛЬНО и с разными подписями: «дані суперечать» требует
 * разобраться, кому верить, «даних не вистачає» — дособрать. Смешать их в один
 * значок означало бы обесценить оба: оператор перестал бы читать.
 */
import { useTranslation } from 'react-i18next'
import type { CreditApplicationFlag } from '@/features/credit/api/applicantFlags'

const SEVERITY_CLASS: Record<string, string> = {
  danger: 'bg-error-100 text-error-700',
  warn: 'bg-warning-100 text-warning-800',
}

function Group({ titleKey, flags }: { titleKey: string; flags: CreditApplicationFlag[] }) {
  const { t } = useTranslation('common')
  if (flags.length === 0) return null
  return (
    <div className="mb-3">
      <div className="text-muted-foreground mb-1.5 text-xs font-medium">{t(titleKey)}</div>
      <div className="flex flex-wrap gap-2">
        {flags.map((flag) => (
          <span
            key={flag.id}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${SEVERITY_CLASS[flag.severity]}`}
          >
            {t(flag.labelKey, flag.values)}
          </span>
        ))}
      </div>
    </div>
  )
}

export function CreditFlagList({ flags }: { flags: CreditApplicationFlag[] }) {
  if (flags.length === 0) return null
  return (
    <div className="mb-4">
      <Group
        titleKey="credit.flags.conflictTitle"
        flags={flags.filter((flag) => flag.kind === 'conflict')}
      />
      <Group
        titleKey="credit.flags.missingTitle"
        flags={flags.filter((flag) => flag.kind === 'missing')}
      />
    </div>
  )
}

export default CreditFlagList
