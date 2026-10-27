import { it, expect } from 'vitest';
import { estadoInicial, pasoDinamica } from '../../src/modelos/dinamica.js';
import { crearMundo } from '../../src/mundo/pista';
import { mundoPlano } from '../../src/mundo/plano';
import { ROBOT_POR_DEFECTO, type ConfigRobot } from '../../src/robot/config';
import type { Motores } from '../../src/simulacion/motores';
import { pistaDe } from '../ayuda/pistas';

const GRADOS = Math.PI / 180;
const RAMPA = () => crearMundo(pistaDe({ columnas: 2, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'recta' }, { c: 1, r: 0, tipo: 'rampa' }] }));
const sinLocas = (): ConfigRobot => ({ ...structuredClone(ROBOT_POR_DEFECTO), ruedasLocas: { ...ROBOT_POR_DEFECTO.ruedasLocas, instalado: false } });

it('con ruedas locas, el robot se inclina cuando ellas llegan a la rampa, no cuando llega el frente del chasis', () => {
  // La rampa empieza en x = 300. En x = 220 las locas (x + 70) siguen en lo plano y el frente (x + 97) ya está en la rampa.
  expect(estadoInicial({ x: 220, y: 150, yaw: 0 }, ROBOT_POR_DEFECTO, RAMPA()).pitch).toBe(0);
  // En x = 250 las locas están 20 mm dentro de la rampa de 20°: suben 7,3 mm en 70 mm.
  const e = estadoInicial({ x: 250, y: 150, yaw: 0 }, ROBOT_POR_DEFECTO, RAMPA());
  expect(e.pitch).toBeCloseTo(-Math.atan2(20 * Math.tan(20 * GRADOS), 70), 6);
  expect(e.z).toBe(0);
});

it('sin ruedas locas, el chasis se apoya en su frente y su cola, como antes', () => {
  const e = estadoInicial({ x: 220, y: 150, yaw: 0 }, sinLocas(), RAMPA());
  // El frente (317) está 17 mm dentro de la rampa; la cola (192), en lo plano: 125 mm entre los dos.
  expect(e.pitch).toBeCloseTo(-Math.atan2(17 * Math.tan(20 * GRADOS), 125), 6);
});

it('un bache de 6 mm bajo el eje casi no inclina al robot', () => {
  const mundo = crearMundo(pistaDe({ columnas: 1, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'recta' }],
    objetos: [{ tipo: 'bache', x: 150, y: 150, rot: 90, props: { largo: 250, radio: 6 } }] }));
  const e = estadoInicial({ x: 150, y: 150, yaw: 0 }, ROBOT_POR_DEFECTO, mundo);
  expect(Math.abs(e.pitch)).toBeLessThan(5 * GRADOS);
});

it('en la mitad de la rampa la inclinación es la de la rampa', () => {
  const mundo = crearMundo(pistaDe({ columnas: 3, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'recta' }, { c: 1, r: 0, tipo: 'rampa' }, { c: 2, r: 0, tipo: 'recta', nivel: 109.19 }] }));
  for (const robot of [ROBOT_POR_DEFECTO, sinLocas()]) {
    const e = estadoInicial({ x: 450, y: 150, yaw: 0 }, robot, mundo);
    expect(e.pitch).toBeCloseTo(-20 * GRADOS, 3);
    expect(e.z).toBeCloseTo(150 * Math.tan(20 * GRADOS), 1);
    expect(e.roll).toBeCloseTo(0, 6);
  }
});

it('la velocidad de las ruedas sale de motores.vMaxMmS del robot', () => {
  const mundo = mundoPlano();
  const robot = { ...structuredClone(ROBOT_POR_DEFECTO), motores: { ...ROBOT_POR_DEFECTO.motores, vMaxMmS: 300 } };
  const motores: Motores = { izq: { duty: 1, modo: 'avance' }, der: { duty: 1, modo: 'avance' } };
  const e = pasoDinamica(estadoInicial({ x: 0, y: 0, yaw: 0 }, robot, mundo), motores, 0.1, mundo, robot, () => 0);
  expect(e.x).toBeCloseTo(30, 6);
  expect(e.v).toBe(300);
});
