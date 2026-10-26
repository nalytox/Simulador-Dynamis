import { test, expect, type Page } from './fixtures';

const pestanas = (page: Page) => page.locator('#pestanas [role="tab"]');
const codigo = (page: Page) => page.locator('#editor .cm-content');

test('abre con el seguidor: pestañas seguidor.ino y pines.h, y el código en el editor', async ({ page }) => {
  await page.goto('/');
  await expect(pestanas(page)).toHaveText(['seguidor.ino', 'pines.h']);
  await expect(pestanas(page).first()).toHaveAttribute('aria-selected', 'true');
  await expect(codigo(page)).toContainText('Seguidor de línea');
  await expect(page.locator('#chip-carpeta')).toHaveText('Carpeta: seguidor');
  await pestanas(page).nth(1).click();
  await expect(codigo(page)).toContainText('PINES_QTR');
});

test('editar, recargar y el cambio sigue ahí', async ({ page }) => {
  await page.goto('/');
  await codigo(page).click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('\n// hola desde la prueba');
  await page.waitForTimeout(1000);
  await page.reload();
  // CodeMirror dibuja solo las líneas visibles: se baja al final, donde quedó el cambio.
  await codigo(page).click();
  await page.keyboard.press('Control+End');
  await expect(codigo(page)).toContainText('// hola desde la prueba');
});

test('+ crea util.h, que queda como pestaña; un nombre inválido muestra el mensaje', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Crear un archivo' }).click();
  const dialogo = page.locator('dialog[open]');
  await dialogo.locator('input').fill('mi archivo.txt');
  await dialogo.getByRole('button', { name: 'Crear' }).click();
  await expect(dialogo).toContainText('Usa solo letras sin tilde, números, guiones y puntos.');
  await dialogo.locator('input').fill('util.h');
  await dialogo.getByRole('button', { name: 'Crear' }).click();
  await expect(pestanas(page)).toHaveText(['seguidor.ino', 'pines.h', 'util.h']);
  await expect(pestanas(page).nth(2)).toHaveAttribute('aria-selected', 'true');
});

test('abrir una carpeta con pines.h la muestra en pestañas', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('#in-carpeta', 'tests/e2e/proyectos/mi-robot');
  await expect(pestanas(page)).toHaveText(['mi-robot.ino', 'pines.h']);
  await expect(page.locator('#chip-carpeta')).toHaveText('Carpeta: mi-robot');
  await expect(codigo(page)).toContainText('Serial.println("hola")');
});
