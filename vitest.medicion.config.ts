import { defineConfig } from 'vitest/config';

// Mediciones de rendimiento: fuera de `npm test`. Se corren con `npm run medir`.
export default defineConfig({
  test: {
    include: ['tests/medicion/**/*.test.ts'],
    globalSetup: ['tests/configurar-nucleo.ts'],
    testTimeout: 300_000,
    silent: false,
  },
});
