import { it, expect } from 'vitest';
import { PISTAS_DE_EJEMPLO, PROYECTOS_DE_EJEMPLO, PROYECTO_INICIAL, type IdPista } from '../../src/ejemplos';
import { revisarPista } from '../../src/pista/revision';
import { accionEsperada } from '../../src/pista/catalogo';
import type { Pista } from '../../src/pista/tipos';
import { entradasDe, recorridoEsperado } from '../ayuda/recorrido';

const pista = (id: IdPista): Pista => PISTAS_DE_EJEMPLO.find(p => p.id === id)!.pista;
const hitos = (p: Pista) => p.objetos.flatMap(o => (o.tipo === 'hito' ? [o.props.numero] : [])).sort((a, b) => a - b);

it('las pistas de ejemplo, con sus nombres', () => {
  expect(PISTAS_DE_EJEMPLO.map(p => [p.id, p.pista.nombre])).toEqual([
    ['practica', 'Práctica FIRVI'], ['cruces', 'Cruces con marcas'], ['rampa', 'Rampa y baches'], ['circuito', 'Circuito'],
    ['completa', 'Pista completa'],
  ]);
  for (const id of ['practica', 'cruces', 'rampa'] as const) expect([pista(id).columnas, pista(id).filas]).toEqual([8, 6]);
});

it('el Circuito es una vuelta cerrada con curvas a los dos lados y sin meta', () => {
  const p = pista('circuito');
  // Es para dar vueltas, no una pista de competencia: las bases piden hitos y meta, y esta no los tiene.
  expect(revisarPista(p).map(a => a.mensaje)).toEqual(['La pista tiene 0 hitos; las bases piden 8.', 'La pista necesita una baldosa de meta.']);
  expect(p.baldosas.filter(b => b.tipo === 'partida')).toHaveLength(1);
  // Las curvas suaves conectan bocas que giran hacia los dos lados: a lo largo de la vuelta hay giros a la izquierda y a la derecha.
  expect(p.baldosas.filter(b => b.tipo === 'giroSuave').length).toBeGreaterThanOrEqual(5);
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

it('la Pista completa trae todos los casos y cumple las bases', () => {
  const p = pista('completa');
  expect(revisarPista(p)).toEqual([]);
  expect(hitos(p)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  const recorrido = recorridoEsperado(p);
  expect(recorrido.at(-1)!.tipo).toBe('meta');
  const tipos = new Set(recorrido.map(b => b.tipo));
  for (const t of ['cortes', 'cruce', 'unionT', 'giroL', 'giroSuave', 'rampa', 'indicadorF2', 'cuadradoF1'] as const) expect(tipos.has(t), t).toBe(true);
  expect(recorrido.some(b => b.props.invertida)).toBe(true);
  // Cruces y uniones en T: girar a cada lado, seguir recto y la vuelta en U (que vuelve a pasar por un cruce).
  const cruces = p.baldosas.flatMap(b => (b.tipo === 'cruce' || b.tipo === 'unionT' ? [accionEsperada(b)] : []));
  for (const a of ['izq', 'der', 'recto', 'vuelta'] as const) expect(cruces, a).toContain(a);
  expect(new Set(recorrido.map(b => `${b.c},${b.r}`)).size).toBeLessThan(recorrido.length);
  const entradas = entradasDe(recorrido);
  const rampas = recorrido.flatMap((b, i) => (b.tipo === 'rampa' ? [entradas[i] === 'oeste' ? 'sube' : 'baja'] : []));
  expect(rampas).toEqual(['sube', 'baja']);
  const baches = p.objetos.flatMap(o => (o.tipo === 'bache' ? [o.rot % 90] : []));
  expect(baches.sort()).toEqual([0, 45]);
  expect(p.objetos.filter(o => o.tipo === 'obstaculo')).toHaveLength(1);
  // F2: sus decisiones son las de los dos cruces que vienen y la del cuadrado F1.
  const desdeF2 = recorrido.slice(recorrido.findIndex(b => b.tipo === 'indicadorF2'));
  const f2 = desdeF2[0];
  if (f2.tipo !== 'indicadorF2') throw new Error('sin F2');
  const siguientes = desdeF2.filter(b => b.tipo === 'cruce').slice(0, 2).map(b => accionEsperada(b));
  const f1 = desdeF2.find(b => b.tipo === 'cuadradoF1');
  expect(f2.props.decisiones).toEqual([...siguientes, f1?.tipo === 'cuadradoF1' ? f1.props.correcto : null]);
});
