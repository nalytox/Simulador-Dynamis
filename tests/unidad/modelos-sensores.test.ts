import { it, expect } from 'vitest';
import { MODELOS_POR_DEFECTO, type Ambiente } from '../../src/simulacion/sensores';
import type { EstadoRobot } from '../../src/simulacion/simulador';
import { crearMundo } from '../../src/mundo/pista';
import { crearAzar } from '../../src/simulacion/azar';
import { ROBOT_POR_DEFECTO } from '../../src/robot/config';
import { pistaDe } from '../ayuda/pistas';

const mundo = crearMundo(pistaDe({ columnas: 2, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'recta' }], objetos: [{ tipo: 'obstaculo', x: 500, y: 150, rot: 0 }] }));
const azar = crearAzar(1);
const ambiente: Ambiente = { luz: 'normal' };
const quieto: EstadoRobot = { x: 150, y: 150, z: 0, yaw: 0, pitch: 0, roll: 0 };

it('QTR: negro 3980 y blanco 180', () =>
  expect(MODELOS_POR_DEFECTO.leerQTR({ t: 0, estado: quieto, sensores: [{ x: 150, y: 150, z: 3 }, { x: 150, y: 50, z: 3 }], emisoresEncendidos: true, mundo, ambiente, azar }))
    .toEqual([3980, 180]));

it('VL53L0X: distancia al obstáculo o 8190', () => {
  expect(MODELOS_POR_DEFECTO.leerVL53L0X({ t: 0, estado: quieto, sensor: { x: 242, y: 150, z: 35, yaw: 0, pitch: 0 }, mundo, azar })).toBe(208);
  expect(MODELOS_POR_DEFECTO.leerVL53L0X({ t: 0, estado: quieto, sensor: { x: 242, y: 150, z: 35, yaw: Math.PI, pitch: 0 }, mundo, azar })).toBe(8190);
});

const ADELANTE = { ...ROBOT_POR_DEFECTO.mpu6050, orientacion: 'z-arriba-x-adelante' as const };
const ATRAS = { ...ROBOT_POR_DEFECTO.mpu6050, orientacion: 'z-arriba-x-atras' as const };
const GRADO = Math.PI / 180;

it('MPU6050: gravedad según la inclinación y gz por el cambio de rumbo', () => {
  const enRampa = { ...quieto, pitch: -20 * GRADO, yaw: 0.01 };
  const l = MODELOS_POR_DEFECTO.leerMPU6050({ t: 0, dt: 0.001, estado: enRampa, estadoAnterior: quieto, montaje: ADELANTE, mundo, azar });
  expect(l.ax).toBeCloseTo(9.80665 * Math.sin(20 * GRADO)); expect(l.ay).toBeCloseTo(0); expect(l.az).toBeCloseTo(9.80665 * Math.cos(20 * GRADO));
  expect(l.gz).toBeCloseTo(10); expect(l.temp).toBe(25);
  const vuelta = MODELOS_POR_DEFECTO.leerMPU6050({ t: 0, dt: 0.001, estado: { ...quieto, yaw: -Math.PI + 0.001 },
    estadoAnterior: { ...quieto, yaw: Math.PI - 0.001 }, montaje: ADELANTE, mundo, azar });
  expect(vuelta.gz).toBeCloseTo(2);
});

it('MPU6050: gx y gy son el cambio de roll y de pitch', () => {
  const antes = { ...quieto, pitch: -10 * GRADO, roll: 2 * GRADO };
  const ahora = { ...quieto, pitch: -10.5 * GRADO, roll: 2.2 * GRADO };
  const l = MODELOS_POR_DEFECTO.leerMPU6050({ t: 0, dt: 0.01, estado: ahora, estadoAnterior: antes, montaje: ADELANTE, mundo, azar });
  expect(l.gx).toBeCloseTo(0.2 * GRADO / 0.01, 9);
  expect(l.gy).toBeCloseTo(-0.5 * GRADO / 0.01, 9);
  expect(MODELOS_POR_DEFECTO.leerMPU6050({ t: 0, dt: 0.01, estado: quieto, estadoAnterior: quieto, montaje: ADELANTE, mundo, azar }))
    .toMatchObject({ gx: 0, gy: 0, gz: 0 });
});

it('MPU6050 mirando hacia atrás: ax, ay, gx y gy cambian de signo; az y gz no', () => {
  const antes = { ...quieto, pitch: -10 * GRADO, roll: 2 * GRADO };
  const ahora = { ...quieto, pitch: -10.5 * GRADO, roll: 2.2 * GRADO, yaw: 0.01 };
  const e = { t: 0, dt: 0.01, estado: ahora, estadoAnterior: antes, mundo, azar };
  const adelante = MODELOS_POR_DEFECTO.leerMPU6050({ ...e, montaje: ADELANTE });
  const atras = MODELOS_POR_DEFECTO.leerMPU6050({ ...e, montaje: ATRAS });
  expect(atras).toEqual({ ...adelante, ax: -adelante.ax, ay: -adelante.ay, gx: -adelante.gx, gy: -adelante.gy });
  // En lo plano no aparece −0 (el núcleo lo imprimiría como -0.00).
  expect(Object.is(MODELOS_POR_DEFECTO.leerMPU6050({ ...e, estado: quieto, estadoAnterior: quieto, montaje: ATRAS }).ax, -0)).toBe(false);
});

it('TCS34725: color escalado por ganancia e integración', () =>
  expect(MODELOS_POR_DEFECTO.leerTCS34725({ t: 0, estado: quieto, sensor: { x: 150, y: 50, z: 5 }, tiempoIntegracionMs: 24, ganancia: 4, ledEncendido: true, mundo, ambiente, azar }))
    .toEqual({ r: 960, g: 960, b: 960, c: 2880 }));
