import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Deployed as a subpath of the standalone app (meeting-scheduler), not its own domain
  // root — see meeting-scheduler/scripts/build-ems.mjs, which meeting-scheduler's own
  // `npm run build` runs to build this app and copy its output into
  // meeting-scheduler/dist/enhanced-meeting-scheduler/. Every %BASE_URL% reference in
  // index.html/privacy.html/terms.html picks this up at build time.
  base: '/enhanced-meeting-scheduler/',
  build: {
    rollupOptions: {
      // Static, non-React legal pages linked from the app's footer — plain multi-page
      // entries so `vite build` actually emits them into dist/ alongside index.html.
      input: {
        main: resolve(__dirname, 'index.html'),
        privacy: resolve(__dirname, 'privacy.html'),
        terms: resolve(__dirname, 'terms.html'),
        whatTimeZone: resolve(__dirname, 'what-time-zone.html'),
        accessibility: resolve(__dirname, 'accessibility.html'),
      },
    },
  },
})
