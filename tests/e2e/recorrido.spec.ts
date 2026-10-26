import { test, expect, type Page } from '@playwright/test';

// Una visita nueva: sin la marca de "recorrido visto" que traen las demás pruebas.
test.use({ storageState: { cookies: [], origins: [] } });

const texto = (page: Page) => page.locator('#rec-texto');
const siguiente = (page: Page) => page.locator('#rec-siguiente');

test('la primera visita muestra los 4 pasos y no vuelve a aparecer', async ({ page }) => {
  await page.goto('/');
  await expect(texto(page)).toHaveText('Este es tu código');
  await expect(page.locator('#rec-paso')).toHaveText('1 de 4');
  await siguiente(page).click();
  await expect(texto(page)).toHaveText('Presiona aquí para probar');
  await siguiente(page).click();
  await expect(texto(page)).toHaveText('Aquí ves lo que siente tu robot');
  await siguiente(page).click();
  await expect(texto(page)).toHaveText('Aquí construyes la pista');
  await expect(siguiente(page)).toHaveText('¡Listo!');
  await siguiente(page).click();
  await expect(page.locator('#recorrido')).toBeHidden();
  await page.reload();
  await expect(page.locator('#btn-probar')).toBeEnabled();
  await expect(page.locator('#recorrido')).toBeHidden();
});

test('Saltar termina el recorrido', async ({ page }) => {
  await page.goto('/');
  await expect(texto(page)).toHaveText('Este es tu código');
  await page.locator('#rec-saltar').click();
  await expect(page.locator('#recorrido')).toBeHidden();
});

test('Esc termina el recorrido y el foco queda en Probar mi robot', async ({ page }) => {
  await page.goto('/');
  await expect(texto(page)).toHaveText('Este es tu código');
  await page.keyboard.press('Escape');
  await expect(page.locator('#recorrido')).toBeHidden();
  await expect(page.locator('#btn-probar')).toBeFocused();
});

test('en 1024 × 640 el bocadillo entra completo en la ventana', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 640 });
  await page.goto('/');
  for (let paso = 0; paso < 4; paso++) {
    await expect(page.locator('#rec-paso')).toHaveText(`${paso + 1} de 4`);
    const caja = (await page.locator('#recorrido').boundingBox())!;
    expect(caja.x, `paso ${paso + 1}`).toBeGreaterThanOrEqual(0);
    expect(caja.y, `paso ${paso + 1}`).toBeGreaterThanOrEqual(0);
    expect(caja.x + caja.width, `paso ${paso + 1}`).toBeLessThanOrEqual(1024);
    expect(caja.y + caja.height, `paso ${paso + 1}`).toBeLessThanOrEqual(640);
    await siguiente(page).click();
  }
});

test('el foco entra al bocadillo', async ({ page }) => {
  await page.goto('/');
  await expect(texto(page)).toHaveText('Este es tu código');
  await expect(siguiente(page)).toBeFocused();
});

/** Contraste WCAG entre el texto de un elemento y su fondo real (el primero no transparente hacia arriba). */
const contraste = (page: Page, selector: string) => page.locator(selector).evaluate(el => {
  const rgba = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
  const luz = ([r, g, b]: number[]) => {
    const canal = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
  };
  let fondo: number[] = [255, 255, 255];
  for (let e: Element | null = el; e; e = e.parentElement) {
    const c = rgba(getComputedStyle(e).backgroundColor);
    if (c.length === 3 || (c.length === 4 && c[3] > 0.5)) { fondo = c; break; }
  }
  const [a, b] = [luz(rgba(getComputedStyle(el).color)), luz(fondo)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
});

test('el botón Siguiente se distingue del bocadillo, también con el mouse encima', async ({ page }) => {
  await page.goto('/');
  await expect(siguiente(page)).toBeVisible();
  expect(await contraste(page, '#rec-siguiente')).toBeGreaterThanOrEqual(4.5);
  await siguiente(page).hover();
  expect(await contraste(page, '#rec-siguiente')).toBeGreaterThanOrEqual(4.5);
});
