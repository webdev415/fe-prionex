/**
 * QaListeningSection — «Прослуховування (AI)», the Call QA rules surface of
 * the Training → «Налаштування» tab.
 *
 * Two sub-surfaces, both edited by the training-department head:
 * the critical-blocker dictionary and the AI rubrics. The tab itself is
 * gated by `manage_qa_rules`; this component assumes that gate and only
 * arranges the two editors.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AiRubricsSection } from './AiRubricsSection'
import { QaBlockersTable } from './QaBlockersTable'

type SubTab = 'blockers' | 'rubrics'

export function QaListeningSection() {
  const { t } = useTranslation('common')
  const [subTab, setSubTab] = useState<SubTab>('blockers')

  const tabs: Array<{ id: SubTab; label: string }> = [
    {
      id: 'blockers',
      label: t('pages.qaRules.tabs.blockers', 'Critical blockers'),
    },
    { id: 'rubrics', label: t('pages.qaRules.tabs.rubrics', 'AI rubrics') },
  ]

  return (
    <section className="flex flex-col gap-3" data-testid="qa-listening-section">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-[#05040D]">
          {t('pages.qaRules.title', 'Listening (AI)')}
        </h2>
        <p className="text-xs text-[#6B7280]">
          {t(
            'pages.qaRules.helper',
            'Stop-phrases that mark a call critical, and the rubrics the AI scores calls against.'
          )}
        </p>
      </div>

      <div className="inline-flex flex-wrap gap-1" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={subTab === tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
              subTab === tab.id
                ? 'bg-[#204E4D] text-white'
                : 'bg-white text-[#545454] hover:bg-[#F7F7F7]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === 'blockers' ? <QaBlockersTable /> : <AiRubricsSection />}
    </section>
  )
}

export default QaListeningSection
