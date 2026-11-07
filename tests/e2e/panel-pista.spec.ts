import { test, expect, type Page } from '@playwright/test';
import { abrirEditor, baldosa, clicCelda, clicEn, elegirPieza, enPantalla, pistaEditor, seleccion } from './ayuda/editor';

const panel = (page: Page) => page.locator('#panel-pista');

/** Suma r + g + b del píxel del lienzo del editor en el punto (x, y) de la pista. */
async function brillo(page: Page, x: number, y: number): Promise<number> {
  const p = await enPantalla(page, x, y);
  return page.locator('#lienzo-editor').evaluate((c: HTMLCanvasElement, p) => {
    const d = window.devicePixelRatio || 1;
    const [r, g, b] = c.getContext('2d')!.getImageData(Math.round(p.x * d), Math.round(p.y * d), 1, 1).data;
    return r + g + b;
  }, p);
}

async function colocar(page: Page, pieza: string, c: number, r: number) {
  await elegirPieza(page, pieza);
  await clicCelda(page, c, r);
}

test('el panel muestra la baldosa elegida', async ({ page }) => {
  await abrirEditor(page);
  await expect(panel(page)).toContainText('Elige una baldosa o un objeto');
  await colocar(page, 'Recta', 5, 4);
  await expect(page.locator('#panel-titulo')).toHaveText('Baldosa elegida');
  await expect(panel(page)).toContainText('Recta');
  await expect(panel(page)).toContainText('Columna 6, fila 5 · 0°');
  await panel(page).getByRole('button', { name: 'Izquierda' }).click();
  await expect(panel(page)).toContainText('Columna 6, fila 5 · 90°');
  await panel(page).getByRole('button', { name: 'Dejar vacía' }).click();
  expect(await baldosa(page, 5, 4)).toBeNull();
  await expect(panel(page)).toContainText('Celda vacía');
});

test('una rampa muestra "sube 10,9 cm" y ajusta la altura de la baldosa siguiente', async ({ page }) => {
  await abrirEditor(page);
  await colocar(page, 'Recta', 3, 2);
  await colocar(page, 'Rampa', 2, 2);
  await expect(panel(page)).toContainText('sube 10,9 cm');
  await page.keyboard.press('Escape');
  // En el centro de (3, 2) está el hito 2: se hace clic en una esquina de la baldosa.
  await clicEn(page, 3 * 300 + 60, 2 * 300 + 60);
  await expect(page.locator('#pp-altura')).toHaveValue('10.9');
  await clicCelda(page, 2, 2);
  await page.locator('#pp-angulo').fill('30');
  await page.locator('#pp-angulo').press('Enter');
  await expect(panel(page)).toContainText('sube 17,3 cm');
  await expect(page.locator('#pp-angulo')).toBeFocused();
  expect((await baldosa(page, 3, 2))!.nivel).toBeCloseTo(173.21, 1);
});

test('las marcas de un cruce cambian la acción esperada', async ({ page }) => {
  await abrirEditor(page);
  await colocar(page, 'Cruce sin marcas', 5, 4);
  await expect(panel(page)).toContainText('El robot debe: Seguir derecho');
  await expect(panel(page)).toContainText('Izquierda y derecha se miran desde la flecha rosada, que muestra por dónde entra el robot.');
  await panel(page).getByLabel('Antes del cruce, a la izquierda').check();
  await expect(panel(page)).toContainText('El robot debe: Girar a la izquierda');
  await panel(page).getByLabel('Antes del cruce, a la derecha').check();
  await expect(panel(page)).toContainText('El robot debe: Dar la vuelta (180°)');
  expect((await baldosa(page, 5, 4))!.props).toMatchObject({ marcas: { ai: true, ad: true, di: false, dd: false } });
});

test('un escalón aparece en la revisión de las bases y su clic elige la baldosa', async ({ page }) => {
  await abrirEditor(page);
  await colocar(page, 'Recta', 5, 4);
  await colocar(page, 'Recta', 6, 4);
  await page.locator('#pp-altura').fill('5');
  await page.locator('#pp-altura').press('Enter');
  // Un escalón con la recta de al lado y otro con la celda vacía que sigue.
  const avisos = page.locator('#avisos-pista').getByRole('button', { name: 'Hay un escalón de 5 cm entre estas baldosas.' });
  await expect(avisos).toHaveCount(2);
  await page.keyboard.press('Escape');
  await clicCelda(page, 0, 0);
  await avisos.first().click();
  expect(await seleccion(page)).toEqual({ clase: 'baldosa', c: 5, r: 4 });
});

