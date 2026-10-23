import { test, expect } from '@playwright/test';
import { abrirProyecto, entrenar, usarAjusteDePrueba, vivos } from './ayuda/ajuste';

test('sin el agente del profe, Empezar explica qué falta y no deja workers', async ({ page }) => {
  await page.goto('/');
  await entrenar(page, 10);
  await expect(page.locator('#aj-error')).toContainText('Para entrenar falta que tu profe programe el agente (src/ajuste/agente.js).');
  await expect(page.locator('#aj-empezar-txt')).toHaveText('Empezar a entrenar');
  expect(await vivos(page)).toBe(0);
  await page.locator('#aj-cerrar').click();
  await expect(page.locator('#btn-probar')).toBeEnabled();
});

test('si el entrenamiento no puede partir, la ventana lo explica y se puede volver a empezar', async ({ page }) => {
  await usarAjusteDePrueba(page);
  await page.route('**/src/ajuste/pool.ts*', r => r.fulfill({ contentType: 'text/javascript', body: 'export function crearPool() { throw new Error("sin workers"); }' }));
  await page.goto('/');
  await entrenar(page, 10);
  await expect(page.locator('#aj-error')).toContainText('Algo falló en el simulador, avisa a tu profe.', { timeout: 120_000 });
  await expect(page.locator('#aj-empezar-txt')).toHaveText('Empezar a entrenar');
  await expect(page.locator('#aj-chip')).toHaveText('Sin terminar');
  await page.locator('#aj-error-tecnico-btn').click();
  await expect(page.locator('#aj-error-tecnico')).toContainText('sin workers');
});

test('con 10 pruebas, el gráfico y el mejor resultado se llenan', async ({ page }) => {
  test.setTimeout(300_000);
  await usarAjusteDePrueba(page);
  await page.goto('/');
  await entrenar(page, 10);
  await expect(page.locator('#aj-chip')).toHaveText('Practicando…');
  await expect(page.locator('#aj-empezar-txt')).toHaveText('Detener entrenamiento');
  await expect(page.locator('#aj-pids input').first()).toBeDisabled();
  await expect(page.locator('#aj-chip')).toHaveText('Terminado', { timeout: 240_000 });
  await expect(page.locator('#aj-progreso')).toHaveText('Prueba 10 de 10');
  await expect(page.locator('#aj-grafico .g-punto')).toHaveCount(10);
  await expect(page.locator('#aj-grafico .g-linea')).toHaveCount(1);
  await expect(page.locator('#aj-mejor-r')).not.toHaveText('—');
  await expect(page.locator('#aj-mejor-sub')).toContainText('Recompensa de la prueba');
  await expect(page.locator('#aj-tabla tr')).toHaveCount(2);
  await expect(page.locator('#aj-ver')).toBeEnabled();
  await expect(page.locator('#aj-usar')).toBeEnabled();
  expect(await vivos(page)).toBe(0);
  // El tooltip muestra la prueba bajo el puntero (la prueba 1 siempre es récord: su círculo amarillo la tapa).
  await page.locator('#aj-grafico .g-punto').first().hover({ force: true });
  await expect(page.locator('#aj-tip')).toContainText('Prueba 1 · recompensa');
});

test('Detener entrenamiento cierra los workers', async ({ page }) => {
  test.setTimeout(300_000);
  await usarAjusteDePrueba(page);
  await page.goto('/');
  await entrenar(page, 200);
  await expect(page.locator('#aj-progreso')).toHaveText(/^Prueba \d+ de 200$/, { timeout: 240_000 });
  await page.locator('#aj-empezar').click();
  await expect(page.locator('#aj-chip')).toHaveText('Detenido');
  await expect(page.locator('#aj-empezar-txt')).toHaveText('Empezar a entrenar');
  await expect.poll(() => vivos(page)).toBe(0);
});

test('un programa que se cuelga no detiene el entrenamiento', async ({ page }) => {
  test.setTimeout(300_000);
  await usarAjusteDePrueba(page);
  await page.goto('/');
  await abrirProyecto(page, { 'p.ino': 'float kp = 1.0; // @ajustar siguelineas\nvoid setup() {}\nvoid loop() { while (kp > 0) {} }\n' });
  // Se piden 2 pruebas: el mínimo es 10, así que el campo se ajusta a 10.
  await entrenar(page, 2);
  await expect(page.locator('#aj-pruebas')).toHaveValue('10');
  await expect(page.locator('#aj-chip')).toHaveText('Terminado', { timeout: 240_000 });
  await expect(page.locator('#aj-progreso')).toHaveText('Prueba 10 de 10');
  await expect(page.locator('#aj-grafico .g-punto')).toHaveCount(10);
  expect(await vivos(page)).toBe(0);
});
