import { useTranslation } from 'react-i18next'
import type { EmployeeCard } from '@/features/employeeCard/types.card'
import { CardSection } from './CardSection'

export interface TerminationSectionProps {
  card: EmployeeCard
}

/**
 * How somebody's employment ended, and the notice that the card is closed.
 *
 * Last on the card, after the chronology: it is where the record stops. The
 * section is present either way, so the tab bar does not change shape when
 * somebody leaves - a bar that gains an entry would move every other tab under
 * the reader's cursor.
 *
 * Its pencil survives the freeze, and is the only thing here that writes: a
 * date recorded wrongly has to be correctable or the mistake is permanent.
 * Recording a departure in the first place, and taking one back off, are acted
 * from the profile panel instead - whether somebody still works here is a fact
 * about the person, and belongs beside the name rather than in a section a
 * reader has to scroll to the end of the card to find.
 *
 * So an employee nobody has terminated has no action here at all, only the
 * sentence saying what would fill the block in.
 *
 * The contents sit in a framed block of their own rather than loose under the
 * heading. The design draws it lighter than the section around it; here the
 * section is already the lightest surface any theme has, so the frame is what
 * carries the same separation.
 */
export function TerminationSection({ card }: TerminationSectionProps) {
  const { t, i18n } = useTranslation()
  const gone = card.termination

  const day = (value: string) => new Date(value).toLocaleDateString(i18n.language)

  /*
   * ``min-w-0`` and ``break-words`` together, and both are needed. A grid
   * column is at least as wide as its widest unbreakable word, so a comment
   * typed as one 500-character run pushes the column - and the card with it -
   * off the side of the page. ``min-w-0`` lets the column be narrower than its
   * content, and ``break-words`` then has somewhere to break.
   */
  const field = (label: string, value: string | null, wide = false) => (
    <div className={wide ? 'min-w-0 space-y-1 sm:col-span-3' : 'min-w-0 space-y-1'}>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-foreground text-sm break-words">
        {value || <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  )

  return (
    <CardSection id="termination" title={t('pages.employeeCard.sections.termination')}>
      <div className="border-border rounded-lg border p-4 sm:p-6">
        {gone ? (
          <div className="space-y-6">
            {/*
              Centred and stated twice over: that the employment ended, and
              what that costs the reader. Every control on the card is already
              gone by this point, and without a sentence saying why, their
              absence reads as a permission problem.
            */}
            <div className="border-border space-y-1 border-b pb-4 text-center">
              <p className="text-destructive text-sm font-semibold">
                {t('pages.employeeCard.termination.left')}
              </p>
              <p className="text-destructive/80 text-xs">
                {t('pages.employeeCard.termination.readOnly')}
              </p>
            </div>

            {/*
              The label sits in the first column of the same grid as the
              fields, so the comment below can start under it rather than
              indented to where the values happen to begin.

              ``contents`` is what lets the list keep its markup and still hand
              its rows to the grid outside it - a heading is not allowed inside
              a description list, and the two have to share one set of columns
              for the alignment to hold.
            */}
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-3">
              <h3 className="text-foreground text-sm font-semibold">
                {t('pages.employeeCard.sections.termination')}
              </h3>
              <dl className="contents">
                {field(
                  t('pages.employeeCard.termination.reason'),
                  t(`pages.employeeCard.termination.reasons.${gone.reason}`, gone.reason)
                )}
                {field(t('pages.employeeCard.termination.date'), day(gone.terminated_on))}
                {field(t('pages.employeeCard.termination.comment'), gone.comment, true)}
              </dl>
            </div>
          </div>
        ) : (
          <div className="space-y-1 py-6 text-center">
            <p className="text-muted-foreground text-sm">
              {t('pages.employeeCard.termination.stillHere')}
            </p>
            <p className="text-muted-foreground text-xs">
              {t('pages.employeeCard.termination.fillsIn')}
            </p>
          </div>
        )}
      </div>
    </CardSection>
  )
}
