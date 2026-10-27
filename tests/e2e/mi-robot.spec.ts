import { readFileSync } from 'node:fs';
import { test, expect, type Page } from './fixtures';
import { abrirEditor, clicCelda, elegirPieza } from './ayuda/editor';
import { leerRobot } from '../../src/robot/archivo';
import { ROBOT_POR_DEFECTO, ROBOT_POR_DEFECTO_ANTERIOR } from '../../src/robot/config';

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
/** Escribe un robot en el almacén del perfil de Marco, como si lo hubiera guardado una versión anterior. */
const guardarRobot = (page: Page, robot: unknown) => page.evaluate(r => new Promise<void>(resolver => {
  const pedido = indexedDB.open('simulador-dynamis-marco', 1);
  pedido.onsuccess = () => {
    const tx = pedido.result.transaction('datos', 'readwrite');
    tx.objectStore('datos').put(r, 'robot');
    tx.oncomplete = () => resolver();
  };
}), robot);
const robotGuardado = (page: Page) => page.evaluate(() => new Promise<{ ruedas: { trocha: number } } | null>(resolver => {
  const pedido = indexedDB.open('simulador-dynamis-marco', 1);
  pedido.onsuccess = () => {
    const leer = pedido.result.transaction('datos').objectStore('datos').get('robot');
    leer.onsuccess = () => resolver(leer.result ?? null);
  };
}));
const corriendo = (page: Page) => expect(page.locator('#txt-estado')).toHaveText('El robot está corriendo', { timeout: 150_000 });

test('Mi robot abre la ventana con el Dynamis V2', async ({ page }) => {
  await abrirMiRobot(page);
  await expect(ventana(page).getByRole('heading', { name: 'Mi robot' })).toBeVisible();
  await expect(campo(page, 'ruedas.trocha')).toHaveValue('160');
  await expect(campo(page, 'ruedasLocas.diametro')).toHaveValue('55');
  await expect(campo(page, 'ruedasLocas.instalado')).toBeChecked();
  await expect(campo(page, 'motores.vMaxMmS')).toHaveValue('600');
  await expect(campo(page, 'motores.izq.pwm')).toHaveValue('4');
  await expect(campo(page, 'qtr.pines.0')).toHaveValue('36');
  await expect(campo(page, 'qtr.emisor')).toHaveValue('27');
  await expect(campo(page, 'vl53l0x.canal')).toHaveValue('2');
  await expect(campo(page, 'mpu6050.orientacion')).toHaveValue('z-arriba-x-atras');
  await expect(campo(page, 'motores.stby')).toHaveValue('');
  await expect(campo(page, 'motores.izq.invertir')).not.toBeChecked();
  await expect(page.locator('#robot-anterior')).toBeHidden();
  await expect(page.locator('#robot-avisos')).toContainText('Todo bien');
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
  await expect(campo(page, 'chasis.largo')).toHaveValue('125');
});

test('los cambios se guardan y se usan en la prueba', async ({ page }) => {
  await abrirMiRobot(page);
  await cambiar(page, 'ruedas.trocha', '120');
  await cambiar(page, 'motores.izq.pwm', '23');
  await campo(page, 'mpu6050.orientacion').selectOption('z-arriba-x-adelante');
  await ventana(page).getByRole('button', { name: 'Listo' }).click();
  await expect(ventana(page)).toBeHidden();
  // Se autoguarda (medio segundo después del último cambio): al recargar sigue igual.
  await expect.poll(() => page.evaluate(() => new Promise<number | null>(resolver => {
    const pedido = indexedDB.open('simulador-dynamis-marco', 1);
    pedido.onsuccess = () => {
      const leer = pedido.result.transaction('datos').objectStore('datos').get('robot');
      leer.onsuccess = () => resolver(leer.result?.ruedas.trocha ?? null);
    };
  }))).toBe(120);
  await page.reload();
  await page.locator('#btn-mi-robot').click();
  await expect(campo(page, 'ruedas.trocha')).toHaveValue('120');
  await expect(campo(page, 'motores.izq.pwm')).toHaveValue('23');
  await expect(campo(page, 'mpu6050.orientacion')).toHaveValue('z-arriba-x-adelante');
  await page.keyboard.press('Escape');

  // El seguidor del ejemplo escribe en el pin 4: con el PWM izquierdo en el 23, la rueda izquierda no se mueve.
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
  // El robot tiene cambios: reemplazarlo pide confirmar.
  const dialogo = page.locator('dialog.dialogo[open]');
  await importar(JSON.stringify(sinDistancia));
  await expect(dialogo).toContainText('¿Reemplazar tu robot? Si no lo exportaste, se pierden tus cambios.');
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  await expect(campo(page, 'chasis.ancho')).toHaveValue('150');
  await importar(JSON.stringify(sinDistancia));
  await dialogo.getByRole('button', { name: 'Reemplazar' }).click();
  await expect(page.locator('#robot-error')).toBeHidden();
  await expect(campo(page, 'ruedas.diametro')).toHaveValue('50');
  await expect(campo(page, 'chasis.ancho')).toHaveValue('180');
  await expect(page.locator('#robot-importado')).toContainText('Faltaba vl53l0x: se usaron los valores del profe.');
});

