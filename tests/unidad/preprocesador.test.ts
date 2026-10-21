import { describe, it, expect } from 'vitest';
import { prepararUnidades, ErrorProyecto } from '../../src/compilador/preprocesador';
import type { Proyecto } from '../../src/proyecto/proyecto';

const p: Proyecto = { nombre: 'robot', archivos: {
  'robot.ino': '﻿#include "pines.h"\r\nvoid setup() { avanzar(); }\r\nvoid loop() {}\r\n',
  'motores.ino': '// ¡Motores! ñandú\nvoid avanzar() { analogWrite(PWM_IZQ, 200); }\n',
  'pines.h': '#define PWM_IZQ 18\n', 'src/filtro.cpp': 'int f() { return 1; }\n', 'util.c': 'int g(void) { return 2; }\n' } };

describe('prepararUnidades', () => {
  it('crea una unidad para el sketch, otra por cada .cpp y otra por cada .c', () =>
    expect(prepararUnidades(p).map(u => [u.ruta, u.lenguaje])).toEqual([['robot.ino.cpp', 'c++'], ['src/filtro.cpp', 'c++'], ['util.c', 'c']]));
  it('incluye Arduino.h, inserta prototipos y conserva la numeración', () => {
    const [u] = prepararUnidades(p);
    const lineas = u.codigo.split('\n');
    expect(lineas[0]).toBe('#include <Arduino.h>');
    expect(lineas[1]).toBe('#line 1 "robot.ino"');
    expect(u.codigo).toContain('void avanzar();');
    expect(u.codigo).not.toMatch(/[\r﻿]/);
    const i = lineas.findIndex(l => l.startsWith('void setup() {'));
    expect(lineas[i - 1]).toBe('#line 2 "robot.ino"');
    expect(u.codigo.indexOf('#line 1 "motores.ino"')).toBeGreaterThan(u.codigo.indexOf('void loop()'));
    expect(u.codigo).toContain('// ¡Motores! ñandú');
  });
  it('sin .ino lanza un error claro', () => {
    expect(() => prepararUnidades({ nombre: 'x', archivos: { 'a.h': '' } })).toThrow(ErrorProyecto);
    expect(() => prepararUnidades({ nombre: 'x', archivos: { 'a.h': '' } })).toThrow('Tu proyecto no tiene ningún archivo .ino');
  });
  it('cada prototipo lleva su propio #line', () => {
    const [u] = prepararUnidades(p);
    expect(u.codigo).toContain('#line 2 "motores.ino"\nvoid avanzar();');
    expect(u.codigo).toContain('#line 2 "robot.ino"\nvoid setup();');
  });
  it('solo compila los .cpp y .c de la raíz y de src/', () => {
    const q: Proyecto = { nombre: 'r', archivos: { 'r.ino': 'void setup() {}\nvoid loop() {}\n', 'respaldo/viejo.cpp': 'void setup() {}\n', 'src/a/b.cpp': '', 'x.cpp': '' } };
    expect(prepararUnidades(q).map(u => u.ruta)).toEqual(['r.ino.cpp', 'src/a/b.cpp', 'x.cpp']);
  });
  it('inserta los prototipos después de un #ifdef inicial', () => {
    const [u] = prepararUnidades({ nombre: 'r', archivos: { 'r.ino': '#ifdef DEPURAR\nvoid depurar() {}\n#endif\nvoid setup() { avanzar(); }\nvoid loop() {}\nvoid avanzar() {}\n' } });
    const lineas = u.codigo.split('\n');
    expect(lineas.indexOf('void avanzar();')).toBeGreaterThan(lineas.indexOf('#endif'));
  });
});
