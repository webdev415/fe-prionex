import { useTranslation } from 'react-i18next'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { displayName } from '@/features/employeeCard/lib/displayName'
import type { CardHeader } from '@/features/employeeCard/types.card'

export interface ProfilePanelProps {
  header: CardHeader
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
export function ProfilePanel({ header }: ProfilePanelProps) {
  const { t, i18n } = useTranslation()

  const hired = header.hired_at ? new Date(header.hired_at).toLocaleDateString(i18n.language) : null

  const detail = (label: string, value: string | null) =>
    value ? (
      <div className="space-y-0.5 text-center">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-foreground text-sm font-medium">{value}</p>
      </div>
    ) : null

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
        <h1 className="text-foreground text-lg font-semibold">{displayName(header)}</h1>
        {header.position && <p className="text-muted-foreground text-sm">{header.position}</p>}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
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
          <span className="border-border text-foreground rounded-full border px-3 py-1 text-xs">
            {t(`pages.employeeCard.workFormat.${header.work_format}`, header.work_format)}
          </span>
        )}
      </div>

      <div className="border-border w-full space-y-3 border-t pt-4">
        {detail(t('pages.employeeCard.panel.department'), header.department)}
        {detail(t('pages.employeeCard.panel.manager'), header.manager)}
        {detail(t('pages.employeeCard.panel.hiredAt'), hired)}
        {detail(t('pages.employeeCard.panel.phone'), header.phone)}
        {detail(t('pages.employeeCard.panel.email'), header.email)}
      </div>
      {/*
        Telegram only. The mail action went because the address is already
        printed just above it, and a round button that does the same thing as
        the line above is a second way to say one thing.
      */}
      {header.telegram && (
        <div className="flex gap-3 pt-2">
          <a
            href={`https://t.me/${header.telegram.replace(/^@/, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('pages.employeeCard.panel.openTelegram')}
            title={t('pages.employeeCard.panel.openTelegram')}
            className="border-border text-foreground hover:bg-muted inline-flex size-10 items-center justify-center rounded-full border"
          >
            ✈
          </a>
        </div>
      )}
    </aside>
  )
}
