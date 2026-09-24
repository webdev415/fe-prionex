/**
 * Кнопка «Відкрити» документа в карточках заявки и кредита.
 *
 * Защищаются вещи, каждая из которых ломается молча:
 *  1) дверь выбирается по карточке, из списка которой пришёл документ, а не по
 *     полям документа — у договора выданного кредита заполнены оба;
 *  2) «не откроется» кнопка говорит ДО нажатия, без запроса;
 *  3) отказ называется своими словами по коду модуля, а не «Request failed…»
 *     и не русским `detail`, — в обеих карточках, и новое нажатие его снимает;
 *  4) вкладка открывается в самом нажатии (после `await` её блокирует браузер),
 *     а без вкладки (блокировщик, OneX) документ уходит скачиванием тем же
 *     файлом, и это называется словами — уведомлением, а не отказом: в OneX
 *     вкладки нет никогда, и красная плашка висела бы на каждом удачном
 *     открытии; над таблицей не больше одной плашки;
 *  5) имя скачивания очищено от символов, подменяющих видимое имя, — всем
 *     перечнем, не представителями;
 *  5а) во вкладку уходят только инертные типы: HTML, SVG и прочее при `inline`
 *     скачиваются — blob-адрес живёт в origin CRM, рядом с пропуском оператора;
 *  5б) отзыв blob-адреса не переживает кнопку: после размонтирования таймеров нет;
 *  6) демо-ручка вне контракта не возвращается в исходники раздела.
 *
 * Запросы ловятся подменой адаптера `creditHttp` (приём `credentials.test.ts`):
 * видно ИТОГОВЫЙ конфиг — адрес, тип ответа, параметры. Свой адаптер axios не
 * прогоняет через проверку статуса, поэтому отказ адаптер бросает сам.
 */
import type { ReactNode } from 'react'
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
  type MockInstance,
} from 'vitest'
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { alertVariants } from '@/components/ui/Alert'
import { creditHttp } from '@/features/credit/api/creditApi'
import * as hooks from '@/features/credit/hooks/useCredit'
import type {
  CreditApplicationDetail,
  CreditDocumentMeta,
  CreditLoanDetail,
  CreditLoanState,
} from '@/features/credit/api/types'
import {
  CreditDocumentOpenButton,
  type CreditDocumentOwner,
} from '../components/CreditDocumentOpenButton'
import { CreditNotice } from '../components/CreditCardHeader'
import { CreditApplicationDetailPage } from '../CreditApplicationDetailPage'
import { CreditLoanDetailPage } from '../CreditLoanDetailPage'
import en from '../../../../public/locales/en/common.json'
import es from '../../../../public/locales/es/common.json'
import uk from '../../../../public/locales/uk/common.json'

const IDS = vi.hoisted(() => ({
  application: 'aaaaaaaa-0000-4000-8000-000000000001',
  loan: 'bbbbbbbb-0000-4000-8000-000000000002',
  document: 'dddddddd-0000-4000-8000-000000000003',
  secondDocument: 'dddddddd-0000-4000-8000-000000000007',
  // Владельцы, записанные в САМОМ документе, — чужие: кнопка обязана их не читать.
  foreignApplication: 'eeeeeeee-0000-4000-8000-000000000004',
  foreignLoan: 'ffffffff-0000-4000-8000-000000000005',
}))

// Мокаем хуки, а не HTTP: списки документов страницы берут из хуков, а кнопка
// ходит в `creditApi` напрямую — её запрос виден подменённому адаптеру.
vi.mock('@/features/credit/hooks/useCredit')
// Мок печатает ключ вместе с подстановками: иначе статус в общем тексте отказа
// не виден.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars && typeof vars === 'object'
        ? `${key} ${Object.entries(vars)
            .map(([name, value]) => `${name}=${String(value)}`)
            .join(' ')}`
        : key,
    i18n: { language: 'uk', changeLanguage: vi.fn() },
  }),
  I18nextProvider: ({ children }: { children: ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))
// Обе страницы в одном файле: `useParams` отдаёт оба идентификатора.
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useParams: () => ({ loanId: IDS.loan, applicationId: IDS.application }),
}))

const A = IDS.application
const L = IDS.loan
const D = IDS.document

const DOC: CreditDocumentMeta = {
  document_id: D,
  application_id: IDS.foreignApplication,
  loan_id: IDS.foreignLoan,
  client_id: null,
  debt_id: null,
  client_document_id: null,
  content_available: true,
  kind: 'agreement_draft',
  title: 'other.pdf',
  template_version: 'agr-1-draft',
  sha256: 'a'.repeat(64),
  generated_at: '2026-09-01T10:00:00Z',
}

const APPLICATION_OWNER: CreditDocumentOwner = { kind: 'application', id: A }
const LOAN_OWNER: CreditDocumentOwner = { kind: 'loan', id: L }

const APPLICATION_DOOR = `/api/v1/credit/applications/${A}/documents/${D}/content`
const LOAN_DOOR = `/api/v1/credit/loans/${L}/documents/${D}/content`
const BLOB_URL = 'blob:mock-document'

// ── Журнал событий окна ──────────────────────────────────────────────────────
// Порядок «вкладка → запрос → blob → адрес вкладки → отзыв» и есть предмет
// нескольких сцен, поэтому каждое событие пишется в один журнал.

let events: string[] = []

// ── Транспорт ────────────────────────────────────────────────────────────────

