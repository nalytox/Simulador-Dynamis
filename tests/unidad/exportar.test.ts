import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { proyectoAZip, nombreZip, guardarEnCarpeta } from '../../src/proyecto/exportar';

/** Una carpeta del sistema de archivos, en memoria. */
class CarpetaFalsa {
  archivos = new Map<string, string>();
  carpetas = new Map<string, CarpetaFalsa>();
  async getDirectoryHandle(nombre: string, o?: { create?: boolean }) {
    if (!this.carpetas.has(nombre)) {
      if (!o?.create) throw new Error('no existe');
      this.carpetas.set(nombre, new CarpetaFalsa());
    }
    return this.carpetas.get(nombre)!;
  }
  async getFileHandle(nombre: string, o?: { create?: boolean }) {
    if (!this.archivos.has(nombre) && !o?.create) throw new Error('no existe');
    return { createWritable: async () => {
      let contenido = '';
      return { write: async (d: string) => { contenido += d; }, close: async () => { this.archivos.set(nombre, contenido); } };
    } };
  }
}

describe('exportar proyectos', () => {
  it('el zip lleva la carpeta con el nombre del .ino principal', () => {
    const p = { nombre: 'otro', archivos: { 'seguidor.ino': 'a', 'pines.h': 'b' } };
    const zip = unzipSync(proyectoAZip(p));
    expect(Object.keys(zip).sort()).toEqual(['seguidor/pines.h', 'seguidor/seguidor.ino']);
    expect(strFromU8(zip['seguidor/pines.h'])).toBe('b');
    expect(nombreZip(p)).toBe('seguidor.zip');
  });

  it('guardarEnCarpeta escribe los archivos y crea src/', async () => {
    const raiz = new CarpetaFalsa();
    raiz.archivos.set('notas.txt', 'no se toca');
    await guardarEnCarpeta(raiz, { nombre: 'p', archivos: { 'p.ino': 'void setup() {}', 'src/util.cpp': 'int x;' } });
    expect(raiz.archivos.get('p.ino')).toBe('void setup() {}');
    expect(raiz.carpetas.get('src')?.archivos.get('util.cpp')).toBe('int x;');
    expect(raiz.archivos.get('notas.txt')).toBe('no se toca');
  });
});
