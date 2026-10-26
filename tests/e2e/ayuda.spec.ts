import { test, expect, type Page } from './fixtures';

async function abrirAyuda(page: Page) {
  await page.locator('#btn-ayuda').click();
  await expect(page.locator('#ventana-ayuda')).toBeVisible();
}
const fila = (page: Page, grupo: string, que: string) =>
  page.locator('#ay-conexiones table', { hasText: grupo }).locator('tr', { has: page.locator('th', { hasText: new RegExp(`^${que}$`) }) });

test('Ayuda muestra la guía de cada sensor y copia el programa', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await abrirAyuda(page);
  await expect(page.locator('#ay-sensores .ay-guia')).toHaveCount(5);
  await page.locator('#ay-guia-qtr .ay-copiar').click();
  await expect(page.locator('#ay-guia-qtr .ay-copiar')).toHaveText('¡Copiado!');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('#include <QTRSensors.h>');
});

test('el aviso I2C aparece en la guía del sensor de distancia', async ({ page }) => {
  await page.goto('/');
  await abrirAyuda(page);
  await expect(page.locator('#ay-guia-vl53l0x .ay-aviso')).toContainText('misma dirección I2C (0x29)');
});

test('Conexiones de mi robot sigue a Mi robot', async ({ page }) => {
  await page.goto('/');
  await abrirAyuda(page);
  await page.locator('#ay-tab-conexiones').click();
  await expect(fila(page, 'Motor izquierdo', 'PWM')).toContainText('18');
  await page.locator('#ay-mi-robot').click();
  await expect(page.locator('#ventana-robot')).toBeVisible();
  await page.locator('#rb-motores-izq-pwm').fill('23');
  await page.locator('#rb-motores-izq-pwm').press('Enter');
  await page.locator('#robot-listo').click();
  // El foco no se pierde: vuelve al botón Ayuda.
  await expect(page.locator('#btn-ayuda')).toBeFocused();
  await abrirAyuda(page);
  await page.locator('#ay-tab-conexiones').click();
  await expect(fila(page, 'Motor izquierdo', 'PWM')).toContainText('23');
});

test('Las bases muestran el puntaje', async ({ page }) => {
  await page.goto('/');
  await abrirAyuda(page);
  await page.locator('#ay-tab-bases').click();
  await expect(page.locator('#ay-bases')).toContainText('(300 − segundos) ÷ 4');
  await expect(page.locator('#ay-bases')).toContainText('Línea con cortes');
});

test('Ver el recorrido de nuevo lo muestra', async ({ page }) => {
  await page.goto('/');
  await abrirAyuda(page);
  await page.locator('#ay-tab-inicio').click();
  await page.locator('#ay-recorrido').click();
  await expect(page.locator('#ventana-ayuda')).toBeHidden();
  await expect(page.locator('#rec-texto')).toHaveText('Este es tu código');
});

test('las pestañas se usan con las flechas y Esc cierra', async ({ page }) => {
  await page.goto('/');
  await abrirAyuda(page);
  await page.locator('#ay-tab-sensores').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#ay-tab-conexiones')).toBeFocused();
  await expect(page.locator('#ay-tab-conexiones')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#ay-conexiones')).toBeVisible();
  await expect(page.locator('#ay-sensores')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#ventana-ayuda')).toBeHidden();
  await expect(page.locator('#btn-ayuda')).toBeFocused();
});
