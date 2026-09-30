/**
 * «Доступ» (planner story 5.10, AC1; UX C-08): who sees what on this board, by
 * the board's current policy (`Board.config.policy.value` — the same policy
 * `GET /boards/{code}/policy` gives). Read only: the policy is edited in
 * «Політика дошки» (5.10a). The sentences restate the settings П-1, П-2, П-4
 * and П-8; nothing here is computed beyond picking the sentence.
 */
import type { PlannerBoard, PlannerBoardPolicy } from '@/api/planner/plannerApi'
import { useSettingsText } from '../settingsText'
import { SectionHeading } from '../settingsUi'

function readPolicy(board: PlannerBoard): PlannerBoardPolicy | null {
  const value = board.config.policy?.value
  return value && typeof value === 'object' && 'member_visibility' in value ? value : null
}

export function AccessSection({ board }: { board: PlannerBoard }) {
  const { t } = useSettingsText()
  const policy = readPolicy(board)

  return (
    <section className="space-y-3" aria-labelledby="planner-settings-access">
      <SectionHeading
        id="planner-settings-access"
        title={t('settings.sections.access')}
        hint={t('settings.access.editIn')}
      />
      {policy ? (
        <dl className="max-w-2xl space-y-3 text-sm">
          <div>
            <dt className="text-muted-foreground">{t('settings.access.memberVisibility')}</dt>
            <dd className="text-foreground">
              {t(`settings.access.memberVisibilityValues.${policy.member_visibility}`)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('settings.access.triageBy')}</dt>
            <dd className="text-foreground">
              {t(`settings.access.triageByValues.${policy.triage_by}`)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('settings.access.requestAuthor')}</dt>
            <dd className="text-foreground">
              {policy.intake_open
                ? t('settings.access.requestAuthorOpen')
                : t('settings.access.requestAuthorClosed')}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('settings.access.overview')}</dt>
            <dd className="text-foreground">
              {policy.confidential
                ? t('settings.access.confidential')
                : t('settings.access.notConfidential')}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="text-muted-foreground text-sm">{t('settings.access.unknown')}</p>
      )}
    </section>
  )
}

export default AccessSection
