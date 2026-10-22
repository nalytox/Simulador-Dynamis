import { describe, it, expect } from 'vitest';
import { validarNombreArchivo, puedeBorrar } from '../../src/ui/archivos';

const P = { nombre: 'seguidor', archivos: { 'seguidor.ino': '', 'pines.h': '' } };

describe('nombres de archivo', () => {
  it.each([
    ['', 'Escribe un nombre para el archivo.'],
    ['   ', 'Escribe un nombre para el archivo.'],
    ['mi archivo.h', 'Usa solo letras sin tilde, números, guiones y puntos.'],
    ['año.h', 'Usa solo letras sin tilde, números, guiones y puntos.'],
    ['../fuera.h', 'Usa solo letras sin tilde, números, guiones y puntos.'],
    ['/raiz.h', 'Usa solo letras sin tilde, números, guiones y puntos.'],
    ['notas.txt', 'El archivo debe terminar en .ino, .h, .hpp, .c o .cpp.'],
    ['util', 'El archivo debe terminar en .ino, .h, .hpp, .c o .cpp.'],
    ['pines.h', 'Ya existe un archivo con ese nombre.'],
  ])('"%s" → %s', (nombre, mensaje) => {
    expect(validarNombreArchivo(P, nombre)).toBe(mensaje);
  });

  it('acepta nombres válidos, también en src/', () => {
    expect(validarNombreArchivo(P, 'util.h')).toBeNull();
    expect(validarNombreArchivo(P, 'src/motores.cpp')).toBeNull();
    expect(validarNombreArchivo(P, 'otro.ino')).toBeNull();
  });

  it('renombrar un archivo con su mismo nombre es válido', () => {
    expect(validarNombreArchivo(P, 'pines.h', 'pines.h')).toBeNull();
  });

  it('no se puede borrar el único .ino; los demás sí', () => {
    expect(puedeBorrar(P, 'seguidor.ino')).toBe('Tu proyecto necesita al menos un archivo .ino.');
    expect(puedeBorrar(P, 'pines.h')).toBeNull();
    expect(puedeBorrar({ nombre: 'p', archivos: { 'a.ino': '', 'b.ino': '' } }, 'a.ino')).toBeNull();
  });
});
