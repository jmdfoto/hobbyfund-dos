import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // cloudflare() runs worker/index.js (the /api backend) inside the dev server.
  plugins: [react(), cloudflare()],
})
