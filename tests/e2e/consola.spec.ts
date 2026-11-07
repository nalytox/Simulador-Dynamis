import { test, expect, type Page } from '@playwright/test';

const agregar = async (page: Page, desde: number, hasta: number) => {
  // La consola está debajo del editor: se trae a la vista para mirar qué líneas se ven.
  await page.locator('#consola').scrollIntoViewIfNeeded();
  await agregarLineas(page, desde, hasta);
};
const agregarLineas = (page: Page, desde: number, hasta: number) => page.evaluate(([a, b]) => {
  const mensajes = (window as unknown as { __pruebas: { mensajes(t: number, texto: string): void } }).__pruebas.mensajes;
  for (let i = a; i < b; i++) mensajes(i / 10, `línea ${i}\n`);
}, [desde, hasta]);
const linea = (page: Page, texto: string) => page.locator('#consola div', { hasText: new RegExp(`${texto}$`) });

test('los mensajes nuevos empujan hacia arriba mientras se mira el final', async ({ page }) => {
  await page.goto('/');
  await agregar(page, 0, 300);
  await expect(linea(page, 'línea 299')).toBeInViewport();
  await expect(linea(page, 'línea 0')).not.toBeInViewport();
  await expect(page.locator('#pildora-nuevos')).toBeHidden();
});

test('si el usuario sube, la vista no se mueve y aparece "Mensajes nuevos ↓"; su clic vuelve al final', async ({ page }) => {
  await page.goto('/');
  await agregar(page, 0, 100);
  await expect(linea(page, 'línea 99')).toBeInViewport();
  await page.locator('#consola').evaluate(c => { c.scrollTop = 0; });
  await agregar(page, 100, 200);
  await expect(page.locator('#pildora-nuevos')).toBeVisible();
  await expect(linea(page, 'línea 0')).toBeInViewport();
  await page.locator('#pildora-nuevos').click();
  await expect(linea(page, 'línea 199')).toBeInViewport();
  await expect(page.locator('#pildora-nuevos')).toBeHidden();
});

test('Limpiar borra los mensajes', async ({ page }) => {
  await page.goto('/');
  await agregar(page, 0, 10);
  await expect(linea(page, 'línea 9')).toBeVisible();
  await page.locator('#btn-limpiar').click();
  await expect(page.locator('#consola div')).toHaveCount(0);
});
