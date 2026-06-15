import { cn } from '@/lib/utils'
import { LETTER_TYPE_COLOR_BY_ID } from './constants'

export function LetterTypeDot({ colorId, className }: { colorId: string; className?: string }) {
  const color = LETTER_TYPE_COLOR_BY_ID[colorId] ?? LETTER_TYPE_COLOR_BY_ID.teal!
  return <span className={cn('h-2 w-2 shrink-0 rounded-full', color.dotClass, className)} />
}
