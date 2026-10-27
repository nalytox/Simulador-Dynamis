// MODELO DE LA IMU MPU6050 — lo implementa el profesor.
// Contrato y unidades: ver src/modelos/README.md.

const G = 9.80665;

/** Diferencia de dos ángulos en (−π, π]. */
const diferencia = (ahora, antes) => {
  const d = ahora - antes;
  return d - 2 * Math.PI * Math.round(d / (2 * Math.PI));
};

/**
 * Aceleración (m/s²), velocidad angular (rad/s) y temperatura (°C), en el marco del sensor.
 * @param {{ t: number, dt: number, estado: Record<string, any>, estadoAnterior: Record<string, any>,
 *   montaje: { x: number, y: number, z: number, orientacion: string }, mundo: import('../mundo/tipos').Mundo, azar: () => number }} e
 *   dt: segundos entre estadoAnterior y estado (un paso de física).
 * @returns {{ ax: number, ay: number, az: number, gx: number, gy: number, gz: number, temp: number }}
 */
export function leerMPU6050({ dt, estado, estadoAnterior, montaje }) {
  // TODO(profe): reemplazar este placeholder ideal (solo la gravedad según la inclinación y el giro
  // como el cambio de roll, pitch y yaw, sin aceleración lineal, vibraciones, sesgo ni ruido) por el
  // modelo real del sensor.
  const { pitch, roll } = estado;
  const tasa = (eje) => (dt > 0 ? diferencia(estado[eje], estadoAnterior[eje]) / dt : 0);
  // En el marco del robot (x adelante, y izquierda, z arriba): gx es el cambio de roll y gy el de
  // pitch (pitch > 0: nariz hacia abajo). Así MPU6050_light los integra en el mismo sentido que sus
  // ángulos del acelerómetro.
  const enRobot = {
    ax: 0 - G * Math.sin(pitch), // 0 − 0 da 0, no −0
    ay: G * Math.sin(roll) * Math.cos(pitch),
    az: G * Math.cos(roll) * Math.cos(pitch),
    gx: tasa('roll'),
    gy: tasa('pitch'),
    gz: tasa('yaw'),
    temp: 25,
  };
  if (montaje.orientacion !== 'z-arriba-x-atras') return enRobot;
  // El chip girado 180° sobre z: sus ejes x e y apuntan al revés que los del robot.
  return { ...enRobot, ax: 0 - enRobot.ax, ay: 0 - enRobot.ay, gx: 0 - enRobot.gx, gy: 0 - enRobot.gy };
}
