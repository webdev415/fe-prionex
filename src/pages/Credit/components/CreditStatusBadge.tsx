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
  // Тона взяты из макета Figma «Techno-Finance» (fileKey yiiOBaBswSaXYF61nBuPnj,
  // фрейм «Credit status» 4255:36203) — там девять состояний с цветом и знаком:
  // зелёное «Схвалено»/«Гроші видані», красное «Відхилено»/«Прострочено»,
  // нейтральное с часами «Очікує рішення»/«Очікує на відправку коштів».
  // Язык цвета оттуда, набор значений — наш: продукт другой, а правило
  // «ждём — нейтральное, сделано — зелёное, беда — красное» общее.
  //
  // заявки
  draft: 'default',
  in_progress: 'default',
  identity_check: 'accent',
  data_collection: 'accent',
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
  // Деньги ещё не ушли — это ожидание, а не готовность: в макете отдельное
  // состояние «Очікує на відправку коштів» с часами.
  pending_disbursement: 'accent',
  // ⚠️ Обе беды с деньгами были СЕРЫМИ — теми же, что «закрыт». Оператор не
  // отличал кредит, где деньги не дошли до клиента, от завершённого.
  disbursement_failed: 'danger',
  funding_exception: 'danger',
  delinquent: 'danger',
  // Особые режимы обслуживания: не беда и не норма — требуют внимания.
  forbearance: 'warn',
  protected: 'warn',
  closed: 'default',
  withdrawn: 'default',
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