type Reply = (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>

/**
 * Подменяет адаптер `creditHttp` и ловит конфиги. Восстановление — в `finally`
 * вызывающего: `creditHttp` — модульный синглтон. Своего адаптера у инстанса не
 * было — его надо СНЯТЬ, а не записать `undefined`.
 */
function withAdapter(reply: Reply): { seen: InternalAxiosRequestConfig[]; restore: () => void } {
  const seen: InternalAxiosRequestConfig[] = []
  const hadPrevious = 'adapter' in creditHttp.defaults
  const previous = creditHttp.defaults.adapter
  creditHttp.defaults.adapter = async (config) => {
    events.push('request')
    seen.push(config)
    return reply(config)
  }
  return {
    seen,
    restore: () => {
      if (hadPrevious) creditHttp.defaults.adapter = previous
      else delete creditHttp.defaults.adapter
    },
  }
}

/** Ответы по очереди: первое нажатие получает первый, второе — второй. */
function inTurn(...replies: Reply[]): Reply {
  return (config) => {
    const next = replies.shift()
    if (!next) throw new Error('ответов больше, чем нажатий: лишний запрос')
    return next(config)
  }
}

const ok =
  (blob: Blob, disposition: string): Reply =>
  async (config) =>
    ({
      data: blob,
      status: 200,
      statusText: 'OK',
      headers: { 'content-disposition': disposition },
      config,
    }) as AxiosResponse

const fail =
  (status: number, body: unknown): Reply =>
  async (config) => {
    const response = { data: body, status, statusText: '', headers: {}, config } as AxiosResponse
    // Свой адаптер axios не зовёт проверку статуса: ответ 404 из него — УСПЕХ.
    throw new AxiosError(
      `Request failed with status code ${status}`,
      'ERR_BAD_REQUEST',
      config,
      null,
      response
    )
  }

const offline: Reply = async (config) => {
  throw new AxiosError('Network Error', 'ERR_NETWORK', config, null)
}

/** Тело отказа модуля — Problem, blob'ом: так его отдаёт запрос с `responseType: 'blob'`. */
const problem = (status: number, code: string, detail: string) =>
  new Blob([JSON.stringify({ title: 'x', status, code, detail })], {
    type: 'application/problem+json',
  })

const missingFile = () =>
  fail(503, problem(503, 'document_file_missing', 'Файл документа не найден в хранилище'))

const pdf = () => new Blob(['%PDF-1.4'], { type: 'application/pdf' })
const inlinePdf = () => ok(pdf(), 'inline; filename="s.pdf"')

/** Договор так, как его отдаёт модуль: `text/markdown`, показать во вкладке. */
const inlineAgreement = () =>
  ok(
    new Blob(['# Договір'], { type: 'text/markdown; charset=utf-8' }),
    'inline; filename="agreement-agr-1.md"'
  )

/** `Content-Disposition` скачивания с именем в `filename*`, как его кодирует модуль. */
const attachmentNamed = (name: string, ascii = 'x') =>
  `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`

/** Текст blob'а тем же путём, что у разбора отказа: у Blob в jsdom нет `text()`. */
function readText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

// ── Окно браузера ────────────────────────────────────────────────────────────
// `URL.createObjectURL` в jsdom нет вовсе — `vi.spyOn` на нём бросил бы, а
// `vi.stubGlobal('URL')` подменил бы конструктор. Поэтому прямое присваивание и
// возврат прежнего дескриптора (или снятие) после каждого случая.
//
// Вкладка — поддельная: jsdom окон не открывает. Её адрес записывается в журнал,
// а `opener` изначально указывает на окно CRM, как у настоящей.

type FakeTab = { opener: unknown; close: Mock<() => void>; location: { href: string } }

function makeTab(): FakeTab {
  let href = ''
  return {
    opener: window,
    close: vi.fn(),
    location: {
      get href() {
        return href
      },
      set href(value: string) {
        events.push('navigate')
        href = value
      },
    },
  }
}

const URL_STATICS = ['createObjectURL', 'revokeObjectURL'] as const
const ORIGINAL_URL_STATICS = URL_STATICS.map(
  (name) => [name, Object.getOwnPropertyDescriptor(URL, name)] as const
)

let created: Blob[] = []
let downloads: string[] = []
let tabs: FakeTab[] = []
let blockTabs = false
let openSpy: MockInstance<typeof window.open>
let clickSpy: MockInstance<HTMLAnchorElement['click']>
let revokeSpy: Mock<(url: string) => void>

/** Нажатие ссылки скачивания: jsdom навигацию не умеет, записываем имя файла. */
function recordDownload(this: HTMLAnchorElement) {
  events.push('download')
  downloads.push(this.download)
}

beforeEach(() => {
  vi.clearAllMocks()
  // Отзыв blob-адреса отложен на 60 с. Под поддельными часами этот таймер видно
  // и его можно промотать; снимает его сама кнопка при размонтировании
  // (`afterEach` проверяет, что снят). Время всё равно идёт (`shouldAdvanceTime`):
  // иначе встал бы собственный таймаут `waitFor`, и упавшая сцена молчала бы до
  // таймаута теста.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true })
  events = []
  created = []
  downloads = []
  tabs = []
  blockTabs = false
  URL.createObjectURL = vi.fn((object: Blob | MediaSource) => {
    events.push('create')
    created.push(object as Blob)
    return BLOB_URL
  })
  revokeSpy = vi.fn((url: string) => {
    events.push(`revoke ${url}`)
  })
  URL.revokeObjectURL = revokeSpy
  openSpy = vi.spyOn(window, 'open').mockImplementation(() => {
    events.push('open')
    if (blockTabs) return null
    const tab = makeTab()
    tabs.push(tab)
    return tab as unknown as Window
  })
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(recordDownload)
})

afterEach(() => {
  // Размонтирование — ЗДЕСЬ, пока подмены окна ещё стоят: при уходе кнопка
  // снимает свои таймеры и отзывает адреса. После него не должно остаться ни
  // одного таймера — иначе отзыв пережил бы кнопку и стрелял в разобранный jsdom.
  cleanup()
  expect(vi.getTimerCount(), 'таймер пережил размонтирование кнопки').toBe(0)
  // Настоящие часы возвращаются тоже здесь: after-хуки идут стеком, этот — раньше
  // общего из `src/test/setup.ts`, и общий застаёт уже настоящие часы, а значит
  // делает свой такт после размонтирования, а не пропускает его.
  vi.useRealTimers()
  openSpy.mockRestore()
  clickSpy.mockRestore()
  for (const [name, descriptor] of ORIGINAL_URL_STATICS) {
    if (descriptor) Object.defineProperty(URL, name, descriptor)
    else delete (URL as unknown as Record<string, unknown>)[name]
  }
})

function lastTab(): FakeTab {
  const tab = tabs.at(-1)
  if (!tab) throw new Error('вкладка не открывалась')
  return tab
}

function renderButton(document: CreditDocumentMeta, owner: CreditDocumentOwner) {
  const onError = vi.fn()
  const onNotice = vi.fn()
  const view = render(
    <CreditDocumentOpenButton
      document={document}
      owner={owner}
      onError={onError}
      onNotice={onNotice}
    />
  )
  // Кнопок на экране может быть две (сцена с контролем) — ищем в своём контейнере.
  const button = within(view.container).getByRole('button', {
    name: 'credit.actions.openDocument',
  })
  return { onError, onNotice, button, unmount: view.unmount }
}

/** Последний непустой отказ, который получил `onError` (`null` — снятие прежнего). */
function lastRefusal(onError: Mock): string | undefined {
  const refusals = onError.mock.calls.map(([message]) => message).filter((m) => m !== null)
  return refusals.at(-1) as string | undefined
}

/** Последнее непустое уведомление, которое получил `onNotice` (`null` — снятие). */
function lastNotice(onNotice: Mock): string | undefined {
  const notices = onNotice.mock.calls.map(([message]) => message).filter((m) => m !== null)
  return notices.at(-1) as string | undefined
}

/** Отказ, который получил `onError`: нажатие, ожидание разбора тела, одна строка. */
async function refusalFor(reply: Reply): Promise<string> {
  const { seen, restore } = withAdapter(reply)
  try {
    const tabsBefore = tabs.length
    const { onError, button, unmount } = renderButton(DOC, LOAN_OWNER)
    fireEvent.click(button)
    // Разбор тела асинхронный (FileReader): ждём отказа, а не такта.
    await waitFor(() => expect(lastRefusal(onError)).toBeDefined())
    expect(seen, 'ровно один запрос на нажатие').toHaveLength(1)
    // Вкладка, открытая в нажатии, при отказе закрывается — пустой она не висит.
    expect(tabs).toHaveLength(tabsBefore + 1)
    expect(lastTab().close).toHaveBeenCalledTimes(1)
    const message = String(lastRefusal(onError))
    unmount()
    return message
  } finally {
    restore()
  }
}

describe('CreditDocumentOpenButton → дверь по владельцу списка', () => {
  it('T-1: карточка заявки — один запрос в дверь заявки, blob, без параметров', async () => {
    const { seen, restore } = withAdapter(inlinePdf())
    try {
      const { button } = renderButton(DOC, APPLICATION_OWNER)
      fireEvent.click(button)
      await waitFor(() => expect(lastTab().location.href).toBe(BLOB_URL))
    } finally {
      restore()
    }
    expect(seen).toHaveLength(1)
    expect(seen[0].url).toBe(APPLICATION_DOOR)
    expect(seen[0].responseType).toBe('blob')
    // История версий не просится: параметров нет вовсе, и в адресе их тоже нет.
    expect(seen[0].params).toBeUndefined()
    expect(String(seen[0].url)).not.toContain('include_replaced')
  })

  it('T-2: карточка кредита — один запрос в дверь кредита', async () => {
    const { seen, restore } = withAdapter(inlinePdf())
    try {
      const { button } = renderButton(DOC, LOAN_OWNER)
      fireEvent.click(button)
      await waitFor(() => expect(lastTab().location.href).toBe(BLOB_URL))
    } finally {
      restore()
    }
    expect(seen).toHaveLength(1)
    expect(seen[0].url).toBe(LOAN_DOOR)
  })

  it('T-3: по записям модуля выдавать нечего — кнопка неактивна, текст виден, запроса нет', async () => {
    const { seen, restore } = withAdapter(inlinePdf())
    try {
      const { button } = renderButton({ ...DOC, content_available: false }, APPLICATION_OWNER)
      expect(button).toBeDisabled()
      expect(screen.getByText('credit.documentOpen.unavailable')).toBeInTheDocument()
      // Подсказка — на обёртке: неактивная кнопка не ловит указатель
      // (`disabled:pointer-events-none`), и её собственный `title` не показался бы.
      expect(button.className).toContain('disabled:pointer-events-none')
      const carrier = screen.getByTitle('credit.documentOpen.unavailableHint')
      expect(carrier.tagName, 'подсказка висит на неактивной кнопке — её не увидят').toBe('SPAN')
      expect(carrier).toContainElement(button)
      expect(carrier.className).not.toContain('pointer-events-none')
      expect(button).not.toHaveAttribute('title')
      fireEvent.click(button)

      // Положительный контроль ТОГО ЖЕ счёта: та же фикстура с `true` отправляет
      // запрос. Нажата ПОСЛЕ неактивной — её запрос пришёл бы раньше контрольного.
      const control = renderButton(DOC, APPLICATION_OWNER)
      fireEvent.click(control.button)
      await waitFor(() => expect(lastTab().location.href).toBe(BLOB_URL))
    } finally {
      restore()
    }
    expect(seen).toHaveLength(1)
    expect(seen[0].url).toBe(APPLICATION_DOOR)
    // И вкладку открыло только контрольное нажатие.
    expect(openSpy).toHaveBeenCalledTimes(1)
  })

  it('T-4: признака нет в ответе (модуль старше) — кнопка активна, запрос уходит', async () => {
    const lagging: Partial<CreditDocumentMeta> = { ...DOC }
    delete lagging.content_available
    // Контроль фикстуры: ключа действительно нет, а не `undefined` под ключом.
    expect('content_available' in lagging).toBe(false)

    const { seen, restore } = withAdapter(inlinePdf())
    try {
      const { button } = renderButton(lagging as CreditDocumentMeta, LOAN_OWNER)
      expect(button).toBeEnabled()
      expect(screen.queryByText('credit.documentOpen.unavailable')).not.toBeInTheDocument()
      fireEvent.click(button)
      await waitFor(() => expect(lastTab().location.href).toBe(BLOB_URL))
    } finally {
      restore()
    }
    expect(seen).toHaveLength(1)
  })
})

describe('CreditDocumentOpenButton → отказ назван своими словами', () => {
  it('T-5: 404 not_found — «не найден в этой карточке», без detail модуля и текста axios', async () => {
    const detail = 'Документ кредита не найден'
    const message = await refusalFor(fail(404, problem(404, 'not_found', detail)))
    expect(message).toBe('credit.documentOpen.errorNotFound')
    expect(message).not.toContain(detail)
    expect(message).not.toContain('Request failed')
  })

  it('T-5b: тело отказа уже объектом, не blob — тот же текст', async () => {
    const body = { title: 'x', status: 404, code: 'not_found', detail: 'Документ не найден' }
    expect(await refusalFor(fail(404, body))).toBe('credit.documentOpen.errorNotFound')
  })

  it('T-5c: тело отказа строкой JSON — тот же текст', async () => {
    const body = JSON.stringify({ title: 'x', status: 404, code: 'not_found', detail: 'Нет' })
    expect(await refusalFor(fail(404, body))).toBe('credit.documentOpen.errorNotFound')
  })

  it('T-6: 410 document_revision_unreproducible', async () => {
    const body = problem(410, 'document_revision_unreproducible', 'Редакция не воспроизводится')
    expect(await refusalFor(fail(410, body))).toBe('credit.documentOpen.errorGone')
  })

  it('T-7: 503 document_file_missing', async () => {
    expect(await refusalFor(missingFile())).toBe('credit.documentOpen.errorMissing')
  })

  it('T-8: 500 document_content_diverged', async () => {
    const body = problem(500, 'document_content_diverged', 'Содержимое разошлось с отпечатком')
    expect(await refusalFor(fail(500, body))).toBe('credit.documentOpen.errorDiverged')
  })

  it('T-9: 403 forbidden (нет права у пропуска)', async () => {
    const body = problem(403, 'forbidden', 'Недостаточно прав: credit.documents.read')
    expect(await refusalFor(fail(403, body))).toBe('credit.documentOpen.errorForbidden')
  })

  it('T-9b: 403 permission_denied (общий обработчик модуля)', async () => {
    const body = problem(403, 'permission_denied', 'Доступ запрещён')
    expect(await refusalFor(fail(403, body))).toBe('credit.documentOpen.errorForbidden')
  })

  it('T-9c: 403 шлюза без кода — тот же отказ в доступе', async () => {
    const gateway = new Blob([JSON.stringify({ message: 'You cannot consume this service' })], {
      type: 'application/json',
    })
    expect(await refusalFor(fail(403, gateway))).toBe('credit.documentOpen.errorForbidden')
  })

  it('T-14: 401 не Problem — общий текст со статусом', async () => {
    const body = new Blob([JSON.stringify({ message: 'Unauthorized' })], {
      type: 'application/json',
    })
    expect(await refusalFor(fail(401, body))).toBe('credit.documentOpen.errorGeneric status=401')
  })

  it('T-14b: 404 шлюза без кода — общий текст, а не «документа нет в карточке»', async () => {
    const gateway = new Blob([JSON.stringify({ message: 'no Route matched with those values' })], {
      type: 'application/json',
    })
    expect(await refusalFor(fail(404, gateway))).toBe('credit.documentOpen.errorGeneric status=404')
    // Положительный контроль на том же статусе: 404 модуля с кодом называется иначе.
    const module = problem(404, 'not_found', 'Документ кредита не найден')
    expect(await refusalFor(fail(404, module))).toBe('credit.documentOpen.errorNotFound')
  })

  it('T-14c: ответа нет вовсе (сеть) — общий текст с прочерком', async () => {
    expect(await refusalFor(offline)).toBe('credit.documentOpen.errorGeneric status=—')
  })

  it('T-14d: тело не JSON (страница прокси) — общий текст со статусом, без исключения', async () => {
    const proxy = new Blob(['<html><body>502 Bad Gateway</body></html>'], { type: 'text/html' })
    expect(await refusalFor(fail(502, proxy))).toBe('credit.documentOpen.errorGeneric status=502')
  })
})

describe('CreditDocumentOpenButton → вкладка в самом нажатии', () => {
  it('T-15: вкладка открыта ДО запроса и без связи с окном CRM, адрес — когда пришёл файл', async () => {
    const { restore } = withAdapter(inlinePdf())
    try {
      const { button } = renderButton(DOC, LOAN_OWNER)
      fireEvent.click(button)
      // Синхронно, в самом нажатии: запроса ещё нет, вкладка уже есть.
      expect(events).toEqual(['open'])
      expect(openSpy).toHaveBeenCalledWith('', '_blank')
      expect(lastTab().opener).toBeNull()
      await waitFor(() => expect(lastTab().location.href).toBe(BLOB_URL))
    } finally {
      restore()
    }
    expect(events).toEqual(['open', 'request', 'create', 'navigate'])
    expect(lastTab().close).not.toHaveBeenCalled()
  })

  it('T-15b: вкладку не дали — документ уходит скачиванием тем же файлом, оператор узнаёт почему уведомлением, а не отказом', async () => {
    blockTabs = true
    const { restore } = withAdapter(
      inTurn(inlineAgreement(), ok(pdf(), attachmentNamed('файл.pdf')))
    )
    try {
      const shown = renderButton(DOC, LOAN_OWNER)
      fireEvent.click(shown.button)
      await waitFor(() => expect(lastNotice(shown.onNotice)).toBe('credit.documentOpen.tabBlocked'))
      // Файл получен — это не отказ: канал отказа слышал только снятие прежнего.
      expect(shown.onError.mock.calls, 'удачное скачивание ушло каналом отказа').toEqual([[null]])
      // Тот же файл, что показала бы вкладка: blob создан (его и ловит замер
      // S-1), тип текстовый, байты те же, имя — из заголовка сервера.
      expect(created).toHaveLength(1)
      expect(created[0].type).toBe('text/plain;charset=utf-8')
      expect(await readText(created[0])).toBe('# Договір')
      expect(downloads).toEqual(['agreement-agr-1.md'])

      // Положительный контроль: скачивание, которое заказал сам сервер, при той
      // же блокировке проходит молча — ни уведомления, ни отказа.
      const saved = renderButton(DOC, LOAN_OWNER)
      fireEvent.click(saved.button)
      await waitFor(() => expect(downloads).toEqual(['agreement-agr-1.md', 'файл.pdf']))
      expect(lastRefusal(saved.onError)).toBeUndefined()
      expect(lastNotice(saved.onNotice)).toBeUndefined()
    } finally {
      restore()
    }
  })

  it('T-15c: вкладку не дали, а тип показывать нельзя — скачивание молча, как attachment', async () => {
    blockTabs = true
    const served = new Blob(['<html></html>'], { type: 'text/html' })
    const { restore } = withAdapter(ok(served, 'inline; filename="x.html"'))
    try {
      const { onError, onNotice, button } = renderButton(DOC, LOAN_OWNER)
      fireEvent.click(button)
      await waitFor(() => expect(downloads).toEqual(['x.html']))
      // Показывать было нечего и при вкладке — объяснять оператору нечего.
      expect(lastNotice(onNotice)).toBeUndefined()
      expect(lastRefusal(onError)).toBeUndefined()
    } finally {
      restore()
    }
  })

  it('T-17: прежний отказ снимается в самом нажатии, до ответа', async () => {
    const { restore } = withAdapter(inTurn(missingFile(), inlinePdf()))
    try {
      const { onError, button } = renderButton(DOC, LOAN_OWNER)
      fireEvent.click(button)
      await waitFor(() => expect(lastRefusal(onError)).toBe('credit.documentOpen.errorMissing'))
      // Второе нажатие — только по освободившейся кнопке: пока идёт первое, она
      // занята (`isLoading` → `disabled`), и React клик по ней не доставит. Отказ
      // и уведомление приходят раньше, чем кнопка освобождается, а какая из двух
      // задач цикла событий — коммит React или выход `waitFor` — придёт первой,
      // решает нагрузка раннера: в CI второе нажатие попадало в занятую кнопку.
      await waitFor(() => expect(button).toBeEnabled())
      const callsBefore = onError.mock.calls.length
      events = []
      fireEvent.click(button)
      // Синхронно, в том же нажатии: запрос ещё не ушёл, отказ уже снят.
      expect(events).toEqual(['open'])
      expect(onError).toHaveBeenCalledTimes(callsBefore + 1)
      expect(onError).toHaveBeenLastCalledWith(null)
      await waitFor(() => expect(lastTab().location.href).toBe(BLOB_URL))
    } finally {
      restore()
    }
  })

  it('T-17b: прежнее уведомление снимается в самом нажатии вместе с отказом', async () => {
    blockTabs = true
    const { restore } = withAdapter(inTurn(inlineAgreement(), inlinePdf()))
    try {
      const { onError, onNotice, button } = renderButton(DOC, LOAN_OWNER)
      fireEvent.click(button)
      await waitFor(() => expect(lastNotice(onNotice)).toBe('credit.documentOpen.tabBlocked'))
      // Второе нажатие — только по освободившейся кнопке: пока идёт первое, она
      // занята (`isLoading` → `disabled`), и React клик по ней не доставит. Отказ
      // и уведомление приходят раньше, чем кнопка освобождается, а какая из двух
      // задач цикла событий — коммит React или выход `waitFor` — придёт первой,
      // решает нагрузка раннера: в CI второе нажатие попадало в занятую кнопку.
      await waitFor(() => expect(button).toBeEnabled())
      const noticesBefore = onNotice.mock.calls.length
      const errorsBefore = onError.mock.calls.length
      blockTabs = false
      events = []
      fireEvent.click(button)
      // Синхронно, в том же нажатии: запрос ещё не ушёл, сняты оба канала.
      expect(events).toEqual(['open'])
      expect(onNotice).toHaveBeenCalledTimes(noticesBefore + 1)
      expect(onNotice).toHaveBeenLastCalledWith(null)
      expect(onError).toHaveBeenCalledTimes(errorsBefore + 1)
      expect(onError).toHaveBeenLastCalledWith(null)
      await waitFor(() => expect(lastTab().location.href).toBe(BLOB_URL))
      // Показ во вкладке удался — нового уведомления нет.
      expect(onNotice).toHaveBeenLastCalledWith(null)
    } finally {
      restore()
    }
  })

  it('T-19: уход с карточки снимает таймер отзыва и отзывает адрес сразу', async () => {
    const { restore } = withAdapter(inlinePdf())
    try {
      const { button, unmount } = renderButton(DOC, LOAN_OWNER)
      fireEvent.click(button)
      await waitFor(() => expect(lastTab().location.href).toBe(BLOB_URL))
      // Контроль: таймер отзыва действительно поставлен, иначе ноль ниже ничего не доказывал бы.
      expect(vi.getTimerCount()).toBe(1)
      expect(revokeSpy).not.toHaveBeenCalled()
      unmount()
      expect(vi.getTimerCount(), 'таймер отзыва пережил кнопку').toBe(0)
      expect(revokeSpy).toHaveBeenCalledWith(BLOB_URL)
    } finally {
      restore()
    }
  })

  it('T-19b: ушли с карточки до ответа — документ всё равно открыт, а таймера нет', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const pdfReply = inlinePdf()
    const { restore } = withAdapter(async (config) => {
      await gate
      return pdfReply(config)
    })
    try {
      const { button, unmount } = renderButton(DOC, LOAN_OWNER)
      fireEvent.click(button)
      await waitFor(() => expect(events).toContain('request'))
      unmount()
      release()
      await waitFor(() => expect(lastTab().location.href).toBe(BLOB_URL))
      // Кнопки уже нет, снимать минутный таймер было бы некому: адрес отозван сразу.
      expect(revokeSpy).toHaveBeenCalledWith(BLOB_URL)
      expect(vi.getTimerCount(), 'таймер отзыва поставлен после размонтирования').toBe(0)
    } finally {
      restore()
    }
  })
})

