import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { Icons } from '@/lib/icons'
import { displayName } from '@/features/employeeCard/lib/displayName'
import { piiProps } from '@/lib/openreplay/pii'
import type { CardHeader } from '@/features/employeeCard/types.card'

export interface ProfilePanelProps {
  header: CardHeader
  /** Whether a termination has been recorded, which is what the action offers to undo. */
  terminated?: boolean
  /** Whether this reader may write to the card at all. */
  canEdit?: boolean
  onTerminate?: () => void
  onReinstate?: () => void
}

/**
 * The panel that stays put while the sections scroll.
 *
 * It repeats a few things the sections also show. That is deliberate: it is
 * what somebody reads to know whose card they are on, and losing it after one
 * scroll is how the wrong person gets edited.
 *
 * Staying put is the column's job rather than this panel's: the way back to
 * the list sits above it and has to stay too. No height is set here, and the
 * grid it sits in is ``items-start`` - a grid item stretches to its row by
 * default, and something already as tall as everything beside it has nowhere
 * to slide, which is how this was marked sticky and did nothing.
 */
export function ProfilePanel({
  header,
  terminated = false,
  canEdit = false,
  onTerminate,
  onReinstate,
}: ProfilePanelProps) {
  const { t, i18n } = useTranslation()

  const hired = header.hired_at ? new Date(header.hired_at).toLocaleDateString(i18n.language) : null

  const details = [
    [t('pages.employeeCard.panel.department'), header.department],
    [t('pages.employeeCard.panel.manager'), header.manager],
    [t('pages.employeeCard.panel.hiredAt'), hired],
    [t('pages.employeeCard.panel.phone'), header.phone],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]))

  const telegramHandle = header.telegram?.trim().replace(/^@/, '') ?? ''
  const telegramHref = telegramHandle
    ? /^https?:\/\//i.test(telegramHandle)
      ? telegramHandle
      : `https://t.me/${telegramHandle}`
    : null
  const emailHref = header.email ? `mailto:${header.email}` : null

  return (
    <aside className="border-border bg-card flex flex-col items-center gap-4 rounded-xl border p-6">
      <UserAvatar
        userId={header.id}
        // The two parts rather than the whole name: the monogram then reads
        // in the same order as the heading under it, and it cannot be thrown
        // by a middle name or a surname of two words the way splitting a
        // string on its spaces would be.
        firstName={header.first_name}
        lastName={header.last_name}
        fullName={displayName(header)}
        avatarUrl={header.avatar_url}
        size={112}
      />

      <div className="space-y-1 text-center">
        <h1 className="text-foreground text-lg font-semibold" {...piiProps}>
          {displayName(header)}
        </h1>
        {/* The position stays readable: a job title is not personal data, and it
            is what tells a replay whose card this was once the name is gone. */}
        {header.position && <p className="text-muted-foreground text-sm">{header.position}</p>}
      </div>

      {/* One badge per line. Side by side they wrap unevenly in a 280px
          column as soon as a work format is longer than "Remote". */}
      <div className="flex flex-col items-center gap-2">
        <span className="border-border text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs">
          <span
            aria-hidden="true"
            className={
              header.status === 'active'
                ? 'size-2 rounded-full bg-emerald-500'
                : 'bg-muted-foreground size-2 rounded-full'
            }
          />
          {t(`pages.employeeCard.status.${header.status}`, header.status)}
        </span>
        {header.work_format && (
          <span className="border-border text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs">
            {header.work_format === 'remote' ? (
              <Icons.Home size={13} strokeWidth={1.8} aria-hidden="true" />
            ) : (
              <Icons.Briefcase01 size={13} strokeWidth={1.8} aria-hidden="true" />
            )}
            {t(`pages.employeeCard.workFormat.${header.work_format}`, header.work_format)}
          </span>
        )}
      </div>

      {/* The rule belongs to what is under it. On somebody with no department,
          manager, hire date or phone recorded, drawing it anyway leaves a line
          across the panel with nothing beneath it. */}
      {details.length > 0 && (
        <div className="border-border w-full space-y-3 border-t pt-4">
          {details.map(([label, value]) => (
            <div key={label} className="space-y-0.5 text-center">
              <p className="text-muted-foreground text-xs">{label}</p>
              <p className="text-foreground text-sm font-medium">{value}</p>
            </div>
          ))}
        </div>
      )}

      {(emailHref || telegramHref) && (
        <div className="flex w-full items-center justify-center gap-3">
          {emailHref && (
            <a
              href={emailHref}
              title={header.email ?? undefined}
              aria-label={`${t('pages.employeeCard.panel.email')}: ${header.email}`}
              className="border-border text-muted-foreground hover:text-foreground hover:border-foreground focus-visible:ring-ring inline-flex size-9 items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <Icons.Mail size={16} strokeWidth={1.8} aria-hidden="true" />
            </a>
          )}
          {telegramHref && (
            <a
              href={telegramHref}
              target="_blank"
              rel="noopener noreferrer"
              title={header.telegram ?? undefined}
              aria-label={`${t('pages.employeeCard.fields.telegram')}: ${header.telegram}`}
              className="border-border text-muted-foreground hover:text-foreground hover:border-foreground focus-visible:ring-ring inline-flex size-9 items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <Icons.Sent02 size={16} strokeWidth={1.8} aria-hidden="true" />
            </a>
          )}
        </div>
      )}

      {/*
        Whether somebody still works here is a fact about the person, so it is
        acted on where the person is - beside the name and the status badge,
        not in a section three screens down that a reader has to find first.

        Only ever one of the two, because they are the same fact from either
        side: an employee who has left can be brought back, and one who has not
        cannot leave twice.
      */}
      {canEdit && (terminated ? onReinstate : onTerminate) && (
        <div className="border-border w-full border-t pt-4">
          {terminated ? (
            <Button variant="outline" size="md" className="w-full" onClick={onReinstate}>
              <Icons.Unlock size={16} strokeWidth={1.8} aria-hidden="true" />
              {t('pages.employeeCard.termination.reinstate')}
            </Button>
          ) : (
            <Button variant="danger" size="md" className="w-full" onClick={onTerminate}>
              <Icons.Logout size={16} strokeWidth={1.8} aria-hidden="true" />
              {t('pages.employeeCard.termination.terminate')}
            </Button>
          )}
        </div>
      )}
    </aside>
  )
}
