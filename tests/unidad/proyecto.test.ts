import { describe, it, expect } from 'vitest';
import { archivoPrincipal, ordenarArchivos, tipoDeArchivo, type Proyecto } from '../../src/proyecto/proyecto';

const p: Proyecto = { nombre: 'seguidor', archivos: { 'pines.h': '', 'seguidor.ino': '', 'motores.ino': '', 'src/util.cpp': '', 'filtro.c': '' } };

describe('proyecto', () => {
  it('elige el .ino con el nombre de la carpeta', () => expect(archivoPrincipal(p)).toBe('seguidor.ino'));
  it('si no hay uno con ese nombre, usa el primero en orden alfabético', () =>
    expect(archivoPrincipal({ nombre: 'x', archivos: { 'b.ino': '', 'a.ino': '', 'src/c.ino': '' } })).toBe('a.ino'));
  it('sin .ino devuelve null', () => expect(archivoPrincipal({ nombre: 'x', archivos: { 'a.h': '' } })).toBeNull());
  it('ordena con el principal primero', () =>
    expect(ordenarArchivos(p)).toEqual(['seguidor.ino', 'filtro.c', 'motores.ino', 'pines.h', 'src/util.cpp']));
  it('clasifica por extensión', () => {
    expect(tipoDeArchivo('a.INO')).toBe('ino');
    expect(tipoDeArchivo('src/x.hpp')).toBe('cabecera');
    expect(tipoDeArchivo('x.c')).toBe('c');
    expect(tipoDeArchivo('x.cc')).toBe('cpp');
    expect(tipoDeArchivo('notas.txt')).toBe('otro');
  });
});
