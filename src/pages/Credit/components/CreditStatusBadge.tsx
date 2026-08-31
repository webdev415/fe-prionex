/**
 * Бейдж статуса заявки/кредита.
 *
 * Не переиспользует `ui/StatusBadge`: тот знает закрытый список статусов
 * пользователей CRM (active/disabled/…), а у модуля свой словарь. Внешний вид
 * повторён один в один — пилюля с точкой и теми же палитрами.
 */
import { useTranslation } from 'react-i18next'

type Tone = 'default' | 'ok' | 'warn' | 'danger' | 'accent'

const TONES: Record<string, Tone> = {
  // заявки
  in_progress: 'default',
  scoring: 'accent',
  referred: 'warn',
  approved: 'ok',
  contracted: 'ok',
  disbursed: 'ok',
  declined: 'danger',
  expired: 'danger',
  abandoned: 'default',
  // кредиты
  active: 'ok',
  delinquent: 'danger',
  closed: 'default',
  cancelled: 'danger',
  written_off: 'danger',
  charged_off: 'danger',
  // очередь ручного разбора: та же шкала «ждёт → в работе → закрыто», что у
  // заявок. Без этих трёх строк все позиции очереди рисовались серым
  // `default`, и «Очікує» ничем не отличалось от «Розібрано» — бейдж переставал
  // быть бейджем.
  pending: 'warn',
  in_review: 'accent',
  done: 'ok',
  // взносы графика
  scheduled: 'default',
  paid: 'ok',
  partially_paid: 'warn',
  overdue: 'danger',
}

const TONE_CLASS: Record<Tone, string> = {
  default: 'bg-muted text-muted-foreground',
  ok: 'bg-success-100 text-success-700',
  warn: 'bg-warning-100 text-warning-800',
  danger: 'bg-error-100 text-error-700',
  accent: 'bg-information-100 text-information-700',
}

interface CreditStatusBadgeProps {
  status: string
  /** Пространство переводов: credit.status.* для заявок, credit.loanStatus.* для кредитов. */
  namespace?: 'status' | 'loanStatus' | 'scheduleStatus' | 'queueStatus'
  className?: string
}

export function CreditStatusBadge({
  status,
  namespace = 'status',
  className,
}: CreditStatusBadgeProps) {
  const { t } = useTranslation('common')
  const tone = TONES[status] ?? 'default'
  return (
    <span
      className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${TONE_CLASS[tone]} ${className ?? ''}`}
    >
      <span className="h-2 w-2 rounded-full bg-current opacity-70" />
      {t(`credit.${namespace}.${status}`, status)}
    </span>
  )
}

export default CreditStatusBadge
