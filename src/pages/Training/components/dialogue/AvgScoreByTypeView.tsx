import { useTranslation } from 'react-i18next'
import { MOCK_AVG_BY_TYPE } from '../../mocks/trainerWorkplaceMocks'

/**
 * Average-score-by-type view (KAN-504). Per-period dual bars for Client vs
 * Third Party dialogue templates.
 */
export function AvgScoreByTypeView() {
  const { t } = useTranslation('common')
  const data = MOCK_AVG_BY_TYPE

  const maxValue = Math.max(data.client.avg, data.thirdParty.avg, 100)

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[#EBECE8] bg-white p-6 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
      <div>
        <h3 className="text-base font-semibold text-[#05040D]">
          {t('pages.training.dialogue.avgByType.title', 'Average score by dialogue type')}
        </h3>
        <p className="text-xs text-[#6B7280]">
          {t(
            'pages.training.dialogue.avgByType.subtitle',
            'Comparison of client vs third-party scorecard templates over the selected period.'
          )}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <BarRow
          label={t('pages.training.dialogue.avgByType.client', 'Client dialogue')}
          value={data.client.avg}
          count={data.client.count}
          max={maxValue}
        />
        <BarRow
          label={t('pages.training.dialogue.avgByType.thirdParty', 'Third party dialogue')}
          value={data.thirdParty.avg}
          count={data.thirdParty.count}
          max={maxValue}
          tone="bg-[#7C3AED]"
        />
      </div>
    </div>
  )
}

function BarRow({
  label,
  value,
  count,
  max,
  tone = 'bg-[#204E4D]',
}: {
  label: string
  value: number
  count: number
  max: number
  tone?: string
}) {
  const pct = (value / max) * 100
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-[#05040D]">{label}</span>
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-semibold text-[#05040D]">{value}</span>
          <span className="text-[10px] text-[#6B7280]">/100 · {count} scorecards</span>
        </div>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-[#EBECE8]">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default AvgScoreByTypeView
