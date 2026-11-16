import { test, expect, type Page } from '@playwright/test';

interface Ganchos { abrirProyecto(p: { nombre: string; archivos: Record<string, string> }): void }
const abrir = async (page: Page, archivos: Record<string, string>) => {
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { __pruebas?: Ganchos }).__pruebas?.abrirProyecto)).toBe('function');
  await page.evaluate(a => (window as unknown as { __pruebas: Ganchos }).__pruebas.abrirProyecto({ nombre: 'robot', archivos: a }), archivos);
};
const corriendo = (page: Page) => expect(page.locator('#txt-estado')).toHaveText('El robot está corriendo', { timeout: 150_000 });
const programa = (texto: string) => `void setup() { Serial.begin(115200); Serial.println("${texto}"); }\nvoid loop() { delay(100); }\n`;

test('el selector «Programa a ejecutar» decide qué .ino corre, y la elección sigue al recargar', async ({ page }) => {
  await page.goto('/');
  await abrir(page, { 'uno.ino': programa('soy uno'), 'dos.ino': programa('soy dos'), 'pines.h': '#pragma once\n' });
  const selector = page.getByLabel('Programa a ejecutar');
  await expect(selector.locator('option')).toHaveText(['dos.ino', 'uno.ino']);
  await selector.selectOption('uno.ino');
  await page.locator('#btn-probar').click();
  await corriendo(page);
  await expect(page.locator('#consola')).toContainText('soy uno', { timeout: 20_000 });
  await expect(page.locator('#consola')).not.toContainText('soy dos');
  await page.locator('#btn-probar').click();
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.getByLabel('Programa a ejecutar')).toHaveValue('uno.ino');
});

const pestanas = (page: Page) => page.locator('#pestanas [role="tab"]');

test('las pestañas se ordenan arrastrándolas o con Alt+flechas, y el orden sigue al recargar', async ({ page }) => {
  await page.goto('/');
  await abrir(page, { 'a.ino': programa('a'), 'b.h': '#pragma once\n', 'c.h': '#pragma once\n' });
  await expect(pestanas(page)).toHaveText(['a.ino', 'b.h', 'c.h']);

  // Arrastra c.h hasta antes de b.h.
  const c = (await page.getByRole('tab', { name: 'c.h' }).boundingBox())!;
  const b = (await page.getByRole('tab', { name: 'b.h' }).boundingBox())!;
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 5 });
  await page.mouse.move(b.x + 4, b.y + b.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(pestanas(page)).toHaveText(['a.ino', 'c.h', 'b.h']);
  // Arrastrar no cambia el archivo abierto.
  await expect(page.getByRole('tab', { name: 'a.ino' })).toHaveAttribute('aria-selected', 'true');

  // Con el teclado: Alt+← mueve la pestaña con el foco.
  await page.getByRole('tab', { name: 'b.h' }).click();
  await page.keyboard.press('Alt+ArrowLeft');
  await expect(pestanas(page)).toHaveText(['a.ino', 'b.h', 'c.h']);
  await expect(page.getByRole('tab', { name: 'b.h' })).toBeFocused();
  await page.keyboard.press('Alt+ArrowRight');
  await expect(pestanas(page)).toHaveText(['a.ino', 'c.h', 'b.h']);

  await page.waitForTimeout(800);
  await page.reload();
  await expect(pestanas(page)).toHaveText(['a.ino', 'c.h', 'b.h']);
});
