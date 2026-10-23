import { strToU8, zipSync } from 'fflate';
import { archivoPrincipal, type Proyecto } from './proyecto';

/** El Arduino IDE exige que la carpeta se llame como el .ino principal. */
function carpetaDe(p: Proyecto): string {
  return archivoPrincipal(p)?.replace(/\.ino$/i, '') ?? p.nombre;
}

export function proyectoAZip(p: Proyecto): Uint8Array {
  const carpeta = carpetaDe(p);
  return zipSync(Object.fromEntries(Object.entries(p.archivos).map(([ruta, texto]) => [`${carpeta}/${ruta}`, strToU8(texto)])));
}

export function nombreZip(p: Proyecto): string {
  return `${carpetaDe(p)}.zip`;
}

/** Lo que usa guardarEnCarpeta de un FileSystemDirectoryHandle. */
export interface CarpetaEscribible {
  getDirectoryHandle(nombre: string, o?: { create?: boolean }): Promise<CarpetaEscribible>;
  getFileHandle(nombre: string, o?: { create?: boolean }): Promise<{
    createWritable(): Promise<{ write(datos: string): Promise<void>; close(): Promise<void> }>;
  }>;
}

/** Escribe cada archivo en la carpeta (creando subcarpetas) sin borrar nada más. */
export async function guardarEnCarpeta(dir: CarpetaEscribible, p: Proyecto): Promise<void> {
  for (const [ruta, texto] of Object.entries(p.archivos)) {
    const partes = ruta.split('/');
    let carpeta = dir;
    for (const parte of partes.slice(0, -1)) carpeta = await carpeta.getDirectoryHandle(parte, { create: true });
    const escritor = await (await carpeta.getFileHandle(partes.at(-1)!, { create: true })).createWritable();
    await escritor.write(texto);
    await escritor.close();
  }
}
