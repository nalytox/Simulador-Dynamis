import { confirmar } from './dialogo';
import { escribirPista, leerPista, pistaVacia } from '../pista/serializacion';
import type { Pista } from '../pista/tipos';

/** Una pista real pesa unos pocos KB: más que esto no es una pista. */
const TAMANO_MAXIMO = 1024 * 1024;
const ERRORES_VISIBLES = 6;

/**
 * Nombre de archivo a partir del nombre de la pista: sin tildes (algunos sistemas cambian por
 * "download" un nombre con letras fuera de ASCII) ni caracteres que los sistemas no aceptan.
 */
export function nombreArchivoPista(nombre: string): string {
  const limpio = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]|[\\/:*?"<>|]/g, '-').trim();
  return `${limpio || 'pista'}.json`;
}

/**
 * Guardar pista (descarga el .json), Abrir pista (lee un .json; si no sirve, muestra qué falla y
 * no cambia nada) y Pista nueva (con confirmación).
 */
export function crearArchivoPista(raiz: Document, eventos: { pista(): Pista; alAbrir(p: Pista): void }): void {
  const $ = <E extends HTMLElement>(id: string) => raiz.getElementById(id) as E;
  const entrada = $<HTMLInputElement>('in-pista');
  const caja = $('error-pista');
  const lista = $('error-pista-lista');

  const ocultarError = () => { caja.hidden = true; };
  const mostrarError = (errores: string[]) => {
    const visibles = errores.slice(0, ERRORES_VISIBLES);
    if (errores.length > visibles.length) visibles.push(`… y ${errores.length - visibles.length} problemas más.`);
    lista.replaceChildren(...visibles.map(e => {
      const li = raiz.createElement('li');
      li.textContent = e;
      return li;
    }));
    caja.hidden = false;
  };
  const abrir = (p: Pista) => {
    ocultarError();
    eventos.alAbrir(p);
  };

  $('btn-guardar').addEventListener('click', () => {
    const pista = eventos.pista();
    const url = URL.createObjectURL(new Blob([escribirPista(pista)], { type: 'application/json' }));
    const a = raiz.createElement('a');
    a.href = url;
    a.download = nombreArchivoPista(pista.nombre);
    a.hidden = true;
    raiz.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  $('btn-abrir').addEventListener('click', () => entrada.click());
  entrada.addEventListener('change', async () => {
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (!archivo) return;
    if (archivo.size > TAMANO_MAXIMO) {
      mostrarError(['El archivo es demasiado grande para ser una pista.']);
      return;
    }
    const r = leerPista(await archivo.text());
    if (r.ok) abrir(r.pista);
    else mostrarError(r.errores);
  });

  $('btn-nueva').addEventListener('click', async () => {
    const seguir = await confirmar(raiz, { titulo: '¿Empezar una pista nueva? Si no guardaste la actual, se va a perder.', boton: 'Empezar una nueva' });
    if (seguir) abrir(pistaVacia());
  });

  $('btn-cerrar-error-pista').addEventListener('click', ocultarError);
}
