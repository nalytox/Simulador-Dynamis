import { defineConfig } from 'vite';

/** SharedArrayBuffer (pausa y ritmo de la simulación) exige aislamiento de origen cruzado. */
const AISLAMIENTO = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  base: './',
  server: { headers: AISLAMIENTO },
  preview: { headers: AISLAMIENTO },
  // @yowasp/clang busca sus .wasm junto a su propio archivo con import.meta.url: no se preempaqueta.
  optimizeDeps: { exclude: ['@yowasp/clang'] },
  worker: { format: 'es' },
  // @yowasp/clang usa await en el nivel superior.
  build: { target: 'es2022' },
});