describe('CreditDocumentOpenButton → показ по решению сервера', () => {
  it('T-10: attachment — скачивание под именем из filename*, вкладка закрыта, отзыв через 60 с', async () => {
    const disposition =
      'attachment; filename=".pdf"; filename*=UTF-8\'\'%D0%B2%D0%B8%D0%BF%D0%B8%D1%81%D0%BA%D0%B0.pdf'
    const { restore } = withAdapter(ok(pdf(), disposition))
    try {
      const { button } = renderButton(DOC, LOAN_OWNER)
      fireEvent.click(button)
      await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1))
    } finally {
      restore()
    }
    // Не `.pdf` (ASCII-имя) и не `other.pdf` (заголовок документа).
    expect(downloads).toEqual(['виписка.pdf'])
    expect(lastTab().close).toHaveBeenCalledTimes(1)
    expect(lastTab().location.href).toBe('')
    expect(revokeSpy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60_000)
    expect(revokeSpy).toHaveBeenCalledWith(BLOB_URL)
  })

  it('T-10a: inline PDF — адрес вкладки, blob как прислал сервер; отзыв не сразу, а через минуту', async () => {
    const served = pdf()
    const { restore } = withAdapter(ok(served, 'inline; filename="s.pdf"'))
    try {
      const { button } = renderButton(DOC, LOAN_OWNER)
      fireEvent.click(button)
      await waitFor(() => expect(lastTab().location.href).toBe(BLOB_URL))
    } finally {
      restore()
    }
    expect(created).toHaveLength(1)
    expect(created[0]).toBe(served)
    expect(created[0].type).toBe('application/pdf')
    expect(clickSpy).not.toHaveBeenCalled()
    // Адрес отзывается НЕ сразу: вкладке ещё грузить документ. Граница — с
    // запасом в полминуты: поддельные часы идут и сами, вместе с настоящими.
    expect(revokeSpy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(30_000)
    expect(revokeSpy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(30_000)
    expect(revokeSpy).toHaveBeenCalledTimes(1)
    expect(revokeSpy).toHaveBeenCalledWith(BLOB_URL)
    expect(events.at(-1)).toBe(`revoke ${BLOB_URL}`)
  })

  it('T-10b: договор text/markdown — показывается текстом, байты те же', async () => {
    const served = new Blob(['# Договір'], { type: 'text/markdown; charset=utf-8' })
    const { restore } = withAdapter(ok(served, 'inline; filename="agreement-agr-1.md"'))
    try {
      const { button } = renderButton(DOC, LOAN_OWNER)
      fireEvent.click(button)
      await waitFor(() => expect(lastTab().location.href).toBe(BLOB_URL))
    } finally {
      restore()
    }
    expect(created).toHaveLength(1)
    expect(created[0].type).toBe('text/plain;charset=utf-8')
    expect(await readText(created[0])).toBe('# Договір')
  })

  it('T-10c: markdown как attachment — скачивается как есть, тип не меняется', async () => {
    const served = new Blob(['# Договір'], { type: 'text/markdown; charset=utf-8' })
    const { restore } = withAdapter(ok(served, 'attachment; filename="a.md"'))
    try {
      const { button } = renderButton(DOC, LOAN_OWNER)
      fireEvent.click(button)
      await waitFor(() => expect(downloads).toEqual(['a.md']))
    } finally {
      restore()
    }
    expect(created).toHaveLength(1)
    expect(created[0].type).toBe('text/markdown; charset=utf-8')
    expect(lastTab().location.href).toBe('')
    expect(lastTab().close).toHaveBeenCalledTimes(1)
  })

  it('T-10d: признак показа без учёта регистра — `Inline` открывает вкладку', async () => {
    const { restore } = withAdapter(ok(pdf(), 'Inline; filename="s.pdf"'))
    try {
      const { button } = renderButton(DOC, LOAN_OWNER)
      fireEvent.click(button)
      await waitFor(() => expect(lastTab().location.href).toBe(BLOB_URL))
    } finally {
      restore()
    }
    expect(clickSpy).not.toHaveBeenCalled()
    expect(lastTab().close).not.toHaveBeenCalled()
  })

  // Сервер сказал `inline`, но во вкладку уходят только инертные типы: blob-адрес
  // живёт в origin CRM, и загруженный клиентом HTML или SVG исполнил бы скрипт с
  // пропуском оператора. Прочее скачивается молча, как `attachment`.
  it.each([
    ['text/html', 'text/html'],
    ['image/svg+xml', 'image/svg+xml'],
    ['application/xhtml+xml', 'application/xhtml+xml'],
    ['text/html с параметром', 'text/html; charset=utf-8'],
    ['неизвестный тип', 'application/x-unknown'],
    ['тип не назван', ''],
  ])('T-18: inline «%s» — не во вкладку, а скачиванием', async (_label, type) => {
    const served = new Blob(['<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'], {
      type,
    })
    const { restore } = withAdapter(ok(served, 'inline; filename="x.html"'))
    try {
      const { onError, button } = renderButton(DOC, LOAN_OWNER)
      fireEvent.click(button)
      await waitFor(() => expect(created).toHaveLength(1))
      expect(lastTab().location.href, `blob-адрес ушёл во вкладку при типе «${type}»`).toBe('')
      expect(lastTab().close).toHaveBeenCalledTimes(1)
      expect(downloads).toEqual(['x.html'])
      expect(created[0]).toBe(served)
      expect(lastRefusal(onError)).toBeUndefined()
    } finally {
      restore()
    }
  })

  it.each([
    ['application/pdf'],
    ['application/pdf; name=x'],
    ['text/plain; charset=utf-8'],
    ['image/png'],
    ['image/jpeg'],
    ['image/gif'],
    ['image/webp'],
  ])('T-18b: inline «%s» — во вкладку (тип без параметров)', async (type) => {
    const { restore } = withAdapter(ok(new Blob(['x'], { type }), 'inline; filename="s"'))
    try {
      const { button } = renderButton(DOC, LOAN_OWNER)
      fireEvent.click(button)
      await waitFor(() => expect(created).toHaveLength(1))
      expect(lastTab().location.href, `инертный тип «${type}» не показан`).toBe(BLOB_URL)
      expect(clickSpy).not.toHaveBeenCalled()
    } finally {
      restore()
    }
  })
})

