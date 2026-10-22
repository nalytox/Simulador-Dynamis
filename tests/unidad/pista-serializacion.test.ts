import { it, expect } from 'vitest';
import { normalizarPista, leerPista, escribirPista, pistaVacia, poseInicial } from '../../src/pista/serializacion';
import { puntosDePartida } from '../../src/pista/puntos';
import { pistaDe } from '../ayuda/pistas';

it('completa los valores por defecto', () => {
  const r = normalizarPista({ version: 1, nombre: 'a', tamanoBaldosa: 300, columnas: 2, filas: 1, inicio: { x: 150, y: 150, yaw: 0 },
    baldosas: [{ c: 0, r: 0, tipo: 'cortes' }, { c: 1, r: 0, tipo: 'unionT', rot: 90 }], objetos: [{ tipo: 'hito', x: 1, y: 2, rot: 0, props: { numero: 1 } }] });
  expect(r.ok && r.pista.baldosas).toEqual([
    { c: 0, r: 0, rot: 0, nivel: 0, tipo: 'cortes', props: { invertida: false, guion: 50, espacio: 40 } },
    { c: 1, r: 0, rot: 90, nivel: 0, tipo: 'unionT', props: { invertida: false, marcas: { ai: false, ad: false, di: false, dd: false }, rama: 'izq' } }]);
  expect(r.ok && r.pista.ambiente).toEqual({ luz: 'normal' });
  expect(r.ok && r.pista.objetos[0]).toEqual({ tipo: 'hito', x: 1, y: 2, rot: 0, props: { numero: 1, yaw: 0 } });
});

it('ida y vuelta por JSON deja la pista igual', () => {
  const p = pistaDe({ columnas: 3, filas: 2, baldosas: [{ c: 2, r: 1, tipo: 'rampa', props: { angulo: 25 } }] });
  expect(leerPista(escribirPista(p))).toEqual({ ok: true, pista: p });
});

it('pistaVacia es de 8 × 6 y poseInicial pasa a radianes', () => {
  expect(pistaVacia()).toMatchObject({ columnas: 8, filas: 6, baldosas: [], objetos: [] });
  expect(poseInicial(pistaDe({ columnas: 1, filas: 1, inicio: { x: 10, y: 20, yaw: 90 } }))).toEqual({ x: 10, y: 20, yaw: Math.PI / 2 });
});

it('informa todos los problemas sin lanzar', () => {
  expect(leerPista('{nope')).toEqual({ ok: false, errores: ['El archivo no es una pista válida (no es JSON).'] });
  const r = normalizarPista({ version: 1, nombre: 'a', tamanoBaldosa: 250, filas: 1, inicio: { x: 0, y: 0, yaw: 0 }, ambiente: { luz: 'rara' },
    baldosas: [{ c: 0, r: 0, tipo: 'puente' }, { c: 9, r: 0, tipo: 'recta' }, { c: 1, r: 0, tipo: 'recta', rot: 45 }, { c: 1, r: 0, tipo: 'recta' }],
    objetos: [{ tipo: 'pelota', x: 0, y: 0, rot: 0 }, { tipo: 'hito', x: 0, y: 0, rot: 0, props: {} }] });
  expect(r.ok).toBe(false);
  expect(!r.ok && r.errores).toEqual(expect.arrayContaining([
    'Falta "columnas".',
    'Por ahora las baldosas miden 30 cm: tamanoBaldosa debe ser 300.',
    'La luz del ambiente debe ser "normal", "fuerte" o "tenue".',
    'La baldosa en (0, 0) tiene un tipo desconocido: "puente".',
    'La baldosa en (1, 0) tiene rot 45: usa 0, 90, 180 o 270.',
    'Hay dos baldosas en (1, 0).',
    'El objeto 1 tiene un tipo desconocido: "pelota".',
    'El objeto 2 (hito) no tiene número.']));
  expect(normalizarPista({ version: 2 })).toMatchObject({ ok: false, errores: expect.arrayContaining(['Esta pista es de una versión desconocida (version: 2).']) });
  expect(normalizarPista({ version: 1, nombre: 'a', tamanoBaldosa: 300, columnas: 8, filas: 6, inicio: { x: 0, y: 0, yaw: 0 }, baldosas: [{ c: 9, r: 0, tipo: 'recta' }] }))
    .toMatchObject({ ok: false, errores: ['La baldosa en (9, 0) queda fuera de la grilla de 8 × 6.'] });
});

it('los puntos de desafío necesitan nombre y hito siguiente', () => {
  const r = normalizarPista({ version: 1, nombre: 'a', tamanoBaldosa: 300, columnas: 1, filas: 1, inicio: { x: 0, y: 0, yaw: 0 },
    objetos: [{ tipo: 'desafio', x: 600, y: 150, rot: 0, props: { nombre: 'F1', hitoSiguiente: 2 } }, { tipo: 'desafio', x: 0, y: 0, rot: 0, props: {} }] });
  expect(r).toEqual({ ok: false, errores: ['El objeto 2 (desafío) no tiene nombre.', 'El objeto 2 (desafío) no dice cuál es el hito siguiente.'] });
});

it('puntos de partida en el orden del recorrido', () => {
  const p = pistaDe({ columnas: 4, filas: 1, objetos: [
    { tipo: 'hito', x: 750, y: 150, rot: 0, props: { numero: 2 } },
    { tipo: 'desafio', x: 600, y: 150, rot: 0, props: { nombre: 'F1', hitoSiguiente: 2, yaw: 90 } },
    { tipo: 'hito', x: 450, y: 150, rot: 0, props: { numero: 1 } }] });
  expect(puntosDePartida(p).map(q => [q.id, q.nombre, q.hitoSiguiente]))
    .toEqual([['partida', 'Partida', 1], ['hito-1', 'Hito 1', 2], ['desafio-F1', 'F1', 2], ['hito-2', 'Hito 2', 3]]);
  expect(puntosDePartida(p)[2].pose).toEqual({ x: 600, y: 150, yaw: Math.PI / 2 });
});
