/**
 * Board settings (C-08, `…/boards/:code/settings`) before story 5.10: the `⚙`
 * of the board header (5.3) leads here and finds a plain «coming» state with
 * a way back, not a dead link (precedent: «Календар», E-3).
 */
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { MdOutlineSettings } from 'react-icons/md'
import { boardPath } from './plannerFormat'

export function PlannerBoardSettingsPage() {
  const { t } = useTranslation('planner')
  const { code = '' } = useParams()
  return (
    <div className="border-border bg-card flex flex-col items-center gap-3 rounded-xl border p-10 text-center">
      <MdOutlineSettings aria-hidden="true" className="text-muted-foreground h-10 w-10" />
      <p className="text-foreground text-sm">{t('boardHeader.settingsSoon')}</p>
      <Link to={boardPath(code)} className="text-foreground text-sm underline">
        {t('boardHeader.backToBoard')}
      </Link>
    </div>
  )
}

export default PlannerBoardSettingsPage
