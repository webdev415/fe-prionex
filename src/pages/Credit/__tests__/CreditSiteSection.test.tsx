/**
 * Настройки → Сайт (17-40b): владелец сайта и вход в админку сайта.
 *
 * Что защищаем:
 *  - «Сайт принадлежит проекту: <имя>» — имя берётся из ответа сервера, а
 *    если сервер его не прислал, из списка проектов; «не выбран» говорится
 *    только тогда, когда владельца действительно нет;
 *  - сменить владельца может только держатель `manage_settings`: у остальных
 *    выбор выключен и кнопки сохранения нет; в сеансе «от имени» выбор и
 *    кнопка выключены у всех (r3: сервер откажет всегда); отказ PUT 403
 *    `SITE_OWNER_CHANGE_DENIED` назван правилом, а не «спробуйте ще раз»;
 *  - кнопку «Открыть админку сайта» решает ответ сервера
 *    `current_user_site_role` — роль в ПРОЕКТЕ-ВЛАДЕЛЬЦЕ, а не права JWT
 *    активного проекта (r2); когда входа не будет, на месте кнопки сказано
 *    почему; без поля — прежняя догадка по JWT;
 *  - нажатие просит ключ и открывает выданный адрес в новой вкладке без
 *    `opener`, после чего мутация сбрасывается (ключ не остаётся в кэше);
 *    адрес не http(s) не открывается;
 *  - 401 / 403 / 409 / 503 называются разными словами — по телам 17-40a
 *    дословно; 503 без кода «не настроено» не выдаёт;
 *  - сбой ПЕРЕчитывания поверх прочитанной картины секцию не прячет (r3):
 *    кнопка и точный текст отказа остаются.
 */
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AxiosError, type AxiosResponse } from 'axios'
import { CreditSiteSection } from '../components/CreditSiteSection'
import { useAuthStore } from '@/stores/authStore'
import {
  useSiteAdminHandoff,
  useSiteAdminSettings,
  useUpdateSiteAdminSettings,
} from '@/features/siteAdmin/hooks'
import { useProjects } from '@/features/projects/hooks/useProjects'
import type { SiteAdminSettings, SiteRole } from '@/features/siteAdmin/types'

// Мокаем хуки, а не HTTP: живой QueryClient оставляет таймеры notifyManager,
// которые падают уже после teardown jsdom (см. CreditSettingsPage.test.tsx).
vi.mock('@/features/siteAdmin/hooks', () => ({
  siteAdminKeys: { all: ['siteAdmin'], settings: () => ['siteAdmin', 'settings'] },
  useSiteAdminSettings: vi.fn(),
  useUpdateSiteAdminSettings: vi.fn(),
  useSiteAdminHandoff: vi.fn(),
}))

vi.mock('@/features/projects/hooks/useProjects', () => ({
  projectsKeys: { all: ['projects'] },
  useProjects: vi.fn(),
  useProjectDetail: vi.fn(),
}))

const OWNER_ID = 7
const OTHER_ID = 9

const PROJECTS = [
  { id: OWNER_ID, name: 'Owner Project Alpha' },
  { id: OTHER_ID, name: 'Second Project Beta' },
]

/** Ответ GET 17-40a: владелец выбран, вход настроен, роль у вызывающего — editor. */
const SERVER_SETTINGS: SiteAdminSettings = {
  site_owner_project_id: OWNER_ID,
  site_owner_project_name: 'Owner Project Alpha',
  configured: true,
  current_user_site_role: 'editor',
}

/** Тела отказов 17-40a дословно (`routers/site_admin.py`). */
const BODY = {
  notConfigured: { detail: 'site_admin_not_configured', code: 'SITE_ADMIN_NOT_CONFIGURED' },
  ownerNotSet: { detail: 'site_owner_not_set', code: 'SITE_OWNER_NOT_SET' },
  accessDenied: { detail: 'site_admin_access_denied', code: 'SITE_ADMIN_ACCESS_DENIED' },
  ownerChangeDenied: { detail: 'site_owner_change_denied', code: 'SITE_OWNER_CHANGE_DENIED' },
  projectNotFound: {
    detail: 'site_owner_project_not_found',
    code: 'SITE_OWNER_PROJECT_NOT_FOUND',
  },
}

const handoffMutate = vi.fn()
const handoffReset = vi.fn()
const updateMutate = vi.fn()

