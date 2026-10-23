import { it, expect } from 'vitest';
import { escalaY, geometria } from '../../src/ui/grafico';

it('escalaY con 0 y 1000 marca cada 250', () => {
  expect(escalaY(0, 1000)).toEqual({ desde: 0, hasta: 1000, marcas: [0, 250, 500, 750, 1000] });
});

it('escalaY contiene rangos negativos con marcas redondas', () => {
  const e = escalaY(-35, 12);
  expect(e.desde).toBeLessThanOrEqual(-35);
  expect(e.hasta).toBeGreaterThanOrEqual(12);
  expect(e.marcas.length).toBeGreaterThanOrEqual(3);
  expect(e.marcas.length).toBeLessThanOrEqual(7);
  expect(e.marcas).toContain(0);
});

it('escalaY con todos los valores iguales o enormes no divide por cero', () => {
  const igual = escalaY(5, 5);
  expect(igual.desde).toBeLessThan(5);
  expect(igual.hasta).toBeGreaterThan(5);
  expect(igual.marcas.every(Number.isFinite)).toBe(true);
  const enorme = escalaY(0, 3.2e7);
  expect(enorme.hasta).toBeGreaterThanOrEqual(3.2e7);
  expect(enorme.marcas.length).toBeLessThanOrEqual(7);
});

it('geometria pone la prueba 1 en el borde izquierdo y la última en el derecho', () => {
  const g = geometria({ ancho: 600, alto: 260, total: 10, puntos: [{ i: 1, r: 0 }, { i: 10, r: 100 }] });
  expect(g.x(1)).toBe(48);
  expect(g.x(10)).toBe(600 - 50);
  expect(g.y(g.escala.hasta)).toBe(28);
  expect(g.y(g.escala.desde)).toBe(260 - 42);
});

it('el camino del mejor hasta ahora sube solo en los récords', () => {
  const g = geometria({ ancho: 600, alto: 260, total: 5, puntos: [{ i: 1, r: 5 }, { i: 2, r: 3 }, { i: 3, r: 8 }, { i: 4, r: 8 }] });
  expect(g.records).toEqual([1, 3]);
  expect(g.camino.match(/V/g)).toHaveLength(1);
  expect(g.camino.startsWith(`M${g.x(1).toFixed(1)} ${g.y(5).toFixed(1)}`)).toBe(true);
  expect(g.camino.endsWith(`H${g.x(4).toFixed(1)}`)).toBe(true);
  expect(geometria({ ancho: 600, alto: 260, total: 5, puntos: [] }).camino).toBe('');
});
