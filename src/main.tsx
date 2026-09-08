import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { Toaster } from './components/Toaster'
import { QUERY } from './constants'
import { setupChunkLoadRecovery } from './lib/chunkLoadRecovery.ts'
import { applyDomTranslationCompat } from './lib/domTranslationCompat'
import './lib/i18n'
import './index.css'
import App from './App.tsx'
import { AppLoadingFallback } from '@/components/ui/AppLoadingFallback'
import { setupThemeStorageListener, useThemeStore } from '@/stores/themeStore'

// Ensure theme store module evaluates (applies attrs from localStorage).
void useThemeStore.getState()

// Mutation retry policy: retry ONCE on a pure network error (no HTTP
// response received — e.g. browser dropped the connection, DNS hiccup,
// gunicorn worker recycle mid-flight). We deliberately do NOT retry on
// HTTP 4xx/5xx because most mutation endpoints don't have idempotency
// keys yet, and a server that processed the write but failed mid-response
// would get a duplicate on retry. Transient 5xx on safe (GET) requests
// is handled at the axios layer in src/lib/api.ts.
const MUTATION_NETWORK_ERROR_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK'])
const isMutationRetryable = (error: unknown): boolean => {
  const axiosError = error as AxiosError | undefined
  if (!axiosError || axiosError.response) return false
  return Boolean(axiosError.code && MUTATION_NETWORK_ERROR_CODES.has(axiosError.code))
}

// A refused read is refused for good: the role will not have gained the
// permission by the time a retry lands, so the second request only doubles
// the rejected traffic and the noise in the gateway log.
const isQueryRetryable = (error: unknown): boolean => {
  const status = (error as AxiosError | undefined)?.response?.status
  return status !== 401 && status !== 403
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY.STALE_TIME,
      retry: (failureCount, error) => failureCount < QUERY.RETRY_COUNT && isQueryRetryable(error),
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: (failureCount, error) => failureCount < 1 && isMutationRetryable(error),
      retryDelay: 500,
    },
  },
})

setupChunkLoadRecovery()
applyDomTranslationCompat()
const teardownThemeStorageListener = setupThemeStorageListener()
if (import.meta.hot) {
  import.meta.hot.dispose(() => teardownThemeStorageListener())
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<AppLoadingFallback />}>
        <App />
        <Toaster />
      </Suspense>
    </QueryClientProvider>
  </StrictMode>
)
