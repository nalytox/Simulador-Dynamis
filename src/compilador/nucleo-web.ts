import type { ArchivosNucleo } from './compilar';
import urlBiblioteca from '../../generado/nucleo.a?url';

const PREFIJO = '../nucleo/include/';
const crudas = import.meta.glob('../nucleo/include/**/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Las cabeceras del núcleo (empaquetadas con la app) y el nucleo.a precompilado (se descarga). */
export async function cargarNucleoWeb(): Promise<ArchivosNucleo> {
  const cabeceras = Object.fromEntries(Object.entries(crudas).map(([ruta, texto]) => [ruta.slice(PREFIJO.length), texto]));
  const respuesta = await fetch(urlBiblioteca);
  if (!respuesta.ok) throw new Error(`No se pudo descargar el núcleo (HTTP ${respuesta.status}).`);
  return { cabeceras, biblioteca: new Uint8Array(await respuesta.arrayBuffer()) };
}
