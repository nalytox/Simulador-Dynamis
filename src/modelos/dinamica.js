// MODELO DE DINÁMICA DEL ROBOT — lo implementa el profesor.
// Contrato y unidades: ver src/modelos/README.md.
import { PARAMETROS } from './parametros.js';
import { huellaRobot } from '../robot/config';

/**
 * Estado del robot al empezar una ejecución.
 * @param {{ x: number, y: number, yaw: number }} pose mm y rad, en el marco del mundo
 * @param {import('../robot/config').ConfigRobot} robot
 * @param {import('../mundo/tipos').Mundo} mundo
 */
export function estadoInicial(pose, robot, mundo) {
  const { pitch, roll } = mundo.inclinacion(pose.x, pose.y, pose.yaw);
  return { x: pose.x, y: pose.y, z: mundo.altura(pose.x, pose.y), yaw: pose.yaw, pitch, roll, v: 0, w: 0 };
}

/**
 * Avanza el estado del robot un paso de dt segundos.
 * @param {Record<string, any>} estado { x, y, z, yaw, pitch, roll, ...campos propios }
 * @param {import('../simulacion/motores').Motores} motores duty ∈ [−1, 1] y modo de cada motor
 * @param {number} dt segundos
 * @param {import('../mundo/tipos').Mundo} mundo
 * @param {import('../robot/config').ConfigRobot} robot
 * @param {() => number} azar números aleatorios en [0, 1) con la semilla de la ejecución
 */
export function pasoDinamica(estado, motores, dt, mundo, robot, azar) {
  // TODO(profe): reemplazar este placeholder ideal (cinemática diferencial, sin inercia ni
  // deslizamiento) por el modelo dinámico real: masa, inercia, fricción, efecto de las rampas…
  const vIzq = motores.izq.duty * PARAMETROS.vMaxMmS;
  const vDer = motores.der.duty * PARAMETROS.vMaxMmS;
  const v = (vIzq + vDer) / 2;
  const w = (vDer - vIzq) / robot.ruedas.trocha;
  const yaw = estado.yaw + w * dt;
  let x = estado.x + v * Math.cos(yaw) * dt;
  let y = estado.y + v * Math.sin(yaw) * dt;
  if (mundo.colisiona(huellaRobot(x, y, yaw, robot))) {
    x = estado.x;
    y = estado.y;
  }
  const { pitch, roll } = mundo.inclinacion(x, y, yaw);
  return { ...estado, x, y, z: mundo.altura(x, y), yaw, pitch, roll, v, w };
}
