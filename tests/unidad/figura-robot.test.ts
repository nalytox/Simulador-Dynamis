import { it, expect } from 'vitest';
import { piezasRobot } from '../../src/ui/figura-robot';
import { ROBOT_POR_DEFECTO } from '../../src/robot/config';

it('el robot por defecto tiene cuatro ruedas: las traseras de 60 mm y las locas de 55 mm', () => {
  const { ruedas } = piezasRobot(ROBOT_POR_DEFECTO);
  expect(ruedas.map(r => [r.x, r.y, r.largo, r.tipo])).toEqual([
    [0, 80, 60, 'motriz'], [0, -80, 60, 'motriz'], [70, 80, 55, 'loca'], [70, -80, 55, 'loca'],
  ]);
});

it('sin ruedas locas, solo las dos motrices', () => {
  const robot = { ...ROBOT_POR_DEFECTO, ruedasLocas: { ...ROBOT_POR_DEFECTO.ruedasLocas, instalado: false } };
  expect(piezasRobot(robot).ruedas.map(r => r.tipo)).toEqual(['motriz', 'motriz']);
});

it('la placa queda dentro del chasis', () => {
  const { placa } = piezasRobot(ROBOT_POR_DEFECTO);
  const { xDelantero, largo, ancho } = ROBOT_POR_DEFECTO.chasis;
  expect(placa.x - placa.largo / 2).toBeGreaterThan(xDelantero - largo);
  expect(placa.x + placa.largo / 2).toBeLessThan(xDelantero);
  expect(placa.ancho).toBeLessThan(ancho);
});

it('la flecha del MPU6050 apunta hacia donde mira su eje x', () => {
  const atras = piezasRobot(ROBOT_POR_DEFECTO).flechaMPU;
  expect(atras.desde).toEqual({ x: -15, y: 0 });
  expect(atras.hasta.x).toBeLessThan(-15);
  expect(atras.hasta.y).toBe(0);
  const adelante = piezasRobot({ ...ROBOT_POR_DEFECTO, mpu6050: { ...ROBOT_POR_DEFECTO.mpu6050, orientacion: 'z-arriba-x-adelante' } }).flechaMPU;
  expect(adelante.hasta.x).toBeGreaterThan(-15);
});
