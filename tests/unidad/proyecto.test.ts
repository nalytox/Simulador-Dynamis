import { describe, it, expect } from 'vitest';
import { archivoPrincipal, archivosCompilados, moverArchivo, ordenarArchivos, programasDelProyecto, tieneSetupOLoop, tipoDeArchivo, type Proyecto } from '../../src/proyecto/proyecto';

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

describe('orden de las pestañas y programa elegido', () => {
  const dos: Proyecto = { nombre: 'robot', archivos: { 'uno.ino': 'void setup() {}\nvoid loop() {}\n', 'dos.ino': 'void setup() {}\nvoid loop() {}\n', 'ayuda.ino': 'void girar() {}\n', 'pines.h': '' } };

  it('el programa elegido manda; si ya no existe o no es un .ino de la raíz, vale la regla de siempre', () => {
    expect(archivoPrincipal({ ...dos, principal: 'dos.ino' })).toBe('dos.ino');
    // ayuda.ino va primero en orden alfabético, pero no tiene setup() ni loop(): no es un programa.
    expect(archivoPrincipal({ ...dos, principal: 'borrado.ino' })).toBe('dos.ino');
    expect(archivoPrincipal({ ...dos, principal: 'pines.h' })).toBe('dos.ino');
  });

  it('con orden, las pestañas lo siguen: sin las rutas que ya no existen y con las nuevas al final', () => {
    expect(ordenarArchivos({ ...dos, orden: ['pines.h', 'dos.ino', 'borrado.h', 'uno.ino'] })).toEqual(['pines.h', 'dos.ino', 'uno.ino', 'ayuda.ino']);
  });

  it('un proyecto guardado sin orden abre con el orden de siempre', () => {
    expect(ordenarArchivos(dos)).toEqual(['dos.ino', 'ayuda.ino', 'pines.h', 'uno.ino']);
  });

  it('moverArchivo lleva una pestaña a la posición pedida y guarda el orden completo', () => {
    expect(moverArchivo(dos, 'uno.ino', 0).orden).toEqual(['uno.ino', 'dos.ino', 'ayuda.ino', 'pines.h']);
    expect(moverArchivo(dos, 'ayuda.ino', 3).orden).toEqual(['dos.ino', 'pines.h', 'uno.ino', 'ayuda.ino']);
  });

  it('programasDelProyecto: los .ino de la raíz en el orden de las pestañas', () => {
    expect(programasDelProyecto({ ...dos, orden: ['uno.ino', 'pines.h', 'dos.ino', 'ayuda.ino'] })).toEqual(['uno.ino', 'dos.ino', 'ayuda.ino']);
  });

  it('archivosCompilados: el elegido, las pestañas de ayuda sin setup ni loop, y lo demás; no los otros programas', () => {
    expect(archivosCompilados({ ...dos, principal: 'dos.ino' })).toEqual(['dos.ino', 'ayuda.ino', 'pines.h']);
    expect(tieneSetupOLoop('// void setup() {}\nint x;')).toBe(false);
    expect(tieneSetupOLoop('void loop()\n{\n}')).toBe(true);
  });
});
