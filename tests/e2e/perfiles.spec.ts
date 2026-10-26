import { test, expect, type Page } from '@playwright/test';

// Sin perfil elegido de antemano (las demás pruebas parten como Marco, ver fixtures.ts).
const NOMBRES = ['Marco', 'Maite', 'Juan', 'Antonio', 'Agustin', 'Javier', 'Emilia'];
const ORIGEN = 'http://localhost:5179';
const RECORRIDO_VISTO = NOMBRES.map(n => ({ name: `dynamis.recorrido.${n.toLowerCase()}`, value: 'visto' }));
test.use({ storageState: { cookies: [], origins: [{ origin: ORIGEN, localStorage: RECORRIDO_VISTO }] } });

const ventana = (page: Page) => page.locator('#ventana-perfil');
const codigo = (page: Page) => page.locator('#editor .cm-content');

async function elegir(page: Page, nombre: string) {
  await expect(ventana(page)).toBeVisible();
  await ventana(page).getByRole('button', { name: nombre, exact: true }).click();
  await expect(ventana(page)).toBeHidden();
  await expect(page.locator('#btn-perfil')).toContainText(nombre);
  await expect(codigo(page)).toBeVisible();
}

test('al abrir pide elegir quién va a programar, solo con los siete nombres', async ({ page }) => {
  await page.goto('/');
  await expect(ventana(page)).toBeVisible();
  await expect(ventana(page).getByRole('button')).toHaveText(NOMBRES);
  await page.keyboard.press('Escape');
  await expect(ventana(page)).toBeVisible();
});

test('cada perfil guarda su propio programa', async ({ page }) => {
  await page.goto('/');
  await elegir(page, 'Marco');
  // Arriba del archivo: el editor solo dibuja las líneas que están a la vista.
  await codigo(page).click();
  await page.keyboard.press('Control+Home');
  await page.keyboard.type('// trabajo de Marco\n');
  await page.locator('#btn-perfil').click();
  await elegir(page, 'Maite');
  await expect(codigo(page)).not.toContainText('trabajo de Marco');
  await page.locator('#btn-perfil').click();
  await elegir(page, 'Marco');
  await expect(codigo(page)).toContainText('// trabajo de Marco');
});

test('recargar no vuelve a preguntar; una sesión nueva sí', async ({ page, browser }) => {
  await page.goto('/');
  await elegir(page, 'Juan');
  await page.reload();
  await expect(page.locator('#btn-perfil')).toContainText('Juan');
  await expect(codigo(page)).toBeVisible();
  await expect(ventana(page)).toBeHidden();
  const otra = await browser.newPage();
  await otra.goto('/');
  await expect(ventana(otra)).toBeVisible();
  await otra.close();
});

test.describe('sin recorridos vistos', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test('el recorrido de la primera visita es de cada perfil', async ({ page }) => {
    await page.goto('/');
    await elegir(page, 'Antonio');
    await expect(page.locator('#rec-texto')).toHaveText('Este es tu código');
    await page.locator('#rec-saltar').click();
    await page.locator('#btn-perfil').click();
    await elegir(page, 'Emilia');
    await expect(page.locator('#rec-texto')).toHaveText('Este es tu código');
  });
});
