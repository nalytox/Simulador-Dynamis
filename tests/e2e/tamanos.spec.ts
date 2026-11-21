import { test, expect, type Page } from '@playwright/test';

const caja = async (page: Page, selector: string) => (await page.locator(selector).boundingBox())!;
const editor = (page: Page) => caja(page, '#editor .cm-editor');
const pista = (page: Page) => caja(page, '#lienzo-sim');

async function arrastrarManilla(page: Page, id: string, dx: number, dy: number) {
  const m = await caja(page, id);
  await page.mouse.move(m.x + m.width / 2, m.y + m.height / 2);
  await page.mouse.down();
  await page.mouse.move(m.x + m.width / 2 + dx, m.y + m.height / 2 + dy, { steps: 8 });
  await page.mouse.up();
}

test.use({ viewport: { width: 1400, height: 900 } });

test('la esquina del código agranda el editor y achica la pista; se guarda y el doble clic lo restablece', async ({ page }) => {
  await page.goto('/');
  const e0 = await editor(page);
  const p0 = await pista(page);
  await arrastrarManilla(page, '#manilla-editor', 150, 100);
  await expect.poll(async () => (await editor(page)).width).toBeGreaterThan(e0.width + 100);
  expect((await editor(page)).height).toBeCloseTo(e0.height + 100, -1);
  await expect.poll(async () => (await pista(page)).width).toBeLessThan(p0.width - 100);
  const e1 = await editor(page);

  await page.waitForTimeout(800);
  await page.reload();
  await expect.poll(async () => Math.round((await editor(page)).width)).toBe(Math.round(e1.width));
  expect(Math.round((await editor(page)).height)).toBe(Math.round(e1.height));

  await page.locator('#manilla-editor').dblclick();
  await expect.poll(async () => Math.round((await editor(page)).width)).toBe(Math.round(e0.width));
  expect(Math.round((await editor(page)).height)).toBe(Math.round(e0.height));
});

test('la esquina de la pista la agranda hacia la izquierda y hacia abajo; el lienzo se redibuja a su tamaño', async ({ page }) => {
  await page.goto('/');
  const p0 = await pista(page);
  await arrastrarManilla(page, '#manilla-pista', -120, 150);
  await expect.poll(async () => (await pista(page)).width).toBeGreaterThan(p0.width + 80);
  await expect.poll(async () => (await pista(page)).height).toBeGreaterThan(p0.height + 100);
  // El lienzo dibuja a su tamaño nuevo (sus píxeles siguen al tamaño en pantalla).
  const { ancho, cssAncho } = await page.locator('#lienzo-sim').evaluate((c: HTMLCanvasElement) => ({ ancho: c.width, cssAncho: c.clientWidth * (window.devicePixelRatio || 1) }));
  expect(Math.abs(ancho - cssAncho)).toBeLessThan(2);
});

test('con el teclado: la esquina toma el foco y las flechas cambian el tamaño', async ({ page }) => {
  await page.goto('/');
  const e0 = await editor(page);
  await page.locator('#manilla-editor').focus();
  await page.keyboard.press('Shift+ArrowDown');
  await expect.poll(async () => (await editor(page)).height).toBeCloseTo(e0.height + 50, -1);
});
