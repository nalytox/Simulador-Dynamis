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
  return { x: pose.x, y: pose.y, yaw: pose.yaw, ...apoyo(pose.x, pose.y, pose.yaw, robot, mundo), v: 0, w: 0 };
}

/**
 * Altura e inclinación del chasis apoyado en el suelo: se inclina según la altura del suelo bajo su
 * frente y su cola (pitch) y bajo cada rueda (roll). z es la altura del eje de las ruedas.
 * Así el robot empieza a subir cuando su frente llega a la rampa, y un bache chico lo inclina poco.
 */
function apoyo(x, y, yaw, robot, mundo) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const suelo = (adelante, izquierda) => mundo.altura(x + adelante * c - izquierda * s, y + adelante * s + izquierda * c);
  const frente = robot.chasis.xDelantero;
  const cola = robot.chasis.xDelantero - robot.chasis.largo;
  const medio = robot.ruedas.trocha / 2;
  const hFrente = suelo(frente, 0);
  const hCola = suelo(cola, 0);
  const z = hCola + ((hFrente - hCola) * (robot.ruedas.x - cola)) / (frente - cola);
  const pitch = -Math.atan2(hFrente - hCola, frente - cola);
  const roll = Math.atan2(suelo(robot.ruedas.x, medio) - suelo(robot.ruedas.x, -medio), 2 * medio);
  return { z, pitch: pitch === 0 ? 0 : pitch, roll: roll === 0 ? 0 : roll };
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
  return { ...estado, x, y, yaw, ...apoyo(x, y, yaw, robot, mundo), v, w };
}
