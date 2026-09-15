/**
 * A relative scope must never carry an employee list. Storing one would make
 * the preset look like it covers those people while the resolver recomputes the
 * group behind their backs, and it would hand the stale list back if the
 * operator ever returned to "Selected employees".
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { PresetEmployeeScopeRow } from '../components/PresetEmployeeScopeRow'
import type { EmployeeScopeParam } from '../types'

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
  }
  Element.prototype.scrollIntoView = vi.fn()
})

const OPTIONS = [
  { id: 7, name: 'Olena K.' },
  { id: 9, name: 'Taras M.' },
]

function Harness({ onChange }: { onChange: (next: EmployeeScopeParam | undefined) => void }) {
  const [value, setValue] = useState<EmployeeScopeParam | undefined>(undefined)
  return (
    <PresetEmployeeScopeRow
      label="Responsible employee"
      value={value}
      options={OPTIONS}
      onChange={(next) => {
        setValue(next)
        onChange(next)
      }}
    />
  )
}

const scopeOption = (scope: string) => `pages.profile.presets.employees.scopes.${scope}`

async function chooseScope(user: ReturnType<typeof userEvent.setup>, scope: string) {
  await user.click(screen.getByRole('combobox'))
  await user.click(screen.getByRole('option', { name: scopeOption(scope) }))
}

describe('PresetEmployeeScopeRow', () => {
  it('saves a relative scope without any employee ids', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await chooseScope(user, 'myGroup')

    expect(onChange).toHaveBeenLastCalledWith({ scope: 'myGroup' })
  })

  it('offers the employee list for "Selected employees" and for nothing else', async () => {
    const user = userEvent.setup()
    render(<Harness onChange={vi.fn()} />)

    expect(screen.queryByTestId('preset-employee-ids')).toBeNull()
    await chooseScope(user, 'custom')
    expect(screen.getByTestId('preset-employee-ids')).toBeTruthy()
    // Showing it next to "My department" would imply the two combine.
    await chooseScope(user, 'myDepartment')
    expect(screen.queryByTestId('preset-employee-ids')).toBeNull()
  })

  it('stores the chosen employees', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await chooseScope(user, 'custom')
    await user.click(screen.getByTestId('preset-employee-ids'))
    await user.click(screen.getByText('Taras M.'))

    expect(onChange).toHaveBeenLastCalledWith({ scope: 'custom', employeeIds: [9] })
  })

  it('drops the chosen employees when the scope becomes relative', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await chooseScope(user, 'custom')
    await user.click(screen.getByTestId('preset-employee-ids'))
    await user.click(screen.getByText('Olena K.'))
    await chooseScope(user, 'everyoneExceptMe')

    expect(onChange).toHaveBeenLastCalledWith({ scope: 'everyoneExceptMe' })
  })

  it('reports the filter as unset when the scope goes back to Anyone', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await chooseScope(user, 'myGroup')
    await chooseScope(user, 'any')

    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })
})
