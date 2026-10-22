// MODELO DE LA IMU MPU6050 — lo implementa el profesor.
// Contrato y unidades: ver src/modelos/README.md.

const G = 9.80665;

/**
 * Aceleración (m/s²), velocidad angular (rad/s) y temperatura (°C), en el marco del sensor.
 * @param {{ t: number, dt: number, estado: Record<string, any>, estadoAnterior: Record<string, any>,
 *   montaje: { x: number, y: number, z: number, orientacion: string }, mundo: import('../mundo/tipos').Mundo, azar: () => number }} e
 *   dt: segundos entre estadoAnterior y estado (un paso de física).
 * @returns {{ ax: number, ay: number, az: number, gx: number, gy: number, gz: number, temp: number }}
 */
export function leerMPU6050({ dt, estado, estadoAnterior }) {
  // TODO(profe): reemplazar este placeholder ideal (solo la gravedad según la inclinación y el giro
  // en z, sin aceleración lineal, vibraciones, sesgo ni ruido) por el modelo real del sensor.
  const { pitch, roll } = estado;
  const dYaw = estado.yaw - estadoAnterior.yaw;
  const giro = dYaw - 2 * Math.PI * Math.round(dYaw / (2 * Math.PI));
  return {
    ax: -G * Math.sin(pitch),
    ay: G * Math.sin(roll) * Math.cos(pitch),
    az: G * Math.cos(roll) * Math.cos(pitch),
    gx: 0,
    gy: 0,
    gz: dt > 0 ? giro / dt : 0,
    temp: 25,
  };
}
