/**
 * «Загальне» (planner story 5.10, AC1; UX C-08): name, code, kind, template,
 * time zone — read only. Contract 0.24.0 has no way to rename a board and does
 * not name a board's department; the time zone changes with its own command
 * and preview (`PUT /tzid`, 3.11), outside this story.
 */
import type { PlannerBoard } from '@/api/planner/plannerApi'
import { useSettingsText } from '../settingsText'
import { SectionHeading } from '../settingsUi'

export function GeneralSection({ board }: { board: PlannerBoard }) {
  const { t } = useSettingsText()
  const rows: [string, string][] = [
    [t('settings.general.name'), board.name],
    [t('settings.general.code'), board.code],
    [t('settings.general.kind'), t(`settings.general.kinds.${board.kind}`)],
    [t('settings.general.template'), board.template_code ?? t('settings.general.noTemplate')],
    [t('settings.general.tzid'), board.tzid],
  ]
  return (
    <section className="space-y-3" aria-labelledby="planner-settings-general">
      <SectionHeading
        id="planner-settings-general"
        title={t('settings.sections.general')}
        hint={t('settings.general.readOnly')}
      />
      <dl className="grid max-w-xl grid-cols-[10rem_1fr] gap-x-4 gap-y-2 text-sm">
        {rows.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="text-foreground break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export default GeneralSection
