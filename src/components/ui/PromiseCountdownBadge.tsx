/**
 * PromiseCountdownBadge — small status pill rendered next to a promise_to_pay
 * tag on the client card. Reads `payload.promise_date` (ISO datetime stored
 * by the tag-service when the tag was assigned) and shows time-to-deadline
 * with one-minute auto-refresh:
 *
 *  - "до 10.05 14:00 (3 дн.)" when the ЦД is in the future
 *  - "просрочено 2 ч." red when the ЦД has passed (the scheduled rule will
 *    replace the tag soon, but operator sees state before that fires)
 */

import { useEffect, useState } from 'react'

interface PromiseCountdownBadgeProps {
  promiseDate: string
  className?: string
}

function formatRelative(target: Date, now: Date): string {
  const diffMs = target.getTime() - now.getTime()
  const absMs = Math.abs(diffMs)
  const minutes = Math.floor(absMs / 60_000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days >= 1) return `${days} дн.`
  if (hours >= 1) return `${hours} ч.`
  return `${minutes} мин.`
}

function formatLocalDateTime(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${dd}.${mm} ${hh}:${min}`
}

export function PromiseCountdownBadge({ promiseDate, className }: PromiseCountdownBadgeProps) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const target = new Date(promiseDate)
  if (isNaN(target.getTime())) return null

  const isOverdue = target.getTime() <= now.getTime()
  const relative = formatRelative(target, now)
  const local = formatLocalDateTime(target)

  const tone = isOverdue
    ? 'bg-red-100 text-red-800 border-red-200'
    : 'bg-amber-50 text-amber-800 border-amber-200'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${tone} ${className ?? ''}`}
      title={isOverdue ? `Просрочено: ${local}` : `ЦД: ${local}`}
    >
      {isOverdue ? `просрочено ${relative}` : `до ${local} (${relative})`}
    </span>
  )
}