test('un ángulo escrito a mano fuera de rango se acota', async ({ page }) => {
  await abrirEditor(page);
  await colocar(page, 'Rampa', 5, 4);
  await page.locator('#pp-angulo').fill('90');
  await page.locator('#pp-angulo').press('Enter');
  await expect(page.locator('#pp-angulo')).toHaveValue('35');
  expect((await baldosa(page, 5, 4))!.props).toMatchObject({ angulo: 35 });
  await page.locator('#pp-altura').fill('-20');
  await page.locator('#pp-altura').press('Enter');
  await expect(page.locator('#pp-altura')).toHaveValue('0');
  await page.locator('#pp-angulo').fill('');
  await page.locator('#pp-angulo').press('Enter');
  await expect(page.locator('#pp-angulo')).toHaveValue('35');
});

test('invertir colores pinta la baldosa negra en el editor', async ({ page }) => {
  await abrirEditor(page);
  await colocar(page, 'Recta', 5, 4);
  await expect.poll(() => brillo(page, 5 * 300 + 60, 4 * 300 + 60)).toBeGreaterThan(600);
  await panel(page).getByLabel('Línea blanca sobre fondo negro').check();
  await expect.poll(() => brillo(page, 5 * 300 + 60, 4 * 300 + 60)).toBeLessThan(150);
  expect((await baldosa(page, 5, 4))!.props).toMatchObject({ invertida: true });
});

test('cortes, F2 y F1 tienen sus controles', async ({ page }) => {
  await abrirEditor(page);
  await colocar(page, 'Línea con cortes', 5, 4);
  await page.locator('#pp-espacio').fill('25');
  await page.locator('#pp-espacio').press('Enter');
  expect((await baldosa(page, 5, 4))!.props).toMatchObject({ espacio: 25, guion: 50 });
  await colocar(page, 'Indicador F2', 6, 4);
  await panel(page).getByRole('button', { name: 'Agregar decisión' }).click();
  await panel(page).getByLabel('Decisión 2').selectOption('der');
  expect((await baldosa(page, 6, 4))!.props).toMatchObject({ decisiones: ['izq', 'der'] });
  await panel(page).getByRole('button', { name: 'Agregar decisión' }).click();
  await expect(panel(page).getByRole('button', { name: 'Agregar decisión' })).toBeDisabled();
  await panel(page).getByRole('button', { name: 'Quitar la última' }).click();
  expect((await baldosa(page, 6, 4))!.props).toMatchObject({ decisiones: ['izq', 'der'] });
  await colocar(page, 'Cuadrado F1', 7, 4);
  await panel(page).getByLabel('Camino correcto').selectOption('der');
  expect((await baldosa(page, 7, 4))!.props).toMatchObject({ correcto: 'der' });
  await colocar(page, 'Unión en T (rama a la izquierda)', 4, 4);
  await panel(page).getByLabel('Rama').selectOption('der');
  expect((await baldosa(page, 4, 4))!.props).toMatchObject({ rama: 'der' });
});

test('un valor escrito sin confirmar se aplica antes del clic en la pista', async ({ page }) => {
  await abrirEditor(page);
  await colocar(page, 'Rampa', 5, 4);
  // Se escribe 30 sin Enter y se hace clic en otra celda con la Rampa todavía elegida.
  await page.locator('#pp-angulo').fill('30');
  await clicCelda(page, 6, 1);
  expect((await baldosa(page, 5, 4))!.props).toMatchObject({ angulo: 30 });
  expect(await baldosa(page, 6, 1)).toMatchObject({ tipo: 'rampa' });
  expect(await seleccion(page)).toEqual({ clase: 'baldosa', c: 6, r: 1 });
  // Lo mismo con el nombre y el tamaño de la pista.
  await page.locator('#pista-nombre').fill('Con rampas');
  await clicCelda(page, 6, 0);
  expect((await pistaEditor(page)).nombre).toBe('Con rampas');
  expect(await baldosa(page, 6, 0)).toMatchObject({ tipo: 'rampa' });
});
