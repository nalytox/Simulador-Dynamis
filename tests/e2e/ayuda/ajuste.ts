import { expect, type Page } from '@playwright/test';

/** Agente de prueba: recorre el rango con la razón áurea (sin azar), para que los valores cambien. */
const AGENTE = `export function crearAgente({ parametros }) {
  let n = 0;
  return {
    proponer() { n++; const f = (n * 0.6180339887) % 1; return Object.fromEntries(parametros.map(p => [p.id, p.min + f * (p.max - p.min)])); },
    aprender() {},
  };
}`;
/** Recompensa de prueba: el puntaje del juez más lo que avanzó en x. */
const RECOMPENSA = `export function calcularRecompensa(r) {
  const ultimo = r.pasos[r.pasos.length - 1];
  return (r.juez ? r.juez.puntaje : 0) + (ultimo ? ultimo.estado.x / 1000 : 0);
}
export function debeTerminar() { return false; }`;

/**
 * Reemplaza el agente y la recompensa del profe (que vienen sin rellenar) por versiones de prueba,
 * en la página y en los workers del entrenamiento.
 */
export async function usarAjusteDePrueba(page: Page): Promise<void> {
  await page.route('**/src/ajuste/agente.js*', r => r.fulfill({ contentType: 'text/javascript', body: AGENTE }));
  await page.route('**/src/ajuste/recompensa.js*', r => r.fulfill({ contentType: 'text/javascript', body: RECOMPENSA }));
}

export const vivos = (page: Page) => page.evaluate(() => (window as unknown as { __pruebas: { trabajadoresVivos(): number } }).__pruebas.trabajadoresVivos());

export async function abrirProyecto(page: Page, archivos: Record<string, string>): Promise<void> {
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { __pruebas?: { abrirProyecto?: unknown } }).__pruebas?.abrirProyecto)).toBe('function');
  await page.evaluate(a => (window as unknown as { __pruebas: { abrirProyecto(p: unknown): void } }).__pruebas.abrirProyecto({ nombre: 'p', archivos: a }), archivos);
}

/** Abre la ventana y entrena con pocas pruebas de 10 s. */
export async function entrenar(page: Page, pruebas: number): Promise<void> {
  await page.locator('#btn-ajustar').click();
  await page.locator('#aj-pruebas').fill(String(pruebas));
  await page.locator('#aj-duracion').selectOption('10');
  await page.locator('#aj-empezar').click();
}