describe('CreditDocumentOpenButton → имя скачивания очищено', () => {
  async function downloadedAs(disposition: string, doc: CreditDocumentMeta = DOC) {
    const { restore } = withAdapter(ok(pdf(), disposition))
    try {
      const { button } = renderButton(doc, LOAN_OWNER)
      fireEvent.click(button)
      await waitFor(() => expect(downloads).toHaveLength(1))
    } finally {
      restore()
    }
    return downloads[0]
  }

  it('T-10e: знак смены направления письма снят — расширение видно настоящее', async () => {
    // «рахунок<U+202E>fdp.exe» на экране читается как «рахунокexe.pdf».
    expect(await downloadedAs(attachmentNamed('рахунок\u202efdp.exe'))).toBe('рахунокfdp.exe')
  })

  it('T-10f: разделители путей, управляющие символы и изоляторы направления сняты', async () => {
    const name = '..\\../tmp/\u0007a\u2066b\u2069\u200f.pdf'
    expect(await downloadedAs(attachmentNamed(name))).toBe('....tmpab.pdf')
  })

  it('T-10g: от имени ничего не осталось — имя по умолчанию', async () => {
    // Положительный контроль ветки: чистое имя берётся как есть (T-10), а
    // очищенное до пустоты уступает место заголовку документа, затем 'document'.
    expect(await downloadedAs(attachmentNamed('\u202e', ''))).toBe('other.pdf')
    downloads = []
    const untitled = { ...DOC, title: '\u202e/' }
    expect(await downloadedAs(attachmentNamed('\u202e', ''), untitled)).toBe('document')
  })

  // Весь перечень, а не представители: C0 и C1 — по концам диапазонов, набор
  // Bidi_Control (U+061C, U+200E–U+200F, U+202A–U+202E, U+2066–U+2069) и
  // разделители — поштучно. Сужение любого диапазона краснит свою строку.
  it.each([
    ['U+0000', '\u0000'],
    ['U+001F', '\u001f'],
    ['U+007F', '\u007f'],
    ['U+0080', '\u0080'],
    ['U+009F', '\u009f'],
    ['U+061C', '\u061c'],
    ['U+200E', '\u200e'],
    ['U+200F', '\u200f'],
    ['U+202A', '\u202a'],
    ['U+202B', '\u202b'],
    ['U+202C', '\u202c'],
    ['U+202D', '\u202d'],
    ['U+202E', '\u202e'],
    ['U+2066', '\u2066'],
    ['U+2067', '\u2067'],
    ['U+2068', '\u2068'],
    ['U+2069', '\u2069'],
    ['/', '/'],
    ['\\', '\\'],
  ])('T-10h: %s снимается из имени', async (_code, char) => {
    expect(await downloadedAs(attachmentNamed(`a${char}b.pdf`))).toBe('ab.pdf')
  })

  it('T-10i: пробелы по краям имени сняты; из одних пробелов — имя по умолчанию', async () => {
    expect(await downloadedAs(attachmentNamed('  рахунок.pdf  '))).toBe('рахунок.pdf')
    downloads = []
    expect(await downloadedAs(attachmentNamed('   ', ''))).toBe('other.pdf')
  })

  it("T-10j: расширенная форма с языком — `UTF-8'uk'…`", async () => {
    const disposition =
      "attachment; filename*=UTF-8'uk'%D0%B2%D0%B8%D0%BF%D0%B8%D1%81%D0%BA%D0%B0.pdf"
    expect(await downloadedAs(disposition)).toBe('виписка.pdf')
  })

  it('T-10k: простая форма без кавычек — токен до «;» или пробела', async () => {
    expect(await downloadedAs('attachment; filename=report.pdf')).toBe('report.pdf')
    downloads = []
    expect(await downloadedAs('attachment; filename=report.pdf; size=10')).toBe('report.pdf')
  })

  it('T-10l: имя без кавычек тоже очищается', async () => {
    expect(await downloadedAs('attachment; filename=a\u202eb.pdf; size=10')).toBe('ab.pdf')
  })
})

