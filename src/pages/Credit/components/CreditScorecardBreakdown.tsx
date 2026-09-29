/**
 * «Розбір скорингу» — почему машина одобрила, отказала или оставила заявку человеку.
 *
 * Андеррайтер сверяет решение с листом «Калькулятор скоринга» книги правил
 * проверки клиента построчно: класс дохода и откуда он взят, восемь параметров
 * с входом и баллом, сумма, банд, гейт с кодами и причинами разбора, а после
 * 19-4 — тип клиента, тир и цепочка суммы. Всё — из снимка решения как записано
 * модулем (`readScorecard`), ничего не пересчитывается.
 *
 * Ключа `scorecard` нет (флаг скоринга выключен, решение до 19-3, ручное или
 * override-решение) — компонент не рисует ничего: вкладка выглядит как прежде.
 *
 * Тексты кодов — из индекса справочника, который форма ручного решения уже
 * загрузила (19-1f): своих запросов у панели нет. Справочника нет — только `id`;
 * плашку сбоя справочника рисует форма, не разбор.
 */
import { useTranslation } from 'react-i18next'
import { decisionCodeText, type CreditDecisionCodeIndex } from '@/features/credit/api/decisionCodes'
import { formatCreditMoney } from '@/features/credit/api/money'
import { readScorecard, type CreditScorecardInput } from '@/features/credit/api/scorecard'
import type { CreditDecisionSnapshot } from '@/features/credit/api/types'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground w-64 shrink-0">{label}</span>
      <div className="min-w-0 break-words">{children}</div>
    </div>
  )
}

/** Код строкой: `id` моноширинно, текст книги по языку, приглушённо — код книги. */
function CodeList({
  ids,
  directory,
  language,
}: {
  ids: readonly string[]
  directory: CreditDecisionCodeIndex | undefined
  language: string | undefined
}) {
  const { t } = useTranslation('common')
  return (
    <div className="flex flex-col gap-1">
      {[...new Set(ids)].map((id) => {
        const entry = directory?.byId.get(id)
        return (
          <span key={id}>
            <span className="font-mono">{id}</span>
            {entry && (
              <>
                {' — '}
                {decisionCodeText(entry, language).primary}
                {entry.book_code && (
                  <span className="text-muted-foreground">
                    {' · '}
                    {t('credit.scorecard.bookCode', { code: entry.book_code })}
                  </span>
                )}
              </>
            )}
          </span>
        )
      })}
    </div>
  )
}

