import { it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, truncateSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { revisarDist } from '../../scripts/revisar-dist.mjs';

let dir = '';
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dist-'));
  for (const archivo of ['index.html', 'sw.js', 'manifest.webmanifest']) writeFileSync(join(dir, archivo), 'x');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

it('revisarDist acepta un dist completo', () => {
  expect(revisarDist(dir)).toEqual([]);
});

it('revisarDist avisa un archivo de 100 MB y lo que falta', () => {
  const grande = join(dir, 'llvm.core.wasm');
  writeFileSync(grande, '');
  truncateSync(grande, 100 * 1024 * 1024);
  rmSync(join(dir, 'sw.js'));
  const problemas = revisarDist(dir);
  expect(problemas.some(p => p.includes('llvm.core.wasm'))).toBe(true);
  expect(problemas).toContain('Falta sw.js.');
});

it('el workflow publica en Pages al hacer push a main', () => {
  const flujo = readFileSync('.github/workflows/publicar.yml', 'utf8');
  for (const texto of [
    'branches: [main]', 'workflow_dispatch', 'node-version: 22',
    'npm ci', 'npm test', 'npm run build', 'node scripts/revisar-dist.mjs dist',
    'actions/upload-pages-artifact', 'path: dist', 'actions/deploy-pages', 'pages: write', 'id-token: write',
  ]) expect(flujo, texto).toContain(texto);
});
