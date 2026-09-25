/**
 * React Query хуки админки сайта (17-40b).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { siteAdminApi } from './api'
import type { UpdateSiteAdminSettingsInput } from './types'

export const siteAdminKeys = {
  all: ['siteAdmin'] as const,
  settings: () => [...siteAdminKeys.all, 'settings'] as const,
}

export function useSiteAdminSettings(enabled = true) {
  return useQuery({
    queryKey: siteAdminKeys.settings(),
    queryFn: () => siteAdminApi.getSiteAdminSettings(),
    enabled,
  })
}

export function useUpdateSiteAdminSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateSiteAdminSettingsInput) =>
      siteAdminApi.updateSiteAdminSettings(input),
    onSuccess: (data) => {
      queryClient.setQueryData(siteAdminKeys.settings(), data)
    },
    // Отказ (например, выбранный проект уже удалён) значит, что экран держит
    // устаревшую картину — перечитать её, а не спорить с ней.
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: siteAdminKeys.settings() })
    },
  })
}

/**
 * Ключ входа — не данные для кэша: одноразовый и живёт минуту.
 *
 * Результат мутации React Query хранит в `MutationCache` (`data`), пока
 * компонент смонтирован, и ещё `gcTime` после. Поэтому `gcTime: 0` здесь, а
 * экран зовёт `reset()` сразу после `safeHttpUrl`, до `window.open` (так сброс
 * случается и на негодном адресе) — ключ в памяти страницы не задерживается.
 * `retry: false`: повтор выпустил бы второй ключ и отодвинул `window.open` за
 * окно активации пользователя (блокировщик всплывающих окон); повтор — это
 * новое нажатие.
 *
 * На отказе перечитываются настройки: 403/409/503 значат, что экран показал
 * кнопку по устаревшей картине, и новая скажет человеку правду без нажатия.
 * Если и перечитать не удалось, экран держит прежнюю картину (r3, D-2).
 */
export function useSiteAdminHandoff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => siteAdminApi.requestSiteAdminHandoff(),
    gcTime: 0,
    retry: false,
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: siteAdminKeys.settings() })
    },
  })
}
