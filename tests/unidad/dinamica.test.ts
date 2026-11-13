import { it, expect, beforeAll, afterAll } from 'vitest';
import { estadoInicial } from '../../src/modelos/dinamica.js';
import { PISO } from '../../src/modelos/parametros.js';
import { crearMundo } from '../../src/mundo/pista';
import { ROBOT_POR_DEFECTO, type ConfigRobot } from '../../src/robot/config';
import { pistaDe } from '../ayuda/pistas';

// La geometría del apoyo, sin los desniveles entre baldosas (la rugosidad se prueba en fisica.test.ts).
const desnivel = PISO.desnivelMm;
beforeAll(() => { PISO.desnivelMm = 0; });
afterAll(() => { PISO.desnivelMm = desnivel; });
/** Una rueda de radio R apoyada en una rampa de ángulo a: su centro queda R·(1/cos a − 1) más arriba que en lo plano. */
const sobreRampa = (R: number, a: number) => R * (1 / Math.cos(a) - 1);

const GRADOS = Math.PI / 180;
const RAMPA = () => crearMundo(pistaDe({ columnas: 2, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'recta' }, { c: 1, r: 0, tipo: 'rampa' }] }));
const sinLocas = (): ConfigRobot => ({ ...structuredClone(ROBOT_POR_DEFECTO), ruedasLocas: { ...ROBOT_POR_DEFECTO.ruedasLocas, instalado: false } });

it('con ruedas locas, el robot se inclina cuando ellas llegan a la rampa, no cuando llega el frente del chasis', () => {
  // La rampa empieza en x = 300. En x = 220 las locas (x + 70) siguen en lo plano y el frente (x + 97) ya está en la rampa.
  expect(estadoInicial({ x: 220, y: 150, yaw: 0 }, ROBOT_POR_DEFECTO, RAMPA()).pitch).toBe(0);
  // En x = 250 las locas están 20 mm dentro de la rampa de 20° (y la tocan, 9 mm más atrás que su
  // centro, también en la rampa): suben 7,3 mm, más lo que su radio queda sobre la rampa, en 70 mm.
  const e = estadoInicial({ x: 250, y: 150, yaw: 0 }, ROBOT_POR_DEFECTO, RAMPA());
  expect(e.pitch).toBeCloseTo(-Math.atan2(20 * Math.tan(20 * GRADOS) + sobreRampa(27.5, 20 * GRADOS), 70), 3);
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
  // Sin ruedas locas, el chasis se apoya en su frente y su cola: la rampa exacta.
  const arrastra = estadoInicial({ x: 450, y: 150, yaw: 0 }, sinLocas(), mundo);
  expect(arrastra.pitch).toBeCloseTo(-20 * GRADOS, 3);
  expect(arrastra.z).toBeCloseTo(150 * Math.tan(20 * GRADOS), 1);
  // Con ruedas, el eje queda 1,9 mm más arriba (su radio sobre la rampa). Las locas son 2,5 mm más
  // chicas, así que su centro queda un poco menos arriba: el robot se ve 0,13° menos inclinado.
  const e = estadoInicial({ x: 450, y: 150, yaw: 0 }, ROBOT_POR_DEFECTO, mundo);
  expect(e.pitch).toBeCloseTo(-20 * GRADOS, 2);
  expect(e.z).toBeCloseTo(150 * Math.tan(20 * GRADOS) + sobreRampa(30, 20 * GRADOS), 1);
  expect(e.roll).toBeCloseTo(0, 6);
});
