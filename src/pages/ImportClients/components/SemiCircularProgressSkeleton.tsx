/**
 * SemiCircularProgressSkeleton Component
 *
 * Skeleton loading component for the semi-circular progress indicator.
 * Matches the SemiCircularProgress structure with animated placeholders.
 */

interface SemiCircularProgressSkeletonProps {
  size?: number
  className?: string
}

export function SemiCircularProgressSkeleton({
  size = 300,
  className,
}: SemiCircularProgressSkeletonProps) {
  const segments = 15
  const segmentWidth = size * 0.055
  const segmentHeight = size * 0.14
  const radius = size * 0.36
  const centerX = size / 2
  const centerY = size * 0.48

  const segmentElements = []

  for (let i = 0; i < segments; i++) {
    const angle = Math.PI - (i / (segments - 1)) * Math.PI

    const x = centerX + radius * Math.cos(angle)
    const y = centerY - radius * Math.sin(angle)

    const rotation = (i / (segments - 1)) * 180 - 90

    segmentElements.push(
      <rect
        key={i}
        x={x - segmentWidth / 2}
        y={y - segmentHeight / 2}
        width={segmentWidth}
        height={segmentHeight}
        rx={segmentWidth / 2}
        ry={segmentWidth / 2}
        transform={`rotate(${rotation}, ${x}, ${y})`}
        className="fill-muted animate-pulse"
      />
    )
  }

  return (
    <div className={`relative inline-flex items-center justify-center ${className || ''}`}>
      <svg
        width={size}
        height={size * 0.55}
        viewBox={`0 0 ${size} ${size * 0.55}`}
        className="overflow-visible"
      >
        {segmentElements}

        {/* Percentage Text Skeleton */}
        <text
          x={centerX}
          y={size * 0.42}
          textAnchor="middle"
          className="fill-muted animate-pulse text-2xl leading-tight font-medium tracking-[-0.48px]"
        >
          {/* Placeholder text */}
          <tspan opacity="0.5">100</tspan>
        </text>

        {/* Label Text Skeleton */}
        <text
          x={centerX}
          y={size * 0.52}
          textAnchor="middle"
          className="fill-muted animate-pulse text-2xl leading-tight font-light tracking-[-0.48px]"
        >
          {/* Placeholder text */}
          <tspan opacity="0.5">Completed</tspan>
        </text>
      </svg>
    </div>
  )
}

export default SemiCircularProgressSkeleton
