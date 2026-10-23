import { it, expect } from 'vitest';
import { poseVL53, puntoEnMundo, puntosQTR, puntoTCS } from '../../src/simulacion/sensores';
import type { EstadoRobot } from '../../src/simulacion/simulador';
import { ROBOT_POR_DEFECTO } from '../../src/robot/config';

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
  expect(s[0]).toMatchObject({ x: expect.closeTo(192), y: expect.closeTo(200 + 3.5 * 9.525), z: expect.closeTo(3) });
  expect(s[7].y).toBeCloseTo(200 - 3.5 * 9.525);
});

it('pose del VL53L0X y punto del TCS34725', () => {
  const robot = { ...ROBOT_POR_DEFECTO, vl53l0x: { ...ROBOT_POR_DEFECTO.vl53l0x, yaw: 90, pitch: 10 } };
  expect(poseVL53(estado({ yaw: 0.5 }), robot)).toMatchObject({
    x: expect.closeTo(100 + 92 * Math.cos(0.5)), z: expect.closeTo(35), yaw: expect.closeTo(0.5 + Math.PI / 2), pitch: expect.closeTo(10 * Math.PI / 180) });
  expect(puntoTCS(estado(), ROBOT_POR_DEFECTO)).toMatchObject({ x: 140, y: 154, z: 5 });
});
