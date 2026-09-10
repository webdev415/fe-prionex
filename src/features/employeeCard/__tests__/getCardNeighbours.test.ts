/**
 * What the card actually asks for when it wants somebody's place in the list.
 *
 * The page hands this function the list's own URL, and the endpoint does not
 * speak that vocabulary. The translation has to happen here or the position
 * comes back counted over every employee rather than over the filtered ones.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api', () => ({ default: { get } }))

const { getCardNeighbours } = await import('../api/employeeCardApi')

const asked = () => new URL(`http://x${get.mock.calls[0][0]}`).searchParams

describe('getCardNeighbours', () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue({ data: { position: 4, total: 10 } })
  })

  it('asks with the filters the list was showing, under the names the endpoint knows', async () => {
    await getCardNeighbours(7, 'role=3&project=1&status=active&page=2')

    const params = asked()
    expect(params.get('role_id')).toBe('3')
    expect(params.get('project_id')).toBe('1')
    expect(params.get('status')).toBe('active')
    expect(params.get('role')).toBeNull()
    expect(params.get('page')).toBeNull()
  })

  it('asks for the same order the list was in', async () => {
    await getCardNeighbours(7, 'sort_by=full_name&sort_order=asc')

    expect(asked().get('sort_by')).toBe('full_name')
    expect(asked().get('sort_order')).toBe('asc')
  })

  it('still names a sort when the list was in its default order', async () => {
    await getCardNeighbours(7, '')

    expect(asked().get('sort_by')).toBe('id')
  })

  it('asks about the employee whose card is open', async () => {
    await getCardNeighbours(42, 'role=3')

    expect(get.mock.calls[0][0]).toContain('/api/v1/admin/users/42/card/neighbours')
  })
})
