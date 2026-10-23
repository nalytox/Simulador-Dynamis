import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const PUERTO = 5179;
// En el contenedor de desarrollo Chromium ya viene instalado; en otro computador Playwright usa el suyo.
const CHROMIUM_LOCAL = '/opt/pw-browsers/chromium';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  expect: { timeout: 10_000 },
  use: {
    actionTimeout: 15_000,
    baseURL: `http://localhost:${PUERTO}`,
    // Las pruebas parten con el recorrido de la primera visita ya visto (recorrido.spec.ts lo prueba).
    storageState: 'tests/e2e/estado-inicial.json',
    launchOptions: { executablePath: existsSync(CHROMIUM_LOCAL) ? CHROMIUM_LOCAL : undefined },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: `npm run dev -- --port ${PUERTO} --strictPort`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
