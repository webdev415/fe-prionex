/**
 * Where a task came from (planner story 5.1, AC2; UX-DR11, FR-38): a neutral
 * pill with an icon and a word — «з чату», «з протоколу», «повтор»,
 * «перенесено з Forgejo». A task created by hand (`manual`) carries no chip, and
 * neither does a kind this build does not know: an empty or guessed chip would
 * say something false.
 *
 * The planner's own vocabulary (`internal/work/domain/task.go`) is `manual`,
 * `draft` (a draft item from a chat, 9.x), `recurrence` and `import` (the
 * Forgejo move); epics 9.3 also names `chat` and `protocol`. `draft` reads as
 * «з чату» (spec 5.1, assumption). The only link the contract gives is
 * `origin.message_url` — the source message in HUB, ready-made by the planner
 * (CF-16); anything but http(s) is not a link.
 */
import { useTranslation } from 'react-i18next'
import type { IconType } from 'react-icons'
import {
  MdChatBubbleOutline,
  MdOutlineDescription,
  MdOutlineMoveDown,
  MdRepeat,
} from 'react-icons/md'
import { cn } from '@/lib/utils'
import type { PlannerTaskOrigin } from '@/api/planner/plannerApi'
import { toneClass } from '../plannerTones'

// A Map, not an object literal: `origin.kind` is free text from the server,
// and `{}['constructor']` is a function, not «unknown kind».
const ORIGINS = new Map<string, { key: string; icon: IconType }>([
  ['draft', { key: 'origin.chat', icon: MdChatBubbleOutline }],
  ['chat', { key: 'origin.chat', icon: MdChatBubbleOutline }],
  ['protocol', { key: 'origin.protocol', icon: MdOutlineDescription }],
  ['recurrence', { key: 'origin.recurrence', icon: MdRepeat }],
  ['import', { key: 'origin.import', icon: MdOutlineMoveDown }],
])

function sourceLink(url: string | undefined): string | undefined {
  if (!url) return undefined
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : undefined
  } catch {
    return undefined
  }
}

export function OriginChip({ origin }: { origin: PlannerTaskOrigin }) {
  const { t } = useTranslation('planner')
  const known = ORIGINS.get(origin.kind)
  if (!known) return null
  const { key, icon: Icon } = known
  const href = sourceLink(origin.message_url)
  const className = cn(
    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
    toneClass('normal')
  )
  const face = (
    <>
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span>{t(key)}</span>
    </>
  )
  if (!href) return <span className={className}>{face}</span>
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(className, 'focus-visible:ring-ring hover:underline focus-visible:ring-2')}
    >
      {face}
      <span className="sr-only">{t('origin.openSource')}</span>
    </a>
  )
}

export default OriginChip
