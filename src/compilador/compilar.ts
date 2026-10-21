import { runClang, runLLVM, Exit } from '@yowasp/clang';
import type { Proyecto } from '../proyecto/proyecto';
import { prepararUnidades, ErrorProyecto, type UnidadCompilacion } from './preprocesador';
import { parsearDiagnosticos, diagnosticosDeFallo, type Diagnostico } from './diagnosticos';
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

let precarga: Promise<unknown> | null = null;

/**
 * Descarga y prepara LLVM una sola vez. runClang no pasa fetchProgress a sus
 * subprocesos, así que sin esta precarga se imprimiría el progreso en la consola.
 * Si la descarga falla, la próxima llamada vuelve a intentarlo.
 */
export function prepararCompilador(alProgresar: (hecho: number, total: number) => void = () => {}): Promise<unknown> {
  precarga ??= Promise.resolve(runLLVM(undefined, {}, {
    fetchProgress: ({ doneLength, totalLength }) => alProgresar(doneLength, totalLength),
  })).catch((e: unknown) => {
    precarga = null;
    throw e;
  });
  return precarga;
}

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
  await prepararCompilador();
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
    const objeto = arbol && leerDeArbol(arbol, `${u.ruta}.o`);
    if (objeto instanceof Uint8Array) {
      objetos[`${u.ruta}.o`] = objeto;
      diagnosticos.push(...parsearDiagnosticos(salida));
    } else {
      fallo = true;
      diagnosticos.push(...diagnosticosDeFallo(salida));
    }
  }
  if (fallo) return { ok: false, diagnosticos };

  const argsEnlace = [
    'clang++', ...opciones.enlace, ...Object.keys(objetos),
    // --whole-archive: principal.o (dyn_setup/dyn_loop) no tiene otras referencias que lo saquen del .a.
    ...(nucleo.biblioteca ? ['-Wl,--whole-archive', BIBLIOTECA, '-Wl,--no-whole-archive'] : []), '-o', SALIDA,
  ];
  const { arbol, salida } = await ejecutarClang(argsEnlace, aArbol({ ...planos, ...objetos }));
  const wasm = arbol && leerDeArbol(arbol, SALIDA);
  if (!(wasm instanceof Uint8Array)) return { ok: false, diagnosticos: [...diagnosticos, ...diagnosticosDeFallo(salida)] };
  diagnosticos.push(...parsearDiagnosticos(salida));
  return { ok: true, wasm: new Uint8Array(wasm), diagnosticos };
}
