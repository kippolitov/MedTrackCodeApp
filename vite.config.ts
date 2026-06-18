import { defineConfig } from 'vitest/config'
import path from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { powerApps } from '@microsoft/power-apps-vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    powerApps()
  ],
  server: {
    port: 3000,
    https: {
      key: './localhost-key.pem',
      cert: './localhost.pem',
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    passWithNoTests: true,
    clearMocks: true,
  },
})
