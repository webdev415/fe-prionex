/**
 * «Показані правові тексти» — какие правовые тексты сайта клиент видел до
 * подачи заявки (след 18-4a, поле карточки `legal_texts_shown`).
 *
 * Читатель — комплаенс, отвечающий регулятору «что было на экране у клиента»:
 * ключ строки CMS не переводится (по нему сверяют с журналом CMS), порядок —
 * как прислал модуль, момент показа — только часы сайта. На экране — для
 * глаза (дата без секунд, 12 знаков отпечатка), в подсказке ячейки и в буфере —
 * точное значение.
 *
 * Не ПД (ссылки на публичные тексты сайта) — под маску записи сессии не идёт.
 * Переменная строки — `shown`: имена `row`/`item` pii-audit считает
 * владельцами свободного текста.
 */
import { useTranslation } from 'react-i18next'
import { formatDateTime } from '@/lib/formatters'
import {
  doorKind,
  hasDoor,
  hasShownAt,
  readLegalTrail,
  shortSha,
  sourceKind,
  type CreditLegalTrailRow,
} from '@/features/credit/api/legalTrail'
import { CopyButton } from './CreditCardHeader'

const EMPTY = '—'
const TH = 'py-1 pr-3 text-left font-medium'
const TD = 'py-1 pr-3'

/** Время: на экране — часами браузера, как все моменты карточки; в `title` — строка модуля как есть. */
function TimeCell({ value }: { value: string | null }) {
  return (
    <td className={`${TD} whitespace-nowrap`} title={value ?? undefined}>
      {formatDateTime(value ?? undefined)}
    </td>
  )
}

export function CreditLegalTrail({ value }: { value: unknown }) {
  const { t } = useTranslation('common')
  const rows = readLegalTrail(value)
  // Поля нет — модуль старше 0.1.48: следа у его заявок быть не может, блока нет.
  if (rows === null) return null

  const withShownAt = hasShownAt(rows)
  const withDoor = hasDoor(rows)
  const sourceLabel = (source: string | null) => {
    const kind = sourceKind(source)
    return kind === 'legalTexts'
      ? t('credit.legalTrail.source.legalTexts')
      : kind === 'siteDocuments'
        ? t('credit.legalTrail.source.siteDocuments')
        : (source ?? EMPTY)
  }
  const doorLabel = (door: string | null) => {
    const kind = doorKind(door)
    return kind === 'intake'
      ? t('credit.legalTrail.door.intake')
      : kind === 'sign'
        ? t('credit.legalTrail.door.sign')
        : door || EMPTY
  }
  // Подпись кнопки копирования различает строки: один `subject` бывает в двух
  // языках и (после 18-4c) на двух экранах — язык и этап входят в подпись.
  const copyLabel = (shown: CreditLegalTrailRow) => {
    let label = `${t('credit.actions.copy')} · ${shown.subject ?? EMPTY}`
    if (shown.locale) label += ` · ${shown.locale}`
    if (shown.door) label += ` · ${doorLabel(shown.door)}`
    return label
  }
  const cells = (shown: CreditLegalTrailRow) => {
    const short = shortSha(shown.sha256)
    return (
      <>
        <td className={`${TD} font-mono text-xs break-all`}>{shown.subject ?? EMPTY}</td>
        <td className={TD}>{sourceLabel(shown.source)}</td>
        <td className={`${TD} whitespace-nowrap`}>
          {`v${shown.version_no ?? EMPTY} · #${shown.publication_id ?? EMPTY}`}
        </td>
        <td className={TD}>{shown.locale ?? EMPTY}</td>
        {withShownAt && <TimeCell value={shown.shown_at} />}
        <TimeCell value={shown.received_at} />
        <td className={`${TD} whitespace-nowrap`} title={shown.sha256 ?? undefined}>
          {short && shown.sha256 ? (
            <span className="inline-flex items-center gap-1">
              <span className="font-mono text-xs">{short}</span>
              <CopyButton value={shown.sha256} label={copyLabel(shown)} />
            </span>
          ) : (
            EMPTY
          )}
        </td>
        {withDoor && <td className={TD}>{doorLabel(shown.door)}</td>}
      </>
    )
  }

  return (
    <>
      <p className="text-muted-foreground mt-4 mb-1 text-xs">
        {t('credit.legalTrail.title')}
        {/* Счёт — отдельным узлом, не подстановкой: число показанных строк, не длина массива. */}
        {rows.length > 0 && <span> · {rows.length}</span>}
      </p>
      {rows.length === 0 ? (
        <p className="text-sm">{t('credit.legalTrail.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-xs">
                <th className={TH}>{t('credit.legalTrail.columns.subject')}</th>
                <th className={TH}>{t('credit.legalTrail.columns.source')}</th>
                <th className={TH}>{t('credit.legalTrail.columns.version')}</th>
                <th className={TH}>{t('credit.legalTrail.columns.locale')}</th>
                {withShownAt && <th className={TH}>{t('credit.legalTrail.columns.shownAt')}</th>}
                <th className={TH}>{t('credit.legalTrail.columns.receivedAt')}</th>
                <th className={TH}>{t('credit.legalTrail.columns.sha256')}</th>
                {withDoor && <th className={TH}>{t('credit.legalTrail.columns.door')}</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((shown, index) => (
                // Индекс обязателен: после 18-4c та же публикация приходит с двух экранов.
                <tr
                  key={`${index}:${shown.source}:${shown.publication_id}:${shown.locale}`}
                  className="border-border border-b align-top last:border-0"
                >
                  {cells(shown)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
