import { test, expect, type Page } from '@playwright/test';

const pestanas = (page: Page) => page.locator('#pestanas [role="tab"]');
const codigo = (page: Page) => page.locator('#editor .cm-content');
const robotX = (page: Page) => page.evaluate(() => (window as unknown as { __pruebas: { robot(): { x: number } | null } }).__pruebas.robot()?.x ?? null);
const corriendo = (page: Page) => expect(page.locator('#txt-estado')).toHaveText('El robot está corriendo', { timeout: 150_000 });

async function abrirEjemplos(page: Page) {
  await page.locator('#btn-ejemplos').click();
  await expect(page.locator('#ventana-ejemplos')).toBeVisible();
}

test('Ejemplos abre un proyecto y Probar mi robot lo corre', async ({ page }) => {
  await page.goto('/');
  await abrirEjemplos(page);
  await page.locator('#ej-proyecto-mover-motores .ej-abrir').click();
  await expect(page.locator('#ventana-ejemplos')).toBeHidden();
  await expect(pestanas(page).first()).toHaveText('mover-motores.ino');
  await expect(pestanas(page).first()).toHaveAttribute('aria-selected', 'true');
  await page.locator('#btn-probar').click();
  await corriendo(page);
  const x0 = await robotX(page);
  await expect.poll(() => robotX(page), { timeout: 20_000 }).not.toBe(x0);
  await expect(page.locator('#consola')).toContainText('Adelante', { timeout: 20_000 });
  // La consola sigue el final: con la consola a la vista, se ve la última línea.
  await page.locator('#consola').scrollIntoViewIfNeeded();
  await expect(page.locator('#consola > div').last()).toBeInViewport();
});

test('con el proyecto cambiado pide confirmar y Cancelar lo deja como estaba', async ({ page }) => {
  await page.goto('/');
  await codigo(page).click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('\n// trabajo mío');
  await abrirEjemplos(page);
  await page.locator('#ej-proyecto-leer-linea .ej-abrir').click();
  const dialogo = page.locator('dialog[open]', { hasText: '¿Reemplazar tu proyecto?' });
  await expect(dialogo).toBeVisible();
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  await expect(codigo(page)).toContainText('// trabajo mío');
  await expect(pestanas(page).first()).toHaveText('seguidor.ino');
});

test('Ejemplos abre una pista y la de la prueba no cambia mientras corre', async ({ page }) => {
  await page.goto('/');
  await page.locator('#btn-probar').click();
  await corriendo(page);
  await abrirEjemplos(page);
  await page.locator('#ej-pista-cruces .ej-abrir').click();
  await expect(page.locator('#ventana-ejemplos')).toBeHidden();
  // La prueba sigue en la pista de práctica: 2 hitos y la meta.
  await expect(page.locator('#hitos .hito')).toHaveCount(3);
  await page.locator('#btn-inicio').click();
  await expect(page.locator('#hitos .hito')).toHaveCount(9);
});

test('la tarjeta de un proyecto abre su pista', async ({ page }) => {
  await page.goto('/');
  await abrirEjemplos(page);
  await expect(page.locator('#ej-proyecto-marcas-color')).toContainText('Se prueba en la pista «Cruces con marcas»');
  await page.locator('#ej-proyecto-marcas-color .ej-abrir-pista').click();
  await expect(page.locator('#ventana-ejemplos')).toBeHidden();
  await page.locator('#btn-ajustar').click();
  await expect(page.locator('#aj-pista')).toHaveText('Cruces con marcas');
});

test('Esc cierra la ventana y el foco vuelve a Ejemplos', async ({ page }) => {
  await page.goto('/');
  await abrirEjemplos(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#ventana-ejemplos')).toBeHidden();
  await expect(page.locator('#btn-ejemplos')).toBeFocused();
});