export function CreditScorecardBreakdown({
  snapshot,
  currency,
  directory,
  language,
}: {
  snapshot?: CreditDecisionSnapshot
  currency?: string
  directory: CreditDecisionCodeIndex | undefined
  language: string | undefined
}) {
  const { t } = useTranslation('common')
  const view = readScorecard(snapshot)
  if (!view) return null

  const money = (minor: number | null) => formatCreditMoney(minor, currency)
  const computed = (minor: number | null) =>
    minor === null ? t('credit.scorecard.notComputed') : money(minor)
  // «Не виміряно» ≠ «ні»: неизмеренный признак машина отдала человеку, а не отказала.
  const yesNo = (value: boolean | null) =>
    value === null
      ? t('credit.scorecard.notMeasured')
      : value
        ? t('credit.scorecard.yes')
        : t('credit.scorecard.no')
  const inputText = (input: CreditScorecardInput) => {
    switch (input.kind) {
      case 'missing':
        return t('credit.scorecard.notMeasured')
      case 'unknown':
        return '—'
      case 'count':
        return String(input.value)
      case 'money':
        return money(input.value)
      case 'flag':
        return yesNo(input.value)
      case 'trend':
        return t(`credit.balanceTrend.${input.value}`, input.value)
      case 'days':
        return t('credit.card.days', { count: input.value })
    }
  }
  const classText = (value: string | null) =>
    value === null ? '—' : t(`credit.incomeClass.${value}`, value)
  const sourceText =
    view.incomeClassSource === null
      ? '—'
      : t(`credit.incomeClassSource.${view.incomeClassSource}`, view.incomeClassSource)
  const signals = (items: readonly { signal: string; value: boolean | null }[]) => (
    <ul>
      {items.map((item) => (
        <li key={item.signal}>
          {t(`credit.scorecardSignal.${item.signal}`, item.signal)}: {yesNo(item.value)}
        </li>
      ))}
    </ul>
  )
  // Гейт не отказал, но код удержан для человека (`held`): признак сработал, отказ
  // отложен до решения андеррайтера — «Пройдено» здесь было бы неправдой.
  const verdict = view.declined
    ? t('credit.scorecard.gateDecline')
    : view.gate.decline !== false
      ? '—'
      : view.gate.held.length > 0
        ? t('credit.scorecard.gateHeldVerdict')
        : t('credit.scorecard.gatePass')
  const basis = view.basis
  const amount = view.amount
  const installments = amount?.installments
  const installmentsText =
    !installments || installments.max === null
      ? t('credit.scorecard.notComputed')
      : installments.min === null
        ? t('credit.scorecard.installmentsUpTo', { max: installments.max })
        : t('credit.scorecard.installmentsRange', { min: installments.min, max: installments.max })

  return (
    <section className="border-border bg-card mb-4 rounded-xl border shadow-sm">
      <h3 className="border-border flex min-h-[49px] items-center border-b px-4 text-sm font-semibold">
        {t('credit.scorecard.title')}
      </h3>
      <div className="p-4">
        <Row label={t('credit.scorecard.version')}>
          <span className="font-mono">{view.version ?? '—'}</span>
        </Row>
        <Row label={t('credit.scorecard.incomeClass')}>
          {`${classText(view.incomeClass)} · ${sourceText}`}
        </Row>
        {basis && (
          <>
            <Row label={t('credit.scorecard.declaredClass')}>{classText(basis.declaredClass)}</Row>
            <Row label={t('credit.scorecard.employmentStatus')}>
              {basis.employmentStatus === null
                ? '—'
                : t(`credit.employment.${basis.employmentStatus}`, basis.employmentStatus)}
              {basis.employmentStatusKnown === false && (
                <span className="text-muted-foreground">
                  {' · '}
                  {t('credit.scorecard.employmentStatusUnknown')}
                </span>
              )}
            </Row>
            {basis.bNotConfirmed === true && (
              <p className="text-warning-800 py-1.5 text-sm">
                {t('credit.scorecard.bNotConfirmed')}
              </p>
            )}
            <Row label={t('credit.scorecard.evidence')}>{signals(basis.evidence)}</Row>
          </>
        )}

        <table className="mt-3 mb-2 w-full text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-left text-xs">
              <th scope="col" className="py-1.5 pr-3 font-medium">
                {t('credit.scorecard.parameter')}
              </th>
              <th scope="col" className="py-1.5 pr-3 font-medium">
                {t('credit.scorecard.value')}
              </th>
              <th scope="col" className="py-1.5 text-right font-medium">
                {t('credit.scorecard.points')}
              </th>
            </tr>
          </thead>
          <tbody>
            {view.rows.map((row) => (
              <tr key={row.parameter} className="border-border border-b align-top last:border-0">
                <td className="py-1.5 pr-3">
                  <span className="block">
                    {t(`credit.scorecardParameter.${row.parameter}`, row.parameter)}
                  </span>
                  {row.cell && (
                    <span className="text-muted-foreground block text-xs">{`${row.cell} · ${row.book}`}</span>
                  )}
                </td>
                <td className="py-1.5 pr-3">{inputText(row.input)}</td>
                <td className="py-1.5 text-right tabular-nums">{row.points ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <Row label={t('credit.scorecard.total')}>
          {view.total === null
            ? '—'
            : t('credit.scorecard.totalValue', { total: view.total, max: view.maxTotal })}
        </Row>
        <Row label={t('credit.scorecard.band')}>
          {view.declined
            ? t('credit.scorecard.bandDeclined')
            : view.band === null
              ? '—'
              : t('credit.scorecard.bandValue', { band: view.band })}
        </Row>
        <Row label={t('credit.scorecard.gate')}>{verdict}</Row>
        {view.gate.codes.length > 0 && (
          <Row label={t('credit.scorecard.gateCodes')}>
            <CodeList ids={view.gate.codes} directory={directory} language={language} />
          </Row>
        )}
        {view.gate.held.length > 0 && (
          <Row label={t('credit.scorecard.gateHeld')}>
            <CodeList ids={view.gate.held} directory={directory} language={language} />
          </Row>
        )}
        {view.gate.review.length > 0 && (
          <Row label={t('credit.scorecard.gateReview')}>
            {view.gate.review
              .map((cause) => t(`credit.referralReason.${cause}`, cause))
              .join(' · ')}
          </Row>
        )}
        <Row label={t('credit.scorecard.gateSignals')}>{signals(view.gateSignals)}</Row>

        {amount && (
          <div className="border-border mt-3 border-t pt-3">
            <h4 className="mb-1 text-sm font-semibold">{t('credit.scorecard.amountTitle')}</h4>
            <Row label={t('credit.scorecard.clientType')}>
              {amount.clientType === null
                ? '—'
                : t('credit.scorecard.clientTypeValue', {
                    type: amount.clientType,
                    closed: amount.closedLoans ?? '—',
                  })}
            </Row>
            <Row label={t('credit.scorecard.tier')}>
              {amount.tier ? (
                <>
                  {`${money(amount.tier.min)} – ${money(amount.tier.max)}`}
                  {amount.tier.classBCap && (
                    <span className="text-muted-foreground">
                      {' · '}
                      {t('credit.scorecard.classBCap')}
                    </span>
                  )}
                </>
              ) : (
                t('credit.scorecard.notComputed')
              )}
            </Row>
            <Row label={t('credit.scorecard.scale')}>{computed(amount.scale)}</Row>
            <Row label={t('credit.scorecard.cap')}>{computed(amount.cap)}</Row>
            <Row label={t('credit.scorecard.rounded')}>{computed(amount.rounded)}</Row>
            <Row label={t('credit.scorecard.final')}>{computed(amount.final)}</Row>
            <Row label={t('credit.scorecard.installments')}>{installmentsText}</Row>
            {amount.codes.length > 0 && (
              <Row label={t('credit.scorecard.decisionCodes')}>
                <CodeList ids={amount.codes} directory={directory} language={language} />
              </Row>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

export default CreditScorecardBreakdown
