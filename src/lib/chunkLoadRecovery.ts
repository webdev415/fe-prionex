const CHUNK_LOAD_RELOAD_KEY = '__chunk_load_reload__'
const CHUNK_LOAD_PATTERNS = [
  'failed to fetch dynamically imported module',
  'importing a module script failed',
  'chunkloaderror',
  'loading chunk',
]

const isChunkLoadError = (error: unknown): boolean => {
  if (!error) return false

  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : JSON.stringify(error)

  const normalized = message.toLowerCase()
  return CHUNK_LOAD_PATTERNS.some((pattern) => normalized.includes(pattern))
}

const alreadyRetried = (): boolean => {
  const currentPath = `${window.location.pathname}${window.location.search}`
  return sessionStorage.getItem(CHUNK_LOAD_RELOAD_KEY) === currentPath
}

const markRetried = () => {
  const currentPath = `${window.location.pathname}${window.location.search}`
  sessionStorage.setItem(CHUNK_LOAD_RELOAD_KEY, currentPath)
}

const clearRetryMark = () => {
  sessionStorage.removeItem(CHUNK_LOAD_RELOAD_KEY)
}

const forceReloadWithCacheBypass = () => {
  if (alreadyRetried()) return

  markRetried()

  const url = new URL(window.location.href)
  url.searchParams.set('__reload', Date.now().toString())
  window.location.replace(url.toString())
}

export const setupChunkLoadRecovery = () => {
  if (typeof window === 'undefined') return

  // App booted successfully, allow future recoveries after next deployment.
  clearRetryMark()

  window.addEventListener('error', (event) => {
    if (isChunkLoadError(event.error ?? event.message)) {
      forceReloadWithCacheBypass()
    }
  })

  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason)) {
      forceReloadWithCacheBypass()
    }
  })
}
