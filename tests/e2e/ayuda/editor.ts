import { expect, type Page } from '@playwright/test';
import type { Pista } from '../../../src/pista/tipos';
import type { Seleccion } from '../../../src/ui/editor-pista';

interface GanchoEditor {
  pista(): Pista;
  seleccion(): Seleccion | null;
  aPantalla(x: number, y: number): { x: number; y: number };
}
type Ventana = { __pruebas?: { editorPista?: GanchoEditor } };

/** Abre la app en la vista Construir pista y espera a que el lienzo del editor tenga tamaño. */
export async function abrirEditor(page: Page): Promise<void> {
  await page.goto('/');
  await page.locator('#tab-pista').click();
  await expect.poll(() => page.evaluate(() => {
    const e = (window as unknown as Ventana).__pruebas?.editorPista;
    return e ? e.aPantalla(300, 0).x - e.aPantalla(0, 0).x : 0;
  })).toBeGreaterThan(10);
}

export const pistaEditor = (page: Page) => page.evaluate(() => (window as unknown as Ventana).__pruebas!.editorPista!.pista());
export const seleccion = (page: Page) => page.evaluate(() => (window as unknown as Ventana).__pruebas!.editorPista!.seleccion());
export const baldosa = async (page: Page, c: number, r: number) => (await pistaEditor(page)).baldosas.find(b => b.c === c && b.r === r) ?? null;

/** Punto de la pista (mm) en CSS px relativos al lienzo del editor. */
export const enPantalla = (page: Page, x: number, y: number) =>
  page.evaluate(([x, y]) => (window as unknown as Ventana).__pruebas!.editorPista!.aPantalla(x, y), [x, y]);

export async function clicEn(page: Page, x: number, y: number): Promise<void> {
  await page.locator('#lienzo-editor').click({ position: await enPantalla(page, x, y) });
}
export const clicCelda = (page: Page, c: number, r: number) => clicEn(page, (c + 0.5) * 300, (r + 0.5) * 300);

export const elegirPieza = (page: Page, nombre: string) =>
  page.locator('#paleta-baldosas').getByRole('button', { name: nombre, exact: true }).click();

/** Arrastra con el mouse desde un punto de la pista (mm) hasta otro. */
export async function arrastrar(page: Page, desde: { x: number; y: number }, hasta: { x: number; y: number }): Promise<void> {
  const caja = (await page.locator('#lienzo-editor').boundingBox())!;
  const a = await enPantalla(page, desde.x, desde.y);
  const b = await enPantalla(page, hasta.x, hasta.y);
  await page.mouse.move(caja.x + a.x, caja.y + a.y);
  await page.mouse.down();
  await page.mouse.move(caja.x + b.x, caja.y + b.y, { steps: 8 });
  await page.mouse.up();
}

/** Escribe un valor en un campo y lo confirma con Enter. */
export async function escribir(page: Page, selector: string, valor: string): Promise<void> {
  await page.locator(selector).fill(valor);
  await page.locator(selector).press('Enter');
}
