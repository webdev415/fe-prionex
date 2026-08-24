/**
 * "1-on-1 today" tile drill-down (Tanya, 13.08: the tile showed a session
 * exists but nothing opened — who / when / topic were invisible).
 *
 * Covers:
 *  - clicking the tile opens the dialog with today's sessions;
 *  - the dialog shows operator name, time, duration and notes;
 *  - non-today / non-scheduled sessions are filtered out;
 *  - the other tiles stay non-interactive (no role="button");
 *  - `enabled=false` keeps the 1-on-1 tile inert too.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { TrainerHeaderStrip } from '../TrainerHeaderStrip'
import { HeaderKpiTile } from '../HeaderKpiTile'
import { Icons } from '@/lib/icons'

/** Same formatting call the dialog uses — keeps the assertion TZ-proof. */
function formatSessionTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string, opts?: Record<string, unknown>) => {
      let out = fallback ?? _key
      for (const [k, v] of Object.entries(opts ?? {})) {
        out = out.replace(`{{${k}}}`, String(v))
      }
      return out
    },
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

const authState = { user: { active_project_id: 1, id: 7 } }
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: typeof authState) => unknown) => selector(authState),
}))

vi.mock('@/features/users/hooks', () => ({
  useOperators: () => ({
    data: [
      { id: 42, full_name: 'Оксана Оператор' },
      { id: 43, full_name: 'Петро Вчорашній' },
    ],
  }),
}))

// Today's date in UTC — mirrors the BE tile counter (date(scheduled_at) =
// current UTC date), so the fixture is today regardless of the local TZ.
function todayUtcAt(hour: number, minute: number): string {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute)
  ).toISOString()
}

function shiftDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

const todaySession = {
  id: 1,
  trainer_id: 7,
  operator_id: 42,
  scheduled_at: todayUtcAt(9, 30),
  duration_minutes: 45,
  status: 'scheduled',
  notes: 'Розбір дзвінка з боржником',
  created_at: todayUtcAt(8, 0),
}

const yesterdaySession = {
  ...todaySession,
  id: 2,
  operator_id: 43,
  scheduled_at: shiftDays(todayUtcAt(9, 30), -1),
}

const cancelledToday = {
  ...todaySession,
  id: 3,
  operator_id: 43,
  status: 'cancelled',
}

const useOneOnOnesMock = vi.fn((_filters: Record<string, unknown>, enabled: boolean = true) => ({
  data: enabled ? [yesterdaySession, todaySession, cancelledToday] : undefined,
  isLoading: false,
  isError: false,
}))

vi.mock('@/features/quality/coaching/hooks', () => ({
  useHeaderKpis: () => ({
    data: {
      in_progress_count: 2,
      average_score: 80,
      average_score_delta_pct: null,
      team_plan_pct: 50,
      team_plan_delta_pct: null,
      tasks_today_count: 4,
      one_on_one_today_count: 1,
      period_from: '2026-08-24T00:00:00Z',
      period_to: '2026-08-24T23:59:59Z',
    },
    isLoading: false,
  }),
  useOneOnOnes: (filters: Record<string, unknown>, enabled?: boolean) =>
    useOneOnOnesMock(filters, enabled),
}))

const filters = { period: 'today' as const }

describe('TrainerHeaderStrip — 1-on-1 today drill-down', () => {
  it('opens the sessions dialog on tile click and shows who/when/topic', () => {
    render(<TrainerHeaderStrip filters={filters} />)

    // Before the click there is no dialog and the list query is disabled.
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(useOneOnOnesMock).toHaveBeenCalledWith(
      { scope: 'mine', upcoming_only: false, limit: 200 },
      false
    )

    fireEvent.click(screen.getByRole('button', { name: '1-on-1 today' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(useOneOnOnesMock).toHaveBeenCalledWith(
      { scope: 'mine', upcoming_only: false, limit: 200 },
      true
    )

    // Who / when / how long / topic.
    expect(screen.getByText('Оксана Оператор')).toBeInTheDocument()
    expect(
      screen.getByText(new RegExp(formatSessionTime(todaySession.scheduled_at)))
    ).toBeInTheDocument()
    expect(screen.getByText(/45 min/)).toBeInTheDocument()
    expect(screen.getByText('Розбір дзвінка з боржником')).toBeInTheDocument()

    // Yesterday's and cancelled sessions are filtered out.
    expect(screen.queryByText('Петро Вчорашній')).toBeNull()
  })

  it('keeps every other tile non-interactive', () => {
    render(<TrainerHeaderStrip filters={filters} />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]).toHaveAccessibleName('1-on-1 today')
  })

  it('keeps the 1-on-1 tile inert when the strip is disabled', () => {
    render(<TrainerHeaderStrip filters={filters} enabled={false} />)

    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('HeaderKpiTile', () => {
  const baseProps = {
    label: 'Tasks today',
    value: '4',
    icon: Icons.Brochure,
    iconColor: 'text-[#3B82F6]',
    iconBg: 'bg-[#3B82F6]/10',
    accentColor: '#3B82F6',
  }

  it('stays a plain non-focusable card without onClick', () => {
    const { container } = render(<HeaderKpiTile {...baseProps} />)

    expect(screen.queryByRole('button')).toBeNull()
    expect(container.querySelector('[tabindex]')).toBeNull()
  })

  it('becomes a focusable button with onClick and reacts to Enter', () => {
    const onClick = vi.fn()
    render(<HeaderKpiTile {...baseProps} onClick={onClick} />)

    const tile = screen.getByRole('button', { name: 'Tasks today' })
    expect(tile).toHaveAttribute('tabindex', '0')

    fireEvent.click(tile)
    fireEvent.keyDown(tile, { key: 'Enter' })
    expect(onClick).toHaveBeenCalledTimes(2)
  })
})
