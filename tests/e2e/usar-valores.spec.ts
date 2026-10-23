import { test, expect, type Page } from '@playwright/test';
import { entrenar, usarAjusteDePrueba } from './ayuda/ajuste';

/** Lo que quedó autoguardado en IndexedDB para un archivo del proyecto. */
const guardado = (page: Page, ruta: string) => page.evaluate(r => new Promise<string | undefined>(resolver => {
  const pedido = indexedDB.open('simulador-dynamis', 1);
  pedido.onsuccess = () => {
    const leer = pedido.result.transaction('datos').objectStore('datos').get('proyecto');
    leer.onsuccess = () => resolver(leer.result?.archivos?.[r]);
  };
}), ruta);
const lineaDe = (texto: string | undefined, prefijo: string) => texto?.split('\n').find(l => l.startsWith(prefijo)) ?? '';
const robotX = (page: Page) => page.evaluate(() => (window as unknown as { __pruebas: { robot(): { x: number } | null } }).__pruebas.robot()?.x ?? null);

async function entrenarDiez(page: Page) {
  await usarAjusteDePrueba(page);
  await page.goto('/');
  await entrenar(page, 10);
  await expect(page.locator('#aj-chip')).toHaveText('Terminado', { timeout: 240_000 });
}

test('Usar estos valores reescribe las marcas y se puede deshacer', async ({ page }) => {
  test.setTimeout(300_000);
  await entrenarDiez(page);
  const mejorKp = await page.locator('#aj-tabla tr', { hasText: 'KP' }).locator('td').nth(1).textContent();
  await page.locator('#aj-usar').click();
  await expect(page.locator('#ventana-ajuste')).toBeHidden();
  await expect(page.locator('#vista-programar')).toBeVisible();
  await expect(page.locator('#txt-logro')).toHaveText('¡Tu robot aprendió! Cambiamos los valores marcados en tu código.');
  await expect(page.locator('#editor .linea-ajustada')).toHaveCount(2);
  await expect(page.locator('#consola')).toContainText('Usé los valores del entrenamiento: VELOCIDAD = ');
  await expect.poll(async () => lineaDe(await guardado(page, 'seguidor.ino'), 'const float KP')).toMatch(/^const float KP = (?!0\.025;)/);
  const kp = lineaDe(await guardado(page, 'seguidor.ino'), 'const float KP');
  expect(kp).toMatch(/^const float KP = \d+\.\d+;      \/\/ cuánto corrige por cada unidad de error · @ajustar siguelineas 0\.\.0\.1$/);
  expect(kp.match(/= ([\d.]+);/)![1].replace('.', ',')).toBe(mejorKp);
  expect(lineaDe(await guardado(page, 'seguidor.ino'), 'const int VELOCIDAD')).toMatch(/^const int VELOCIDAD = \d+;/);
  // Ctrl+Z vuelve a los valores de antes.
  await page.locator('#editor .cm-content').click();
  await page.keyboard.press('Control+z');
  await expect.poll(async () => lineaDe(await guardado(page, 'seguidor.ino'), 'const float KP')).toContain('= 0.025;');
  await expect(page.locator('#editor .linea-ajustada')).toHaveCount(0);
});

test('una marca que cambió de línea se encuentra igual', async ({ page }) => {
  test.setTimeout(300_000);
  await entrenarDiez(page);
  await page.locator('#aj-cerrar').click();
  await page.locator('#editor .cm-content').click();
  await page.keyboard.press('Control+Home');
  await page.keyboard.type('// una línea nueva\n');
  await page.locator('#btn-ajustar').click();
  await page.locator('#aj-usar').click();
  await expect.poll(async () => (await guardado(page, 'seguidor.ino'))?.split('\n')[10] ?? '').toMatch(/^const float KP = (?!0\.025;)/);
  expect((await guardado(page, 'seguidor.ino'))?.split('\n')[0]).toBe('// una línea nueva');
});

test('Ver esta prueba en la pista corre la mejor prueba', async ({ page }) => {
  test.setTimeout(300_000);
  await entrenarDiez(page);
  await page.locator('#aj-ver').click();
  await expect(page.locator('#ventana-ajuste')).toBeHidden();
  await expect(page.locator('#txt-estado')).toHaveText('El robot está corriendo', { timeout: 60_000 });
  const x0 = await robotX(page);
  await expect.poll(() => robotX(page), { timeout: 20_000 }).not.toBe(x0);
});
