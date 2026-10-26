import { test, expect } from './fixtures';

test('antes de probar, las tarjetas muestran — y el juez muestra 2 hitos, la meta, "Quedan 5:00" y "0 de 3"', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#hitos .hito')).toHaveCount(3);
  await expect(page.locator('#hitos .hito').last()).toContainText('M');
  await expect(page.locator('#juez-tiempo')).toHaveText('Quedan 5:00');
  await expect(page.locator('#juez-rein')).toHaveText('0 de 3');
  await expect(page.locator('#juez-pts')).toHaveText('0');
  await expect(page.locator('#qtr-pos-num')).toHaveText('—');
  await expect(page.locator('#tof-val')).toContainText('—');
  await expect(page.locator('#color-nombre')).toHaveText('—');
  await expect(page.locator('#mpu-rumbo')).toHaveText('—');
  await expect(page.locator('#m-izq-n')).toHaveText('—');
  await expect(page.locator('#btn-ultimo-hito')).toBeDisabled();
});

test('Partir desde ofrece Partida, Hito 1 y Hito 2', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#sel-desde option')).toHaveText(['Partida', 'Hito 1', 'Hito 2']);
});

test('¿Cómo lo uso? muestra el código de ejemplo del QTR', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#s-qtr')).toBeHidden();
  await page.locator('.sensor .como').first().click();
  await expect(page.locator('#s-qtr')).toBeVisible();
  await expect(page.locator('#s-qtr')).toContainText('readLineBlack');
});
