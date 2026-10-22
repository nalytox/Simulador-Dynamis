import { it, expect } from 'vitest';
import { buscarAjustables, conAjustables, formatearValor, reescribirAjustables } from '../../src/compilador/ajustables';
import type { Proyecto } from '../../src/proyecto/proyecto';

const INO = [
  'float kp = 0.08;  // @ajustar siguelineas',
  'const int VEL = 100; // rápido @ajustar siguelineas 50..200',
  '#define KD 0.6 // @ajustar siguelineas',
  'int sinMarca = 3;  // ajustar a mano',
  'void setup() {}',
  'void loop() {}',
].join('\n');
const CONFIG = ['#pragma once', '#define N 3 // @ajustar mio', ''].join('\n');
const proyecto = (archivos: Record<string, string> = { 'robot.ino': INO, 'config.h': CONFIG }): Proyecto => ({ nombre: 'robot', archivos });

it('encuentra variables y #define marcados, con grupo y rango', () => {
  const { parametros, avisos } = buscarAjustables(proyecto());
  expect(avisos).toEqual([]);
  expect(parametros).toEqual([
    { id: 'siguelineas.kp', grupo: 'siguelineas', nombre: 'kp', valor: 0.08, entero: false, min: null, max: null, archivo: 'robot.ino', linea: 1, forma: 'variable' },
    { id: 'siguelineas.VEL', grupo: 'siguelineas', nombre: 'VEL', valor: 100, entero: true, min: 50, max: 200, archivo: 'robot.ino', linea: 2, forma: 'variable' },
    { id: 'siguelineas.KD', grupo: 'siguelineas', nombre: 'KD', valor: 0.6, entero: false, min: null, max: null, archivo: 'robot.ino', linea: 3, forma: 'define' },
    { id: 'mio.N', grupo: 'mio', nombre: 'N', valor: 3, entero: true, min: null, max: null, archivo: 'config.h', linea: 2, forma: 'define' },
  ]);
});

it('acepta signos, exponentes, sufijos y otros tipos', () => {
  const { parametros } = buscarAjustables(proyecto({ 'a.ino': [
    'static volatile double a = -1.5e-2; // @ajustar g -1..0',
    'uint8_t b = 7u; // @ajustar g',
    'float c = 2.f;  // @ajustar g',
    'unsigned long d = 1000UL; // @ajustar g',
  ].join('\n') }));
  expect(parametros.map(p => [p.nombre, p.valor, p.entero, p.min, p.max])).toEqual([
    ['a', -0.015, false, -1, 0], ['b', 7, true, null, null], ['c', 2, false, null, null], ['d', 1000, true, null, null],
  ]);
});

it('constexpr, marcas sueltas e ids repetidos dan avisos y no se transforman', () => {
  const texto = ['constexpr float kp = 1.0; // @ajustar a', 'Serial.println(x); // @ajustar a', 'float kp = 2; // @ajustar a', 'float kp = 3; // @ajustar a'].join('\n');
  const p = proyecto({ 'a.ino': texto });
  const { parametros, avisos } = buscarAjustables(p);
  expect(parametros.map(x => [x.id, x.linea])).toEqual([['a.kp', 3]]);
  expect(avisos).toEqual([
    { archivo: 'a.ino', linea: 1, mensaje: 'kp está marcado con @ajustar pero es constexpr: no puede cambiar mientras corre el programa. Quita constexpr para ajustarlo.' },
    { archivo: 'a.ino', linea: 2, mensaje: 'La marca @ajustar de esta línea debe ir junto a una variable con un número (float kp = 0.5;) o a un #define con un número.' },
    { archivo: 'a.ino', linea: 4, mensaje: 'El valor a.kp está marcado dos veces: se usa el primero.' },
  ]);
  const lineas = conAjustables(p).archivos['a.ino'].split('\n');
  expect(lineas[0]).toBe('constexpr float kp = 1.0; // @ajustar a');
  expect(lineas[1]).toBe('Serial.println(x); // @ajustar a');
  expect(lineas[3]).toBe('float kp = 3; // @ajustar a');
});