// ── Страж исходников ─────────────────────────────────────────────────────────
// Глоб Vite с `?raw`, как в `i18nKeys.test.ts`: модуль файловой системы Node
// роняет сборку типов. Собственный файл глоб не возвращает никогда
// (`creditStaleStandTexts.test.ts`), соседние тест-файлы — возвращает.

const RAW_SOURCES = {
  ...import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../../../features/credit/**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
} as Record<string, string>

// Ключи глоба относительны этому файлу; соседний тест приходит как `./x.test.tsx`,
// без `__tests__` в ключе. Поэтому фильтр — по репозиторному пути.
const GLOB_BASE = 'src/pages/Credit/__tests__'

function repoPath(key: string): string {
  const parts = GLOB_BASE.split('/')
  for (const segment of key.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') parts.pop()
    else parts.push(segment)
  }
  return parts.join('/')
}

const ALL_FILES = Object.entries(RAW_SOURCES).map(([key, src]) => [repoPath(key), src] as const)
const SECTION_SOURCES = ALL_FILES.filter(([path]) => !path.includes('/__tests__/'))

const CREDIT_API = 'src/features/credit/api/creditApi.ts'
const OPEN_BUTTON = 'src/pages/Credit/components/CreditDocumentOpenButton.tsx'

describe('документы раздела → только контрактные двери', () => {
  it('T-11: литерала демо-ручки нет ни в одном исходнике раздела', () => {
    // Контроль выборки ПЕРВЫМ: «не найдено» на пустом множестве — отказ проверки.
    const paths = SECTION_SOURCES.map(([path]) => path)
    expect(paths.length).toBeGreaterThan(0)
    expect(paths).toContain(CREDIT_API)
    expect(paths).toContain(OPEN_BUTTON)
    // Фильтр тест-файлов работает: в сыром множестве они есть, после — нет.
    expect(ALL_FILES.some(([path]) => path.includes('/__tests__/'))).toBe(true)
    expect(paths.filter((path) => path.includes('/__tests__/'))).toEqual([])

    const hits = SECTION_SOURCES.filter(([, src]) => src.includes('admin/documents')).map(
      ([path]) => path
    )
    expect(hits, `найден литерал admin/documents в: ${hits.join(', ')}`).toEqual([])

    // Положительный контроль ТОГО ЖЕ поиска: пути контрактных дверей в
    // `creditApi.ts` находятся — ровно две штуки.
    const api = SECTION_SOURCES.find(([path]) => path === CREDIT_API)?.[1] ?? ''
    expect(api.split('/documents/${documentId}/content').length - 1).toBe(2)
  })
})

// ── Словари ──────────────────────────────────────────────────────────────────
// Мок `t` печатает ключ и настоящий шаблон из JSON не рендерит никогда: потеря
// `{{status}}` при переводе оставалась бы зелёной, а оператор прочёл бы «код »
// без числа (приём `i18nKeys.test.ts`, подпись шага).

function lookup(dictionary: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in node) {
      return (node as Record<string, unknown>)[part]
    }
    return undefined
  }, dictionary)
}

describe('словари → общий текст отказа несёт статус', () => {
  it.each([
    ['uk', uk],
    ['en', en],
    ['es', es],
  ] as const)('T-16: %s — credit.documentOpen.errorGeneric с {{status}}', (_lang, dictionary) => {
    const value = lookup(dictionary, 'credit.documentOpen.errorGeneric')
    expect(typeof value).toBe('string')
    expect(String(value)).toContain('{{status}}')
  })
})

// ── Страницы ─────────────────────────────────────────────────────────────────
// Тесты кнопки подают `owner` руками и не видят, что СТРАНИЦА передала не того.

const idle = { data: undefined, isLoading: false, error: null, refetch: vi.fn() }

/** Копия фикстуры `CreditLoanDetailPage.test.tsx` со своим идентификатором. */
const LOAN_T = {
  loan_id: L,
  contract_number: 'FB-001788',
  product_code: 'CA_AB_PAYDAY',
  product_version: '1',
  status: 'delinquent',
  currency: 'CAD',
  principal_minor: 40_000,
  balance_total_minor: 51_000,
  project_id: 1,
  client_id: null,
  debt_id: null,
  application_id: 'a1111111-2222-3333-4444-555555555555',
  origin: 'credit_module',
  jurisdiction: 'CA-AB',
  schedule_version: 1,
  delinquency_days: 3,
  advance_refund_excess_minor: 0,
  paid_minor: 7_000,
  disbursed_at: '2026-08-29T09:00:00Z',
  maturity_date: '2026-10-19',
} as unknown as CreditLoanDetail

/** Копия состояния оттуда же; платежи этой сцене не нужны. */
const STATE_T = {
  loan_id: L,
  contract_number: 'FB-001788',
  status: 'delinquent',
  currency: 'CAD',
  paid_minor: 7000,
  delinquency: { delinquency_days: 20, arrears_flag: true, no_contact_flag: false },
  balances: {
    principal_minor: 27200,
    interest_minor: 130,
    fee_minor: 0,
    commission_minor: 0,
    penalty_minor: 0,
    fine_minor: 0,
    overpayment_minor: 0,
    total_due_minor: 27330,
    overdue_minor: 15930,
    principal_charged_minor: 30000,
    interest_charged_minor: 130,
    fee_charged_minor: 4200,
    commission_charged_minor: 0,
    penalty_charged_minor: 0,
    fine_charged_minor: 0,
    total_charged_minor: 34330,
    default_interest_minor: 130,
    nsf_fees_minor: 0,
  },
  flags: { validation_valid: true, delinquency_bucket: '1-30' },
  next_payment: { due_date: '2026-10-10', amount_minor: 11400 },
  payments: [],
} as unknown as CreditLoanState

/** Заявка по образцу `CreditApplicationDetailPage.test.tsx`: кредит уже выдан. */
const APPLICATION_T = {
  application_id: A,
  external_application_id: 'c0c0c0c0-0000-4000-8000-000000000006',
  number: 'CA-000208',
  status: 'disbursed',
  product_code: 'CA_AB_PAYDAY',
  channel: 'site',
  jurisdiction: 'CA-AB',
  currency: 'CAD',
  requested_amount_minor: 30_000,
  client_email: null,
  client_phone: null,
  created_at: '2026-08-31T20:07:08.091139+00:00',
  updated_at: '2026-08-31T20:48:41.882126+00:00',
  expires_at: '2026-09-01T20:07:08.103297+00:00',
  decision_outcome: null,
  decision_mode: null,
  final_amount_minor: null,
  project_id: 1,
  client_id: null,
  decision_id: null,
  // Кредит уже есть: выбор двери не должен зависеть от выдачи.
  loan_id: L,
  resume_step: null,
  missing_fields: [],
  paydays: [],
  consents: [],
  audit: [],
  draft: {},
  documents: [DOC],
} as unknown as CreditApplicationDetail

function mockLoanHooks(documents: CreditDocumentMeta[]) {
  vi.mocked(hooks.useCreditLoan).mockReturnValue({
    ...idle,
    data: LOAN_T,
  } as unknown as ReturnType<typeof hooks.useCreditLoan>)
  vi.mocked(hooks.useCreditLoanState).mockReturnValue({
    ...idle,
    data: STATE_T,
  } as unknown as ReturnType<typeof hooks.useCreditLoanState>)
  for (const hook of [
    hooks.useCreditLoanSchedule,
    hooks.useCreditLoanJournal,
    hooks.useCreditLoanScheduleVersions,
    hooks.useCreditApplication,
  ]) {
    vi.mocked(hook).mockReturnValue(idle as never)
  }
  vi.mocked(hooks.useCreditLoanDocuments).mockReturnValue({
    ...idle,
    data: { items: documents },
  } as unknown as ReturnType<typeof hooks.useCreditLoanDocuments>)
}

function mockApplicationHooks(documents: CreditDocumentMeta[]) {
  vi.mocked(hooks.useCreditApplication).mockReturnValue({
    ...idle,
    data: { ...APPLICATION_T, documents },
  } as unknown as ReturnType<typeof hooks.useCreditApplication>)
  vi.mocked(hooks.useCreditOverview).mockReturnValue(idle as never)
  vi.mocked(hooks.useCreditManualDecision).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never)
}

