// MODELO DEL SENSOR DE LÍNEA QTR-MX-8A — lo implementa el profesor.
// Contrato y unidades: ver src/modelos/README.md.

/**
 * Lectura de los 8 sensores del QTR (ADC crudo de 12 bits, 0–4095).
 * @param {{ t: number, estado: Record<string, any>, sensores: { x: number, y: number, z: number }[],
 *   emisoresEncendidos: boolean, mundo: import('../mundo/tipos').Mundo, ambiente: { luz: string }, azar: () => number }} e
 *   sensores: posición de cada sensor en el mundo (mm); el 0 es el de la izquierda del robot.
 * @returns {number[]}
 */
export function leerQTR({ sensores, mundo }) {
  // TODO(profe): reemplazar este placeholder ideal (reflectancia directa del color del suelo, sin
  // emisores, luz ambiente, altura ni ruido) por el modelo real del sensor.
  return sensores.map(s => {
    const { r, g, b } = mundo.muestrear(s.x, s.y);
    const luminancia = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return Math.round(180 + (1 - luminancia) * 3800);
  });
}
