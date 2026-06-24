import { defineConfig } from 'vitest/config'
import path from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { powerApps } from '@microsoft/power-apps-vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Mock dev mode (`vite --mode mock` / `npm run dev:mock`): swap the generated
  // Dataverse services and the Power Apps host module for in-memory mocks so the
  // app runs end-to-end with seed data and no Power runtime. Not applied in
  // normal dev/build or under Vitest (which uses vi.mock instead).
  const mockAliases =
    mode === 'mock'
      ? [
          {
            find: /^@\/generated\/services\/Ppa_medicationsService$/,
            replacement: path.resolve(__dirname, './src/mocks/mock-medications-service.ts'),
          },
          {
            find: /^@\/generated\/services\/Ppa_intakelogsService$/,
            replacement: path.resolve(__dirname, './src/mocks/mock-intakelogs-service.ts'),
          },
          {
            find: /^@microsoft\/power-apps\/app$/,
            replacement: path.resolve(__dirname, './src/mocks/mock-app.ts'),
          },
        ]
      : []

  return {
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
      // Array form so the specific mock entries are matched before the general "@".
      alias: [
        ...mockAliases,
        { find: '@', replacement: path.resolve(__dirname, './src') },
      ],
    },
    test: {
      environment: 'happy-dom',
      globals: true,
      setupFiles: ['./tests/setup.ts'],
      passWithNoTests: true,
      clearMocks: true,
    },
  }
})
