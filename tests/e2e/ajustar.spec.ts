import { test, expect, type Page } from '@playwright/test';

const ventana = (page: Page) => page.locator('#ventana-ajuste');

async function abrirAjuste(page: Page) {
  await page.goto('/');
  await page.locator('#btn-ajustar').click();
  await expect(ventana(page)).toBeVisible();
}

async function abrirProyecto(page: Page, archivos: Record<string, string>) {
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { __pruebas?: { abrirProyecto?: unknown } }).__pruebas?.abrirProyecto)).toBe('function');
  await page.evaluate(a => (window as unknown as { __pruebas: { abrirProyecto(p: unknown): void } }).__pruebas.abrirProyecto({ nombre: 'p', archivos: a }), archivos);
}

test('Ajustar parámetros muestra los valores marcados del ejemplo', async ({ page }) => {
  await abrirAjuste(page);
  const siguelineas = ventana(page).locator('.pid', { has: page.getByRole('heading', { name: 'Siguelíneas' }) });
  await expect(siguelineas).toContainText('En tu código');
  const velocidad = siguelineas.locator('.param', { hasText: 'VELOCIDAD' });
  await expect(velocidad.locator('.param-val')).toHaveText('100');
  await expect(velocidad.getByLabel('Mínimo de VELOCIDAD')).toHaveValue('50');
  await expect(velocidad.getByLabel('Máximo de VELOCIDAD')).toHaveValue('200');
  const kp = siguelineas.locator('.param', { hasText: 'KP' });
  await expect(kp.locator('.param-val')).toHaveText('0,025');
  await expect(kp).toContainText('Qué tan fuerte corrige');
  await expect(kp.getByLabel('Mínimo de KP')).toHaveValue('0');
  await expect(kp.getByLabel('Máximo de KP')).toHaveValue('0.1');
  await expect(ventana(page).getByLabel('KP', { exact: true })).toBeChecked();
  const giroscopio = ventana(page).locator('.pid', { has: page.getByRole('heading', { name: 'Giroscopio' }) });
  await expect(giroscopio).toContainText('Todavía no está en tu código. Marca sus variables así:');
  await expect(giroscopio.locator('pre')).toHaveText('float kp = 1.0;  // @ajustar giroscopio');
  await expect(page.locator('#aj-pista')).toHaveText('Práctica');
  await expect(page.locator('#aj-chip')).toHaveText('Sin empezar');
  await expect(page.locator('#aj-pruebas')).toHaveValue('200');
});

test('sin valores elegidos no se puede empezar', async ({ page }) => {
  await abrirAjuste(page);
  await ventana(page).getByLabel('KP', { exact: true }).uncheck();
  await ventana(page).getByLabel('VELOCIDAD', { exact: true }).uncheck();
  await page.locator('#aj-empezar').click();
  await expect(page.locator('#aj-error')).toContainText('Elige al menos un valor para ajustar.');
  await expect(page.locator('#aj-chip')).toHaveText('Sin empezar');
});

test('un rango al revés no deja empezar', async ({ page }) => {
  await abrirAjuste(page);
  await ventana(page).getByLabel('Mínimo de KP').fill('0.5');
  await ventana(page).getByLabel('Mínimo de KP').press('Tab');
  await page.locator('#aj-empezar').click();
  await expect(page.locator('#aj-error')).toContainText('El rango de KP no sirve: el mínimo debe ser menor que el máximo.');
  // Lo elegido se mantiene al cerrar y volver a abrir.
  await page.locator('#aj-cerrar').click();
  await page.locator('#btn-ajustar').click();
  await expect(ventana(page).getByLabel('Mínimo de KP')).toHaveValue('0.5');
});

test('un código sin marcas lo dice, y un constexpr marcado muestra su aviso', async ({ page }) => {
  await page.goto('/');
  await abrirProyecto(page, { 'p.ino': 'constexpr float kp = 1.0; // @ajustar siguelineas\nvoid setup() {}\nvoid loop() {}\n' });
  await page.locator('#btn-ajustar').click();
  await expect(page.locator('#aj-avisos')).toContainText('kp está marcado con @ajustar pero es constexpr');
  await expect(page.locator('#aj-avisos')).toContainText('p.ino, línea 1');
  await page.locator('#aj-empezar').click();
  await expect(page.locator('#aj-error')).toContainText('Tu código no tiene valores marcados con @ajustar.');
});

test('Esc y "Volver a mi programa" cierran la ventana y el foco vuelve al botón', async ({ page }) => {
  await abrirAjuste(page);
  await page.keyboard.press('Escape');
  await expect(ventana(page)).toBeHidden();
  await expect(page.locator('#btn-ajustar')).toBeFocused();
  await page.locator('#btn-ajustar').click();
  await page.locator('#aj-cerrar').click();
  await expect(ventana(page)).toBeHidden();
  await expect(page.locator('#btn-ajustar')).toBeFocused();
});
