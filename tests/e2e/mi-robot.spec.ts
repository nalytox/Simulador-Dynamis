import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { abrirEditor, clicCelda, elegirPieza } from './ayuda/editor';
import { leerRobot } from '../../src/robot/archivo';
import { ROBOT_POR_DEFECTO } from '../../src/robot/config';

const ventana = (page: Page) => page.locator('#ventana-robot');
const campo = (page: Page, ruta: string) => page.locator(`#rb-${ruta.replaceAll('.', '-')}`);

async function abrirMiRobot(page: Page) {
  await page.goto('/');
  await page.locator('#btn-mi-robot').click();
  await expect(ventana(page)).toBeVisible();
}
async function cambiar(page: Page, ruta: string, valor: string) {
  await campo(page, ruta).fill(valor);
  await campo(page, ruta).press('Enter');
}
const corriendo = (page: Page) => expect(page.locator('#txt-estado')).toHaveText('El robot está corriendo', { timeout: 150_000 });

test('Mi robot abre la ventana con los valores del profe', async ({ page }) => {
  await abrirMiRobot(page);
  await expect(ventana(page).getByRole('heading', { name: 'Mi robot' })).toBeVisible();
  await expect(campo(page, 'ruedas.trocha')).toHaveValue('140');
  await expect(campo(page, 'qtr.pines.0')).toHaveValue('36');
  await expect(campo(page, 'motores.stby')).toHaveValue('');
  await expect(campo(page, 'motores.izq.invertir')).not.toBeChecked();
  await page.keyboard.press('Escape');
  await expect(ventana(page)).toBeHidden();
  await expect(page.locator('#btn-mi-robot')).toBeFocused();
});

