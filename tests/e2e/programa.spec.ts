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
