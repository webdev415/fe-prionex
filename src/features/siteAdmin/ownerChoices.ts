/**
 * Из чего выбирать проект-владельца сайта (17-40b, r4–r5).
 *
 * Выбор должен видеть ВСЕ активные проекты: владельцем может стать любой, и
 * проект, не попавший в первую страницу, иначе просто нельзя было бы выбрать,
 * а экран не объяснил бы почему. `/api/v1/projects` листается страницами,
 * поэтому список собирается последовательным обходом, как справочник
 * сотрудников (`aiSettings/hooks/useUserDirectory.ts`).
 *
 * Поиск на сервере есть (`ProjectFilters.search`), но выбор владельца —
 * обычный `Select` без ввода текста: искать в нём нечем, и серверный поиск
 * здесь не помог бы. Выбор с поиском по мере ввода — отдельная доработка
 * экрана (r5: отложена осознанно). Пока установка держит десятки проектов,
 * обход — это одна страница.
 *
 * {@link OWNER_CHOICES_MAX_PAGES} держит худший случай ограниченным
 * (20 × 100 = 2000 проектов — на порядки больше, чем есть), и цикл не
 * бесконечен, если сервер начнёт врать про `total_pages`.
 *
 * Список неполон — `truncated`, и экран говорит об этом вслух, а не молчит о
 * пропавших проектах. Причин две: упёрлись в потолок или страница после первой
 * не прочиталась (r5). Во втором случае прочитанное не выбрасывается — один
 * сбойный запрос не должен оставлять выбор пустым. Не прочиталась ПЕРВАЯ —
 * показать нечего, это отказ, и экран называет его отказом.
 *
 * Отмена (`signal` React Query: вкладку закрыли) доходит до каждой страницы и
 * останавливает обход; отменённый обход — отказ, а не «неполный список».
 *
 * Спрашивает только тот, кто может сменить владельца: остальным выбор показан
 * выключенным, и каждый такой запрос был бы лишним (у контент-менеджера может
 * не быть и права читать проекты).
 */
import { getProjects } from '@/features/projects/api/projectsApi'
import type { ProjectListParams, ProjectListResponse } from '@/features/projects/types'

export const OWNER_CHOICES_PAGE_SIZE = 100
export const OWNER_CHOICES_MAX_PAGES = 20

export interface OwnerProjectChoice {
  id: number
  name: string
}

export interface OwnerProjectChoices {
  projects: OwnerProjectChoice[]
  /**
   * Часть активных проектов в список не попала: страниц больше потолка или
   * страница после первой не прочиталась.
   */
  truncated: boolean
}

type ProjectPage = (
  params: ProjectListParams,
  config?: { signal?: AbortSignal }
) => Promise<ProjectListResponse>

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The owner project walk was aborted', 'AbortError')
}

export async function fetchOwnerProjectChoices(
  getPage: ProjectPage = getProjects,
  signal?: AbortSignal
): Promise<OwnerProjectChoices> {
  // По id: проект, созданный во время обхода, сдвигает страницы, и один и тот
  // же проект мог бы прийти дважды — выбор показал бы два одинаковых пункта.
  const byId = new Map<number, OwnerProjectChoice>()
  const collected = () => [...byId.values()]
  let page = 1
  let totalPages = 1

  while (page <= totalPages && page <= OWNER_CHOICES_MAX_PAGES) {
    if (signal?.aborted) throw abortReason(signal)
    let response: ProjectListResponse
    try {
      response = await getPage(
        { page, page_size: OWNER_CHOICES_PAGE_SIZE, status: 'active' },
        { signal }
      )
    } catch (error) {
      if (page === 1 || signal?.aborted) throw error
      return { projects: collected(), truncated: true }
    }
    for (const project of response.projects ?? []) {
      byId.set(project.id, { id: project.id, name: project.name })
    }
    totalPages = response.pagination?.total_pages ?? 1
    page += 1
  }

  return { projects: collected(), truncated: totalPages > OWNER_CHOICES_MAX_PAGES }
}
