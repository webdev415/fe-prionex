/**
 * Is Agent governs the two extension fields, in both user modals.
 *
 * The assertion that matters most is on the payload, not the screen. Clearing
 * a field in the UI is easy to get right and easy to get wrong invisibly: the
 * edit form sends an extension only when the field is dirty, and the backend
 * applies exclude_unset, so a cleared value that arrives as `undefined` is
 * dropped and the row keeps its extension. Every visible behaviour would look
 * correct while the thing the ticket exists to prevent still happened.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { UserDetailResponse } from '../types'

const mutate = vi.fn()

vi.mock('../hooks/useUpdateUser', () => ({
  useUpdateUser: () => ({ mutate, isError: false, error: null }),
}))

vi.mock('@/features/projects', () => ({
  // The component reads `data.projects`, not `data.items`.
  useProjects: () => ({ data: { projects: [] }, isLoading: false }),
}))

import { EditUserForm } from '../components/EditUserForm'

/** An operator with both extensions filled in. */
const agent = {
  id: 42,
  username: 'operator',
  email: 'operator@example.com',
  first_name: 'Ольга',
  last_name: 'Коваль',
  middle_name: '',
  phone: '+380-501112233',
  language: 'uk',
  timezone: 'Europe/Kyiv',
  asterisk_extension: '7001',
  dialer_extension: '9001',
  is_agent: true,
  status: 'active',
  project_assignments: [],
} as unknown as UserDetailResponse

/**
 * The inconsistency that predates this rule: Is Agent unchecked, yet an
 * extension is still stored against the account.
 */
const legacy = { ...agent, is_agent: false } as UserDetailResponse

const asterisk = () => screen.getByLabelText(/asterisk/i) as HTMLInputElement
const dialer = () => screen.getByLabelText(/dialer/i) as HTMLInputElement
const isAgentBox = () => screen.getByRole('checkbox', { name: /agent/i })
/** The modal renders its submit control in a hidden footer slot, so drive the
 *  form directly rather than hunting for a button with a label. */
const save = () => fireEvent.submit(document.querySelector('form') as HTMLFormElement)

function renderEdit(user: UserDetailResponse) {
  return render(<EditUserForm user={user} onSuccess={vi.fn()} />)
}

describe('Is Agent governs the extension fields', () => {
  beforeEach(() => {
    mutate.mockClear()
  })

  it('clears both extensions the moment the box is unchecked', () => {
    renderEdit(agent)
    expect(asterisk().value).toBe('7001')

    fireEvent.click(isAgentBox())

    // Immediately — not deferred to submit.
    expect(asterisk().value).toBe('')
    expect(dialer().value).toBe('')
  })

  it('disables both extensions while Is Agent is unchecked', () => {
    renderEdit(agent)
    expect(asterisk()).not.toBeDisabled()

    fireEvent.click(isAgentBox())

    expect(asterisk()).toBeDisabled()
    expect(dialer()).toBeDisabled()
  })

  it('does not bring back a value the admin typed, but does not destroy the record either', () => {
    // Two claims, and they are easy to confuse. What the admin entered is gone
    // once they uncheck, which is the documented behaviour. What the record
    // holds is not theirs to lose to a stray click.
    //
    // Reading these as one claim is what caused the bug: skipping a field the
    // admin had typed in looked like honouring the first, and quietly
    // discarded the second along with it.
    renderEdit(agent)
    fireEvent.change(asterisk(), { target: { value: '7777' } })
    fireEvent.change(dialer(), { target: { value: '8888' } })

    fireEvent.click(isAgentBox())
    fireEvent.click(isAgentBox())

    expect(asterisk().value).not.toBe('7777')
    expect(dialer().value).not.toBe('8888')
    expect(asterisk().value).toBe('7001')
    expect(dialer().value).toBe('9001')
    expect(asterisk()).not.toBeDisabled()
  })

  it('gives back the stored values when a toggle ends where it started', () => {
    // A double click is not a decision. Two clicks that leave the box exactly
    // as it was must leave the record exactly as it was too.
    renderEdit(agent)

    fireEvent.click(isAgentBox())
    fireEvent.click(isAgentBox())

    expect(asterisk().value).toBe('7001')
    expect(dialer().value).toBe('9001')
  })

  it('sends the cleared extension as an empty string, not as nothing', async () => {
    // The one that catches a silent no-op: `|| undefined` would drop the key,
    // exclude_unset would leave the column alone, and the extension would stay
    // assigned to someone who is no longer an operator.
    renderEdit(agent)

    fireEvent.click(isAgentBox())
    save()

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1))
    const payload = mutate.mock.calls[0][0].data
    expect(payload.asterisk_extension).toBe('')
    expect(payload.dialer_extension).toBe('')
    expect(payload.is_agent).toBe(false)
  })

  it('blocks the save when an agent is left without an asterisk extension', async () => {
    renderEdit(agent)

    fireEvent.change(asterisk(), { target: { value: '' } })
    save()

    await waitFor(() => expect(screen.getByText(/required for agents/i)).toBeInTheDocument())
    expect(mutate).not.toHaveBeenCalled()
  })

  it('still saves an agent whose dialer extension is empty', async () => {
    renderEdit(agent)

    fireEvent.change(dialer(), { target: { value: '' } })
    save()

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1))
    expect(mutate.mock.calls[0][0].data.dialer_extension).toBe('')
  })
})

