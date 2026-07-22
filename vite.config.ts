import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: {
        // PGlite's wasm/data assets (the embedded Postgres build) are well past Workbox's 2 MiB
        // default — they must precache for the app to start offline at all.
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
      },
      manifest: {
        name: 'Steppwize',
        short_name: 'Steppwize',
        description: 'Controle financeiro pessoal Steppwize',
        theme_color: '#0F1117',
        background_color: '#0F1117',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
