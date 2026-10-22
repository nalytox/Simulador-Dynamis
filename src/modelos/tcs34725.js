// MODELO DEL SENSOR DE COLOR TCS34725 — lo implementa el profesor.
// Contrato y unidades: ver src/modelos/README.md.

/** Cuentas por ms de integración, por unidad de ganancia, para un canal a pleno (255). */
const CUENTAS_POR_MS = 10;

/**
 * Cuentas crudas de los canales rojo, verde, azul y claro (el núcleo las satura al máximo del chip).
 * @param {{ t: number, estado: Record<string, any>, sensor: { x: number, y: number, z: number }, tiempoIntegracionMs: number,
 *   ganancia: number, ledEncendido: boolean, mundo: import('../mundo/tipos').Mundo, ambiente: { luz: string }, azar: () => number }} e
 * @returns {{ r: number, g: number, b: number, c: number }}
 */
export function leerTCS34725({ sensor, tiempoIntegracionMs, ganancia, mundo }) {
  // TODO(profe): reemplazar este placeholder ideal (el color del suelo escalado, sin LED, luz
  // ambiente, altura ni ruido) por el modelo real del sensor.
  const color = mundo.muestrear(sensor.x, sensor.y);
  const cuentas = valor => Math.round((valor / 255) * CUENTAS_POR_MS * ganancia * tiempoIntegracionMs);
  const r = cuentas(color.r);
  const g = cuentas(color.g);
  const b = cuentas(color.b);
  return { r, g, b, c: r + g + b };
}
