const AVATAR_PALETTE = [
  '#E0F2EC',
  '#FEF3C7',
  '#FEE4E2',
  '#E0E7FF',
  '#FCE7F3',
  '#DBEAFE',
  '#FFEDD5',
  '#D1FAE5',
] as const

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

/** Initials avatar with a stable colour. `seed` (e.g. operator id) keeps the
 *  same person the same colour across renders; falls back to the name. */
export function EmployeeAvatar({
  name,
  seed,
  size = 24,
}: {
  name: string
  seed?: number
  size?: number
}) {
  const key = seed ?? name.length
  const color =
    AVATAR_PALETTE[((key % AVATAR_PALETTE.length) + AVATAR_PALETTE.length) % AVATAR_PALETTE.length]
  return (
    <div
      aria-hidden
      className="flex flex-shrink-0 items-center justify-center rounded-full font-semibold text-[#05040D]"
      style={{ width: size, height: size, fontSize: size * 0.4, backgroundColor: color }}
    >
      {initialsFor(name)}
    </div>
  )
}

export default EmployeeAvatar
