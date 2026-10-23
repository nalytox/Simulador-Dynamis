import { it, expect } from 'vitest';
import { revisarPista } from '../../src/pista/revision';
import type { Pista } from '../../src/pista/tipos';
import { pistaDe } from '../ayuda/pistas';

type Extra = { baldosas?: Record<string, unknown>[]; objetos?: Record<string, unknown>[]; quitarHito?: number; renumerarHito?: [number, number]; [campo: string]: unknown };

/**
 * Pista válida de 4 × 2: partida, recta, recta y meta en la fila de abajo, inicio en la partida y
 * 8 hitos. `extra` reemplaza baldosas en la misma celda, agrega objetos y puede quitar o renumerar un hito.
 */
function base({ baldosas = [], objetos = [], quitarHito, renumerarHito, ...resto }: Extra): Pista {
  const fila = [{ c: 0, r: 0, tipo: 'partida' }, { c: 1, r: 0, tipo: 'recta' }, { c: 2, r: 0, tipo: 'recta' }, { c: 3, r: 0, tipo: 'meta' }];
  const todas = [...fila.filter(b => !baldosas.some(o => o.c === b.c && o.r === b.r)), ...baldosas];
  const hitos = [1, 2, 3, 4, 5, 6, 7, 8]
    .filter(n => n !== quitarHito)
    .map(n => ({ tipo: 'hito', x: 450, y: 150, rot: 0, props: { numero: renumerarHito?.[0] === n ? renumerarHito[1] : n } }));
  return pistaDe({ columnas: 4, filas: 2, baldosas: todas, objetos: [...hitos, ...objetos], ...resto });
}

const mensajes = (p: Pista) => revisarPista(p).map(a => a.mensaje);

it('una pista correcta no tiene avisos', () => expect(revisarPista(base({}))).toEqual([]));

it('cortes, rampa y bache fuera de las reglas', () => {
  const p = base({ baldosas: [{ c: 1, r: 1, tipo: 'cortes', props: { espacio: 50 } }, { c: 2, r: 1, tipo: 'rampa', props: { angulo: 40 } }],
    objetos: [{ tipo: 'bache', x: 450, y: 450, rot: 0, props: { largo: 350 } }] });
  expect(mensajes(p)).toEqual(expect.arrayContaining(['Los cortes de esta baldosa miden 5 cm; las bases permiten hasta 4 cm.',
    'Esta rampa sube 40°; las bases permiten hasta 35°.', 'Este bache mide 35 cm; las bases permiten hasta 30 cm.']));
  expect(revisarPista(p).find(a => a.mensaje.startsWith('Esta rampa'))!.baldosas).toEqual([{ c: 2, r: 1 }]);
});

it('escalón al final de una rampa, pero no a sus costados', () => {
  const alto = 300 * Math.tan(20 * Math.PI / 180);
  const conRampa = (nivel: number) => base({ baldosas: [{ c: 1, r: 0, tipo: 'rampa' }, { c: 2, r: 0, tipo: 'recta', nivel }, { c: 3, r: 0, tipo: 'meta', nivel }] });
  expect(mensajes(conRampa(0))).toContain('Hay un escalón de 10,9 cm entre estas baldosas.');
  expect(mensajes(conRampa(alto)).filter(m => m.startsWith('Hay un escalón'))).toEqual([]);
});

it('obstáculo cerca de un giro en L', () => {
  const conL = (x: number) => base({ baldosas: [{ c: 1, r: 0, tipo: 'giroL' }], objetos: [{ tipo: 'obstaculo', x, y: 150, rot: 0 }] });
  expect(mensajes(conL(680))).toContain('El obstáculo está a 18 cm de un giro en L; las bases piden más de 25 cm.');
  expect(mensajes(conL(760)).some(m => m.startsWith('El obstáculo'))).toBe(false);
});

it('hitos: cantidad y numeración', () => {
  expect(mensajes(base({ quitarHito: 8 }))).toContain('La pista tiene 7 hitos; las bases piden 8.');
  expect(mensajes(base({ renumerarHito: [8, 7] }))).toContain('Los hitos deben estar numerados del 1 al 8, sin repetir.');
});

it('partida, meta e inicio', () => {
  const p = pistaDe({ columnas: 2, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'recta' }], inicio: { x: 450, y: 150, yaw: 0 } });
  expect(mensajes(p)).toEqual(expect.arrayContaining(['La pista necesita una baldosa de partida.', 'La pista necesita una baldosa de meta.']));
  expect(mensajes(base({ inicio: { x: 450, y: 150, yaw: 0 } }))).toContain('El robot debe empezar dentro de la baldosa de partida.');
});

it('desafíos: nombres repetidos y un hito siguiente que no existe', () => {
  const p = base({ objetos: [{ tipo: 'desafio', x: 600, y: 150, rot: 0, props: { nombre: 'F1', hitoSiguiente: 2 } },
    { tipo: 'desafio', x: 650, y: 150, rot: 0, props: { nombre: 'F1', hitoSiguiente: 10 } }] });
  expect(mensajes(p)).toEqual(expect.arrayContaining(['Hay dos desafíos llamados F1.', 'F1 dice que después viene el hito 10, pero la pista tiene 8 hitos.']));
  expect(mensajes(base({ objetos: [{ tipo: 'desafio', x: 1000, y: 150, rot: 0, props: { nombre: 'F4', hitoSiguiente: 9 } }] }))).toEqual([]);
});

it('unión en T: la marca pide un lado sin camino', () => {
  const p = base({ baldosas: [{ c: 1, r: 0, tipo: 'unionT', props: { rama: 'izq', marcas: { ai: false, ad: true, di: false, dd: false } } }] });
  expect(mensajes(p)).toContain('La marca pide girar a la derecha, pero esta unión en T no tiene camino a la derecha.');
});
