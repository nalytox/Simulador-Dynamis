import { test, expect } from './fixtures';

test('compila en el navegador: un sketch válido da un módulo y uno con error da el diagnóstico', async ({ page }) => {
  await page.goto('/');
  const r = await page.evaluate(async () => {
    const c = (window as unknown as { __pruebas: { compilador: { compilar(p: unknown): Promise<{ ok: boolean; diagnosticos: unknown[] }> } } }).__pruebas.compilador;
    const bueno = await c.compilar({ nombre: 'p', archivos: { 'p.ino': 'void setup() {}\nvoid loop() {}\n' } });
    const malo = await c.compilar({ nombre: 'p', archivos: { 'p.ino': 'void setup() {\n  int x = 1\n}\nvoid loop() {}\n' } });
    return { bueno: bueno.ok, malo: malo.ok, d: malo.diagnosticos[0] };
  });
  expect(r).toMatchObject({ bueno: true, malo: false, d: { archivo: 'p.ino', linea: 2, severidad: 'error' } });
});