function renderLoanCard(documents: CreditDocumentMeta[] = [DOC]) {
  mockLoanHooks(documents)
  render(
    <MemoryRouter>
      <CreditLoanDetailPage />
    </MemoryRouter>
  )
  // Контроль до переключения: отрисован паспорт ЭТОГО кредита, а не экран
  // ошибки, — иначе падение ниже было бы «не про то».
  expect(screen.getAllByText(/FB-001788/).length).toBeGreaterThan(0)
  openDocumentsTab()
}

function renderApplicationCard(documents: CreditDocumentMeta[] = [DOC]) {
  mockApplicationHooks(documents)
  render(
    <MemoryRouter>
      {/* `gcTime: Infinity` — без пятиминутного таймера сборки кэша запросов: он
          пережил бы тест и спутал счёт таймеров кнопки в `afterEach`. */}
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
        }
      >
        <CreditApplicationDetailPage />
      </QueryClientProvider>
    </MemoryRouter>
  )
  // Контроль: у заявки кредит действительно есть — иначе сцена не о выдаче.
  expect(APPLICATION_T.loan_id).toBe(L)
  openDocumentsTab()
}

function openDocumentsTab() {
  fireEvent.click(screen.getByRole('tab', { name: 'credit.tabs.documents' }))
}

function clickOpen() {
  fireEvent.click(screen.getByRole('button', { name: 'credit.actions.openDocument' }))
}