function mockSettings(data: SiteAdminSettings | undefined, extra: Record<string, unknown> = {}) {
  vi.mocked(useSiteAdminSettings).mockReturnValue({
    data,
    isLoading: false,
    error: null,
    ...extra,
  } as unknown as ReturnType<typeof useSiteAdminSettings>)
}

function signIn(
  permissions: string[],
  activeProjectId: string | null = String(OWNER_ID),
  isImpersonating = false
) {
  useAuthStore.setState({
    user: {
      id: '1',
      username: 'content.manager',
      projects: [],
      active_project_id: activeProjectId,
      permissions,
    } as never,
    isImpersonating,
  })
}

function httpError(status: number, data: unknown = {}): AxiosError {
  return new AxiosError('request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    data,
    statusText: '',
    headers: {},
    config: {},
  } as AxiosResponse)
}

/** Ответ handoff: мутация сразу зовёт колбэк, как это сделал бы React Query. */
function handoffAnswers(outcome: { url: string } | { error: unknown }) {
  handoffMutate.mockImplementation(
    (
      _vars: unknown,
      options: { onSuccess?: (data: unknown) => void; onError?: (error: unknown) => void }
    ) => {
      if ('error' in outcome) options.onError?.(outcome.error)
      else options.onSuccess?.({ url: outcome.url, expires_in: 60 })
    }
  )
}

const OPEN_BUTTON = { name: 'credit.settings.site.openAdmin' }
const OWNER_SELECT = { name: 'credit.settings.site.ownerSelect' }
const SAVE_BUTTON = { name: 'credit.settings.site.save' }
const SAVE_FAILED = 'credit.settings.site.saveFailed'

