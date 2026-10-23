import { it, expect } from 'vitest';
import { estadoInicial } from '../../src/modelos/dinamica.js';
import { crearMundo } from '../../src/mundo/pista';
import { ROBOT_POR_DEFECTO } from '../../src/robot/config';
import { pistaDe } from '../ayuda/pistas';

const GRADOS = Math.PI / 180;

it('el chasis se inclina cuando su frente llega a la rampa, no cuando llega su centro', () => {
  const mundo = crearMundo(pistaDe({ columnas: 2, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'recta' }, { c: 1, r: 0, tipo: 'rampa' }] }));
  // El frente (96 mm adelante) ya está 46 mm dentro de la rampa; el centro, todavía en lo plano.
  const e = estadoInicial({ x: 250, y: 150, yaw: 0 }, ROBOT_POR_DEFECTO, mundo);
  expect(e.pitch).toBeLessThan(-3 * GRADOS);
  expect(e.pitch).toBeGreaterThan(-20 * GRADOS);
});

it('un bache de 6 mm bajo el centro casi no inclina al robot', () => {
  const mundo = crearMundo(pistaDe({ columnas: 1, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'recta' }],
    objetos: [{ tipo: 'bache', x: 150, y: 150, rot: 90, props: { largo: 250, radio: 6 } }] }));
  const e = estadoInicial({ x: 154, y: 150, yaw: 0 }, ROBOT_POR_DEFECTO, mundo);
  expect(Math.abs(e.pitch)).toBeLessThan(5 * GRADOS);
});

it('en la mitad de la rampa la inclinación es la de la rampa', () => {
  const mundo = crearMundo(pistaDe({ columnas: 3, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'recta' }, { c: 1, r: 0, tipo: 'rampa' }, { c: 2, r: 0, tipo: 'recta', nivel: 109.19 }] }));
  const e = estadoInicial({ x: 450, y: 150, yaw: 0 }, ROBOT_POR_DEFECTO, mundo);
  expect(e.pitch).toBeCloseTo(-20 * GRADOS, 3);
  expect(e.z).toBeCloseTo(150 * Math.tan(20 * GRADOS), 1);
  expect(e.roll).toBeCloseTo(0, 6);
});
