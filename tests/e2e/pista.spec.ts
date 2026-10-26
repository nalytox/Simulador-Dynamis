import { test, expect } from './fixtures';
import { abrirEditor, baldosa, clicCelda, elegirPieza, pistaEditor, seleccion } from './ayuda/editor';

test('la pestaña Construir pista muestra la paleta y la pista; volver a Programar muestra los mensajes al final', async ({ page }) => {
  await abrirEditor(page);
  await expect(page.locator('#tab-pista')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#vista-pista')).toBeVisible();
  await expect(page.locator('#vista-programar')).toBeHidden();
  await expect(page.locator('#paleta-baldosas .pieza')).toHaveCount(23);
  await expect(page.locator('#chip-herr')).toHaveText('Elegir');
  // Llegan mensajes mientras la consola no se ve.
  await page.evaluate(() => {
    const mensajes = (window as unknown as { __pruebas: { mensajes(t: number, texto: string): void } }).__pruebas.mensajes;
    for (let i = 0; i < 300; i++) mensajes(i / 10, `línea ${i}\n`);
  });
  await page.locator('#tab-pista').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#tab-programar')).toBeFocused();
  await expect(page.locator('#tab-programar')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#vista-pista')).toBeHidden();
  await expect.poll(() => page.locator('#consola').evaluate(c => c.scrollHeight - c.clientHeight - c.scrollTop)).toBeLessThan(5);
  await expect(page.locator('#consola div').last()).toHaveText(/línea 299$/);
});

test('elegir Recta y hacer clic en una celda la coloca y la elige', async ({ page }) => {
  await abrirEditor(page);
  await elegirPieza(page, 'Recta');
  await expect(page.locator('#chip-herr')).toHaveText('Pieza: Recta');
  await clicCelda(page, 5, 4);
  expect(await baldosa(page, 5, 4)).toMatchObject({ tipo: 'recta', rot: 0 });
  expect(await seleccion(page)).toEqual({ clase: 'baldosa', c: 5, r: 4 });
});

test('R gira la baldosa elegida y Supr la deja vacía', async ({ page }) => {
  await abrirEditor(page);
  await elegirPieza(page, 'Recta');
  await clicCelda(page, 5, 4);
  await page.keyboard.press('r');
  expect(await baldosa(page, 5, 4)).toMatchObject({ tipo: 'recta', rot: 90 });
  await page.keyboard.press('Shift+R');
  expect(await baldosa(page, 5, 4)).toMatchObject({ rot: 0 });
  await page.keyboard.press('Delete');
  expect(await baldosa(page, 5, 4)).toBeNull();
});

test('Esc vuelve a Elegir y un clic elige sin colocar', async ({ page }) => {
  await abrirEditor(page);
  const antes = await pistaEditor(page);
  await elegirPieza(page, 'Giro en L');
  await expect(page.locator('#paleta-baldosas').getByRole('button', { name: 'Giro en L', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#lienzo-editor').focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('#chip-herr')).toHaveText('Elegir');
  await expect(page.locator('#paleta-baldosas .pieza[aria-pressed="true"]')).toHaveCount(0);
  await clicCelda(page, 4, 3);
  expect(await seleccion(page)).toEqual({ clase: 'baldosa', c: 4, r: 3 });
  expect(await pistaEditor(page)).toEqual(antes);
  // Con el botón Elegir también se vuelve.
  await elegirPieza(page, 'Recta');
  await page.locator('#btn-elegir').click();
  await expect(page.locator('#chip-herr')).toHaveText('Elegir');
});

test('con el teclado: flechas, Enter, R y Supr', async ({ page }) => {
  await abrirEditor(page);
  await elegirPieza(page, 'Giro suave');
  const lienzo = page.locator('#lienzo-editor');
  await lienzo.focus();
  // El foco empieza en la celda (0, 0): dos a la derecha y una arriba.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  expect(await baldosa(page, 2, 1)).toMatchObject({ tipo: 'giroSuave', rot: 0 });
  await expect(lienzo).toBeFocused();
  await page.keyboard.press('r');
  expect(await baldosa(page, 2, 1)).toMatchObject({ rot: 90 });
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  expect(await seleccion(page)).toEqual({ clase: 'baldosa', c: 3, r: 1 });
  await page.keyboard.press('Delete');
  expect(await baldosa(page, 3, 1)).toBeNull();
  await expect(lienzo).toBeFocused();
});
