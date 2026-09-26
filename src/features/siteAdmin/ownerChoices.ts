/**
 * Из чего выбирать проект-владельца сайта (17-40b, r4).
 *
 * Выбор должен видеть ВСЕ активные проекты: владельцем может стать любой, и
 * проект, не попавший в первую страницу, иначе просто нельзя было бы выбрать,
 * а экран не объяснил бы почему. Поиска на сервере под это нет, а
 * `/api/v1/projects` листается страницами, поэтому список собирается
 * последовательным обходом, как справочник сотрудников
 * (`aiSettings/hooks/useUserDirectory.ts`). {@link OWNER_CHOICES_MAX_PAGES}
 * держит худший случай ограниченным (20 × 100 = 2000 проектов — на порядки
 * больше, чем есть), и цикл не бесконечен, если сервер начнёт врать про
 * `total_pages`. Упёрлись в потолок — `truncated`, и экран говорит об этом
 * вслух, а не молчит о пропавших проектах.
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
  /** Страниц больше потолка: часть активных проектов в список не попала. */
  truncated: boolean
}

type ProjectPage = (params: ProjectListParams) => Promise<ProjectListResponse>

export async function fetchOwnerProjectChoices(
  getPage: ProjectPage = getProjects
): Promise<OwnerProjectChoices> {
  // По id: проект, созданный во время обхода, сдвигает страницы, и один и тот
  // же проект мог бы прийти дважды — выбор показал бы два одинаковых пункта.
  const byId = new Map<number, OwnerProjectChoice>()
  let page = 1
  let totalPages = 1

  while (page <= totalPages && page <= OWNER_CHOICES_MAX_PAGES) {
    const response = await getPage({
      page,
      page_size: OWNER_CHOICES_PAGE_SIZE,
      status: 'active',
    })
    for (const project of response.projects ?? []) {
      byId.set(project.id, { id: project.id, name: project.name })
    }
    totalPages = response.pagination?.total_pages ?? 1
    page += 1
  }

  return { projects: [...byId.values()], truncated: totalPages > OWNER_CHOICES_MAX_PAGES }
}
