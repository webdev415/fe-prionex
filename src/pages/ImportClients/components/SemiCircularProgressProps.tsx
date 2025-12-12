import { cn } from '@/lib/utils'

interface SemiCircularProgressProps {
  percentage: number
  size?: number
  className?: string
  completedColor?: string
  incompleteColor?: string
}

const SemiCircularProgress = ({
  percentage,
  size = 200,
  className,
  completedColor = '#2d9d92',
  incompleteColor = '#d4d7dc',
}: SemiCircularProgressProps) => {
  const clampedPercentage = Math.min(100, Math.max(0, percentage))
  const segments = 15
  const filledSegments = Math.round((clampedPercentage / 100) * segments)

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

    const isFilled = i < filledSegments
    const opacityProgress = filledSegments > 1 ? i / (filledSegments - 1) : 1

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
        fill={isFilled ? completedColor : incompleteColor}
        className="transition-all duration-300 ease-in-out"
        style={{
          opacity: isFilled ? 0.4 + opacityProgress * 0.6 : 1,
        }}
      />
    )
  }

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size * 0.55}
        viewBox={`0 0 ${size} ${size * 0.55}`}
        className="overflow-visible"
      >
        {segmentElements}

        {/* Percentage */}
        <text
          x={centerX}
          y={size * 0.42}
          textAnchor="middle"
          className="text-dark-500 text-2xl leading-tight font-medium tracking-[-0.48px]"
        >
          {Math.round(clampedPercentage)}%
        </text>

        {/* Label */}
        <text
          x={centerX}
          y={size * 0.52}
          textAnchor="middle"
          className="text-dark-500 text-2xl leading-tight font-light tracking-[-0.48px]"
        >
          Completed
        </text>
      </svg>
    </div>
  )
}

export { SemiCircularProgress }
