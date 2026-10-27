import { it, expect } from 'vitest';
import { poseVL53, puntoEnMundo, puntosQTR, puntoTCS } from '../../src/simulacion/sensores';
import type { EstadoRobot } from '../../src/simulacion/simulador';
import { ROBOT_POR_DEFECTO } from '../../src/robot/config';
import { leerVL53L0X } from '../../src/modelos/vl53l0x.js';
import { estadoInicial } from '../../src/modelos/dinamica.js';
import { crearMundo } from '../../src/mundo/pista';
import { pistaDe } from '../ayuda/pistas';

const estado = (extra: Partial<EstadoRobot> = {}): EstadoRobot => ({ x: 100, y: 200, z: 0, yaw: 0, pitch: 0, roll: 0, ...extra });

it('puntoEnMundo gira con yaw, pitch y roll', () => {
  expect(puntoEnMundo(estado({ yaw: Math.PI / 2 }), { x: 92, y: 0, z: 0 }))
    .toMatchObject({ x: expect.closeTo(100), y: expect.closeTo(292), z: expect.closeTo(0) });
  expect(puntoEnMundo(estado({ pitch: -20 * Math.PI / 180, z: 10 }), { x: 100, y: 0, z: 0 }).z).toBeCloseTo(10 + 100 * Math.sin(20 * Math.PI / 180));
  expect(puntoEnMundo(estado({ roll: 10 * Math.PI / 180 }), { x: 0, y: 50, z: 0 }).z).toBeCloseTo(50 * Math.sin(10 * Math.PI / 180));
});

it('el sensor 0 del QTR está a la izquierda del robot', () => {
  const s = puntosQTR(estado(), ROBOT_POR_DEFECTO);
  expect(s).toHaveLength(8);
  expect(s[0]).toMatchObject({ x: expect.closeTo(174), y: expect.closeTo(200 + 3.5 * 8), z: expect.closeTo(7) });
  expect(s[7].y).toBeCloseTo(200 - 3.5 * 8);
});

it('pose del VL53L0X y punto del TCS34725', () => {
  const robot = { ...ROBOT_POR_DEFECTO, vl53l0x: { ...ROBOT_POR_DEFECTO.vl53l0x, yaw: 90, pitch: 10 } };
  expect(poseVL53(estado({ yaw: 0.5 }), robot)).toMatchObject({
    x: expect.closeTo(100 + 82 * Math.cos(0.5)), z: expect.closeTo(20), yaw: expect.closeTo(0.5 + Math.PI / 2), pitch: expect.closeTo(10 * Math.PI / 180) });
  expect(puntoTCS(estado(), ROBOT_POR_DEFECTO)).toMatchObject({ x: 135, y: 222, z: 7 });
  expect(puntoTCS(estado(), ROBOT_POR_DEFECTO, ROBOT_POR_DEFECTO.tcs34725b)).toMatchObject({ x: 135, y: 178, z: 7 });
});

it('el láser a 20 mm del suelo ve la subida de la rampa y un obstáculo con mundo.raycast', () => {
  const mundo = crearMundo(pistaDe({ columnas: 3, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'recta' }, { c: 1, r: 0, tipo: 'rampa' }, { c: 2, r: 0, tipo: 'recta', nivel: 109.19 }] }));
  const leer = (x: number, m = mundo) => {
    const e = estadoInicial({ x, y: 150, yaw: 0 }, ROBOT_POR_DEFECTO, m);
    return leerVL53L0X({ t: 0, estado: e, sensor: poseVL53(e, ROBOT_POR_DEFECTO), mundo: m, azar: () => 0 });
  };
  // En lo plano, el láser (x + 82, a 20 mm) choca con la rampa donde ella sube 20 mm: 20 / tan 20° después de su inicio.
  expect(leer(150)).toBe(Math.round(300 + 20 / Math.tan(20 * Math.PI / 180) - 232));
  // Ya en la rampa, el rayo va paralelo a ella y no ve nada.
  expect(leer(450)).toBe(8190);
  const conObstaculo = crearMundo(pistaDe({ columnas: 3, filas: 1, baldosas: [0, 1, 2].map(c => ({ c, r: 0, tipo: 'recta' })),
    objetos: [{ tipo: 'obstaculo', x: 600, y: 150, rot: 0 }] }));
  expect(leer(150, conObstaculo)).toBe(600 - 50 - 232);
});
