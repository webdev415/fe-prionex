import { describe, expect, it } from 'vitest'
import page from '../../UserManagementPage.tsx?raw'

function columnKeys(): string[] {
  const start = page.indexOf('const columns: Column<ApiUser>[] = [')
  const end = page.indexOf('\n  ]\n', start)
  return [...page.slice(start, end).matchAll(/key: '(\w+)'/g)].map((match) => match[1])
}

describe('the employees table', () => {
  it('shows the columns in the order the ticket asks for', () => {
    expect(columnKeys()).toEqual([
      'fullName',
      'department',
      'position',
      'status',
      'workFormat',
      'extension',
      'actions',
    ])
  })

  it('no longer carries user id or email', () => {
    expect(columnKeys()).not.toContain('id')
    expect(columnKeys()).not.toContain('email')
  })

  it('offers no view or edit action, since the name opens the card', () => {
    expect(page).not.toContain('actions.view')
    expect(page).not.toContain("actions.edit'")
  })

  it('shows a face beside the name', () => {
    const start = page.indexOf("key: 'fullName'")
    const end = page.indexOf("key: 'department'", start)
    const cell = page.slice(start, end)

    expect(cell).toContain('<UserAvatar')
    expect(cell).toContain('avatarUrl={user.avatar_url}')
  })

  it('keeps the actions that have nowhere else to live', () => {
    for (const action of ['resetPassword', 'unlock', 'impersonate']) {
      expect(page).toContain(`actions.${action}`)
    }
  })
})
