import { test, expect, type Page } from '@playwright/test';

interface Ganchos { abrirProyecto(p: { nombre: string; archivos: Record<string, string> }): void }
const abrir = async (page: Page, codigo: string) => {
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { __pruebas?: Ganchos }).__pruebas?.abrirProyecto)).toBe('function');
  await page.evaluate(c => (window as unknown as { __pruebas: Ganchos }).__pruebas.abrirProyecto({ nombre: 'p', archivos: { 'p.ino': c } }), codigo);
};
const opcion = (page: Page, nombre: string) => page.getByRole('radio', { name: nombre });
const corriendo = (page: Page) => expect(page.locator('#txt-estado')).toHaveText('El robot está corriendo', { timeout: 150_000 });

/** Un programa con el PWM de la 2.0.14: por canal. */
const DE_LA_2 = `void setup() {
  Serial.begin(115200);
  pinMode(16, OUTPUT); pinMode(17, OUTPUT); digitalWrite(16, HIGH); digitalWrite(17, LOW);
  ledcSetup(0, 15000, 8);
  ledcAttachPin(4, 0);
  ledcWrite(0, 200);
  Serial.printf("version %d.%d.%d\\n", ESP_ARDUINO_VERSION_MAJOR, ESP_ARDUINO_VERSION_MINOR, ESP_ARDUINO_VERSION_PATCH);
}
void loop() {}
`;

test('bajo «Mi programa» se elige la versión de la placa esp32; parte en 3.x', async ({ page }) => {
  await page.goto('/');
  const grupo = page.getByRole('group', { name: 'Versión de la placa esp32' });
  await expect(grupo).toBeVisible();
  await expect(opcion(page, '3.x')).toBeChecked();
  await expect(page.locator('#nota-version')).toContainText('ledcAttach(pin, frecuencia, bits)');
  // Queda justo debajo del título «Mi programa».
  const titulo = await page.getByRole('heading', { name: 'Mi programa' }).boundingBox();
  const caja = await grupo.boundingBox();
  expect(caja!.y).toBeGreaterThan(titulo!.y);
  expect(caja!.y - (titulo!.y + titulo!.height)).toBeLessThan(80);
});

test('con 2.0.14 corre el PWM por canal, y la elección sigue al volver', async ({ page }) => {
  await page.goto('/');
  await opcion(page, '2.0.14').check();
  await expect(page.locator('#nota-version')).toContainText('ledcSetup(canal, frecuencia, bits)');
  await abrir(page, DE_LA_2);
  await page.locator('#btn-probar').click();
  await corriendo(page);
  await expect(page.locator('#consola')).toContainText('version 2.0.14', { timeout: 20_000 });
  await expect(page.locator('#m-izq-n')).not.toHaveText(/^(0%|—)$/, { timeout: 20_000 });
  await page.locator('#btn-probar').click();
  await page.reload();
  await expect(opcion(page, '2.0.14')).toBeChecked();
});

test('el código de la 2.0.14 con 3.x elegida explica qué cambiar', async ({ page }) => {
  await page.goto('/');
  await abrir(page, DE_LA_2);
  await page.locator('#btn-probar').click();
  await expect(page.locator('#burbuja')).toContainText('ledcSetup es de la versión 2.0.14 del ESP32', { timeout: 150_000 });
  await opcion(page, '2.0.14').check();
  await page.locator('#btn-probar').click();
  await corriendo(page);
});
