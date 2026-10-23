import { it, expect } from 'vitest';
import { PISTAS_DE_EJEMPLO, PROYECTOS_DE_EJEMPLO, PROYECTO_INICIAL, type IdPista } from '../../src/ejemplos';
import { revisarPista } from '../../src/pista/revision';
import { accionEsperada } from '../../src/pista/catalogo';
import type { Pista } from '../../src/pista/tipos';
import { entradasDe, recorridoEsperado } from '../ayuda/recorrido';

const pista = (id: IdPista): Pista => PISTAS_DE_EJEMPLO.find(p => p.id === id)!.pista;
const hitos = (p: Pista) => p.objetos.flatMap(o => (o.tipo === 'hito' ? [o.props.numero] : [])).sort((a, b) => a - b);

it('hay tres pistas de ejemplo con los nombres de la spec', () => {
  expect(PISTAS_DE_EJEMPLO.map(p => [p.id, p.pista.nombre])).toEqual([
    ['practica', 'Práctica FIRVI'], ['cruces', 'Cruces con marcas'], ['rampa', 'Rampa y baches'],
  ]);
  for (const { pista: p } of PISTAS_DE_EJEMPLO) expect([p.columnas, p.filas]).toEqual([8, 6]);
});

it('las pistas nuevas cumplen las bases', () => {
  for (const id of ['cruces', 'rampa'] as const) {
    expect(revisarPista(pista(id)), id).toEqual([]);
    expect(hitos(pista(id)), id).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  }
});

it('Cruces con marcas tiene lo que promete', () => {
  const recorrido = recorridoEsperado(pista('cruces'));
  expect(recorrido.at(-1)!.tipo).toBe('meta');
  const acciones = recorrido.flatMap(b => (b.tipo === 'cruce' || b.tipo === 'unionT' ? [accionEsperada(b)] : []));
  expect(acciones).toContain('recto');
  expect(acciones).toContain('izq');
  expect(acciones).toContain('der');
  expect(recorrido.some(b => b.tipo === 'cortes')).toBe(true);
  const todas = pista('cruces').baldosas.flatMap(b => (b.tipo === 'cruce' || b.tipo === 'unionT' ? [accionEsperada(b)] : []));
  expect(todas).not.toContain('vuelta');
});

it('Rampa y baches tiene lo que promete', () => {
  const p = pista('rampa');
  const recorrido = recorridoEsperado(p);
  expect(recorrido.at(-1)!.tipo).toBe('meta');
  const entradas = entradasDe(recorrido);
  // Una rampa sube hacia su borde este: entrar por el oeste es subir; por el este, bajar.
  const rampas = recorrido.flatMap((b, i) => (b.tipo === 'rampa' ? [entradas[i] === 'oeste' ? 'sube' : 'baja'] : []));
  expect(rampas).toContain('sube');
  expect(rampas).toContain('baja');
  expect(p.objetos.filter(o => o.tipo === 'bache').length).toBeGreaterThanOrEqual(2);
  expect(p.objetos.filter(o => o.tipo === 'obstaculo').length).toBeGreaterThanOrEqual(1);
});

it('el catálogo de proyectos empieza con el seguidor del comienzo', () => {
  expect(PROYECTOS_DE_EJEMPLO[0]).toMatchObject({ id: 'seguidor', pista: 'practica' });
  expect(PROYECTOS_DE_EJEMPLO[0].proyecto).toEqual(PROYECTO_INICIAL);
  const ids = PISTAS_DE_EJEMPLO.map(p => p.id);
  for (const e of PROYECTOS_DE_EJEMPLO) {
    expect(ids, e.id).toContain(e.pista);
    expect(e.proyecto.nombre).toBe(e.id);
    expect(Object.keys(e.proyecto.archivos), e.id).toContain(`${e.id}.ino`);
  }
});
