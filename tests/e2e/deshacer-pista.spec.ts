import { test, expect } from '@playwright/test';
import { abrirEditor, baldosa, clicCelda, elegirPieza } from './ayuda/editor';

const tipoEn = async (page: Parameters<typeof baldosa>[0], c: number, r: number) => (await baldosa(page, c, r))?.tipo ?? null;

test('Ctrl+Z deshace poner una baldosa y Ctrl+Y la vuelve a poner; los botones hacen lo mismo', async ({ page }) => {
  await abrirEditor(page);
  const deshacer = page.locator('#btn-deshacer-pista');
  const rehacer = page.locator('#btn-rehacer-pista');
  await expect(deshacer).toBeDisabled();
  expect(await tipoEn(page, 5, 4)).toBeNull();

  await elegirPieza(page, 'Recta');
  await clicCelda(page, 5, 4);
  await expect.poll(() => tipoEn(page, 5, 4)).toBe('recta');
  await expect(deshacer).toBeEnabled();

  await page.keyboard.press('Control+z');
  await expect.poll(() => tipoEn(page, 5, 4)).toBeNull();
  await page.keyboard.press('Control+y');
  await expect.poll(() => tipoEn(page, 5, 4)).toBe('recta');
  await page.keyboard.press('Control+Shift+z');  // no queda nada por rehacer
  await expect.poll(() => tipoEn(page, 5, 4)).toBe('recta');

  await deshacer.click();
  await expect.poll(() => tipoEn(page, 5, 4)).toBeNull();
  await expect(rehacer).toBeEnabled();
  await rehacer.click();
  await expect.poll(() => tipoEn(page, 5, 4)).toBe('recta');
  await expect(rehacer).toBeDisabled();
});

test('Ctrl+Z dentro de un campo de texto deshace lo escrito, no la pista', async ({ page }) => {
  await abrirEditor(page);
  await elegirPieza(page, 'Recta');
  await clicCelda(page, 5, 4);
  await expect.poll(() => tipoEn(page, 5, 4)).toBe('recta');
  const nombre = page.locator('#pista-nombre');
  await nombre.click();
  await nombre.press('End');
  await nombre.type(' mía');
  await nombre.press('Control+z');
  expect(await tipoEn(page, 5, 4)).toBe('recta');
});
