/**
 * Выбор владельца сайта видит ВСЕ активные проекты (17-40b, r4).
 *
 * r3 читал одну страницу из 100: на установке, где активных проектов больше,
 * нужный владелец просто отсутствовал в выборе, и экран не объяснял почему.
 * Теперь список собирается обходом страниц до `total_pages` — с потолком,
 * который держит худший случай ограниченным, и с признаком `truncated`, когда
 * потолок достигнут.
 *
 * Страница подаётся подменой `getPage`, а не HTTP: предмет проверки — обход,
 * а не транспорт.
 */
import { describe, expect, it, vi } from 'vitest'
import type { ApiProject, ProjectListParams, ProjectListResponse } from '@/features/projects/types'
import {
  fetchOwnerProjectChoices,
  OWNER_CHOICES_MAX_PAGES,
  OWNER_CHOICES_PAGE_SIZE,
} from '../ownerChoices'

function project(id: number): ApiProject {
  return { id, name: `Project ${id}`, status: 'active', is_active: true } as ApiProject
}

/** Сервер с `total` активными проектами, отдающий их страницами. */
function serverWith(total: number, claimedPages?: number) {
  return vi.fn(async (params: ProjectListParams): Promise<ProjectListResponse> => {
    const page = params.page ?? 1
    const size = params.page_size ?? OWNER_CHOICES_PAGE_SIZE
    const ids = Array.from({ length: total }, (_, index) => index + 1)
    return {
      projects: ids.slice((page - 1) * size, page * size).map(project),
      pagination: {
        page,
        page_size: size,
        total_items: total,
        total_pages: claimedPages ?? Math.max(1, Math.ceil(total / size)),
      },
    }
  })
}

describe('fetchOwnerProjectChoices', () => {
  it('150 активных проектов — оба листа прочитаны, проект со второй страницы в выборе', async () => {
    const getPage = serverWith(150)
    const choices = await fetchOwnerProjectChoices(getPage)

    expect(getPage).toHaveBeenCalledTimes(2)
    expect(choices.projects).toHaveLength(150)
    expect(choices.projects).toContainEqual({ id: 150, name: 'Project 150' })
    expect(choices.truncated).toBe(false)
  })

  it('спрашивает только активные проекты, страницами по 100', async () => {
    const getPage = serverWith(150)
    await fetchOwnerProjectChoices(getPage)

    expect(getPage.mock.calls.map(([params]) => params)).toEqual([
      { page: 1, page_size: OWNER_CHOICES_PAGE_SIZE, status: 'active' },
      { page: 2, page_size: OWNER_CHOICES_PAGE_SIZE, status: 'active' },
    ])
  })

  it('одна страница — один запрос', async () => {
    const getPage = serverWith(7)
    const choices = await fetchOwnerProjectChoices(getPage)

    expect(getPage).toHaveBeenCalledTimes(1)
    expect(choices.projects).toHaveLength(7)
    expect(choices.truncated).toBe(false)
  })

  it('сервер обещает страниц без конца — обход упирается в потолок и говорит об этом', async () => {
    const getPage = serverWith(150, 10_000)
    const choices = await fetchOwnerProjectChoices(getPage)

    expect(getPage).toHaveBeenCalledTimes(OWNER_CHOICES_MAX_PAGES)
    expect(choices.truncated).toBe(true)
  })

  it('ровно на потолке — всё прочитано, «обрезано» не говорится', async () => {
    const getPage = serverWith(OWNER_CHOICES_MAX_PAGES * OWNER_CHOICES_PAGE_SIZE)
    const choices = await fetchOwnerProjectChoices(getPage)

    expect(getPage).toHaveBeenCalledTimes(OWNER_CHOICES_MAX_PAGES)
    expect(choices.truncated).toBe(false)
  })

  it('проект, пришедший дважды (страницы сдвинулись), в выборе один раз', async () => {
    const getPage = vi.fn(
      async (params: ProjectListParams): Promise<ProjectListResponse> => ({
        projects: params.page === 1 ? [project(1), project(2)] : [project(2), project(3)],
        pagination: { page: params.page ?? 1, page_size: 2, total_items: 4, total_pages: 2 },
      })
    )
    const choices = await fetchOwnerProjectChoices(getPage)

    expect(choices.projects.map((item) => item.id)).toEqual([1, 2, 3])
  })

  it('ответ без `pagination` — одна страница, а не бесконечный цикл', async () => {
    const getPage = vi.fn(
      async (): Promise<ProjectListResponse> =>
        ({ projects: [project(1)] }) as unknown as ProjectListResponse
    )
    const choices = await fetchOwnerProjectChoices(getPage)

    expect(getPage).toHaveBeenCalledTimes(1)
    expect(choices.projects).toEqual([{ id: 1, name: 'Project 1' }])
  })
})
