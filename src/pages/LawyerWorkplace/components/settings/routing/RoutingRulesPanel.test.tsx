import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { LetterTypeConfig, MailboxRoutingRule, SettingsMailbox } from '../../../settings/types'
import { RoutingRulesPanel } from './RoutingRulesPanel'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}))

vi.mock('../../../context/lawyerWorkplaceLayout', () => ({
  useLawyerWorkplaceLayout: () => ({ isCompact: false }),
}))

function letterType(id: string, nameFallback: string, isActive = true): LetterTypeConfig {
  return {
    id,
    slug: id,
    nameKey: `api:name:${id}`,
    nameFallback,
    colorId: 'teal',
    slaDays: 14,
    slaDayType: 'calendar',
    descriptionKey: `api:desc:${id}`,
    descriptionFallback: '',
    letterCount: 0,
    examples: [],
    priorities: [],
    keywordHints: [],
    isActive,
  }
}

function rule(
  partial: Partial<MailboxRoutingRule> & Pick<MailboxRoutingRule, 'id'>
): MailboxRoutingRule {
  return {
    matchType: 'sender_domain',
    value: 'example.ua',
    letterTypeId: 'court',
    isActive: true,
    priority: 0,
    ...partial,
  }
}

function mailbox(routingRules: MailboxRoutingRule[]): SettingsMailbox {
  return {
    id: 'mb-1',
    email: 'legal@prionex.ua',
    displayNameKey: 'mb:name',
    displayNameFallback: 'Legal',
    status: 'connected',
    provider: 'custom',
    letterCount: 0,
    defaultLetterTypeId: null,
    routingRules,
    isDefaultOutgoing: false,
    hasCredentials: true,
  }
}

const LETTER_TYPES = [letterType('court', 'Court letters'), letterType('nbu', 'NBU letters')]

const DOMAIN_RULE = rule({
  id: 'r-domain',
  matchType: 'sender_domain',
  value: 'vchasno.ua',
  letterTypeId: 'court',
  priority: 0,
})
const DEFAULT_RULE = rule({
  id: 'r-default',
  matchType: 'default',
  value: '',
  letterTypeId: 'nbu',
  priority: 1,
})

function renderPanel(routingRules: MailboxRoutingRule[], letterTypes = LETTER_TYPES) {
  const onSaveRoutingRules = vi.fn().mockResolvedValue(undefined)
  render(
    <RoutingRulesPanel
      mailboxes={[mailbox(routingRules)]}
      letterTypes={letterTypes}
      onSaveRoutingRules={onSaveRoutingRules}
      isSaving={false}
    />
  )
  return { onSaveRoutingRules }
}

describe('RoutingRulesPanel', () => {
  it('renders the list of rules with match labels and values', () => {
    renderPanel([DOMAIN_RULE, DEFAULT_RULE])

    expect(screen.getByText('Sender domain')).toBeInTheDocument()
    expect(screen.getByText('Default')).toBeInTheDocument()
    expect(screen.getByText('vchasno.ua')).toBeInTheDocument()
  })

  it('populates the per-row letter-type select with the available categories', () => {
    renderPanel([DOMAIN_RULE])

    const select = screen.getByLabelText('Letter type') as HTMLSelectElement
    const optionLabels = within(select)
      .getAllByRole('option')
      .map((option) => option.textContent)
    expect(optionLabels).toEqual(['Court letters', 'NBU letters'])
  })

  it('adds a rule and saves the full updated list', async () => {
    const user = userEvent.setup()
    const { onSaveRoutingRules } = renderPanel([DOMAIN_RULE, DEFAULT_RULE])

    await user.click(screen.getByRole('button', { name: 'Add rule' }))
    await user.type(screen.getByLabelText('Value'), 'court.gov.ua')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(onSaveRoutingRules).toHaveBeenCalledTimes(1)
    const [mailboxId, savedRules] = onSaveRoutingRules.mock.calls[0]
    expect(mailboxId).toBe('mb-1')
    expect(savedRules).toHaveLength(3)
    expect(savedRules[2]).toMatchObject({
      matchType: 'sender_domain',
      value: 'court.gov.ua',
      letterTypeId: 'court',
      isActive: true,
    })
  })

  it('toggles is_active and saves the updated list', async () => {
    const user = userEvent.setup()
    const { onSaveRoutingRules } = renderPanel([DOMAIN_RULE, DEFAULT_RULE])

    // First switch belongs to the domain rule (sorted first).
    const switches = screen.getAllByRole('switch')
    await user.click(switches[0])

    expect(onSaveRoutingRules).toHaveBeenCalledTimes(1)
    const [, savedRules] = onSaveRoutingRules.mock.calls[0]
    const domainRule = savedRules.find((item: MailboxRoutingRule) => item.id === 'r-domain')
    expect(domainRule.isActive).toBe(false)
  })

  it('pre-selects the standard "нестандартне звернення" type for a default rule', async () => {
    const user = userEvent.setup()
    const letterTypes = [
      ...LETTER_TYPES,
      letterType('nestandartne_zvernennia', 'Нестандартне звернення'),
    ]
    const { onSaveRoutingRules } = renderPanel([DOMAIN_RULE], letterTypes)

    await user.click(screen.getByRole('button', { name: 'Add rule' }))
    await user.selectOptions(screen.getByLabelText('Match'), 'default')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    const [, savedRules] = onSaveRoutingRules.mock.calls[0]
    expect(savedRules[savedRules.length - 1]).toMatchObject({
      matchType: 'default',
      value: '',
      letterTypeId: 'nestandartne_zvernennia',
    })
  })

  it('deletes a rule and saves the list without it', async () => {
    const user = userEvent.setup()
    const { onSaveRoutingRules } = renderPanel([DOMAIN_RULE, DEFAULT_RULE])

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' })
    await user.click(deleteButtons[0])

    expect(onSaveRoutingRules).toHaveBeenCalledTimes(1)
    const [, savedRules] = onSaveRoutingRules.mock.calls[0]
    expect(savedRules).toHaveLength(1)
    expect(savedRules.map((item: MailboxRoutingRule) => item.id)).toEqual(['r-default'])
  })
})
