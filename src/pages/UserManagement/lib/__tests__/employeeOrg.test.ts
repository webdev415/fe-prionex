import { describe, expect, it } from 'vitest'
import type { ApiUser, ProjectRole } from '@/features/users/types'
import { ALL_PROJECTS, departmentsOf, membershipsForProject, positionsOf } from '../employeeOrg'

function membership(overrides: Partial<ProjectRole> = {}): ProjectRole {
  return {
    project_id: 1,
    project_name: 'Technofinance',
    role_id: 10,
    role_name: 'Operator',
    department_id: 5,
    department_name: 'Collections',
    ...overrides,
  }
}

function user(memberships: ProjectRole[]): ApiUser {
  return { projects: memberships } as ApiUser
}

describe('membershipsForProject', () => {
  it('narrows to the selected project', () => {
    const rows = membershipsForProject(
      user([membership(), membership({ project_id: 2, project_name: 'Premium' })]),
      2
    )

    expect(rows.map((r) => r.project_name)).toEqual(['Premium'])
  })

  it('keeps every project when none is selected', () => {
    const rows = membershipsForProject(
      user([membership(), membership({ project_id: 2, project_name: 'Premium' })]),
      ALL_PROJECTS
    )

    expect(rows).toHaveLength(2)
  })

  it('copes with a user who has no memberships', () => {
    expect(membershipsForProject({} as ApiUser, ALL_PROJECTS)).toEqual([])
  })
})

describe('positionsOf', () => {
  it('is the role name for the selected project', () => {
    const positions = positionsOf(
      user([
        membership({ role_name: 'Lawyer' }),
        membership({ project_id: 2, role_name: 'Operator' }),
      ]),
      1
    )

    expect(positions).toEqual(['Lawyer'])
  })

  it('collapses the same role held on two projects', () => {
    const positions = positionsOf(
      user([
        membership({ role_name: 'Operator' }),
        membership({ project_id: 2, role_name: 'Operator' }),
      ]),
      ALL_PROJECTS
    )

    expect(positions).toEqual(['Operator'])
  })

  it('lists both roles when they differ', () => {
    const positions = positionsOf(
      user([
        membership({ role_name: 'Operator' }),
        membership({ project_id: 2, role_name: 'Supervisor' }),
      ]),
      ALL_PROJECTS
    )

    expect(positions).toEqual(['Operator', 'Supervisor'])
  })
})

describe('departmentsOf', () => {
  it('is the department of the role for the selected project', () => {
    const departments = departmentsOf(
      user([
        membership({ department_name: 'Lawyers' }),
        membership({ project_id: 2, department_name: 'Collections' }),
      ]),
      1
    )

    expect(departments).toEqual(['Lawyers'])
  })

  it('is empty when the role has no department', () => {
    expect(departmentsOf(user([membership({ department_name: null })]), 1)).toEqual([])
  })

  it('ignores a blank department rather than showing an empty chip', () => {
    expect(departmentsOf(user([membership({ department_name: '   ' })]), 1)).toEqual([])
  })
})