/**
 * Тон плашки — по классам, снятым с самих компонентов: у `Alert` — с
 * `alertVariants`, у `CreditNotice` — с его отрисовки. jsdom стилей не считает,
 * и цвет, который увидит оператор, живёт только в классе. Роль тона не
 * различает, а у `CreditNotice` её нет вовсе.
 */
type Tone = 'alertError' | 'alertInfo' | 'noticeInfo'

let palette: Record<Tone, string[]> | undefined

function tones(): Record<Tone, string[]> {
  if (!palette) {
    // Отсоединённый контейнер: на экране сцены эталон не появляется.
    const { container, unmount } = render(<CreditNotice tone="info">x</CreditNotice>, {
      container: document.createElement('div'),
    })
    const noticeInfo = [...(container.firstElementChild as HTMLElement).classList]
    unmount()
    palette = {
      alertError: alertVariants({ variant: 'error' }).split(' '),
      alertInfo: alertVariants({ variant: 'info' }).split(' '),
      noticeInfo,
    }
  }
  return palette
}

function toneOf(element: Element): Tone[] {
  const known = tones()
  return (Object.keys(known) as Tone[]).filter((tone) =>
    known[tone].every((name) => element.classList.contains(name))
  )
}

/**
 * Плашки над таблицей документов: отказы (`role="alert"`) и уведомления любого
 * известного тона. Счёт — внутри панели документов: у карточки кредита есть
 * свои светлые плашки в других панелях.
 */
function plaques(): Element[] {
  return [...documentsPanel().querySelectorAll('div')].filter(
    (node) => node.getAttribute('role') === 'alert' || toneOf(node).length > 0
  )
}

function documentsPanel(): HTMLElement {
  const heading = screen.getByRole('heading', { name: 'credit.tabs.documents' })
  const panel = heading.closest('section')
  if (!panel) throw new Error('панели документов нет')
  return panel
}

/** Отказ показан оператору: текст стоит в элементе с ролью alert, тон — отказа. */
async function expectRefusalShown(key: string) {
  const alert = await screen.findByText(key)
  expect(alert).toHaveAttribute('role', 'alert')
  expect(toneOf(alert)).toEqual(['alertError'])
}

/** Уведомление показано оператору: светлая плашка раздела, не `Alert`. */
async function expectNoticeShown(key: string) {
  const notice = await screen.findByText(key)
  expect(toneOf(notice), 'уведомление нарисовано не CreditNotice info').toEqual(['noticeInfo'])
}

/** Ошибка → новое удачное нажатие: прежний отказ снят, документ открыт. */
async function expectRefusalClearedBySuccess() {
  // Положительный контроль: отказ первого нажатия на экране.
  await expectRefusalShown('credit.documentOpen.errorMissing')
  clickOpen()
  await waitFor(() => expect(lastTab().location.href).toBe(BLOB_URL))
  expect(screen.queryByText('credit.documentOpen.errorMissing')).not.toBeInTheDocument()
  expect(plaques()).toHaveLength(0)
}

describe('карточки → владелец двери из своей карточки', () => {
  it('T-12: карточка кредита — дверь кредита, отказ виден оператору', async () => {
    const { seen, restore } = withAdapter(missingFile())
    try {
      renderLoanCard()
      // До нажатия ни одной плашки: ниже появится именно наш отказ.
      expect(plaques()).toHaveLength(0)
      clickOpen()
      await expectRefusalShown('credit.documentOpen.errorMissing')
    } finally {
      restore()
    }
    expect(seen).toHaveLength(1)
    // Дверь — по карточке, а не по `loan_id`, записанному в документе.
    expect(seen[0].url).toBe(LOAN_DOOR)
  })

  it('T-12b: карточка кредита — удачное открытие снимает прежний отказ', async () => {
    const { seen, restore } = withAdapter(inTurn(missingFile(), inlinePdf()))
    try {
      renderLoanCard()
      clickOpen()
      await expectRefusalClearedBySuccess()
    } finally {
      restore()
    }
    expect(seen.map((config) => config.url)).toEqual([LOAN_DOOR, LOAN_DOOR])
  })

  it('T-13: карточка заявки с выданным кредитом — всё равно дверь заявки', async () => {
    const { seen, restore } = withAdapter(inlinePdf())
    try {
      renderApplicationCard()
      clickOpen()
      await waitFor(() => expect(lastTab().location.href).toBe(BLOB_URL))
    } finally {
      restore()
    }
    expect(seen).toHaveLength(1)
    expect(seen[0].url).toBe(APPLICATION_DOOR)
    expect(String(seen[0].url)).not.toContain('/loans/')
  })

  it('T-13b: карточка заявки — отказ виден оператору', async () => {
    const { seen, restore } = withAdapter(missingFile())
    try {
      renderApplicationCard()
      expect(plaques()).toHaveLength(0)
      clickOpen()
      await expectRefusalShown('credit.documentOpen.errorMissing')
    } finally {
      restore()
    }
    expect(seen).toHaveLength(1)
    expect(seen[0].url).toBe(APPLICATION_DOOR)
  })

  it('T-13c: карточка заявки — удачное открытие снимает прежний отказ', async () => {
    const { seen, restore } = withAdapter(inTurn(missingFile(), inlinePdf()))
    try {
      renderApplicationCard()
      clickOpen()
      await expectRefusalClearedBySuccess()
    } finally {
      restore()
    }
    expect(seen.map((config) => config.url)).toEqual([APPLICATION_DOOR, APPLICATION_DOOR])
  })
})

