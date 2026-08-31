/**
 * Кружок заполненности контекста — как индикатор контекста в Claude Code:
 * маленькое кольцо возле композера, доля окна закрашена дугой, цвет уходит в
 * жёлтый после 70% и в красный после 90%. Подробности — в нативном title
 * (тултип браузера): «Контекст: 15,6 тис. / 262 тис. токенів (6%)».
 */
import { useTranslation } from 'react-i18next'
import {
  CONTEXT_WINDOW_TOKENS,
  contextUsageLevel,
  formatTokensShort,
  type ContextUsageSnapshot,
} from './contextUsage'

const RING_COLORS: Record<ReturnType<typeof contextUsageLevel>, string> = {
  ok: 'var(--color-primary-500)',
  warn: 'var(--color-warning-500)',
  danger: 'var(--destructive)',
}

const SIZE = 16
const STROKE = 2.5
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function ContextUsageRing({ usage }: { usage: ContextUsageSnapshot | null }) {
  const { t } = useTranslation()
  if (usage == null) return null

  const level = contextUsageLevel(usage.fraction)
  const percent = Math.round(usage.fraction * 100)
  // Едва начатый диалог рисуем минимальной видимой дугой, а не пустым кольцом.
  const arc = Math.max(usage.fraction, 0.04) * CIRCUMFERENCE
  const label = t('pages.aiAssistant.contextUsageTitle', {
    used: formatTokensShort(usage.usedTokens),
    max: formatTokensShort(CONTEXT_WINDOW_TOKENS),
    percent,
  })

  return (
    <span
      className="inline-flex items-center gap-1 select-none"
      title={label}
      aria-label={label}
      data-testid="context-usage-ring"
      data-level={level}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-hidden>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--border)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={RING_COLORS[level]}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${CIRCUMFERENCE - arc}`}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>
      <span className="text-muted-foreground text-[10px] tabular-nums">{percent}%</span>
    </span>
  )
}
