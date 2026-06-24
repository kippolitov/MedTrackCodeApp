/**
 * Mock replacement for `@microsoft/power-apps/app` (mock dev mode only).
 * Aliased in via vite.config.ts when running `vite --mode mock` so that
 * useUser() resolves a name without the Power Apps host.
 */
export async function getContext() {
  return {
    user: {
      fullName: 'Alex Morgan',
    },
  }
}
