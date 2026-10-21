import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unidad/**/*.test.ts', 'tests/integracion/**/*.test.ts'],
  },
});
