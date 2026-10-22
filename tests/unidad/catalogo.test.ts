import { it, expect } from 'vitest';
import { accionEsperada, bocasDe, salidaEsperada } from '../../src/pista/catalogo';
import type { Marcas } from '../../src/pista/tipos';
import { pistaDe } from '../ayuda/pistas';

it.each([
  [{ ai: true, ad: false, di: false, dd: false }, 'izq'], [{ ai: false, ad: true, di: false, dd: false }, 'der'],
  [{ ai: true, ad: true, di: false, dd: false }, 'vuelta'], [{ ai: false, ad: false, di: true, dd: true }, 'recto'],
  [{ ai: true, ad: true, di: true, dd: true }, 'vuelta'],
])('accionEsperada(%o) = %s', (marcas, accion) =>
  expect(accionEsperada(pistaDe({ columnas: 1, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'cruce', props: { marcas } }] }).baldosas[0])).toBe(accion));

it('la acción elegida a mano gana a la deducida', () => expect(accionEsperada(pistaDe({ columnas: 1, filas: 1,
  baldosas: [{ c: 0, r: 0, tipo: 'cruce', props: { marcas: { ai: true, ad: false, di: false, dd: false }, accion: 'recto' } }] }).baldosas[0])).toBe('recto'));

it('las piezas sin decisión no tienen acción', () =>
  expect(accionEsperada(pistaDe({ columnas: 1, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'recta' }] }).baldosas[0])).toBeNull());

it('bocas de la T según la rama', () =>
  expect(bocasDe(pistaDe({ columnas: 1, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'unionT', props: { rama: 'der' } }] }).baldosas[0]))
    .toEqual(['oeste', 'este', 'sur']));

const cruce = (marcas: Partial<Marcas>) => pistaDe({ columnas: 1, filas: 1,
  baldosas: [{ c: 0, r: 0, tipo: 'cruce', props: { marcas: { ai: false, ad: false, di: false, dd: false, ...marcas } } }] }).baldosas[0];

it.each([
  ['oeste', { ad: true }, 'sur'], ['sur', { ad: true }, 'oeste'], ['este', { dd: true }, 'sur'],
  ['norte', { di: true }, 'este'], ['sur', {}, 'norte'], ['norte', { ai: true, di: true }, 'norte'],
] as const)('cruce entrando por %s con %o: sale por %s', (entrada, marcas, salida) =>
  expect(salidaEsperada(cruce(marcas), entrada)).toBe(salida));

it('T por la rama: la marca de antes indica el giro; sin marca no hay salida posible', () => {
  const t = (marcas: Partial<Marcas>) => pistaDe({ columnas: 1, filas: 1,
    baldosas: [{ c: 0, r: 0, tipo: 'unionT', props: { rama: 'izq', marcas: { ai: false, ad: false, di: false, dd: false, ...marcas } } }] }).baldosas[0];
  expect(salidaEsperada(t({ di: true }), 'norte')).toBe('este');
  expect(salidaEsperada(t({ ai: true }), 'norte')).toBe('oeste');
  expect(salidaEsperada(t({}), 'norte')).toBeNull();
});
