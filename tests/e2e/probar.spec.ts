import { test, expect, type Page } from '@playwright/test';

interface Ganchos {
  robot(): { x: number; y: number } | null;
  trabajadoresVivos(): number;
  abrirProyecto(p: { nombre: string; archivos: Record<string, string> }): void;
}
const robotX = (page: Page) => page.evaluate(() => (window as unknown as { __pruebas: Ganchos }).__pruebas.robot()?.x ?? null);
const vivos = (page: Page) => page.evaluate(() => (window as unknown as { __pruebas: Ganchos }).__pruebas.trabajadoresVivos());
const abrir = async (page: Page, codigo: string) => {
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { __pruebas?: Ganchos }).__pruebas?.abrirProyecto)).toBe('function');
  await page.evaluate(c => (window as unknown as { __pruebas: Ganchos }).__pruebas.abrirProyecto({ nombre: 'p', archivos: { 'p.ino': c } }), codigo);
};
const corriendo = (page: Page) => expect(page.locator('#txt-estado')).toHaveText('El robot está corriendo', { timeout: 150_000 });
const lineas = (page: Page, texto: string) => page.locator('#consola div', { hasText: texto });

test('Probar mi robot compila, el robot se mueve y llegan los mensajes', async ({ page }) => {
  await page.goto('/');
  await page.locator('#btn-probar').click();
  await corriendo(page);
  await expect(page.locator('#txt-probar')).toHaveText('Detener');
  await expect(page.locator('#chip-tiempo')).not.toHaveText('t = 0,0 s', { timeout: 20_000 });
  await expect(page.locator('#consola')).toContainText('Calibrando...', { timeout: 20_000 });
  const x0 = await robotX(page);
  await expect.poll(() => robotX(page), { timeout: 20_000 }).not.toBe(x0);
});

test('un error de sintaxis muestra la burbuja con archivo y línea, y el editor salta ahí', async ({ page }) => {
  await page.goto('/');
  await abrir(page, 'void setup() {\n  int x = 1\n}\nvoid loop() {}\n');
  await page.locator('#btn-probar').click();
  await expect(page.locator('#burbuja-titulo')).toHaveText('Ups, revisa la línea 2 de p.ino', { timeout: 150_000 });
  await expect(page.locator('#burbuja')).toContainText('Falta un punto y coma');
  await expect(page.locator('#editor .cm-line.linea-error')).toContainText('int x = 1');
  await expect(page.locator('#txt-estado')).toHaveText('Hay que revisar algo');
});

test('abrir una carpeta con pines.h y probarla funciona', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('#in-carpeta', 'tests/e2e/proyectos/mi-robot');
  await expect(page.locator('#chip-carpeta')).toHaveText('Carpeta: mi-robot');
  await page.locator('#btn-probar').click();
  await corriendo(page);
  await expect(page.locator('#consola')).toContainText('hola', { timeout: 20_000 });
});

test('"Volver al último hito" descuenta 10 y reinicia desde setup', async ({ page }) => {
  await page.goto('/');
  await page.locator('#btn-probar').click();
  await corriendo(page);
  await expect(lineas(page, 'Calibrando...')).toHaveCount(1, { timeout: 20_000 });
  await page.locator('#btn-ultimo-hito').click();
  await expect(page.locator('#juez-rein')).toHaveText('1 de 3');
  await expect(lineas(page, 'Calibrando...')).toHaveCount(2, { timeout: 20_000 });
});

test('pausa congela el tiempo y Seguir lo retoma', async ({ page }) => {
  await page.goto('/');
  await page.locator('#btn-probar').click();
  await corriendo(page);
  await expect(page.locator('#chip-tiempo')).not.toHaveText('t = 0,0 s', { timeout: 20_000 });
  await page.locator('#btn-pausa').click();
  await expect(page.locator('#txt-estado')).toHaveText('En pausa');
  await expect(page.locator('#txt-pausa')).toHaveText('Seguir');
  const congelado = await page.locator('#chip-tiempo').textContent();
  await page.waitForTimeout(1000);
  await expect(page.locator('#chip-tiempo')).toHaveText(congelado!);
  await page.locator('#btn-pausa').click();
  await expect(page.locator('#txt-estado')).toHaveText('El robot está corriendo');
  await expect(page.locator('#chip-tiempo')).not.toHaveText(congelado!);
});

test('un while(true){} sin delay muestra el aviso de ciclo sin fin y Detener lo para', async ({ page }) => {
  await page.goto('/');
  await abrir(page, 'void setup() {}\nvoid loop() { while (true) {} }\n');
  await page.locator('#btn-probar').click();
  await corriendo(page);
  // El texto de la spec, con `delay` y `while` como código.
  await expect(page.locator('#burbuja-mensaje')).toHaveText(
    'Tu programa parece atrapado en un ciclo sin fin. ¿Falta un delay o leer un sensor dentro del while?', { timeout: 6000 });
  await expect(page.locator('#burbuja-mensaje code')).toHaveText(['delay', 'while']);
  await page.locator('#btn-burbuja-accion').click();
  await expect(page.locator('#txt-estado')).toHaveText('Detenido');
  expect(await vivos(page)).toBe(0);
});

test('un Serial.println en loop sin delay no congela la página', async ({ page }) => {
  await page.goto('/');
  await abrir(page, 'void setup() { Serial.begin(115200); }\nvoid loop() { Serial.println(millis()); }\n');
  await page.locator('#btn-probar').click();
  await corriendo(page);
  await page.waitForTimeout(3000);
  const inicio = Date.now();
  await page.locator('#btn-pausa').click();
  await expect(page.locator('#txt-estado')).toHaveText('En pausa');
  expect(Date.now() - inicio).toBeLessThan(1000);
  expect(await page.locator('#consola div').count()).toBeLessThanOrEqual(500);
});

test('dos clics seguidos en Probar dejan una sola prueba corriendo', async ({ page }) => {
  await page.goto('/');
  await page.locator('#btn-probar').dblclick();
  await expect(page.locator('#txt-estado')).toHaveText(/^(Detenido|El robot está corriendo)$/, { timeout: 150_000 });
  await page.waitForTimeout(2000);
  expect(await vivos(page)).toBeLessThanOrEqual(1);
  await expect(page.locator('#txt-estado')).toHaveText(/^(Detenido|El robot está corriendo)$/);
  if ((await page.locator('#txt-estado').textContent()) === 'Detenido') {
    await page.locator('#btn-probar').click();
    await corriendo(page);
  }
  expect(await vivos(page)).toBe(1);
});

test('sin compilador muestra Reintentar', async ({ page }) => {
  await page.route('**/llvm.core.wasm*', ruta => ruta.abort());
  await page.goto('/');
  await page.locator('#btn-probar').click();
  await expect(page.locator('#burbuja')).toContainText('No pudimos preparar el compilador', { timeout: 60_000 });
  await page.unroute('**/llvm.core.wasm*');
  await expect(page.locator('#btn-burbuja-accion')).toHaveText('Reintentar');
  await page.locator('#btn-burbuja-accion').click();
  await corriendo(page);
});
