import { it, expect } from 'vitest';
import { crearSuperficie } from '../../src/mundo/superficie';
import { pistaDe } from '../ayuda/pistas';

const NEGRO = { r: 0, g: 0, b: 0 };
const BLANCO = { r: 255, g: 255, b: 255 };

/** Superficie de una pista de 1 × 1 con una sola baldosa. */
const sup = (tipo: string, props: Record<string, unknown> = {}, rot = 0) =>
  crearSuperficie(pistaDe({ columnas: 1, filas: 1, baldosas: [{ c: 0, r: 0, tipo, rot, props }] }));

it('recta: cinta de 19 mm centrada', () => {
  const s = sup('recta');
  expect([140, 141, 159, 160].map(v => s.esLinea(150, v))).toEqual([false, true, true, false]);
  expect(s.color(150, 150)).toEqual(NEGRO); expect(s.color(150, 50)).toEqual(BLANCO);
});

it('recta rotada 90° es vertical', () => {
  const s = sup('recta', {}, 90);
  expect(s.esLinea(150, 20)).toBe(true); expect(s.esLinea(20, 150)).toBe(false);
});

it('giro suave: cuarto de círculo de radio 150 hacia el norte', () => {
  const s = sup('giroSuave');
  expect([[1, 150], [106, 194], [150, 299]].every(([u, v]) => s.esLinea(u, v))).toBe(true);
  expect(s.esLinea(150, 150)).toBe(false); expect(s.esLinea(116, 183)).toBe(false); // radio ≈ 165
});

it('giro en L', () => {
  const s = sup('giroL');
  expect([s.esLinea(75, 150), s.esLinea(150, 225), s.esLinea(225, 150), s.esLinea(150, 75)]).toEqual([true, true, false, false]);
});

it('cortes: guiones de 50 y espacios de 40 mm, sin espacio mayor que 4 cm', () => {
  const s = sup('cortes');
  expect([25, 70, 115, 160, 205, 250, 285].map(u => s.esLinea(u, 150))).toEqual([true, false, true, false, true, false, true]);
  let hueco = 0, maximo = 0;
  for (let u = 0; u < 300; u++) { hueco = s.esLinea(u, 150) ? 0 : hueco + 1; maximo = Math.max(maximo, hueco); }
  expect(maximo).toBe(40);
});

it('partida y meta', () => {
  const p = sup('partida'); expect(p.esLinea(290, 100)).toBe(true);
  const m = sup('meta'); expect([m.esLinea(75, 150), m.esLinea(200, 150), m.esLinea(150, 100)]).toEqual([true, false, true]);
});

it('invertida: cinta blanca sobre fondo negro, y sigue siendo línea', () => {
  const s = sup('recta', { invertida: true });
  expect(s.color(150, 150)).toEqual(BLANCO); expect(s.esLinea(150, 150)).toBe(true); expect(s.color(150, 50)).toEqual(NEGRO);
});

it('fuera de la grilla y celdas sin baldosa: fondo blanco', () => {
  const s = crearSuperficie(pistaDe({ columnas: 2, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'recta' }] }));
  expect([s.color(-5, 150), s.color(450, 150), s.color(700, 150)]).toEqual([BLANCO, BLANCO, BLANCO]);
  expect(s.esLinea(-5, 150)).toBe(false);
});
