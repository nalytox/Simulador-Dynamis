import { test, expect } from './fixtures';

test('la página carga aislada, con la banda y la vista Programar', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#tab-programar')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#btn-probar')).toHaveText(/Probar mi robot/);
  await expect(page.locator('#tab-pista')).toBeEnabled();
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
  await expect(page.locator('#aviso-global')).toBeHidden();
});

test('sin aislamiento de origen cruzado explica qué hacer', async ({ page }) => {
  await page.route('/', async ruta => {
    const respuesta = await ruta.fetch();
    const cabeceras = { ...respuesta.headers() };
    delete cabeceras['cross-origin-opener-policy'];
    delete cabeceras['cross-origin-embedder-policy'];
    await ruta.fulfill({ response: respuesta, headers: cabeceras });
  });
  await page.goto('/');
  await expect(page.locator('#aviso-global')).toContainText('recarga la página o usa Chrome, Edge o Firefox recientes');
});
