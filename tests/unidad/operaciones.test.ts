import { describe, it, expect } from 'vitest';
import { aplicar, type Operacion } from '../../src/proyecto/operaciones';
import { ordenarArchivos, type Proyecto } from '../../src/proyecto/proyecto';

const p: Proyecto = { nombre: 'robot', archivos: { 'a.ino': 'void setup() {}\nvoid loop() {}\n', 'b.h': '// b', 'c.h': '// c' } };

describe('operaciones de archivos que se pueden deshacer', () => {
  it('borrar y deshacer devuelve el archivo con su texto y en su lugar', () => {
    const borrado = aplicar(p, { tipo: 'borrar', ruta: 'b.h' });
    expect(Object.keys(borrado.proyecto.archivos)).not.toContain('b.h');
    expect(borrado.inversa).toEqual({ tipo: 'crear', ruta: 'b.h', texto: '// b', indice: 1 });
    const vuelto = aplicar(borrado.proyecto, borrado.inversa);
    expect(vuelto.proyecto.archivos['b.h']).toBe('// b');
    expect(ordenarArchivos(vuelto.proyecto)).toEqual(['a.ino', 'b.h', 'c.h']);
    expect(vuelto.enfocar).toBe('b.h');
  });

  it('deshacer no toca lo que se escribió en los otros archivos después', () => {
    const borrado = aplicar(p, { tipo: 'borrar', ruta: 'b.h' });
    const editado = { ...borrado.proyecto, archivos: { ...borrado.proyecto.archivos, 'c.h': '// c cambiado' } };
    expect(aplicar(editado, borrado.inversa).proyecto.archivos['c.h']).toBe('// c cambiado');
  });

  it('renombrar y deshacer vuelve al nombre, y el programa elegido lo sigue', () => {
    const conPrincipal = { ...p, principal: 'a.ino', orden: ['c.h', 'a.ino', 'b.h'] };
    const r = aplicar(conPrincipal, { tipo: 'renombrar', de: 'a.ino', a: 'robot.ino' });
    expect(r.proyecto.principal).toBe('robot.ino');
    expect(ordenarArchivos(r.proyecto)).toEqual(['c.h', 'robot.ino', 'b.h']);
    const vuelto = aplicar(r.proyecto, r.inversa);
    expect(vuelto.proyecto.principal).toBe('a.ino');
    expect(ordenarArchivos(vuelto.proyecto)).toEqual(['c.h', 'a.ino', 'b.h']);
  });

  it('crear y deshacer lo quita; mover y deshacer recupera el orden; elegir programa y deshacer vuelve al anterior', () => {
    const creado = aplicar(p, { tipo: 'crear', ruta: 'd.h', texto: '#pragma once\n' });
    expect(Object.keys(aplicar(creado.proyecto, creado.inversa).proyecto.archivos)).toEqual(Object.keys(p.archivos));
    const movido = aplicar(p, { tipo: 'mover', orden: ['c.h', 'a.ino', 'b.h'] });
    expect(ordenarArchivos(aplicar(movido.proyecto, movido.inversa).proyecto)).toEqual(['a.ino', 'b.h', 'c.h']);
    const elegido = aplicar(p, { tipo: 'principal', ruta: 'a.ino' });
    expect(aplicar(elegido.proyecto, elegido.inversa).proyecto.principal).toBeUndefined();
  });

  it('la inversa de la inversa rehace la operación', () => {
    const ops: Operacion[] = [{ tipo: 'borrar', ruta: 'c.h' }, { tipo: 'renombrar', de: 'b.h', a: 'z.h' }, { tipo: 'mover', orden: ['b.h', 'c.h', 'a.ino'] }];
    for (const op of ops) {
      const hecho = aplicar(p, op);
      const deshecho = aplicar(hecho.proyecto, hecho.inversa);
      expect(aplicar(deshecho.proyecto, deshecho.inversa).proyecto, op.tipo).toEqual(hecho.proyecto);
    }
  });
});