test('Volver a los valores del profe restaura todo', async ({ page }) => {
  await abrirMiRobot(page);
  await cambiar(page, 'ruedas.diametro', '70');
  await ventana(page).getByRole('button', { name: 'Volver a los valores del profe' }).click();
  const dialogo = page.locator('dialog.dialogo[open]');
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  await expect(campo(page, 'ruedas.diametro')).toHaveValue('70');
  await ventana(page).getByRole('button', { name: 'Volver a los valores del profe' }).click();
  await dialogo.getByRole('button', { name: 'Volver a los del profe' }).click();
  await expect(campo(page, 'ruedas.diametro')).toHaveValue('60');
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

test('con un solo TCS34725 la tarjeta de color muestra uno; con los dos del Dynamis V2, los dos', async ({ page }) => {
  await abrirMiRobot(page);
  await campo(page, 'tcs34725b.instalado').uncheck();
  await cambiar(page, 'tcs34725.canal', '2');
  await expect(page.locator('#robot-avisos')).toContainText('El VL53L0X y un TCS34725 usan la dirección 0x29: ponlos en canales distintos del multiplexor.');
  await expect(campo(page, 'vl53l0x.canal')).toHaveAttribute('aria-invalid', 'true');
  await cambiar(page, 'tcs34725.canal', '0');
  await expect(page.locator('#robot-avisos')).not.toContainText('0x29');
  await page.keyboard.press('Escape');
  await page.locator('#btn-probar').click();
  await corriendo(page);
  await expect(page.locator('#color2')).toBeHidden();
  await page.locator('#btn-probar').click();
  await expect(page.locator('#txt-probar')).toHaveText('Probar mi robot');
  await page.locator('#btn-mi-robot').click();
  await campo(page, 'tcs34725b.instalado').check();
  await page.keyboard.press('Escape');
  await page.locator('#btn-probar').click();
  await corriendo(page);
  await expect(page.locator('#color2')).toBeVisible();
  await expect(page.locator('#color-nombre')).toHaveText(/^1: /);
  await expect(page.locator('#color2-nombre')).toHaveText(/^2: /);
});

test('un robot guardado igual al robot por defecto anterior pasa al Dynamis V2', async ({ page }) => {
  await page.goto('/');
  await guardarRobot(page, ROBOT_POR_DEFECTO_ANTERIOR);
  await page.reload();
  await page.locator('#btn-mi-robot').click();
  await expect(campo(page, 'ruedas.trocha')).toHaveValue('160');
  await expect(page.locator('#robot-anterior')).toBeHidden();
  await expect.poll(async () => (await robotGuardado(page))?.ruedas.trocha).toBe(160);
});

test('un robot guardado de antes con cambios se queda, con un aviso y el botón para volver al robot por defecto', async ({ page }) => {
  await page.goto('/');
  await guardarRobot(page, { ...ROBOT_POR_DEFECTO_ANTERIOR, ruedas: { ...ROBOT_POR_DEFECTO_ANTERIOR.ruedas, trocha: 120 } });
  await page.reload();
  await expect(page.locator('#consola')).toContainText('Tu robot guardado es de antes del robot Dynamis V2');
  await page.locator('#btn-mi-robot').click();
  await expect(campo(page, 'ruedas.trocha')).toHaveValue('120');
  await expect(campo(page, 'chasis.largo')).toHaveValue('156');
  const aviso = page.locator('#robot-anterior');
  await expect(aviso).toBeVisible();
  await expect(aviso).toContainText('tiene cambios tuyos, así que lo dejamos como estaba');
  await aviso.getByRole('button', { name: 'Volver al robot por defecto' }).click();
  await page.locator('dialog.dialogo[open]').getByRole('button', { name: 'Volver al robot por defecto' }).click();
  await expect(campo(page, 'ruedas.trocha')).toHaveValue('160');
  await expect(campo(page, 'chasis.largo')).toHaveValue('125');
  await expect(aviso).toBeHidden();
});
