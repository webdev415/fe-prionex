/**
 * Справочник «id сотрудника → имя» для админских экранов, где сервер отдаёт
 * только идентификаторы (раздел «Память» знает про скоуп `user:6951`, но не
 * про ФИО).
 *
 * Отдельного batch-эндпоинта «имена по списку id» в auth-service нет, а
 * `/api/v1/admin/users` листается по 100 — поэтому справочник собирается
 * последовательным обходом страниц. {@link DIRECTORY_MAX_PAGES} держит худший
 * случай ограниченным: 10 запросов на 1000 сотрудников — больше, чем есть у
 * кол-центра, и при этом не бесконечный цикл, если сервер начнёт врать про
 * `total_pages`.
 *
 * Запрос гейтится правом `view_users`: у админа AI-настроек его может не быть,
 * и тогда справочник просто пуст — вызывающий показывает id, а не ловит 403.
 */
import { useQuery } from '@tanstack/react-query'

import { PERMISSIONS } from '@/constants/permissions'
import { useHasPermission } from '@/hooks'
import { getUsers } from '@/features/users/api/usersApi'

const DIRECTORY_PAGE_SIZE = 100
const DIRECTORY_MAX_PAGES = 10

export const userDirectoryKey = ['users', 'directory', DIRECTORY_PAGE_SIZE] as const

async function fetchUserDirectory(): Promise<Map<number, string>> {
  const directory = new Map<number, string>()
  let page = 1
  let totalPages = 1

  while (page <= totalPages && page <= DIRECTORY_MAX_PAGES) {
    const response = await getUsers({ page, page_size: DIRECTORY_PAGE_SIZE })
    for (const user of response.users ?? []) {
      const name = user.full_name?.trim() || user.username
      if (name) directory.set(user.id, name)
    }
    totalPages = response.pagination?.total_pages ?? 1
    page += 1
  }

  return directory
}

/**
 * @param enabled дополнительное условие вызывающего (например «секция вообще
 * что-то показывает») — право `view_users` проверяется поверх него.
 */
export function useUserDirectory(enabled = true) {
  const canViewUsers = useHasPermission(PERMISSIONS.USERS.VIEW)

  return useQuery({
    queryKey: userDirectoryKey,
    queryFn: fetchUserDirectory,
    enabled: enabled && canViewUsers,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}
