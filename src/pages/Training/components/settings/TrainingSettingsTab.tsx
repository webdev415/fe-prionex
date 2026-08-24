/**
 * TrainingSettingsTab — body of the Training page's «Налаштування» top-tab.
 *
 * The tab itself only appears for `manage_qa_rules` holders (TrainingPage
 * filters the strip), so this component renders its single section without
 * repeating the check. More trainer-side settings sections land here later.
 */
import { QaListeningSection } from '@/features/quality/components/qaRules/QaListeningSection'

export function TrainingSettingsTab() {
  return (
    <div className="flex flex-col gap-6" data-testid="training-settings-tab">
      <QaListeningSection />
    </div>
  )
}

export default TrainingSettingsTab
