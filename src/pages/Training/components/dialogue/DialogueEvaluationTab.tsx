import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useOperators } from '@/features/users/hooks'
import { useAuthStore } from '@/stores/authStore'
import { useScopedUserIds } from '../../lib/scope'
import { AvgScoreByTypeView } from './AvgScoreByTypeView'
import { DialogsListTab } from './DialogsListTab'

type DialogueView = 'dialogs' | 'averages'

const VIEW_FALLBACK: Record<DialogueView, string> = {
  dialogs: 'Dialogs',
  averages: 'Averages',
}

/**
 * Dialogue Evaluation tab. The "Dialogs" view is the single merged list of
 * dialogs (call-first by default, switching to scorecard records via its
 * evaluation-status filter — see {@link DialogsListTab}); "Averages" is the
 * per-type analytics view.
 */
export function DialogueEvaluationTab() {
  const { t } = useTranslation('common')
  const [view, setView] = useState<DialogueView>('dialogs')

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)
  const scoped = useScopedUserIds(operators)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="inline-flex rounded-md border border-[#EBECE8] p-0.5">
          {(['dialogs', 'averages'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`h-9 rounded px-3 text-xs font-medium transition-colors ${
                view === v ? 'bg-[#204E4D] text-white' : 'text-[#6B7280] hover:text-[#05040D]'
              }`}
            >
              {t(`pages.training.dialogue.view.${v}`, VIEW_FALLBACK[v])}
            </button>
          ))}
        </div>
      </div>

      {view === 'averages' ? (
        <AvgScoreByTypeView operatorIds={scoped.userIds} />
      ) : (
        <DialogsListTab />
      )}
    </div>
  )
}

export default DialogueEvaluationTab