describe('An account that predates the rule', () => {
  beforeEach(() => {
    mutate.mockClear()
  })

  it('keeps showing its stored extension, inactive, without clearing it', () => {
    renderEdit(legacy)

    expect(asterisk().value).toBe('7001')
    expect(asterisk()).toBeDisabled()
    expect(dialer()).toBeDisabled()
  })

  it('still saves, and says nothing about the extensions it left alone', async () => {
    renderEdit(legacy)

    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: '+380-507654321' } })
    save()

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1))
    const payload = mutate.mock.calls[0][0].data
    // Untouched fields are omitted, so the inherited value is neither cleared
    // nor re-sent.
    expect(payload.asterisk_extension).toBeUndefined()
    expect(payload.dialer_extension).toBeUndefined()
  })
})

describe('A toggle that ends where it started changes nothing', () => {
  beforeEach(() => {
    mutate.mockClear()
  })

  it('leaves a legacy account untouched after a stray double click', async () => {
    // This is the case the guard cannot catch: is_agent stays false, so the
    // required check never runs, and before the restore both stored extensions
    // were sent as '' and cleared -- from two clicks on a checkbox that ended
    // unchecked, with nothing typed and nothing to undo it.
    renderEdit(legacy)

    fireEvent.click(isAgentBox())
    fireEvent.click(isAgentBox())

    expect(asterisk().value).toBe('7001')
    expect(dialer().value).toBe('9001')

    save()
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1))
    const payload = mutate.mock.calls[0][0].data
    expect(payload.asterisk_extension).toBeUndefined()
    expect(payload.dialer_extension).toBeUndefined()
  })

  it('sends nothing after a typed field survives a no-op toggle', async () => {
    // The half that leaked. The submit guard covers asterisk, because an agent
    // without one is refused outright, and it never looks at the dialer -- so
    // a cleared dialer went to the server unremarked and took the stored
    // extension with it.
    renderEdit(agent)
    fireEvent.change(dialer(), { target: { value: '8888' } })

    fireEvent.click(isAgentBox())
    fireEvent.click(isAgentBox())

    save()
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1))
    const payload = mutate.mock.calls[0][0].data
    expect(payload.dialer_extension).toBeUndefined()
    expect(payload.asterisk_extension).toBeUndefined()
  })

  it('still clears for real when the box is left unchecked', async () => {
    // The restore must not blunt the actual feature.
    renderEdit(agent)

    fireEvent.click(isAgentBox())

    save()
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1))
    const payload = mutate.mock.calls[0][0].data
    expect(payload.asterisk_extension).toBe('')
    expect(payload.dialer_extension).toBe('')
    expect(payload.is_agent).toBe(false)
  })
})
