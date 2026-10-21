import { runClang, Exit } from '@yowasp/clang';
import type { Proyecto } from '../proyecto/proyecto';
import { prepararUnidades, ErrorProyecto, type UnidadCompilacion } from './preprocesador';
import { parsearDiagnosticos, type Diagnostico } from './diagnosticos';
import { aArbol, leerDeArbol, type Arbol } from './arbol';
import opciones from './opciones.json';

export interface ArchivosNucleo {
  /** Cabeceras del núcleo, con rutas relativas a include/. */
  cabeceras: Record<string, string>;
  /** nucleo.a precompilado (null en pruebas con un núcleo falso). */
  biblioteca: Uint8Array | null;
}

export type ResultadoCompilacion =
  | { ok: true; wasm: Uint8Array<ArrayBuffer>; diagnosticos: Diagnostico[] }
  | { ok: false; diagnosticos: Diagnostico[] };

const DIR_NUCLEO = 'nucleo';
const BIBLIOTECA = `${DIR_NUCLEO}/nucleo.a`;
const SALIDA = 'programa.wasm';

/** Ejecuta Clang y devuelve el árbol resultante o la salida de error si falló. */
async function ejecutarClang(args: string[], archivos: Arbol): Promise<{ arbol: Arbol | null; salida: string }> {
  const decodificador = new TextDecoder();
  let salida = '';
  const capturar = (bytes: Uint8Array | null) => { if (bytes) salida += decodificador.decode(bytes, { stream: true }); };
  try {
    const arbol = await runClang(args, archivos, { stdout: capturar, stderr: capturar, fetchProgress: () => {} });
    return { arbol: (arbol ?? {}) as Arbol, salida };
  } catch (e) {
    if (e instanceof Exit) return { arbol: null, salida };
    throw e;
  }
}

const argumentosDeUnidad = (u: UnidadCompilacion) => [
  u.lenguaje === 'c' ? 'clang' : 'clang++',
  ...(u.lenguaje === 'c' ? opciones.c : opciones.cpp),
  `-I${DIR_NUCLEO}/include`, '-c', u.ruta, '-o', `${u.ruta}.o`,
];

/** Compila un proyecto Arduino a un módulo WebAssembly enlazado con el núcleo. */
export async function compilar(p: Proyecto, nucleo: ArchivosNucleo): Promise<ResultadoCompilacion> {
  let unidades: UnidadCompilacion[];
  try {
    unidades = prepararUnidades(p);
  } catch (e) {
    if (!(e instanceof ErrorProyecto)) throw e;
    return { ok: false, diagnosticos: [{ archivo: null, linea: null, columna: null, severidad: 'error', mensaje: e.message, detalle: '' }] };
  }

  const planos: Record<string, string | Uint8Array> = { ...p.archivos };
  for (const u of unidades) planos[u.ruta] = u.codigo;
  for (const [ruta, contenido] of Object.entries(nucleo.cabeceras)) planos[`${DIR_NUCLEO}/include/${ruta}`] = contenido;
  if (nucleo.biblioteca) planos[BIBLIOTECA] = nucleo.biblioteca;

  const diagnosticos: Diagnostico[] = [];
  const objetos: Record<string, Uint8Array> = {};
  let fallo = false;
  for (const u of unidades) {
    const { arbol, salida } = await ejecutarClang(argumentosDeUnidad(u), aArbol(planos));
    diagnosticos.push(...parsearDiagnosticos(salida));
    const objeto = arbol && leerDeArbol(arbol, `${u.ruta}.o`);
    if (objeto instanceof Uint8Array) objetos[`${u.ruta}.o`] = objeto;
    else fallo = true;
  }
  if (fallo) return { ok: false, diagnosticos };

  const argsEnlace = [
    'clang++', ...opciones.enlace, ...Object.keys(objetos),
    ...(nucleo.biblioteca ? [BIBLIOTECA] : []), '-o', SALIDA,
  ];
  const { arbol, salida } = await ejecutarClang(argsEnlace, aArbol({ ...planos, ...objetos }));
  diagnosticos.push(...parsearDiagnosticos(salida));
  const wasm = arbol && leerDeArbol(arbol, SALIDA);
  if (!(wasm instanceof Uint8Array)) return { ok: false, diagnosticos };
  return { ok: true, wasm: new Uint8Array(wasm), diagnosticos };
}
