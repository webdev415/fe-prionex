import { describe, expect, it } from 'vitest'
import {
  filterStateToTemplate,
  templateToExtras,
  templateToFilterState,
  type TemplateExtras,
} from '../filterTemplateMapping'
import { DEFAULT_USER_FILTERS, type UserFilterState } from '../userFilterDefaults'

const EXTRAS: TemplateExtras = { search: '', searchField: 'full_name', pageSize: 10 }

function state(overrides: Partial<UserFilterState> = {}): UserFilterState {
  return { ...DEFAULT_USER_FILTERS, ...overrides }
}

describe('filterStateToTemplate', () => {
  it('keeps only what was narrowed', () => {
    const document = filterStateToTemplate(state({ workFormat: 'remote' }), EXTRAS)

    expect(document).toEqual({ work_format: 'remote', page_size: 10 })
  })

  it('saves every narrowed filter', () => {
    const document = filterStateToTemplate(
      state({
        roleId: 3,
        projectId: 4,
        departmentIds: [5, 6],
        groupId: 6,
        workFormat: 'office',
        statusFilter: 'all',
        sortBy: 'full_name',
        sortOrder: 'asc',
      }),
      EXTRAS
    )

    expect(document).toMatchObject({
      role_id: 3,
      project_id: 4,
      department_ids: '5,6',
      group_id: 6,
      work_format: 'office',
      status: 'all',
      sort_by: 'full_name',
      sort_order: 'asc',
    })
  })

  it('saves the search only when there is one', () => {
    expect(filterStateToTemplate(state(), EXTRAS).search).toBeUndefined()

    const withSearch = filterStateToTemplate(state(), {
      ...EXTRAS,
      search: '  olena  ',
    })

    expect(withSearch.search).toBe('olena')
    expect(withSearch.search_field).toBe('full_name')
  })
})

describe('templateToFilterState', () => {
  it('restores what was saved', () => {
    const restored = templateToFilterState({
      role_id: 3,
      project_id: 4,
      work_format: 'remote',
      status: 'all',
      sort_by: 'full_name',
      sort_order: 'asc',
    })

    expect(restored).toMatchObject({
      roleId: 3,
      projectId: 4,
      workFormat: 'remote',
      statusFilter: 'all',
      sortBy: 'full_name',
      sortOrder: 'asc',
    })
  })

  it('resets anything the template does not mention', () => {
    const restored = templateToFilterState({ work_format: 'remote' })

    expect(restored.roleId).toBe(DEFAULT_USER_FILTERS.roleId)
    expect(restored.departmentIds).toEqual(DEFAULT_USER_FILTERS.departmentIds)
    expect(restored.statusFilter).toBe(DEFAULT_USER_FILTERS.statusFilter)
  })

  it('ignores a value the list would not accept', () => {
    const restored = templateToFilterState({
      work_format: 'hybrid',
      sort_order: 'sideways',
      status: 'nope',
      role_id: -1,
    })

    expect(restored.workFormat).toBe(DEFAULT_USER_FILTERS.workFormat)
    expect(restored.sortOrder).toBe(DEFAULT_USER_FILTERS.sortOrder)
    expect(restored.statusFilter).toBe(DEFAULT_USER_FILTERS.statusFilter)
    expect(restored.roleId).toBe(DEFAULT_USER_FILTERS.roleId)
  })

  it('round-trips a narrowed state', () => {
    const original = state({ roleId: 2, workFormat: 'remote', sortOrder: 'asc' })

    expect(templateToFilterState(filterStateToTemplate(original, EXTRAS))).toEqual(original)
  })
})

describe('templateToExtras', () => {
  it('restores the search and page size', () => {
    const extras = templateToExtras(
      { search: 'olena', search_field: 'email', page_size: 50 },
      EXTRAS
    )

    expect(extras).toEqual({ search: 'olena', searchField: 'email', pageSize: 50 })
  })

  it('clears the search when the template has none', () => {
    expect(templateToExtras({ page_size: 20 }, { ...EXTRAS, search: 'stale' }).search).toBe('')
  })

  it('falls back when the page size is nonsense', () => {
    expect(templateToExtras({ page_size: 0 }, EXTRAS).pageSize).toBe(10)
  })
})

describe('the status a template holds against the status the list takes', () => {
  const LIST_ACCEPTS = ['all', 'active', 'inactive', 'suspended']

  it.each(['all', 'active', 'inactive'] as const)(
    'saves %s as a word the list endpoint already takes',
    (statusFilter) => {
      const document = filterStateToTemplate(state({ statusFilter }), EXTRAS)

      if (document.status !== undefined) {
        expect(LIST_ACCEPTS).toContain(document.status)
      }
      expect(templateToFilterState(document).statusFilter).toBe(statusFilter)
    }
  )

  it('stores the word the endpoint knows, not a word of its own', () => {
    const document = filterStateToTemplate(state({ statusFilter: 'inactive' }), EXTRAS)

    expect(document.status).toBe('inactive')
  })

  it('restores a template saved before the two agreed on their words', () => {
    expect(templateToFilterState({ status: 'disabled' }).statusFilter).toBe('inactive')
  })
})
