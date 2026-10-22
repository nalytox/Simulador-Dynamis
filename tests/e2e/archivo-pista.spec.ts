import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { abrirEditor, baldosa, clicCelda, clicEn, elegirPieza, pistaEditor } from './ayuda/editor';
import { escribirPista, leerPista, pistaVacia } from '../../src/pista/serializacion';

interface GanchoLienzo { aPantalla(x: number, y: number): { px: number; py: number }; vista(): { escala: number } }

/** Suma r + g + b del lienzo de Programar en el punto (x, y) de la pista. */
const brilloProgramar = (page: Page, x: number, y: number) => page.evaluate(([x, y]) => {
  const lienzo = (window as unknown as { __pruebas?: { lienzo?: GanchoLienzo } }).__pruebas?.lienzo;
  if (!lienzo || lienzo.vista().escala === 0) return -1;
  const { px, py } = lienzo.aPantalla(x, y);
  const canvas = document.getElementById('lienzo-sim') as HTMLCanvasElement;
  const [r, g, b] = canvas.getContext('2d')!.getImageData(Math.round(px), Math.round(py), 1, 1).data;
  return r + g + b;
}, [x, y]);

async function abrirArchivo(page: Page, nombre: string, contenido: string) {
  const [selector] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#btn-abrir').click()]);
  await selector.setFiles({ name: nombre, mimeType: 'application/json', buffer: Buffer.from(contenido) });
}

test('Guardar pista descarga el JSON de la pista', async ({ page }) => {
  await abrirEditor(page);
  await elegirPieza(page, 'Rampa');
  await clicCelda(page, 6, 0);
  const [descarga] = await Promise.all([page.waitForEvent('download'), page.locator('#btn-guardar').click()]);
  const pista = await pistaEditor(page);
  expect(descarga.suggestedFilename()).toBe('Practica.json');
  const leida = leerPista(readFileSync(await descarga.path(), 'utf8'));
  expect(leida).toEqual({ ok: true, pista });
});

test('Abrir una pista válida la carga; una inválida avisa y no cambia nada', async ({ page }) => {
  await abrirEditor(page);
  await abrirArchivo(page, 'abierta.json', escribirPista({ ...pistaVacia(4, 4), nombre: 'Abierta' }));
  await expect(page.locator('#pista-nombre')).toHaveValue('Abierta');
  expect(await pistaEditor(page)).toMatchObject({ nombre: 'Abierta', columnas: 4, filas: 4 });
  await expect(page.locator('#error-pista')).toBeHidden();

  const fuera = { ...pistaVacia(4, 4), baldosas: [{ c: 9, r: 9, rot: 0, nivel: 0, tipo: 'recta', props: {} }] };
  await abrirArchivo(page, 'fuera.json', JSON.stringify(fuera));
  await expect(page.locator('#error-pista')).toContainText('No pudimos abrir esa pista');
  await expect(page.locator('#error-pista')).toContainText('queda fuera de la grilla');
  expect((await pistaEditor(page)).nombre).toBe('Abierta');

  await abrirArchivo(page, 'package.json', '{"name":"mi-app","version":"1.0.0"}');
  await expect(page.locator('#error-pista')).toContainText('Falta "tamanoBaldosa"');
  await abrirArchivo(page, 'nota.json', 'hola');
  await expect(page.locator('#error-pista')).toContainText('no es JSON');
  expect((await pistaEditor(page)).nombre).toBe('Abierta');
  await page.locator('#error-pista').getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.locator('#error-pista')).toBeHidden();
});

test('Pista nueva pide confirmar', async ({ page }) => {
  await abrirEditor(page);
  const antes = await pistaEditor(page);
  await page.locator('#btn-nueva').click();
  const dialogo = page.locator('dialog[open]');
  await expect(dialogo).toContainText('¿Empezar una pista nueva? Si no guardaste la actual, se va a perder.');
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialogo).toBeHidden();
  expect(await pistaEditor(page)).toEqual(antes);
  await page.locator('#btn-nueva').click();
  await dialogo.getByRole('button', { name: 'Empezar una nueva' }).click();
  await expect(page.locator('#pista-nombre')).toHaveValue('Pista nueva');
  expect(await pistaEditor(page)).toEqual(pistaVacia());
});

