import { test, expect, type Page } from '../e2e/fixtures';


/** Espera a que la página quede aislada; la primera vez se recarga sola, y mientras tanto evaluate puede fallar. */
async function aislada(page: Page) {
  await expect.poll(() => page.evaluate(() => crossOriginIsolated).catch(() => false), { timeout: 60_000 }).toBe(true);
  await expect(page.locator('#btn-probar')).toBeEnabled();
}

/** En la versión publicada no están los ganchos de prueba: se mira el reloj de la prueba y los motores. */
async function probarYVerMoverse(page: Page) {
  await page.locator('#btn-probar').click();
  await expect(page.locator('#txt-estado')).toHaveText('El robot está corriendo', { timeout: 300_000 });
  await expect(page.locator('#chip-tiempo')).not.toHaveText('t = 0,0 s', { timeout: 30_000 });
  await expect(page.locator('#m-izq-n')).not.toHaveText('0%', { timeout: 30_000 });
}

test('sin las cabeceras, la app se aísla sola y Probar mi robot funciona', async ({ page }) => {
  await page.goto('./');
  await aislada(page);
  await expect(page.locator('#aviso-global')).toBeHidden();
  await probarYVerMoverse(page);
});

test('después de probar una vez, funciona sin internet', async ({ page, context }) => {
  await page.goto('./');
  await aislada(page);
  await probarYVerMoverse(page);
  await context.setOffline(true);
  await page.reload();
  await aislada(page);
  await probarYVerMoverse(page);
});

test('sin internet y sin haber probado nunca, pide internet para la primera vez', async ({ page, context }) => {
  await page.goto('./');
  await aislada(page);
  await context.setOffline(true);
  await page.locator('#btn-probar').click();
  await expect(page.locator('#burbuja')).toContainText('Falta internet para la primera vez', { timeout: 60_000 });
  await expect(page.locator('#burbuja')).toContainText('Reintentar');
  await expect(page.locator('#txt-estado')).not.toContainText('Preparando');
});

test('el manifiesto y los íconos se publican', async ({ request }) => {
  const r = await request.get('manifest.webmanifest');
  expect(r.status()).toBe(200);
  const m = await r.json();
  expect(m.name).toBe('Simulador Dynamis');
  for (const icono of m.icons as { src: string }[]) expect((await request.get(icono.src)).status(), icono.src).toBe(200);
});

test('el botón Instalar aparece con beforeinstallprompt', async ({ page }) => {
  await page.goto('./');
  await aislada(page);
  await expect(page.locator('#btn-instalar')).toBeHidden();
  await page.evaluate(() => {
    const e = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: async () => {},
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    window.dispatchEvent(e);
  });
  await expect(page.locator('#btn-instalar')).toBeVisible();
  await page.locator('#btn-instalar').click();
  await expect(page.locator('#btn-instalar')).toBeHidden();
});
