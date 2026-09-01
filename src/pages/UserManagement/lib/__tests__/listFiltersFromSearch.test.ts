/**
 * The list's URL, translated into the filters its API takes.
 *
 * The two disagree on four names, and an endpoint ignores a query parameter it
 * does not know rather than refusing it. So a URL forwarded as it stands comes
 * back answered over everybody, in the right order, with only the count wrong -
 * which is how the employee card ended up saying "204 from 1326" while the list
 * behind it was showing ten people.
 */

import { describe, expect, it } from 'vitest'
import { listFiltersFromSearch } from '../userFilterDefaults'

const translate = (query: string) => listFiltersFromSearch(new URLSearchParams(query))

describe('listFiltersFromSearch', () => {
  it('renames the four the endpoint would otherwise never see', () => {
    const filters = translate('role=3&project=1&group=7&department=4')

    expect(filters).toMatchObject({
      role_id: '3',
      project_id: '1',
      group_id: '7',
      department_ids: '4',
    })
    expect(filters).not.toHaveProperty('role')
    expect(filters).not.toHaveProperty('project')
  })

  it('carries several departments the way the list sends them', () => {
    expect(translate('department=4,2')).toMatchObject({ department_ids: '4,2' })
  })

  /*
   * The endpoint refuses a department id it cannot read, and a refused request
   * takes the whole position indicator with it. A hand-edited or stale URL
   * should cost the bad ids, not the feature.
   */
  it('keeps only the department ids that are ids', () => {
    expect(translate('department=4,abc,0,-2,2')).toMatchObject({ department_ids: '4,2' })
  })

  it('sends no departments at all when none of them survive', () => {
    expect(translate('department=abc,0')).not.toHaveProperty('department_ids')
  })

  it('leaves out a filter set to All rather than sending a zero', () => {
    const filters = translate('role=0&project=0&group=0&department=')

    expect(filters).not.toHaveProperty('role_id')
    expect(filters).not.toHaveProperty('project_id')
    expect(filters).not.toHaveProperty('group_id')
    expect(filters).not.toHaveProperty('department_ids')
  })

  it('drops a status of all, which means no status filter at all', () => {
    expect(translate('status=all')).not.toHaveProperty('status')
    expect(translate('status=inactive')).toMatchObject({ status: 'inactive' })
  })

  it('still understands the spelling bookmarks were saved under', () => {
    expect(translate('status=disabled')).toMatchObject({ status: 'inactive' })
  })

  it('drops a work format of all the same way', () => {
    expect(translate('work_format=all')).not.toHaveProperty('work_format')
    expect(translate('work_format=remote')).toMatchObject({ work_format: 'remote' })
  })

  it('renames the search field, which the two also spell differently', () => {
    expect(translate('search=Olena&searchField=email')).toMatchObject({
      search: 'Olena',
      search_field: 'email',
    })
  })

  it('sends no search field without a search to apply it to', () => {
    expect(translate('searchField=email')).not.toHaveProperty('search_field')
  })

  it('ignores a search that is only spaces', () => {
    expect(translate('search=%20%20')).not.toHaveProperty('search')
  })

  /*
   * Sort is not optional: leaving it out would let the endpoint fall back to
   * its own default, and Previous and Next would walk an order nobody asked
   * for while the list stayed as it was.
   */
  it('always names a sort, so both sides walk the same order', () => {
    expect(translate('')).toMatchObject({ sort_by: 'id', sort_order: 'desc' })
    expect(translate('sort_by=full_name&sort_order=asc')).toMatchObject({
      sort_by: 'full_name',
      sort_order: 'asc',
    })
  })

  it('keeps pagination out of it, because position is not a page', () => {
    const filters = translate('page=3&pageSize=25&role=3')

    expect(filters).not.toHaveProperty('page')
    expect(filters).not.toHaveProperty('pageSize')
    expect(filters).toMatchObject({ role_id: '3' })
  })
})
