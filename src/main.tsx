import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from './components/Toaster'
import { QUERY } from './constants'
import { setupChunkLoadRecovery } from './lib/chunkLoadRecovery.ts'
import './lib/i18n'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY.STALE_TIME,
      retry: QUERY.RETRY_COUNT,
    },
  },
})

setupChunkLoadRecovery()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Suspense
        fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}
      >
        <App />
        <Toaster />
      </Suspense>
    </QueryClientProvider>
  </StrictMode>
)
