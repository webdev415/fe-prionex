import { describe, expect, it } from 'vitest'
import { exactSlashCommand, matchSlashCommands, SLASH_COMMANDS } from '../slashCommands'

describe('matchSlashCommands', () => {
  it('«/» показывает все команды, префикс фильтрует по канону и синонимам', () => {
    expect(matchSlashCommands('/')).toHaveLength(SLASH_COMMANDS.length)
    expect(matchSlashCommands('/ст').map((c) => c.command)).toEqual(['/статус'])
    expect(matchSlashCommands('/st').map((c) => c.command)).toEqual(['/статус'])
    expect(matchSlashCommands('/re').map((c) => c.command)).toEqual(['/сброс'])
    expect(matchSlashCommands('/НО').map((c) => c.command)).toEqual(['/новий'])
  })

  it('обычный текст, слеш не в начале и слеш с пробелом меню не открывают', () => {
    expect(matchSlashCommands('')).toHaveLength(0)
    expect(matchSlashCommands('скільки обіцянок')).toHaveLength(0)
    expect(matchSlashCommands('довідка 24/7')).toHaveLength(0)
    expect(matchSlashCommands('/ довідка')).toHaveLength(0)
    expect(matchSlashCommands('/статус діалогу')).toHaveLength(0)
  })

  it('несуществующая команда — пустой список', () => {
    expect(matchSlashCommands('/qwerty')).toHaveLength(0)
  })
})

describe('exactSlashCommand', () => {
  it('находит по канону и синониму, терпит регистр и пробелы по краям', () => {
    expect(exactSlashCommand('/статус')?.command).toBe('/статус')
    expect(exactSlashCommand('/reset')?.command).toBe('/сброс')
    expect(exactSlashCommand('  /Помощь  ')?.command).toBe('/помощь')
  })

  it('клиентская команда нового чата помечена clientAction', () => {
    expect(exactSlashCommand('/new')?.clientAction).toBe('newChat')
    expect(exactSlashCommand('/статус')?.clientAction).toBeUndefined()
  })

  it('null на префиксе и обычном тексте', () => {
    expect(exactSlashCommand('/ст')).toBeNull()
    expect(exactSlashCommand('статус')).toBeNull()
  })
})
