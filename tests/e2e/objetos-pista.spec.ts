import { test, expect } from './fixtures';
import { abrirEditor, arrastrar, clicCelda, clicEn, elegirPieza, escribir, pistaEditor, seleccion } from './ayuda/editor';

test('poner dos hitos los numera solos y vuelve a Elegir', async ({ page }) => {
  await abrirEditor(page);
  // La pista de práctica ya tiene los hitos 1 y 2.
  await elegirPieza(page, 'Hito');
  await clicEn(page, 1350, 1050);
  await expect(page.locator('#chip-herr')).toHaveText('Elegir');
  expect(await seleccion(page)).toEqual({ clase: 'objeto', indice: 2 });
  await expect(page.locator('#panel-titulo')).toHaveText('Objeto elegido');
  await expect(page.locator('#panel-pista')).toContainText('Hito 3');
  await elegirPieza(page, 'Hito');
  await clicEn(page, 1653, 1047);
  const hitos = (await pistaEditor(page)).objetos.filter(o => o.tipo === 'hito');
  expect(hitos.map(h => h.props)).toEqual([{ numero: 1, yaw: 0 }, { numero: 2, yaw: 90 }, { numero: 3, yaw: 0 }, { numero: 4, yaw: 0 }]);
  expect(hitos[3]).toMatchObject({ x: 1650, y: 1050 });
});

test('arrastrar el inicio lo mueve a la celda soltada', async ({ page }) => {
  await abrirEditor(page);
  const { inicio } = await pistaEditor(page);
  await arrastrar(page, inicio, { x: 750, y: 1050 });
  const despues = (await pistaEditor(page)).inicio;
  expect(Math.abs(despues.x - 750)).toBeLessThanOrEqual(10);
  expect(Math.abs(despues.y - 1050)).toBeLessThanOrEqual(10);
  expect(await seleccion(page)).toEqual({ clase: 'inicio' });
  await expect(page.locator('#panel-titulo')).toHaveText('Inicio del robot');
  await page.keyboard.press('r');
  expect((await pistaEditor(page)).inicio.yaw).toBe(90);
});

test('con la pieza Inicio del robot, un clic mueve el inicio con la dirección de la baldosa', async ({ page }) => {
  await abrirEditor(page);
  await elegirPieza(page, 'Inicio del robot');
  await clicCelda(page, 3, 2);
  expect((await pistaEditor(page)).inicio).toEqual({ x: 1050, y: 750, yaw: 90 });
  await expect(page.locator('#chip-herr')).toHaveText('Elegir');
});

test('un bache recto sobre una recta vertical queda perpendicular', async ({ page }) => {
  await abrirEditor(page);
  await elegirPieza(page, 'Bache recto');
  await clicCelda(page, 3, 2);
  const bache = (await pistaEditor(page)).objetos.at(-1)!;
  expect(bache).toMatchObject({ tipo: 'bache', x: 1050, y: 750, rot: 180 });
  await page.locator('#panel-pista').getByRole('button', { name: 'Diagonal' }).click();
  expect((await pistaEditor(page)).objetos.at(-1)!.rot).toBe(135);
});

test('arrastrar un obstáculo lo mueve, R lo gira y Supr lo quita', async ({ page }) => {
  await abrirEditor(page);
  await elegirPieza(page, 'Obstáculo de 10 cm');
  await clicEn(page, 1350, 150);
  const indice = (await pistaEditor(page)).objetos.length - 1;
  await arrastrar(page, { x: 1370, y: 170 }, { x: 1670, y: 470 });
  expect((await pistaEditor(page)).objetos[indice]).toMatchObject({ x: 1650, y: 450 });
  await page.keyboard.press('r');
  expect((await pistaEditor(page)).objetos[indice].rot).toBe(90);
  await page.locator('#pp-alto').fill('20');
  await page.locator('#pp-alto').press('Enter');
  expect((await pistaEditor(page)).objetos[indice].props).toMatchObject({ alto: 200 });
  await page.locator('#lienzo-editor').focus();
  await page.keyboard.press('Delete');
  expect((await pistaEditor(page)).objetos).toHaveLength(indice);
  expect(await seleccion(page)).toBeNull();
});

test('achicar la grilla con piezas afuera pide confirmar', async ({ page }) => {
  await abrirEditor(page);
  await escribir(page, '#pista-columnas', '4');
  const dialogo = page.locator('dialog[open]');
  await expect(dialogo).toContainText('Al achicar la pista se quitan');
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.locator('#pista-columnas')).toHaveValue('8');
  expect(await pistaEditor(page)).toMatchObject({ columnas: 8, filas: 6 });

  await escribir(page, '#pista-columnas', '4');
  await dialogo.getByRole('button', { name: 'Seguir' }).click();
  // El diálogo avisa su cierre en una tarea aparte: se espera a que la pista cambie.
  await expect(page.locator('#chip-tamano')).toHaveText('4 × 6 baldosas');
  await escribir(page, '#pista-filas', '3');
  await dialogo.getByRole('button', { name: 'Seguir' }).click();
  await expect(page.locator('#chip-tamano')).toHaveText('4 × 3 baldosas');
  const p = await pistaEditor(page);
  expect(p).toMatchObject({ columnas: 4, filas: 3 });
  expect(p.baldosas.every(b => b.c < 4 && b.r < 3)).toBe(true);
  expect(p.objetos.every(o => o.x < 1200 && o.y < 900)).toBe(true);
  // Agrandar no pregunta, y los números se acotan.
  await escribir(page, '#pista-columnas', '40');
  await expect(page.locator('#pista-columnas')).toHaveValue('16');
  expect(await pistaEditor(page)).toMatchObject({ columnas: 16, filas: 3 });
});

test('el nombre de la pista se edita', async ({ page }) => {
  await abrirEditor(page);
  await escribir(page, '#pista-nombre', 'Mi pista loca');
  expect((await pistaEditor(page)).nombre).toBe('Mi pista loca');
  await escribir(page, '#pista-nombre', '   ');
  await expect(page.locator('#pista-nombre')).toHaveValue('Mi pista loca');
});

test('arrastrar el inicio o un objeto fuera del lienzo los deja en el borde de la pista', async ({ page }) => {
  await abrirEditor(page);
  const { inicio } = await pistaEditor(page);
  await arrastrar(page, inicio, { x: -900, y: -900 });
  expect((await pistaEditor(page)).inicio).toMatchObject({ x: 0, y: 0 });
  await arrastrar(page, { x: 750, y: 450 }, { x: 3500, y: 2500 });
  expect((await pistaEditor(page)).objetos[0]).toMatchObject({ x: 2390, y: 1790 });
});
