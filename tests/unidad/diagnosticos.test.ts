import { it, expect } from 'vitest';
import { parsearDiagnosticos } from '../../src/compilador/diagnosticos';

it('lee errores de Clang con su detalle', () => {
  const salida = "seguidor.ino:1:24: error: expected ';' at end of declaration\n    1 | void setup(){ int x = 3\n      |                        ^\n      |                        ;\npines.h:1:9: error: expected expression\n    1 | int a = ;\n      |         ^\n2 errors generated.\n";
  expect(parsearDiagnosticos(salida)).toEqual([
    { archivo: 'seguidor.ino', linea: 1, columna: 24, severidad: 'error', mensaje: "expected ';' at end of declaration", detalle: '    1 | void setup(){ int x = 3\n      |                        ^\n      |                        ;' },
    { archivo: 'pines.h', linea: 1, columna: 9, severidad: 'error', mensaje: 'expected expression', detalle: '    1 | int a = ;\n      |         ^' }]);
});
it('lee advertencias', () =>
  expect(parsearDiagnosticos('a.ino:3:1: warning: non-void function does not return a value [-Wreturn-type]\n')[0]).toMatchObject({ archivo: 'a.ino', linea: 3, severidad: 'advertencia' }));
it('lee errores del enlazador y descarta el resumen', () =>
  expect(parsearDiagnosticos('wasm-ld: error: robot.ino.cpp.o: undefined symbol: loop()\nclang++: error: linker command failed with exit code 1 (use -v to see invocation)\n')).toEqual([
    { archivo: null, linea: null, columna: null, severidad: 'error', mensaje: 'undefined symbol: loop()', detalle: '' }]));
