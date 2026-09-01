import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  define: {
    'import.meta.env.VITE_BUILD_TS': JSON.stringify(String(Date.now())),
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      // Кредитный модуль — отдельный сервис (credit-service). Локально он живёт
      // на машине разработчика, поэтому идёт мимо dev-Kong; на этапе 2 маршрут
      // /api/v1/credit/* появится в Kong и это правило исчезнет.
      // ВАЖНО: правило объявлено ДО общего '/api' — vite берёт первое
      // совпадение префикса, и при обратном порядке кредитные запросы уехали бы
      // на dev-сервер, где сервиса ещё нет.
      '/api/v1/credit': {
        target: process.env.VITE_CREDIT_PROXY_TARGET || 'http://localhost:8020',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://72.62.17.132:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://72.62.17.132:8000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          state: ['@tanstack/react-query', 'zustand'],
          ui: [
            '@radix-ui/react-checkbox',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-select',
            '@radix-ui/react-slot',
            '@radix-ui/react-tooltip',
          ],
          forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
          i18n: [
            'i18next',
            'react-i18next',
            'i18next-browser-languagedetector',
            'i18next-http-backend',
          ],
          misc: ['axios', 'date-fns', 'socket.io-client'],
        },
      },
    },
  },
})
