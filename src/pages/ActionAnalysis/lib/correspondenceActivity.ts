import type {
  IncomingRegistryItem,
  OutgoingRegistryItem,
  RegistryLetterType,
} from '@/features/lawyerWorkplace'

export type CorrespondenceDirection = 'incoming' | 'outgoing'

/**
 * A single row of the Action Analysis «Кореспонденція» activity feed — the
 * union of the incoming and outgoing correspondence registries, normalised to
 * a common shape and sorted newest-first.
 */
export interface CorrespondenceActivityRow {
  id: string
  date: string
  direction: CorrespondenceDirection
  number: string
  letterType: RegistryLetterType | null
  party: string | null
  responsible: string | null
}

function toTime(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

/**
 * Merge the last rows of both registries into one activity feed. Incoming rows
 * key off `received_date` and carry no responsible lawyer; outgoing rows key
 * off `issued_date` (the response/registration date) and expose the lawyer.
 * Result is sorted by date descending.
 */
export function mergeCorrespondenceActivity(
  incoming: IncomingRegistryItem[],
  outgoing: OutgoingRegistryItem[]
): CorrespondenceActivityRow[] {
  const incomingRows: CorrespondenceActivityRow[] = incoming.map((item) => ({
    id: `in-${item.id}`,
    date: item.received_date,
    direction: 'incoming',
    number: item.number,
    letterType: item.letter_type,
    party: item.client?.name ?? null,
    responsible: null,
  }))

  const outgoingRows: CorrespondenceActivityRow[] = outgoing.map((item) => ({
    id: `out-${item.id}`,
    date: item.issued_date,
    direction: 'outgoing',
    number: item.number,
    letterType: item.letter_type,
    party: item.recipient_name ?? null,
    responsible: item.lawyer?.name ?? null,
  }))

  return [...incomingRows, ...outgoingRows].sort((a, b) => toTime(b.date) - toTime(a.date))
}
