import { it, expect } from 'vitest';
import { aLocal, aMundo, celdaDe, ladoEnMundo } from '../../src/pista/baldosas';
import type { Lado } from '../../src/pista/tipos';

it('aMundo y aLocal son inversas y rotan en sentido antihorario', () => {
  expect(aMundo({ c: 1, r: 0, rot: 90 }, 10, 150)).toEqual({ x: 450, y: 10 });
  expect(aMundo({ c: 0, r: 0, rot: 180 }, 10, 150)).toEqual({ x: 290, y: 150 });
  const b = { c: 1, r: 2, rot: 270 as const }, w = aMundo(b, 37, 212);
  expect(aLocal(b, w.x, w.y)).toEqual({ u: 37, v: 212 });
});

it('ladoEnMundo gira los bordes con la pieza', () => {
  expect(['oeste', 'este', 'norte', 'sur'].map(l => ladoEnMundo({ c: 0, r: 0, rot: 90 }, l as Lado))).toEqual(['sur', 'norte', 'oeste', 'este']);
});

it('celdaDe: el borde pertenece a la baldosa siguiente', () => expect(celdaDe(300, 299.9)).toEqual({ c: 1, r: 0 }));
