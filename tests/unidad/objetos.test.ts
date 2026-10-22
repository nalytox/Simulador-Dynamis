import { it, expect } from 'vitest';
import { crearMundo } from '../../src/mundo/pista';
import { huellaRobot, ROBOT_POR_DEFECTO } from '../../src/robot/config';
import { pistaDe } from '../ayuda/pistas';

const caja = { tipo: 'obstaculo', x: 500, y: 150, rot: 0 };

it('raycast contra la cara de una caja', () => {
  const m = crearMundo(pistaDe({ columnas: 4, filas: 1, objetos: [caja] }));
  const h = m.raycast({ x: 0, y: 150, z: 35 }, { x: 1, y: 0, z: 0 }, 2000)!;
  expect(h.distancia).toBeCloseTo(450); expect(h.objeto).toBe(m.pista.objetos[0]); expect(h.normal).toEqual({ x: -1, y: 0, z: 0 });
  expect(m.raycast({ x: 0, y: 150, z: 35 }, { x: 1, y: 0, z: 0 }, 400)).toBeNull();
  expect(m.raycast({ x: 0, y: 150, z: 150 }, { x: 2, y: 0, z: 0 }, 2000)).toBeNull(); // pasa por encima
});

it('raycast contra una caja girada 45°', () => {
  const m = crearMundo(pistaDe({ columnas: 4, filas: 1, objetos: [{ ...caja, rot: 45 }] }));
  const h = m.raycast({ x: 393.934, y: 43.934, z: 50 }, { x: 1, y: 1, z: 0 }, 2000)!;
  expect(h.distancia).toBeCloseTo(100, 1); expect(h.normal.x).toBeCloseTo(-Math.SQRT1_2); expect(h.normal.y).toBeCloseTo(-Math.SQRT1_2);
});

it('raycast ve la subida de la rampa y el suelo', () => {
  const alto = 300 * Math.tan(20 * Math.PI / 180);
  const m = crearMundo(pistaDe({ columnas: 3, filas: 1,
    baldosas: [{ c: 0, r: 0, tipo: 'recta' }, { c: 1, r: 0, tipo: 'rampa' }, { c: 2, r: 0, tipo: 'recta', nivel: alto }] }));
  const h = m.raycast({ x: 0, y: 150, z: 35 }, { x: 1, y: 0, z: 0 }, 2000)!;
  expect(h.distancia).toBeCloseTo(300 + 35 / Math.tan(20 * Math.PI / 180), 0); expect(h.objeto).toBeNull();
  expect(h.normal.x).toBeCloseTo(-Math.sin(20 * Math.PI / 180), 2); expect(h.normal.z).toBeCloseTo(Math.cos(20 * Math.PI / 180), 2);
  expect(m.raycast({ x: 150, y: 150, z: 100 }, { x: 0, y: 0, z: -1 }, 2000))
    .toMatchObject({ distancia: expect.closeTo(100, 1), normal: { x: 0, y: 0, z: 1 } });
});

it('rayos raros: sin dirección, desde adentro de una caja o bajo el suelo', () => {
  const m = crearMundo(pistaDe({ columnas: 4, filas: 1, objetos: [caja] }));
  expect(m.raycast({ x: 0, y: 150, z: 35 }, { x: 0, y: 0, z: 0 }, 2000)).toBeNull();
  expect(m.raycast({ x: 500, y: 150, z: 50 }, { x: 1, y: 0, z: 0 }, 2000)!.distancia).toBe(0);
  const conRampa = crearMundo(pistaDe({ columnas: 3, filas: 1, baldosas: [{ c: 1, r: 0, tipo: 'rampa' }] }));
  expect(conRampa.raycast({ x: 450, y: 150, z: 10 }, { x: 1, y: 0, z: 0 }, 2000)!.distancia).toBe(0); // el suelo ahí está a 54,6 mm
  const h = m.raycast({ x: 500, y: -500, z: 50 }, { x: 0, y: 1, z: 0 }, 2000)!;
  expect(h.distancia).toBeCloseTo(600); expect(Number.isNaN(h.normal.x)).toBe(false);
});

it('colisiona: huella del robot contra el obstáculo, no contra baches ni hitos', () => {
  const m = crearMundo(pistaDe({ columnas: 4, filas: 1, objetos: [caja, { tipo: 'bache', x: 200, y: 150, rot: 90 },
    { tipo: 'hito', x: 900, y: 150, rot: 0, props: { numero: 1 } },
    { tipo: 'desafio', x: 300, y: 150, rot: 0, props: { nombre: 'F1', hitoSiguiente: 1 } }] }));
  expect(m.colisiona(huellaRobot(400, 150, 0, ROBOT_POR_DEFECTO))).toEqual({ objeto: m.pista.objetos[0], penetracion: 46 });
  expect(m.colisiona(huellaRobot(200, 150, 0, ROBOT_POR_DEFECTO))).toBeNull();
  expect(m.colisiona(huellaRobot(900, 150, 0, ROBOT_POR_DEFECTO))).toBeNull();
  expect(m.objetosCerca(300, 150, 210).map(o => o.tipo)).toEqual(['bache', 'obstaculo']);
  expect(m.objetosCerca(300, 150, 100).map(o => o.tipo)).toEqual(['bache']);
});

it('crearMundo reúne superficie, relieve y objetos', () => {
  const m = crearMundo(pistaDe({ columnas: 1, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'recta' }] }));
  expect(m.muestrear(150, 150)).toEqual({ r: 0, g: 0, b: 0 }); expect(m.esLinea(150, 150)).toBe(true);
  expect(m.baldosaEn(150, 150)?.tipo).toBe('recta'); expect(m.baldosaEn(400, 150)).toBeNull(); expect(m.altura(150, 150)).toBe(0);
});
