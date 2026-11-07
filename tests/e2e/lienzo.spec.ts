import { test, expect, type Page } from '@playwright/test';

interface GanchoLienzo { aPantalla(x: number, y: number): { px: number; py: number }; vista(): { escala: number } }

/** Suma r + g + b del píxel del lienzo que corresponde al punto (x, y) de la pista, en mm. */
const brillo = (page: Page, x: number, y: number) => page.evaluate(([x, y]) => {
  const lienzo = (window as unknown as { __pruebas?: { lienzo?: GanchoLienzo } }).__pruebas?.lienzo;
  if (!lienzo || lienzo.vista().escala === 0) return -1;
  const { px, py } = lienzo.aPantalla(x, y);
  const canvas = document.getElementById('lienzo-sim') as HTMLCanvasElement;
  const [r, g, b] = canvas.getContext('2d')!.getImageData(Math.round(px), Math.round(py), 1, 1).data;
  return r + g + b;
}, [x, y]);

test('lo que se ve es lo que siente el robot', async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => brillo(page, 450, 450)).toBeGreaterThanOrEqual(0);
  await expect.poll(() => brillo(page, 450, 450)).toBeLessThan(150);
  expect(await brillo(page, 450, 510)).toBeGreaterThan(600);
});

test('la rueda del mouse acerca la vista', async ({ page }) => {
  await page.goto('/');
  const escala = () => page.evaluate(() => (window as unknown as { __pruebas?: { lienzo?: GanchoLienzo } }).__pruebas?.lienzo?.vista().escala ?? 0);
  await expect.poll(escala).toBeGreaterThan(0);
  const antes = await escala();
  await page.locator('#lienzo-sim').hover();
  await page.mouse.wheel(0, -300);
  await expect.poll(escala).toBeGreaterThan(antes);
});