it('conAjustables transforma sin cambiar la cantidad de líneas', () => {
  const p = proyecto({ ...proyecto().archivos, 'util.cpp': 'int x = 1;\n' });
  const t = conAjustables(p);
  const lineas = t.archivos['robot.ino'].split('\n');
  expect(lineas[0]).toBe('float kp = __dyn_ajustable("siguelineas", "kp", 0.08);  // @ajustar siguelineas');
  expect(lineas[1]).toBe('const int VEL = __dyn_ajustable("siguelineas", "VEL", 100); // rápido @ajustar siguelineas 50..200');
  expect(lineas[2]).toBe('#define KD (__dyn_ajustable("siguelineas", "KD", 0.6)) // @ajustar siguelineas');
  expect(t.archivos['config.h'].split('\n')[1]).toBe('#define N (__dyn_ajustable("mio", "N", 3)) // @ajustar mio');
  for (const ruta of Object.keys(p.archivos)) expect(t.archivos[ruta].split('\n').length).toBe(p.archivos[ruta].split('\n').length);
  expect(t.archivos['util.cpp']).toBe(p.archivos['util.cpp']);
  expect(p.archivos['robot.ino']).toBe(INO);
});

it('una variable sin marca, o un comentario que menciona ajustar, no se toca', () => {
  const texto = 'int sinMarca = 3;  // ajustar a mano\nfloat y = 2; // hay que @ajustarlo después';
  expect(conAjustables(proyecto({ 'a.ino': texto })).archivos['a.ino']).toBe(texto);
  expect(buscarAjustables(proyecto({ 'a.ino': texto })).parametros).toEqual([]);
});

it('reescribirAjustables cambia solo el número y respeta enteros y reales', () => {
  const r = reescribirAjustables(proyecto(), { 'siguelineas.kp': 0.123456, 'siguelineas.VEL': 120.6, 'siguelineas.KD': 2 });
  const lineas = r.proyecto.archivos['robot.ino'].split('\n');
  expect(lineas[0]).toBe('float kp = 0.1235;  // @ajustar siguelineas');
  expect(lineas[1]).toBe('const int VEL = 121; // rápido @ajustar siguelineas 50..200');
  expect(lineas[2]).toBe('#define KD 2.0 // @ajustar siguelineas');
  expect(r.cambiadas).toEqual([{ archivo: 'robot.ino', linea: 1 }, { archivo: 'robot.ino', linea: 2 }, { archivo: 'robot.ino', linea: 3 }]);
  expect(r.faltan).toEqual([]);
  expect(r.proyecto.archivos['config.h']).toBe(CONFIG);
});

it('reescribirAjustables encuentra una marca que cambió de línea e informa las que faltan', () => {
  const editado = ['// nuevo', '// otro', ...INO.split('\n').filter(l => !l.includes('KD'))].join('\n');
  const r = reescribirAjustables(proyecto({ 'robot.ino': editado }), { 'siguelineas.kp': 0.2, 'siguelineas.KD': 1.5 });
  const lineas = r.proyecto.archivos['robot.ino'].split('\n');
  expect(lineas[2]).toBe('float kp = 0.2;  // @ajustar siguelineas');
  expect(r.cambiadas).toEqual([{ archivo: 'robot.ino', linea: 3 }]);
  expect(r.faltan).toEqual(['siguelineas.KD']);
  expect(lineas.filter((l, i) => l !== editado.split('\n')[i])).toEqual([lineas[2]]);
});

it('formatearValor', () => {
  expect(formatearValor(0.0001234567, false)).toBe('0.0001235');
  expect(formatearValor(3, false)).toBe('3.0');
  expect(formatearValor(2.5, true)).toBe('3');
  expect(formatearValor(-1.25, false)).toBe('-1.25');
  expect(formatearValor(123456.7, false)).toBe('123500.0');
});
