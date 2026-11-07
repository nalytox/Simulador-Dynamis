import { test, expect, type Page } from '@playwright/test';

const codigo = (page: Page) => page.locator('#editor .cm-content');

/** Lo que quedó guardado en una base de IndexedDB de este navegador. */
const leerBase = (page: Page, base: string, clave: string) => page.evaluate(([b, c]) => new Promise<unknown>(resolver => {
  const pedido = indexedDB.open(b, 1);
  pedido.onupgradeneeded = () => pedido.result.createObjectStore('datos');
  pedido.onsuccess = () => {
    const leer = pedido.result.transaction('datos').objectStore('datos').get(c);
    leer.onsuccess = () => resolver(leer.result);
  };
}), [base, clave] as const);

test('abre directo, sin elegir perfil, y el programa sigue ahí al volver', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#btn-probar')).toBeEnabled();
  await expect(page.locator('#btn-perfil')).toHaveCount(0);
  await codigo(page).click();
  await page.keyboard.press('Control+Home');
  await page.keyboard.type('// guardado en este computador\n');
  await expect.poll(() => leerBase(page, 'simulador-dynamis', 'proyecto').then(p => JSON.stringify(p))).toContain('// guardado en este computador');
  await page.reload();
  await expect(codigo(page)).toContainText('// guardado en este computador');
});

test('lo que estaba guardado en un perfil se abre la primera vez', async ({ page }) => {
  // Una página del mismo sitio que no arranca la app, para dejar la base del perfil antes de abrirla.
  await page.goto('/manifest.webmanifest');
  await page.evaluate(() => new Promise<void>(resolver => {
    const pedido = indexedDB.open('simulador-dynamis-juan', 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore('datos');
    pedido.onsuccess = () => {
      const tx = pedido.result.transaction('datos', 'readwrite');
      tx.objectStore('datos').put({ nombre: 'juan', archivos: { 'juan.ino': '// el programa de Juan\nvoid setup() {}\nvoid loop() {}\n' } }, 'proyecto');
      tx.oncomplete = () => resolver();
    };
  }));
  await page.goto('/');
  await expect(codigo(page)).toContainText('// el programa de Juan');
  await expect(page.locator('#consola')).toContainText('abrí el trabajo que estaba guardado como Juan');
});