// ── Уведомление вместо отказа ────────────────────────────────────────────────
// Сцены идут по ОБЕИМ карточкам: плашка у каждой своя, и тон, перепутанный в
// одной, другая не выдаст.

const D2 = IDS.secondDocument
const SECOND_DOC: CreditDocumentMeta = {
  ...DOC,
  document_id: D2,
  kind: 'contract',
  title: 'second.pdf',
}

const CARDS = [
  ['кредита', renderLoanCard, LOAN_DOOR, `/api/v1/credit/loans/${L}/documents/${D2}/content`],
  [
    'заявки',
    renderApplicationCard,
    APPLICATION_DOOR,
    `/api/v1/credit/applications/${A}/documents/${D2}/content`,
  ],
] as const

const TAB_BLOCKED = 'credit.documentOpen.tabBlocked'
const MISSING = 'credit.documentOpen.errorMissing'

describe.each(CARDS)(
  'карточка %s → уведомление вместо отказа',
  (_card, renderCard, door, secondDoor) => {
    it('T-20: вкладку не дали — уведомление тоном сведений, не отказа; плашка одна', async () => {
      blockTabs = true
      const { seen, restore } = withAdapter(inlineAgreement())
      try {
        renderCard()
        // До нажатия ни одной плашки: ниже появится именно наша.
        expect(plaques()).toHaveLength(0)
        clickOpen()
        await expectNoticeShown(TAB_BLOCKED)
        expect(downloads).toEqual(['agreement-agr-1.md'])
        expect(plaques()).toHaveLength(1)
      } finally {
        restore()
      }
      expect(seen.map((config) => config.url)).toEqual([door])
    })

    it('T-26: живая область стоит до уведомления, и текст появляется внутри неё', async () => {
      blockTabs = true
      const { restore } = withAdapter(inlineAgreement())
      try {
        renderCard()
        // Область есть и пуста ДО уведомления: вставленную вместе с текстом
        // часть дикторов не объявляет.
        const region = within(documentsPanel()).getByRole('status')
        expect(region).toHaveAttribute('aria-live', 'polite')
        expect(region).toBeEmptyDOMElement()
        clickOpen()
        await expectNoticeShown(TAB_BLOCKED)
        // Тот же узел: область не пересоздана вместе с текстом.
        expect(within(documentsPanel()).getByRole('status')).toBe(region)
        expect(within(region).getByText(TAB_BLOCKED)).toBeInTheDocument()
      } finally {
        restore()
      }
    })

    it('T-21: отказ после уведомления заменяет уведомление', async () => {
      blockTabs = true
      const { restore } = withAdapter(inTurn(inlineAgreement(), missingFile()))
      try {
        renderCard()
        clickOpen()
        await expectNoticeShown(TAB_BLOCKED)
        clickOpen()
        await expectRefusalShown(MISSING)
        expect(screen.queryByText(TAB_BLOCKED)).not.toBeInTheDocument()
        expect(plaques()).toHaveLength(1)
        // Отказ вне живой области: у него своя `role="alert"`, а внутри
        // `status` диктор объявил бы его дважды и вежливым тоном.
        expect(within(documentsPanel()).getByRole('status')).toBeEmptyDOMElement()
      } finally {
        restore()
      }
    })

    it('T-22: уведомление после отказа заменяет отказ', async () => {
      blockTabs = true
      const { restore } = withAdapter(inTurn(missingFile(), inlineAgreement()))
      try {
        renderCard()
        clickOpen()
        await expectRefusalShown(MISSING)
        clickOpen()
        await expectNoticeShown(TAB_BLOCKED)
        expect(screen.queryByText(MISSING)).not.toBeInTheDocument()
        expect(plaques()).toHaveLength(1)
      } finally {
        restore()
      }
    })

    it('T-23: новое нажатие снимает уведомление в самом нажатии, до ответа', async () => {
      blockTabs = true
      let release: () => void = () => {}
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      const pdfReply = inlinePdf()
      const { restore } = withAdapter(
        inTurn(inlineAgreement(), async (config) => {
          await gate
          return pdfReply(config)
        })
      )
      try {
        renderCard()
        clickOpen()
        await expectNoticeShown(TAB_BLOCKED)
        blockTabs = false
        clickOpen()
        // Ответа ещё нет, а уведомления прошлого нажатия уже нет.
        expect(plaques()).toHaveLength(0)
        release()
        await waitFor(() => expect(lastTab().location.href).toBe(BLOB_URL))
        expect(plaques()).toHaveLength(0)
      } finally {
        restore()
      }
    })

    it('T-24: запоздавший отказ прежнего нажатия вытесняет уведомление — плашка одна', async () => {
      // Два документа: первый отвечает после второго. Кнопка снимает плашки
      // только в СВОЁМ нажатии — одну плашку держит карточка.
      blockTabs = true
      let release: () => void = () => {}
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      const refusal = missingFile()
      const agreement = inlineAgreement()
      const { seen, restore } = withAdapter(async (config) => {
        if (config.url === secondDoor) return agreement(config)
        await gate
        return refusal(config)
      })
      try {
        renderCard([DOC, SECOND_DOC])
        const [first, second] = screen.getAllByRole('button', {
          name: 'credit.actions.openDocument',
        })
        fireEvent.click(first)
        await waitFor(() => expect(seen).toHaveLength(1))
        fireEvent.click(second)
        await expectNoticeShown(TAB_BLOCKED)
        release()
        await expectRefusalShown(MISSING)
        expect(screen.queryByText(TAB_BLOCKED)).not.toBeInTheDocument()
        expect(plaques()).toHaveLength(1)
      } finally {
        restore()
      }
      expect(seen.map((config) => config.url)).toEqual([door, secondDoor])
    })

    it('T-25: запоздавшее уведомление прежнего нажатия вытесняет отказ — плашка одна', async () => {
      // Зеркало T-24: первый документ скачан без вкладки уже после того, как
      // второй отказал.
      blockTabs = true
      let release: () => void = () => {}
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      const refusal = missingFile()
      const agreement = inlineAgreement()
      const { seen, restore } = withAdapter(async (config) => {
        if (config.url === secondDoor) return refusal(config)
        await gate
        return agreement(config)
      })
      try {
        renderCard([DOC, SECOND_DOC])
        const [first, second] = screen.getAllByRole('button', {
          name: 'credit.actions.openDocument',
        })
        fireEvent.click(first)
        await waitFor(() => expect(seen).toHaveLength(1))
        fireEvent.click(second)
        await expectRefusalShown(MISSING)
        release()
        await expectNoticeShown(TAB_BLOCKED)
        expect(screen.queryByText(MISSING)).not.toBeInTheDocument()
        expect(plaques()).toHaveLength(1)
      } finally {
        restore()
      }
      expect(seen.map((config) => config.url)).toEqual([door, secondDoor])
    })
  }
)