describe('CreditSiteSection', () => {
  let openSpy: MockInstance<typeof window.open>

  beforeEach(() => {
    vi.clearAllMocks()
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    mockSettings({ ...SERVER_SETTINGS })
    vi.mocked(useProjects).mockReturnValue({
      data: { projects: PROJECTS, pagination: {} },
    } as unknown as ReturnType<typeof useProjects>)
    vi.mocked(useUpdateSiteAdminSettings).mockReturnValue({
      mutate: updateMutate,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useUpdateSiteAdminSettings>)
    vi.mocked(useSiteAdminHandoff).mockReturnValue({
      mutate: handoffMutate,
      reset: handoffReset,
      isPending: false,
    } as unknown as ReturnType<typeof useSiteAdminHandoff>)
  })

  afterEach(() => {
    openSpy.mockRestore()
    useAuthStore.setState({ user: null, isImpersonating: false })
  })

  describe('чей сайт', () => {
    it('называет проект-владельца по ответу сервера', () => {
      signIn(['site.content.edit'])
      render(<CreditSiteSection />)
      expect(screen.getByText('credit.settings.site.ownerLabel')).toBeInTheDocument()
      expect(screen.getByTestId('site-owner-name')).toHaveTextContent('Owner Project Alpha')
    })

    it('берёт имя из списка проектов, если сервер прислал только id', () => {
      signIn(['site.content.edit'])
      mockSettings({
        ...SERVER_SETTINGS,
        site_owner_project_id: OTHER_ID,
        site_owner_project_name: null,
      })
      render(<CreditSiteSection />)
      expect(screen.getByTestId('site-owner-name')).toHaveTextContent('Second Project Beta')
    })

    it('говорит «не выбран» только когда владельца нет', () => {
      signIn(['manage_settings'])
      mockSettings({
        site_owner_project_id: null,
        site_owner_project_name: null,
        configured: true,
        current_user_site_role: null,
      })
      render(<CreditSiteSection />)
      expect(screen.getByText('credit.settings.site.ownerNotSet')).toBeInTheDocument()
      expect(screen.queryByTestId('site-owner-name')).not.toBeInTheDocument()
    })

    it('не прочитав настройку, говорит об отказе, а не «не выбран»', () => {
      signIn(['manage_settings'])
      mockSettings(undefined, { error: httpError(500) })
      render(<CreditSiteSection />)
      expect(screen.getByText('credit.settings.site.loadFailed')).toBeInTheDocument()
      expect(screen.queryByText('credit.settings.site.ownerNotSet')).not.toBeInTheDocument()
    })

    it('401 на чтении — «сессия кончилась», а не «не удалось прочитать»', () => {
      signIn(['manage_settings'])
      mockSettings(undefined, { error: httpError(401, { detail: 'Not authenticated' }) })
      render(<CreditSiteSection />)
      expect(screen.getByText('credit.settings.site.errors.sessionExpired')).toBeInTheDocument()
      expect(screen.queryByText('credit.settings.site.loadFailed')).not.toBeInTheDocument()
    })

    it('сбой перечитывания поверх прочитанной картины — секция, кнопка и точный отказ на месте', () => {
      // После отказа выдачи хуки перечитывают настройки; при лежащем
      // auth-service повторный GET тоже падает, и React Query ставит `error`
      // поверх прежних `data`. r2 здесь заменял всю секцию на «не вдалося
      // прочитати», и «сервіс тимчасово недоступний» пропадал.
      signIn(['site.content.edit'])
      const gatewayDown = httpError(503, { message: 'upstream unavailable' })
      mockSettings({ ...SERVER_SETTINGS }, { error: gatewayDown })
      handoffAnswers({ error: gatewayDown })
      render(<CreditSiteSection />)

      expect(screen.queryByText('credit.settings.site.loadFailed')).not.toBeInTheDocument()
      expect(screen.getByText('credit.settings.site.refreshFailed')).toBeInTheDocument()
      expect(screen.getByTestId('site-owner-name')).toHaveTextContent('Owner Project Alpha')

      fireEvent.click(screen.getByRole('button', OPEN_BUTTON))
      expect(screen.getByRole('button', OPEN_BUTTON)).toBeInTheDocument()
      expect(screen.getByText('credit.settings.site.errors.unavailable')).toBeInTheDocument()
    })
  })

  describe('смена владельца', () => {
    it('без manage_settings выбор выключен, сохранения нет', () => {
      signIn(['site.content.edit', 'site.content.publish'])
      render(<CreditSiteSection />)
      expect(screen.getByRole('combobox', OWNER_SELECT)).toBeDisabled()
      expect(screen.queryByRole('button', SAVE_BUTTON)).not.toBeInTheDocument()
      expect(screen.getByText('credit.settings.site.ownerReadOnly')).toBeInTheDocument()
    })

    it('сеанс «от имени» с manage_settings — выбор и сохранение выключены, сказано почему', () => {
      // Сервер отвергает смену владельца в сеансе «от имени» всегда: выбор,
      // который гарантированно кончится 403, экран не даёт.
      signIn(['manage_settings'], String(OWNER_ID), true)
      render(<CreditSiteSection />)
      expect(screen.getByRole('combobox', OWNER_SELECT)).toBeDisabled()
      const save = screen.getByRole('button', SAVE_BUTTON)
      expect(save).toBeDisabled()
      fireEvent.click(save)
      expect(updateMutate).not.toHaveBeenCalled()
      expect(screen.getByText('credit.settings.site.ownerImpersonating')).toBeInTheDocument()
      expect(screen.queryByText('credit.settings.site.ownerReadOnly')).not.toBeInTheDocument()
    })

    it('контроль сцены: тот же человек не «от имени» — выбор включён', () => {
      signIn(['manage_settings'], String(OWNER_ID), false)
      render(<CreditSiteSection />)
      expect(screen.getByRole('combobox', OWNER_SELECT)).toBeEnabled()
      expect(screen.queryByText('credit.settings.site.ownerImpersonating')).not.toBeInTheDocument()
    })

    it('с manage_settings выбор включён, сохранение шлёт выбранный id', async () => {
      signIn(['manage_settings'])
      render(<CreditSiteSection />)
      const select = screen.getByRole('combobox', OWNER_SELECT)
      expect(select).toBeEnabled()

      const save = screen.getByRole('button', SAVE_BUTTON)
      // Ничего не изменено — сохранять нечего.
      expect(save).toBeDisabled()

      fireEvent.click(select)
      fireEvent.click(await screen.findByRole('option', { name: 'Second Project Beta' }))
      expect(save).toBeEnabled()
      fireEvent.click(save)

      expect(updateMutate).toHaveBeenCalledTimes(1)
      expect(updateMutate.mock.calls[0][0]).toEqual({ site_owner_project_id: OTHER_ID })
    })

    it.each([
      ['общий отказ', httpError(500), SAVE_FAILED],
      [
        '404 SITE_OWNER_PROJECT_NOT_FOUND',
        httpError(404, { ...BODY.projectNotFound }),
        'credit.settings.site.errors.ownerProjectGone',
      ],
      ['401', httpError(401), 'credit.settings.site.errors.sessionExpired'],
      [
        '403 SITE_OWNER_CHANGE_DENIED',
        httpError(403, { ...BODY.ownerChangeDenied }),
        'credit.settings.site.errors.ownerChangeDenied',
      ],
      [
        '403 SITE_OWNER_CHANGE_DENIED с уже переведённым detail',
        httpError(403, {
          detail: 'Змінити проєкт-власник сайту вам не дозволено.',
          code: 'SITE_OWNER_CHANGE_DENIED',
        }),
        'credit.settings.site.errors.ownerChangeDenied',
      ],
    ])('ошибка сохранения (%s) показана своими словами', (_name, error, text) => {
      signIn(['manage_settings'])
      vi.mocked(useUpdateSiteAdminSettings).mockReturnValue({
        mutate: updateMutate,
        isPending: false,
        isError: true,
        error,
      } as unknown as ReturnType<typeof useUpdateSiteAdminSettings>)
      render(<CreditSiteSection />)
      expect(screen.getByText(text)).toBeInTheDocument()
      // «Спробуйте ще раз» — только там, где повтор может помочь.
      expect(screen.queryAllByText(SAVE_FAILED)).toHaveLength(text === SAVE_FAILED ? 1 : 0)
    })
  })

  describe('кнопка «Открыть админку сайта» — по ответу сервера', () => {
    it('не видна без роли в проекте-владельце и без права в JWT — даже администратору настроек', () => {
      signIn(['manage_settings'])
      mockSettings({ ...SERVER_SETTINGS, current_user_site_role: null })
      render(<CreditSiteSection />)
      expect(screen.queryByRole('button', OPEN_BUTTON)).not.toBeInTheDocument()
      expect(screen.queryByText('credit.settings.site.adminHint')).not.toBeInTheDocument()
    })

    it.each(['editor', 'publisher'] as SiteRole[])(
      'роль %s в проекте-владельце — кнопка, даже из другого проекта и без права в JWT',
      (role) => {
        // Право есть только в проекте-владельце, активен другой: r1 здесь
        // прятал кнопку, хотя сервер выдал бы ключ.
        signIn(['manage_settings'], String(OTHER_ID))
        mockSettings({ ...SERVER_SETTINGS, current_user_site_role: role })
        render(<CreditSiteSection />)
        expect(screen.getByRole('button', OPEN_BUTTON)).toBeEnabled()
        expect(
          screen.queryByText('credit.settings.site.switchToOwnerProject')
        ).not.toBeInTheDocument()
      }
    )

    it('право по JWT в чужом проекте, в проекте-владельце нет — отказ словами, не «перейдите»', () => {
      signIn(['site.content.edit'], String(OTHER_ID))
      mockSettings({ ...SERVER_SETTINGS, current_user_site_role: null })
      render(<CreditSiteSection />)
      expect(screen.queryByRole('button', OPEN_BUTTON)).not.toBeInTheDocument()
      expect(screen.getByText('credit.settings.site.errors.forbidden')).toBeInTheDocument()
      expect(
        screen.queryByText('credit.settings.site.switchToOwnerProject')
      ).not.toBeInTheDocument()
    })

    it('сеанс «от имени» — объяснение вместо кнопки с гарантированным 403', () => {
      signIn(['site.content.edit'], String(OWNER_ID), true)
      mockSettings({ ...SERVER_SETTINGS, current_user_site_role: null })
      render(<CreditSiteSection />)
      expect(screen.queryByRole('button', OPEN_BUTTON)).not.toBeInTheDocument()
      expect(screen.getByText('credit.settings.site.impersonating')).toBeInTheDocument()
    })

    it('вход не настроен — сказано сразу, без нажатия и без кнопки', () => {
      signIn(['site.content.edit'])
      mockSettings({ ...SERVER_SETTINGS, configured: false })
      render(<CreditSiteSection />)
      expect(screen.queryByRole('button', OPEN_BUTTON)).not.toBeInTheDocument()
      expect(screen.getByText('credit.settings.site.errors.notConfigured')).toBeInTheDocument()
      expect(handoffMutate).not.toHaveBeenCalled()
    })

    it('владелец не выбран — сказано сразу, кнопки нет', () => {
      signIn(['site.content.edit'], String(OTHER_ID))
      mockSettings({
        site_owner_project_id: null,
        site_owner_project_name: null,
        configured: true,
        current_user_site_role: null,
      })
      render(<CreditSiteSection />)
      expect(screen.queryByRole('button', OPEN_BUTTON)).not.toBeInTheDocument()
      expect(screen.getByText('credit.settings.site.errors.ownerNotSet')).toBeInTheDocument()
    })
  })

  describe('кнопка — запасной путь: сервер о роли промолчал', () => {
    const LEGACY: SiteAdminSettings = {
      site_owner_project_id: OWNER_ID,
      site_owner_project_name: 'Owner Project Alpha',
    }

    it.each([['site.content.edit'], ['site.content.publish']])(
      'видна с правом %s в JWT, когда активен проект-владелец',
      (permission) => {
        signIn([permission])
        mockSettings({ ...LEGACY })
        render(<CreditSiteSection />)
        expect(screen.getByRole('button', OPEN_BUTTON)).toBeEnabled()
      }
    )

    it('в чужом активном проекте вместо кнопки — подсказка перейти в проект-владелец', () => {
      signIn(['site.content.edit'], String(OTHER_ID))
      mockSettings({ ...LEGACY })
      render(<CreditSiteSection />)
      expect(screen.queryByRole('button', OPEN_BUTTON)).not.toBeInTheDocument()
      expect(screen.getByText('credit.settings.site.switchToOwnerProject')).toBeInTheDocument()
    })

    it('без права в JWT — ничего', () => {
      signIn(['manage_settings'])
      mockSettings({ ...LEGACY })
      render(<CreditSiteSection />)
      expect(screen.queryByRole('button', OPEN_BUTTON)).not.toBeInTheDocument()
    })
  })

  describe('нажатие', () => {
    it('просит ключ, открывает адрес в новой вкладке без opener и сбрасывает мутацию', () => {
      signIn(['site.content.edit'])
      const url = 'https://cms.dev.example.test/admin/sso?t=one-time'
      handoffAnswers({ url })
      render(<CreditSiteSection />)
      fireEvent.click(screen.getByRole('button', OPEN_BUTTON))

      expect(handoffMutate).toHaveBeenCalledTimes(1)
      expect(openSpy).toHaveBeenCalledTimes(1)
      expect(openSpy).toHaveBeenCalledWith(url, '_blank', 'noopener,noreferrer')
      // Ключ лежит в `data` мутации — она сброшена сразу, а не через gcTime.
      expect(handoffReset).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('адрес не http(s) не открывает, а называет отказ (и тоже сбрасывает мутацию)', () => {
      signIn(['site.content.edit'])
      handoffAnswers({ url: 'javascript:alert(1)' })
      render(<CreditSiteSection />)
      fireEvent.click(screen.getByRole('button', OPEN_BUTTON))

      expect(openSpy).not.toHaveBeenCalled()
      expect(handoffReset).toHaveBeenCalledTimes(1)
      expect(screen.getByText('credit.settings.site.errors.failed')).toBeInTheDocument()
    })

    it('пока ключ запрашивается, кнопка выключена — второй ключ не просим', () => {
      signIn(['site.content.edit'])
      vi.mocked(useSiteAdminHandoff).mockReturnValue({
        mutate: handoffMutate,
        reset: handoffReset,
        isPending: true,
      } as unknown as ReturnType<typeof useSiteAdminHandoff>)
      render(<CreditSiteSection />)
      expect(screen.getByRole('button', OPEN_BUTTON)).toBeDisabled()
    })

    it.each([
      ['403', httpError(403, { ...BODY.accessDenied }), 'credit.settings.site.errors.forbidden'],
      [
        '409 SITE_OWNER_NOT_SET',
        httpError(409, { ...BODY.ownerNotSet }),
        'credit.settings.site.errors.ownerNotSet',
      ],
      [
        '503 SITE_ADMIN_NOT_CONFIGURED',
        httpError(503, { ...BODY.notConfigured }),
        'credit.settings.site.errors.notConfigured',
      ],
      [
        '503 SITE_ADMIN_NOT_CONFIGURED с уже переведённым detail',
        httpError(503, { detail: 'Вхід не налаштований', code: 'SITE_ADMIN_NOT_CONFIGURED' }),
        'credit.settings.site.errors.notConfigured',
      ],
      [
        '503 без кода (шлюз)',
        httpError(503, { message: 'upstream unavailable' }),
        'credit.settings.site.errors.unavailable',
      ],
      [
        '401',
        httpError(401, { detail: 'Not authenticated' }),
        'credit.settings.site.errors.sessionExpired',
      ],
      ['500', httpError(500), 'credit.settings.site.errors.failed'],
    ])('отказ %s называется своими словами', (_name, error, text) => {
      signIn(['site.content.edit'])
      handoffAnswers({ error })
      render(<CreditSiteSection />)
      fireEvent.click(screen.getByRole('button', OPEN_BUTTON))

      expect(openSpy).not.toHaveBeenCalled()
      expect(screen.getByText(text)).toBeInTheDocument()
    })
  })
})
