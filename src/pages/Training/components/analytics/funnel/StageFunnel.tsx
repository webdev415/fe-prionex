import { useTranslation } from 'react-i18next'
import type { StageFunnelResponse } from '@/features/quality'
import { StageBar } from './StageBar'

interface Props {
  data: StageFunnelResponse
}

export function StageFunnel({ data }: Props) {
  const { t } = useTranslation('common')
  const maxExpected = data.evaluated_calls

  return (
    <div className="rounded-xl border border-[#EBECE8] bg-white p-4 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold text-[#05040D]">
            {t('pages.training.funnel.title', 'Script stage funnel')}
          </h3>
          <p className="text-[11px] text-[#676767]">
            {t(
              'pages.training.funnel.subtitle',
              'How many calls reached each stage and where operators drop off'
            )}
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-[#EFF6FF] px-3 py-1 text-[11px] font-semibold text-[#1D4ED8]">
          {t('pages.training.funnel.evaluatedCalls', '{{count}} scored calls', {
            count: data.evaluated_calls,
          })}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {data.stages.map((stage) => (
          <StageBar key={stage.key} stage={stage} maxExpected={maxExpected} />
        ))}
      </div>
    </div>
  )
}

export default StageFunnel
