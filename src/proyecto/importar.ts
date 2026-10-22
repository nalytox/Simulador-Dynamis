import { unzipSync } from 'fflate';
import { archivoPrincipal, tipoDeArchivo, type Proyecto } from './proyecto';

/** Un archivo tal como llega de una carpeta, un .zip o un arrastre: ruta con '/' y sus bytes. */
export interface ArchivoLeido { ruta: string; bytes: Uint8Array }

export type ResultadoImportacion =
  | { ok: true; proyecto: Proyecto; ignorados: string[] }
  | { ok: false; mensaje: string };

const MAXIMO_BYTES = 1024 * 1024;
const CARPETAS_IGNORADAS = new Set(['node_modules', 'build']);
const SIN_INO = 'No encontramos un archivo .ino en la carpeta. Un proyecto de Arduino necesita uno.';

const ignorarCarpeta = (segmento: string) => segmento.startsWith('.') || CARPETAS_IGNORADAS.has(segmento);
const decodificador = new TextDecoder('utf-8');
const aTexto = (bytes: Uint8Array) => decodificador.decode(bytes).replace(/^﻿/, '');

/**
 * Arma un proyecto con los archivos de código de una carpeta. Solo entran .ino, .h, .hpp, .c y
 * .cpp; lo demás (imágenes, .git/, archivos de más de 1 MB) queda en `ignorados`.
 */
export function proyectoDesdeArchivos(archivos: ArchivoLeido[]): ResultadoImportacion {
  const limpias = archivos.map(a => ({ ...a, ruta: a.ruta.replace(/\\/g, '/').replace(/^\/+/, '') }));
  const primeras = new Set(limpias.map(a => (a.ruta.includes('/') ? a.ruta.split('/')[0] : '')));
  const carpeta = primeras.size === 1 && !primeras.has('') ? [...primeras][0] : null;

  const codigo: Record<string, string> = {};
  const ignorados: string[] = [];
  for (const a of limpias) {
    const ruta = carpeta ? a.ruta.slice(carpeta.length + 1) : a.ruta;
    const segmentos = ruta.split('/');
    if (segmentos.slice(0, -1).some(ignorarCarpeta) || tipoDeArchivo(ruta) === 'otro' || a.bytes.length > MAXIMO_BYTES) {
      ignorados.push(ruta);
      continue;
    }
    codigo[ruta] = aTexto(a.bytes);
  }

  const provisorio: Proyecto = { nombre: carpeta ?? '', archivos: codigo };
  const principal = archivoPrincipal(provisorio);
  if (!principal) return { ok: false, mensaje: SIN_INO };
  return { ok: true, proyecto: { nombre: carpeta ?? principal.replace(/\.ino$/i, ''), archivos: codigo }, ignorados };
}

export function leerZip(bytes: Uint8Array): ArchivoLeido[] {
  return Object.entries(unzipSync(bytes))
    .filter(([ruta]) => !ruta.endsWith('/'))
    .map(([ruta, contenido]) => ({ ruta, bytes: contenido }));
}

const bytesDe = async (f: Blob) => new Uint8Array(await f.arrayBuffer());

/** Archivos de un <input webkitdirectory> (o de un input normal). */
export async function leerInput(lista: FileList): Promise<ArchivoLeido[]> {
  return Promise.all([...lista].map(async f => ({ ruta: f.webkitRelativePath || f.name, bytes: await bytesDe(f) })));
}

interface Entrada {
  isFile: boolean;
  isDirectory: boolean;
  fullPath: string;
  file?(exito: (f: File) => void, error?: (e: unknown) => void): void;
  createReader?(): { readEntries(exito: (e: Entrada[]) => void, error?: (e: unknown) => void): void };
}

async function leerEntrada(e: Entrada): Promise<ArchivoLeido[]> {
  if (e.isFile && e.file) {
    const f = await new Promise<File>((resolver, rechazar) => e.file!(resolver, rechazar));
    return [{ ruta: e.fullPath.replace(/^\//, ''), bytes: await bytesDe(f) }];
  }
  if (!e.isDirectory || !e.createReader) return [];
  const lector = e.createReader();
  const hijos: Entrada[] = [];
  // readEntries entrega de a tandas: hay que llamarla hasta que devuelva una vacía.
  for (;;) {
    const tanda = await new Promise<Entrada[]>((resolver, rechazar) => lector.readEntries(resolver, rechazar));
    if (tanda.length === 0) break;
    hijos.push(...tanda);
  }
  return (await Promise.all(hijos.map(leerEntrada))).flat();
}

/** Archivos de una carpeta arrastrada sobre el editor. */
export async function leerArrastre(items: DataTransferItemList): Promise<ArchivoLeido[]> {
  const entradas = [...items]
    .map(i => (i as unknown as { webkitGetAsEntry(): Entrada | null }).webkitGetAsEntry())
    .filter((e): e is Entrada => e !== null);
  return (await Promise.all(entradas.map(leerEntrada))).flat();
}

interface CarpetaLegible {
  name: string;
  entries(): AsyncIterable<[string, { kind: 'file' | 'directory'; getFile?(): Promise<File> }]>;
}

/** Archivos de una carpeta abierta con showDirectoryPicker (Chrome y Edge). */
export async function leerCarpeta(dir: CarpetaLegible, base = dir.name): Promise<ArchivoLeido[]> {
  const leidos: ArchivoLeido[] = [];
  for await (const [nombre, h] of dir.entries()) {
    const ruta = `${base}/${nombre}`;
    if (h.kind === 'file' && h.getFile) leidos.push({ ruta, bytes: await bytesDe(await h.getFile()) });
    else if (h.kind === 'directory' && !ignorarCarpeta(nombre)) leidos.push(...await leerCarpeta(h as unknown as CarpetaLegible, ruta));
  }
  return leidos;
}
