/**
 * The personal information somebody keeps about themselves, on Profile Settings.
 *
 * The endpoint takes no user id, so there is nothing here to point at another
 * employee. What these assertions guard is the other half of that split: the
 * form must never carry an HR-owned field, because a field on screen is a
 * field somebody expects to be able to change, and the server would silently
 * drop it.
 *
 * The API is mocked rather than the hooks, so the query, the mutation and the
 * cache write after a save are all exercised.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import type { MyPersonalInformation } from '@/types/api'

const api = vi.hoisted(() => ({
  myPersonalInformation: vi.fn(),
  updateMyPersonalInformation: vi.fn(),
}))
const toastFns = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock('sonner', () => ({ toast: toastFns }))
vi.mock('@/features/auth/api/authApi', () => ({ authApi: api }))

const { PersonalInformationSection } = await import('../PersonalInformationSection')

const HR_OWNED = ['referralSource', 'militaryStatus', 'visaStatus', 'hiredAt', 'position']

function stored(overrides: Partial<MyPersonalInformation> = {}): MyPersonalInformation {
  return {
    date_of_birth: '1994-05-12',
    telegram: '@olena',
    city: 'Kyiv',
    address: 'Khreshchatyk 1',
    nova_poshta_branch: 'Branch No. 5',
    ...overrides,
  }
}

function field(name: string) {
  return screen.getByLabelText(`pages.employeeCard.fields.${name}`)
}

async function show(given: MyPersonalInformation = stored()) {
  api.myPersonalInformation.mockResolvedValue(given)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <QueryClientProvider client={client}>
      <PersonalInformationSection />
    </QueryClientProvider>
  )
  await screen.findByLabelText('pages.employeeCard.fields.city')
  return result
}

function save() {
  return userEvent.click(screen.getByRole('button', { name: /pages.profile.saveChanges/ }))
}

describe('PersonalInformationSection', () => {
  beforeEach(() => {
    api.myPersonalInformation.mockReset()
    api.updateMyPersonalInformation.mockReset().mockImplementation((data) => data)
    toastFns.success.mockReset()
    toastFns.error.mockReset()
  })

  it('opens with what is already stored', async () => {
    await show()

    expect(field('city')).toHaveValue('Kyiv')
    expect(field('telegram')).toHaveValue('@olena')
    expect(field('dateOfBirth')).toHaveValue('1994-05-12')
  })

  it('shows a date of birth as a date field rather than free text', async () => {
    await show()

    expect(field('dateOfBirth')).toHaveAttribute('type', 'date')
  })

  it('leaves a field somebody has never filled in empty rather than showing null', async () => {
    await show(stored({ address: null, city: null }))

    expect(field('address')).toHaveValue('')
    expect(field('city')).toHaveValue('')
  })

  it('offers nothing HR owns, because the server would drop it without saying so', async () => {
    await show()

    for (const name of HR_OWNED) {
      expect(screen.queryByLabelText(`pages.employeeCard.fields.${name}`)).toBeNull()
    }
  })

  it('sends only what somebody owns about themselves', async () => {
    await show()

    await userEvent.clear(field('city'))
    await userEvent.type(field('city'), 'Lviv')
    await save()

    await waitFor(() => expect(api.updateMyPersonalInformation).toHaveBeenCalled())
    expect(Object.keys(api.updateMyPersonalInformation.mock.calls[0][0]).sort()).toEqual([
      'address',
      'city',
      'date_of_birth',
      'nova_poshta_branch',
      'telegram',
    ])
  })

  it('sends a cleared field as null, so clearing one works', async () => {
    await show()

    await userEvent.clear(field('address'))
    await save()

    await waitFor(() => expect(api.updateMyPersonalInformation).toHaveBeenCalled())
    expect(api.updateMyPersonalInformation.mock.calls[0][0]).toMatchObject({
      address: null,
      city: 'Kyiv',
    })
  })

  it('does not send the spaces around a typed value', async () => {
    await show(stored({ telegram: null }))

    await userEvent.type(field('telegram'), '  @olena  ')
    await save()

    await waitFor(() => expect(api.updateMyPersonalInformation).toHaveBeenCalled())
    expect(api.updateMyPersonalInformation.mock.calls[0][0]).toMatchObject({ telegram: '@olena' })
  })

  it('keeps the save button away until something has actually changed', async () => {
    await show()

    expect(screen.queryByRole('button', { name: /pages.profile.saveChanges/ })).toBeNull()

    await userEvent.type(field('city'), '!')

    expect(screen.getByRole('button', { name: /pages.profile.saveChanges/ })).toBeInTheDocument()
  })

  it('puts back what was stored when a change is abandoned', async () => {
    await show()

    await userEvent.clear(field('city'))
    await userEvent.type(field('city'), 'Lviv')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(field('city')).toHaveValue('Kyiv')
    expect(screen.queryByRole('button', { name: /pages.profile.saveChanges/ })).toBeNull()
    expect(api.updateMyPersonalInformation).not.toHaveBeenCalled()
  })

  /*
   * The server has the last word on what was stored. Showing the typed text
   * back would hide a value it normalised or refused, and the difference only
   * surfaces on the next page load - long after anybody would connect it to
   * this save.
   */
  it('settles on the row the server answers with, not on what was typed', async () => {
    await show(stored({ telegram: null }))
    api.updateMyPersonalInformation.mockResolvedValue(stored({ telegram: '@olena' }))

    await userEvent.type(field('telegram'), 'OLENA')
    await save()

    await waitFor(() => expect(field('telegram')).toHaveValue('@olena'))
  })

  it('says so when a save goes through', async () => {
    await show()

    await userEvent.type(field('city'), '!')
    await save()

    await waitFor(() =>
      expect(toastFns.success).toHaveBeenCalledWith('pages.profile.personalInformation.saved')
    )
  })

  it('says what went wrong and keeps the typing when the server refuses', async () => {
    await show()
    api.updateMyPersonalInformation.mockRejectedValue({
      isAxiosError: true,
      response: { data: { detail: 'Employee profile is unavailable' } },
    })

    await userEvent.clear(field('city'))
    await userEvent.type(field('city'), 'Lviv')
    await save()

    await waitFor(() =>
      expect(toastFns.error).toHaveBeenCalledWith('Employee profile is unavailable')
    )
    expect(field('city')).toHaveValue('Lviv')
  })
})
