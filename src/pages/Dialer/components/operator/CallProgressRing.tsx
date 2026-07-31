interface CallProgressRingProps {
  percent: number
  size?: number
  strokeWidth?: number
}

export function CallProgressRing({ percent, size = 140, strokeWidth = 12 }: CallProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, percent))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dash = (clamped / 100) * circumference

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          className="stroke-primary-400"
        />
      </svg>
      <span className="text-foreground absolute text-2xl font-semibold">
        {Math.round(clamped)}%
      </span>
    </div>
  )
}

export default CallProgressRing
