import { describe, it, expect } from 'vitest';
import { proyectoDesdeArchivos, leerZip, leerArrastre, type ArchivoLeido } from '../../src/proyecto/importar';
import { proyectoAZip } from '../../src/proyecto/exportar';

const texto = (s: string) => new TextEncoder().encode(s);
const archivo = (ruta: string, contenido: string | Uint8Array = 'void setup() {}'): ArchivoLeido =>
  ({ ruta, bytes: typeof contenido === 'string' ? texto(contenido) : contenido });

describe('importar proyectos', () => {
  it('toma el nombre de la carpeta y quita la carpeta de las rutas', () => {
    const r = proyectoDesdeArchivos([archivo('seguidor/seguidor.ino'), archivo('seguidor/src/util.cpp', 'int x;')]);
    expect(r).toEqual({ ok: true, ignorados: [], proyecto: { nombre: 'seguidor', archivos: { 'seguidor.ino': 'void setup() {}', 'src/util.cpp': 'int x;' } } });
  });

  it('sin carpeta común, el nombre es el del primer .ino', () => {
    const r = proyectoDesdeArchivos([archivo('b.ino'), archivo('a.ino')]);
    expect(r.ok && r.proyecto.nombre).toBe('a');
  });

  it('ignora .git, imágenes y archivos de más de 1 MB, y los informa', () => {
    const r = proyectoDesdeArchivos([
      archivo('p/p.ino'), archivo('p/.git/config', '[core]'), archivo('p/foto.png', new Uint8Array([137, 80])),
      archivo('p/node_modules/x/x.h'), archivo('p/grande.h', new Uint8Array(1024 * 1024 + 1)),
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(r.proyecto.archivos)).toEqual(['p.ino']);
    expect([...r.ignorados].sort()).toEqual(['.git/config', 'foto.png', 'grande.h', 'node_modules/x/x.h']);
  });

  it('sin .ino en la raíz da el mensaje y no un proyecto', () => {
    expect(proyectoDesdeArchivos([archivo('p/pines.h'), archivo('p/src/otro.ino')]))
      .toEqual({ ok: false, mensaje: 'No encontramos un archivo .ino en la carpeta. Un proyecto de Arduino necesita uno.' });
  });

  it('quita la BOM', () => {
    const r = proyectoDesdeArchivos([archivo('p.ino', new Uint8Array([0xef, 0xbb, 0xbf, ...texto('void loop() {}')]))]);
    expect(r.ok && r.proyecto.archivos['p.ino']).toBe('void loop() {}');
  });

  it('leerZip y proyectoAZip son inversos', () => {
    const p = { nombre: 'seguidor', archivos: { 'seguidor.ino': '#include "pines.h"\n', 'pines.h': '#pragma once\n', 'src/util.cpp': 'int y;\n' } };
    const r = proyectoDesdeArchivos(leerZip(proyectoAZip(p)));
    expect(r).toEqual({ ok: true, ignorados: [], proyecto: p });
  });

  it('leerArrastre recorre carpetas anidadas', async () => {
    const entradaArchivo = (fullPath: string, contenido: string) => ({
      isFile: true, isDirectory: false, name: fullPath.split('/').at(-1)!, fullPath,
      file: (cb: (f: File) => void) => cb(new File([contenido], fullPath.split('/').at(-1)!)),
    });
    const carpeta = (fullPath: string, hijos: unknown[]) => ({
      isFile: false, isDirectory: true, name: fullPath.split('/').at(-1)!, fullPath,
      createReader: () => {
        let entregado = false;
        return { readEntries: (cb: (e: unknown[]) => void) => { cb(entregado ? [] : hijos); entregado = true; } };
      },
    });
    const raiz = carpeta('/p', [entradaArchivo('/p/p.ino', 'void setup() {}'), carpeta('/p/src', [entradaArchivo('/p/src/u.cpp', 'int z;')])]);
    const items = [{ webkitGetAsEntry: () => raiz }] as unknown as DataTransferItemList;
    const leidos = await leerArrastre(items);
    expect(leidos.map(a => [a.ruta, new TextDecoder().decode(a.bytes)]).sort()).toEqual([['p/p.ino', 'void setup() {}'], ['p/src/u.cpp', 'int z;']]);
  });
});
