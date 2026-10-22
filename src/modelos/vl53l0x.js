// MODELO DEL SENSOR DE DISTANCIA VL53L0X — lo implementa el profesor.
// Contrato y unidades: ver src/modelos/README.md.

/** Sin objetivo dentro del alcance, la librería de Pololu entrega 8190 o más. */
const SIN_OBJETIVO = 8190;
const ALCANCE_MM = 2000;

/**
 * Distancia medida en mm.
 * @param {{ t: number, estado: Record<string, any>, sensor: { x: number, y: number, z: number, yaw: number, pitch: number },
 *   mundo: import('../mundo/tipos').Mundo, azar: () => number }} e
 *   sensor: posición (mm) y rumbo (rad) del sensor en el mundo; pitch > 0 apunta hacia abajo (REP-103).
 * @returns {number}
 */
export function leerVL53L0X({ sensor, mundo }) {
  // TODO(profe): reemplazar este placeholder ideal (el rayo central, sin cono de 25°, ruido ni
  // reflectividad) por el modelo real del sensor.
  const dir = {
    x: Math.cos(sensor.pitch) * Math.cos(sensor.yaw),
    y: Math.cos(sensor.pitch) * Math.sin(sensor.yaw),
    z: -Math.sin(sensor.pitch),
  };
  const impacto = mundo.raycast({ x: sensor.x, y: sensor.y, z: sensor.z }, dir, ALCANCE_MM);
  return impacto ? Math.round(impacto.distancia) : SIN_OBJETIVO;
}
