import { readFileSync } from 'node:fs';
import { test, expect, type Page } from './fixtures';
import { zipSync, strToU8 } from 'fflate';

/** Lo que quedó autoguardado en IndexedDB para un archivo del proyecto. */
const guardado = (page: Page, ruta: string) => page.evaluate(r => new Promise<string | undefined>(resolver => {
  const pedido = indexedDB.open('simulador-dynamis-marco', 1);
  pedido.onsuccess = () => {
    const leer = pedido.result.transaction('datos').objectStore('datos').get('proyecto');
    leer.onsuccess = () => resolver(leer.result?.archivos?.[r]);
  };
}), ruta);

const pestanas = (page: Page) => page.locator('#pestanas [role="tab"]');
const codigo = (page: Page) => page.locator('#editor .cm-content');

test('Ctrl+Z después de cambiar de pestaña no mezcla archivos', async ({ page }) => {
  await page.goto('/');
  await codigo(page).click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('\n// mi cambio');
  await pestanas(page).nth(1).click();
  await expect(codigo(page)).toContainText('PINES_QTR');
  await pestanas(page).nth(0).click();
  await codigo(page).click();
  for (let i = 0; i < 5; i++) await page.keyboard.press('Control+z');
  await page.waitForTimeout(800);
  expect(await guardado(page, 'seguidor.ino')).toBe(readFileSync('src/ejemplos/seguidor/seguidor.ino', 'utf8'));
  expect(await guardado(page, 'pines.h')).toBe(readFileSync('src/ejemplos/seguidor/pines.h', 'utf8'));
});

test('recién abierta, Ctrl+Z no vacía el archivo', async ({ page }) => {
  await page.goto('/');
  await expect(codigo(page)).toContainText('Seguidor de línea');
  await codigo(page).click();
  await page.keyboard.press('Control+z');
  await expect(codigo(page)).toContainText('Seguidor de línea');
});

test('las flechas recorren las pestañas sin perder el foco', async ({ page }) => {
  await page.goto('/');
  await pestanas(page).first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(pestanas(page).nth(1)).toBeFocused();
  await expect(pestanas(page).nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(pestanas(page).nth(0)).toBeFocused();
  await expect(pestanas(page).nth(0)).toHaveAttribute('aria-selected', 'true');
});

test('Serial.print sin salto de línea no congela la página', async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { __pruebas?: { abrirProyecto?: unknown } }).__pruebas?.abrirProyecto)).toBe('function');
  await page.evaluate(() => (window as unknown as { __pruebas: { abrirProyecto(p: unknown): void } }).__pruebas.abrirProyecto(
    { nombre: 'p', archivos: { 'p.ino': 'void setup() { Serial.begin(115200); }\nvoid loop() { Serial.print(millis()); }\n' } }));
  await page.locator('#vel').fill('4');
  await page.locator('#btn-probar').click();
  await expect(page.locator('#txt-estado')).toHaveText('El robot está corriendo', { timeout: 150_000 });
  await page.waitForTimeout(10_000);
  const inicio = Date.now();
  await page.locator('#btn-pausa').click();
  await expect(page.locator('#txt-estado')).toHaveText('En pausa');
  expect(Date.now() - inicio).toBeLessThan(1000);
  const masLarga = await page.locator('#consola div').evaluateAll(filas => Math.max(...filas.map(f => f.textContent!.length)));
  expect(masLarga).toBeLessThan(1100);
});

/** Una carpeta de mentira para showDirectoryPicker, con los archivos dados; registra lo que se escribe. */
async function simularSelector(page: Page, archivos: Record<string, string>) {
  await page.addInitScript(contenido => {
    const escritos: string[] = [];
    (window as unknown as { __escritos: string[] }).__escritos = escritos;
    const carpeta = {
      name: 'elegida', kind: 'directory',
      async *entries() {
        for (const [nombre, texto] of Object.entries(contenido)) yield [nombre, { kind: 'file', getFile: async () => new File([texto], nombre) }];
      },
      requestPermission: async () => 'granted',
      getDirectoryHandle: async () => carpeta,
      getFileHandle: async (nombre: string) => ({ createWritable: async () => ({ write: async () => { escritos.push(nombre); }, close: async () => {} }) }),
    };
    (window as unknown as { showDirectoryPicker: () => Promise<unknown> }).showDirectoryPicker = async () => carpeta;
  }, archivos);
}

test('una carpeta sin .ino no deja activo "Guardar en la carpeta"', async ({ page }) => {
  await simularSelector(page, { 'notas.h': '#pragma once' });
  await page.goto('/');
  await page.locator('#btn-carpeta').click();
  await expect(page.locator('#burbuja')).toContainText('No encontramos un archivo .ino');
  await expect(page.locator('#btn-guardar-carpeta')).toBeHidden();
});

test('abrir otro proyecto oculta "Guardar en la carpeta" de la carpeta anterior', async ({ page }) => {
  await simularSelector(page, { 'elegida.ino': 'void setup() {}\nvoid loop() {}\n' });
  await page.goto('/');
  await page.locator('#btn-carpeta').click();
  await expect(page.locator('#chip-carpeta')).toHaveText('Carpeta: elegida');
  await expect(page.locator('#btn-guardar-carpeta')).toBeVisible();
  const zip = Buffer.from(zipSync({ 'otro/otro.ino': strToU8('void setup() {}\nvoid loop() {}\n') }));
  await page.setInputFiles('#in-zip', { name: 'otro.zip', mimeType: 'application/zip', buffer: zip });
  const dialogo = page.locator('dialog[open]');
  if (await dialogo.count()) await dialogo.getByRole('button', { name: 'Reemplazar' }).click();
  await expect(page.locator('#chip-carpeta')).toHaveText('Carpeta: otro');
  await expect(page.locator('#btn-guardar-carpeta')).toBeHidden();
});

test('abrir otro proyecto pide confirmar si cambiaste el tuyo; Cancelar lo deja como estaba', async ({ page }) => {
  await page.goto('/');
  await codigo(page).click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('\n// trabajo mío');
  await page.setInputFiles('#in-carpeta', 'tests/e2e/proyectos/mi-robot');
  const dialogo = page.locator('dialog[open]');
  await expect(dialogo).toContainText('¿Reemplazar tu proyecto?');
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.locator('#chip-carpeta')).toHaveText('Carpeta: seguidor');
  await expect(codigo(page)).toContainText('// trabajo mío');
  await page.setInputFiles('#in-carpeta', 'tests/e2e/proyectos/mi-robot');
  await dialogo.getByRole('button', { name: 'Reemplazar' }).click();
  await expect(page.locator('#chip-carpeta')).toHaveText('Carpeta: mi-robot');
});
