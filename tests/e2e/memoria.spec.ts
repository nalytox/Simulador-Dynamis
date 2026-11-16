import { test, expect, type Page } from '@playwright/test';

interface Ganchos { abrirProyecto(p: { nombre: string; archivos: Record<string, string> }): void }
const abrir = async (page: Page, codigo: string) => {
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { __pruebas?: Ganchos }).__pruebas?.abrirProyecto)).toBe('function');
  await page.evaluate(c => (window as unknown as { __pruebas: Ganchos }).__pruebas.abrirProyecto({ nombre: 'p', archivos: { 'p.ino': c } }), codigo);
};
const corriendo = (page: Page) => expect(page.locator('#txt-estado')).toHaveText('El robot está corriendo', { timeout: 150_000 });

/** Cuenta en la memoria cuántas veces partió. */
const CONTAR = `#include <Preferences.h>
Preferences memoria;
void setup() {
  Serial.begin(115200);
  memoria.begin("arranques");
  unsigned int veces = memoria.getUInt("veces", 0) + 1;
  memoria.putUInt("veces", veces);
  memoria.putString("nombre", "Dynamis");
  Serial.printf("Parti %u veces\\n", veces);
}
void loop() { delay(100); }
`;

const tarjeta = (page: Page) => page.locator('#tarjeta-memoria');
const fila = (page: Page, clave: string) => tarjeta(page).locator('tr', { hasText: clave });

test('la tarjeta muestra lo que el programa guarda, sigue ahí al volver a probar y al recargar, y se borra', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#mem-vacia')).toHaveText('La memoria está vacía.');
  await expect(page.locator('#mem-uso')).toHaveText('0 de 504 entradas (0 %)');
  await abrir(page, CONTAR);

  await page.locator('#btn-probar').click();
  await corriendo(page);
  await expect(fila(page, 'veces')).toContainText('1', { timeout: 20_000 });
  await expect(tarjeta(page)).toContainText('arranques');
  await expect(fila(page, 'nombre')).toContainText('«Dynamis»');
  await expect(page.locator('#mem-vacia')).toBeHidden();
  await expect(page.locator('#btn-borrar-memoria')).toBeDisabled();
  await page.locator('#btn-probar').click();
  await expect(page.locator('#btn-borrar-memoria')).toBeEnabled();

  await page.locator('#btn-probar').click();
  await corriendo(page);
  await expect(page.locator('#consola')).toContainText('Parti 2 veces', { timeout: 20_000 });
  await expect(fila(page, 'veces')).toContainText('2');
  await page.locator('#btn-probar').click();

  // Se guarda con un pequeño retardo: espera a que quede en la base antes de recargar.
  await page.waitForTimeout(1000);
  await page.reload();
  await expect(fila(page, 'veces')).toContainText('2');
  await expect(page.locator('#mem-uso')).toHaveText('4 de 504 entradas (1 %)');

  await page.locator('#btn-borrar-memoria').click();
  await page.getByRole('button', { name: 'Borrar la memoria', exact: true }).last().click();
  await expect(page.locator('#mem-vacia')).toBeVisible();
  await page.waitForTimeout(1000);
  await page.reload();
  await expect(page.locator('#mem-vacia')).toBeVisible();
});

test('con datos guardados de antes, sin memoria, la página abre con la memoria vacía', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', e => errores.push(e.message));
  await page.goto('/manifest.webmanifest');
  await page.evaluate(() => new Promise<void>(resolver => {
    const pedido = indexedDB.open('simulador-dynamis', 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore('datos');
    pedido.onsuccess = () => {
      const tx = pedido.result.transaction('datos', 'readwrite');
      tx.objectStore('datos').put({ velocidad: 100 }, 'preferencias');
      tx.oncomplete = () => resolver();
    };
  }));
  await page.goto('/');
  await expect(page.locator('#mem-vacia')).toHaveText('La memoria está vacía.');
  expect(errores).toEqual([]);
});

test('¿Cómo lo uso? de la memoria muestra Preferences', async ({ page }) => {
  await page.goto('/');
  await tarjeta(page).locator('.como').click();
  await expect(page.locator('#s-mem')).toContainText('Preferences');
});