test('un pin repetido muestra el aviso junto al campo', async ({ page }) => {
  await abrirMiRobot(page);
  await cambiar(page, 'qtr.pines.1', '36');
  await expect(campo(page, 'qtr.pines.1')).toHaveAttribute('aria-invalid', 'true');
  await expect(campo(page, 'qtr.pines.0')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#robot-avisos')).toContainText('El pin 36 está usado dos veces.');
  const aviso = await campo(page, 'qtr.pines.1').getAttribute('aria-describedby');
  await expect(page.locator(`#${aviso}`)).toHaveText('El pin 36 está usado dos veces.');
  await cambiar(page, 'qtr.pines.1', '39');
  await expect(campo(page, 'qtr.pines.1')).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#robot-avisos')).not.toContainText('El pin 36');
});

test('los valores fuera de rango se acotan y un pin opcional vacío queda sin conectar', async ({ page }) => {
  await abrirMiRobot(page);
  await cambiar(page, 'motores.izq.pwm', '99');
  await expect(campo(page, 'motores.izq.pwm')).toHaveValue('39');
  await expect(page.locator('#robot-avisos')).toContainText('El pin 39 solo puede leer');
  await cambiar(page, 'motores.stby', '27');
  await expect(campo(page, 'motores.stby')).toHaveValue('27');
  await cambiar(page, 'motores.stby', '');
  await expect(campo(page, 'motores.stby')).toHaveValue('');
  await cambiar(page, 'chasis.largo', '');
  await expect(campo(page, 'chasis.largo')).toHaveValue('156');
});

test('los cambios se guardan y se usan en la prueba', async ({ page }) => {
  await abrirMiRobot(page);
  await cambiar(page, 'ruedas.trocha', '120');
  await cambiar(page, 'motores.izq.pwm', '23');
  await ventana(page).getByRole('button', { name: 'Listo' }).click();
  await expect(ventana(page)).toBeHidden();
  // Se autoguarda (medio segundo después del último cambio): al recargar sigue igual.
  await expect.poll(() => page.evaluate(() => new Promise<number | null>(resolver => {
    const pedido = indexedDB.open('simulador-dynamis', 1);
    pedido.onsuccess = () => {
      const leer = pedido.result.transaction('datos').objectStore('datos').get('robot');
      leer.onsuccess = () => resolver(leer.result?.ruedas.trocha ?? null);
    };
  }))).toBe(120);
  await page.reload();
  await page.locator('#btn-mi-robot').click();
  await expect(campo(page, 'ruedas.trocha')).toHaveValue('120');
  await expect(campo(page, 'motores.izq.pwm')).toHaveValue('23');
  await page.keyboard.press('Escape');

  // El seguidor del ejemplo escribe en el pin 18: con el PWM izquierdo en el 23, la rueda izquierda no se mueve.
  await page.locator('#btn-probar').click();
  await corriendo(page);
  await expect(page.locator('#m-der-n')).not.toHaveText(/^(0%|—)$/, { timeout: 20_000 });
  await expect(page.locator('#m-izq-n')).toHaveText('0%');
});

test('Exportar e importar robot.json', async ({ page }) => {
  await abrirMiRobot(page);
  await cambiar(page, 'chasis.ancho', '150');
  const [descarga] = await Promise.all([page.waitForEvent('download'), ventana(page).getByRole('button', { name: 'Exportar robot.json' }).click()]);
  expect(descarga.suggestedFilename()).toBe('robot.json');
  const leido = leerRobot(readFileSync(await descarga.path(), 'utf8'));
  expect(leido).toEqual({ ok: true, robot: { ...ROBOT_POR_DEFECTO, chasis: { ...ROBOT_POR_DEFECTO.chasis, ancho: 150 } }, avisos: [] });

  const importar = async (contenido: string) => {
    const [selector] = await Promise.all([page.waitForEvent('filechooser'), ventana(page).getByRole('button', { name: 'Importar robot.json' }).click()]);
    await selector.setFiles({ name: 'robot.json', mimeType: 'application/json', buffer: Buffer.from(contenido) });
  };
  await importar(JSON.stringify({ ...ROBOT_POR_DEFECTO, chasis: 'grande' }));
  await expect(page.locator('#robot-error')).toContainText('chasis debe ser un grupo de valores entre { }.');
  await expect(campo(page, 'chasis.ancho')).toHaveValue('150');

  const { vl53l0x, ...sinDistancia } = { ...ROBOT_POR_DEFECTO, ruedas: { ...ROBOT_POR_DEFECTO.ruedas, diametro: 50 } };
  void vl53l0x;
  await importar(JSON.stringify(sinDistancia));
  await expect(page.locator('#robot-error')).toBeHidden();
  await expect(campo(page, 'ruedas.diametro')).toHaveValue('50');
  await expect(campo(page, 'chasis.ancho')).toHaveValue('132');
  await expect(page.locator('#robot-importado')).toContainText('Faltaba vl53l0x: se usaron los valores del profe.');
});

test('Volver a los valores del profe restaura todo', async ({ page }) => {
  await abrirMiRobot(page);
  await cambiar(page, 'ruedas.diametro', '60');
  await ventana(page).getByRole('button', { name: 'Volver a los valores del profe' }).click();
  const dialogo = page.locator('dialog.dialogo[open]');
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  await expect(campo(page, 'ruedas.diametro')).toHaveValue('60');
  await ventana(page).getByRole('button', { name: 'Volver a los valores del profe' }).click();
  await dialogo.getByRole('button', { name: 'Volver a los del profe' }).click();
  await expect(campo(page, 'ruedas.diametro')).toHaveValue('42');
  await expect(ventana(page)).toBeVisible();
});

test('editar la pista con una rampa y probar', async ({ page }) => {
  await abrirEditor(page);
  await elegirPieza(page, 'Rampa');
  await clicCelda(page, 1, 1);
  await page.locator('#tab-programar').click();
  await page.locator('#btn-probar').click();
  await corriendo(page);
  await expect(page.locator('#chip-tiempo')).toHaveText(/t = ([3-9]|\d\d),/, { timeout: 30_000 });
  await expect(page.locator('#burbuja')).toBeHidden();
});
