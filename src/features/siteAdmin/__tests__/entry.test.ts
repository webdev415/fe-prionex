/**
 * Кнопка «Открыть админку сайта» или что сказать вместо неё (17-40b, r2).
 *
 * Правда о праве — ответ сервера `current_user_site_role` (роль в
 * ПРОЕКТЕ-ВЛАДЕЛЬЦЕ), а не права JWT активного проекта. Таблица держит три
 * сцены, которые r1 решал неверно:
 *  - право только в проекте-владельце, активен другой проект → кнопка есть;
 *  - право только в чужом проекте → не «перейдите в проект-владелец» (там
 *    права нет), а «нет права в проекте-владельце»;
 *  - сеанс «от имени» → не кнопка с гарантированным 403, а объяснение.
 * Запасной путь без поля — прежняя догадка по JWT.
 */
import { describe, expect, it } from 'vitest'
import { siteAdminEntry, type SiteAdminEntryInput } from '../entry'
import type { SiteAdminEntry, SiteAdminSettings, SiteRole } from '../types'

const OWNER = 7
const OTHER = 9

function input(
  settings: Partial<SiteAdminSettings>,
  extra: Partial<Omit<SiteAdminEntryInput, 'settings'>> = {}
): SiteAdminEntryInput {
  return {
    settings: { site_owner_project_id: OWNER, configured: true, ...settings },
    hasSiteRightInActiveProject: false,
    activeProjectId: String(OTHER),
    isImpersonating: false,
    ...extra,
  }
}

describe('siteAdminEntry — по ответу сервера', () => {
  it.each(['editor', 'publisher'] as SiteRole[])(
    'роль %s в проекте-владельце → кнопка, даже из другого проекта и без прав в JWT',
    (role) => {
      expect(siteAdminEntry(input({ current_user_site_role: role }))).toBe('ready')
    }
  )

  it('право только в чужом проекте → «нет права в проекте-владельце», не «перейдите»', () => {
    const entry = siteAdminEntry(
      input({ current_user_site_role: null }, { hasSiteRightInActiveProject: true })
    )
    expect(entry).toBe('no_right_in_owner')
  })

  it('право по JWT в самом проекте-владельце, а сервер роли не дал → тоже отказ', () => {
    // Роль могли снять минуту назад: JWT ещё помнит право, сервер — нет.
    const entry = siteAdminEntry(
      input(
        { current_user_site_role: null },
        { hasSiteRightInActiveProject: true, activeProjectId: String(OWNER) }
      )
    )
    expect(entry).toBe('no_right_in_owner')
  })

  it('сеанс «от имени» → объяснение, а не кнопка с гарантированным 403', () => {
    const entry = siteAdminEntry(
      input(
        { current_user_site_role: null },
        { hasSiteRightInActiveProject: true, isImpersonating: true }
      )
    )
    expect(entry).toBe('impersonating')
  })

  it('ни роли, ни права в JWT (администратор настроек) → ничего', () => {
    expect(siteAdminEntry(input({ current_user_site_role: null }))).toBe('hidden')
  })

  it('не настроено → сказать сразу, раньше всего (порядок сервера 503 → 409 → 403)', () => {
    const cases: SiteAdminEntryInput[] = [
      input({ configured: false, current_user_site_role: 'editor' }),
      input(
        { configured: false, current_user_site_role: null, site_owner_project_id: null },
        { hasSiteRightInActiveProject: true }
      ),
    ]
    for (const item of cases) expect(siteAdminEntry(item)).toBe('not_configured')
  })

  it('владелец не выбран → сказать сразу, до кнопки', () => {
    const entry = siteAdminEntry(
      input(
        { site_owner_project_id: null, current_user_site_role: null },
        { hasSiteRightInActiveProject: true }
      )
    )
    expect(entry).toBe('owner_not_set')
  })
})

describe('siteAdminEntry — запасной путь: сервер о роли промолчал', () => {
  const cases: Array<[string, SiteAdminEntryInput, SiteAdminEntry]> = [
    ['без права в JWT', input({}), 'hidden'],
    [
      'право в JWT, активен проект-владелец',
      input({}, { hasSiteRightInActiveProject: true, activeProjectId: String(OWNER) }),
      'ready',
    ],
    [
      'право в JWT, активен другой проект',
      input({}, { hasSiteRightInActiveProject: true }),
      'switch_project',
    ],
    [
      'владелец не выбран',
      input({ site_owner_project_id: null }, { hasSiteRightInActiveProject: true }),
      'owner_not_set',
    ],
    [
      'не настроено',
      input({ configured: false }, { hasSiteRightInActiveProject: true }),
      'not_configured',
    ],
    [
      'сеанс «от имени»',
      input(
        {},
        { hasSiteRightInActiveProject: true, activeProjectId: String(OWNER), isImpersonating: true }
      ),
      'impersonating',
    ],
  ]

  it.each(cases)('%s', (_name, item, expected) => {
    expect(item.settings.current_user_site_role).toBeUndefined()
    expect(siteAdminEntry(item)).toBe(expected)
  })
})
