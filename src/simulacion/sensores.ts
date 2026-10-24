import type { ConfigRobot, SensorColor } from '../robot/config';
import type { Mundo, Punto3 } from '../mundo/tipos';
import type { Luz } from '../pista/tipos';
import type { Azar } from './azar';
import type { EstadoRobot } from './simulador';
import * as qtr from '../modelos/qtr.js';
import * as vl53l0x from '../modelos/vl53l0x.js';
import * as mpu6050 from '../modelos/mpu6050.js';
import * as tcs34725 from '../modelos/tcs34725.js';

/**
 * Contrato de los modelos de sensores del profesor (spec §9) y posición de cada sensor en el mundo.
 * Los modelos entregan magnitudes físicas; el núcleo las convierte a lo que devuelve cada librería.
 */
export interface PoseSensor { x: number; y: number; z: number; yaw: number; pitch: number }
export interface Ambiente { luz: Luz }
export interface LecturaMPU { ax: number; ay: number; az: number; gx: number; gy: number; gz: number; temp: number }
export interface LecturaTCS { r: number; g: number; b: number; c: number }

export interface ModelosSensores {
  /** ADC crudo 0–4095 de cada uno de los 8 sensores. */
  leerQTR(e: { t: number; estado: EstadoRobot; sensores: Punto3[]; emisoresEncendidos: boolean; mundo: Mundo; ambiente: Ambiente; azar: Azar }): number[];
  /** mm; ≥ 8190 = sin objetivo. */
  leerVL53L0X(e: { t: number; estado: EstadoRobot; sensor: PoseSensor; mundo: Mundo; azar: Azar }): number;
  /** m/s², rad/s y °C, en el marco del sensor. */
  leerMPU6050(e: {
    t: number; dt: number; estado: EstadoRobot; estadoAnterior: EstadoRobot;
    montaje: ConfigRobot['mpu6050']; mundo: Mundo; azar: Azar;
  }): LecturaMPU;
  /** Cuentas crudas de cada canal. */
  leerTCS34725(e: {
    t: number; estado: EstadoRobot; sensor: Punto3; tiempoIntegracionMs: number; ganancia: number;
    ledEncendido: boolean; mundo: Mundo; ambiente: Ambiente; azar: Azar;
  }): LecturaTCS;
}

export const MODELOS_POR_DEFECTO: ModelosSensores = {
  leerQTR: qtr.leerQTR,
  leerVL53L0X: vl53l0x.leerVL53L0X,
  leerMPU6050: mpu6050.leerMPU6050,
  leerTCS34725: tcs34725.leerTCS34725,
};

const GRADOS = Math.PI / 180;

/** Punto del marco del robot en el mundo: (x, y, z) del estado + Rz(yaw)·Ry(pitch)·Rx(roll)·local. */
export function puntoEnMundo(estado: EstadoRobot, local: Punto3): Punto3 {
  const [cr, sr] = [Math.cos(estado.roll), Math.sin(estado.roll)];
  const [cp, sp] = [Math.cos(estado.pitch), Math.sin(estado.pitch)];
  const [cy, sy] = [Math.cos(estado.yaw), Math.sin(estado.yaw)];
  const y1 = local.y * cr - local.z * sr;
  const z1 = local.y * sr + local.z * cr;
  const x2 = local.x * cp + z1 * sp;
  const z2 = -local.x * sp + z1 * cp;
  return { x: estado.x + x2 * cy - y1 * sy, y: estado.y + x2 * sy + y1 * cy, z: estado.z + z2 };
}

/** Los 8 sensores del QTR; el 0 es el de la izquierda del robot: local (qtr.x, (3,5 − i)·separacion, qtr.altura). */
export function puntosQTR(estado: EstadoRobot, robot: ConfigRobot): Punto3[] {
  const { x, separacion, altura, pines } = robot.qtr;
  const medio = (pines.length - 1) / 2;
  return pines.map((_, i) => puntoEnMundo(estado, { x, y: (medio - i) * separacion, z: altura }));
}

/** Posición y rumbo del VL53L0X: el rumbo del robot más el del montaje (grados en ConfigRobot), sin acoplar el roll. */
export function poseVL53(estado: EstadoRobot, robot: ConfigRobot): PoseSensor {
  const { x, y, z, yaw, pitch } = robot.vl53l0x;
  return { ...puntoEnMundo(estado, { x, y, z }), yaw: estado.yaw + yaw * GRADOS, pitch: estado.pitch + pitch * GRADOS };
}

/** Dónde está un TCS34725 en el mundo (por defecto, el primero del robot). */
export function puntoTCS(estado: EstadoRobot, robot: ConfigRobot, sensor: SensorColor = robot.tcs34725): Punto3 {
  const { x, y, z } = sensor;
  return puntoEnMundo(estado, { x, y, z });
}
