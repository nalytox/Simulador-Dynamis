import { compilar, prepararCompilador, type ArchivosNucleo, type ResultadoCompilacion } from './compilar';
import { cargarNucleoWeb } from './nucleo-web';
import type { Proyecto } from '../proyecto/proyecto';
import type { AmbitoTrabajador } from '../ui/ambito';

/** Worker del compilador: descarga LLVM y el núcleo una vez y compila proyectos a pedido. */
export type MensajeAlCompilador = { tipo: 'preparar' } | { tipo: 'compilar'; id: number; proyecto: Proyecto };
export type MensajeDelCompilador =
  | { tipo: 'progreso'; hecho: number; total: number }
  | { tipo: 'preparado' }
  | { tipo: 'error-preparar'; mensaje: string }
  | { tipo: 'compilado'; id: number; resultado: ResultadoCompilacion };

const ambito = self as unknown as AmbitoTrabajador;
const enviar = (m: MensajeDelCompilador, transferibles: Transferable[] = []) => ambito.postMessage(m, transferibles);
const textoDe = (e: unknown) => (e instanceof Error ? e.message : String(e));

let nucleo: Promise<ArchivosNucleo> | null = null;
function cargarNucleo(): Promise<ArchivosNucleo> {
  nucleo ??= cargarNucleoWeb().catch((e: unknown) => {
    nucleo = null;
    throw e;
  });
  return nucleo;
}

async function compilarProyecto(proyecto: Proyecto): Promise<ResultadoCompilacion> {
  try {
    return await compilar(proyecto, await cargarNucleo());
  } catch (e) {
    return { ok: false, diagnosticos: [{ archivo: null, linea: null, columna: null, severidad: 'error', mensaje: `No se pudo compilar: ${textoDe(e)}`, detalle: '' }] };
  }
}

ambito.onmessage = async ({ data }) => {
  const m = data as MensajeAlCompilador;
  if (m.tipo === 'preparar') {
    try {
      await Promise.all([prepararCompilador((hecho, total) => enviar({ tipo: 'progreso', hecho, total })), cargarNucleo()]);
      enviar({ tipo: 'preparado' });
    } catch (e) {
      enviar({ tipo: 'error-preparar', mensaje: textoDe(e) });
    }
    return;
  }
  const resultado = await compilarProyecto(m.proyecto);
  enviar({ tipo: 'compilado', id: m.id, resultado }, resultado.ok ? [resultado.wasm.buffer] : []);
};