test('la pista se autoguarda', async ({ page }) => {
  await abrirEditor(page);
  await elegirPieza(page, 'Giro en L');
  await clicCelda(page, 6, 0);
  await expect.poll(() => page.evaluate(() => new Promise<boolean>(resolver => {
    const pedido = indexedDB.open('simulador-dynamis', 1);
    pedido.onsuccess = () => {
      const leer = pedido.result.transaction('datos').objectStore('datos').get('pista');
      leer.onsuccess = () => resolver((leer.result?.baldosas ?? []).some((b: { c: number; r: number }) => b.c === 6 && b.r === 0));
    };
  }))).toBe(true);
  await page.reload();
  await page.locator('#tab-pista').click();
  await expect.poll(() => baldosa(page, 6, 0)).toMatchObject({ tipo: 'giroL' });
});

test('la pista editada se ve en Programar y la usa la próxima prueba', async ({ page }) => {
  await abrirEditor(page);
  await elegirPieza(page, 'Hito');
  await clicEn(page, 1350, 1050);
  await page.locator('#tab-programar').click();
  await expect(page.locator('#hitos .hito')).toHaveText(['1+5', '2+10', '3+20', 'M+15']);
  await expect(page.locator('#sel-desde option')).toContainText(['Partida', 'Hito 1', 'Hito 2', 'Hito 3']);

  // Con una prueba corriendo, cambiar la pista no la detiene; el lienzo cambia al volver al inicio.
  await page.locator('#btn-probar').click();
  await expect(page.locator('#txt-estado')).toHaveText('El robot está corriendo', { timeout: 150_000 });
  await expect.poll(() => brilloProgramar(page, 1950, 150)).toBeGreaterThan(600);
  await page.locator('#tab-pista').click();
  await elegirPieza(page, 'Recta');
  await clicCelda(page, 6, 0);
  await page.locator('#tab-programar').click();
  await expect(page.locator('#txt-estado')).toHaveText('El robot está corriendo');
  // Al volver a la pestaña el lienzo recupera su tamaño y se redibuja en el cuadro siguiente.
  await expect.poll(() => brilloProgramar(page, 1950, 150)).toBeGreaterThan(600);
  await page.locator('#btn-inicio').click();
  await expect.poll(() => brilloProgramar(page, 1950, 150)).toBeLessThan(150);
  await expect(page.locator('#chip-pista')).toHaveText('8 × 6 baldosas de 30 cm');
});

test('editar la pista no cambia el "Partir desde" elegido', async ({ page }) => {
  await page.goto('/');
  await page.locator('#sel-desde').selectOption('hito-2');
  await page.locator('#tab-pista').click();
  await elegirPieza(page, 'Recta');
  await clicCelda(page, 6, 0);
  await page.locator('#tab-programar').click();
  await expect(page.locator('#sel-desde')).toHaveValue('hito-2');
});

test('Abrir una pista sobre una pista editada pide confirmar', async ({ page }) => {
  await abrirEditor(page);
  await elegirPieza(page, 'Recta');
  await clicCelda(page, 6, 0);
  const dialogo = page.locator('dialog[open]');
  await abrirArchivo(page, 'otra.json', escribirPista({ ...pistaVacia(4, 4), nombre: 'Otra' }));
  await expect(dialogo).toContainText('¿Reemplazar tu pista? Si no la guardaste, se va a perder.');
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialogo).toBeHidden();
  expect(await baldosa(page, 6, 0)).toMatchObject({ tipo: 'recta' });
  await abrirArchivo(page, 'otra.json', escribirPista({ ...pistaVacia(4, 4), nombre: 'Otra' }));
  await dialogo.getByRole('button', { name: 'Reemplazar' }).click();
  await expect(page.locator('#pista-nombre')).toHaveValue('Otra');
});
