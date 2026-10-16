import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Served from a subpath of the main site: meeting-scheduler/scripts/build-subapps.mjs copies this
// build into meeting-scheduler/dist/team-dashboard/.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/team-dashboard/',
})
