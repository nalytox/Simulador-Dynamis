import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

/**
 * La versión publicada (spec §16): `dist/` servido en /Simulador-Dynamis/ sin las cabeceras COOP/COEP,
 * igual que GitHub Pages. El service worker tiene que aislar la página y guardar la app para usarla sin internet.
 */
const PUERTO = 5180;
const BASE = `http://localhost:${PUERTO}/Simulador-Dynamis/`;
const CHROMIUM_LOCAL = '/opt/pw-browsers/chromium';

export default defineConfig({
  testDir: 'tests/e2e-produccion',
  timeout: 600_000,
  expect: { timeout: 15_000 },
  use: {
    actionTimeout: 15_000,
    baseURL: BASE,
    storageState: 'tests/e2e-produccion/estado-inicial.json',
    launchOptions: { executablePath: existsSync(CHROMIUM_LOCAL) ? CHROMIUM_LOCAL : undefined },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: `npm run build && node scripts/servir-dist.mjs dist ${PUERTO}`,
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 600_000,
  },
});
