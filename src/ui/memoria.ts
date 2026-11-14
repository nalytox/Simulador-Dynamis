import { entradasDe, type ClaveEscrita, type MemoriaNvs } from '../simulacion/memoria';
import { nombreTipo, porcentajeUso, textoUso, textoValor } from './textos-memoria';

export interface TarjetaMemoria {
  /** Muestra la memoria; `ultima` es la clave recién escrita, que se resalta. */
  mostrar(m: MemoriaNvs, ultima: ClaveEscrita | null): void;
  /** «Borrar la memoria» solo se puede con el robot detenido. */
  habilitarBorrar(si: boolean): void;
}

/** La tarjeta «Memoria del robot»: lo que el programa guardó con Preferences, por espacio de nombres. */
export function crearTarjetaMemoria(raiz: Document, o: { alBorrar(): void }): TarjetaMemoria {
  const $ = (id: string) => raiz.getElementById(id)!;
  const boton = $('btn-borrar-memoria') as HTMLButtonElement;
  boton.addEventListener('click', () => o.alBorrar());
  const el = <K extends keyof HTMLElementTagNameMap>(etiqueta: K, clase?: string, texto?: string) => {
    const e = raiz.createElement(etiqueta);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  };

  return {
    mostrar(m, ultima) {
      $('mem-uso').textContent = textoUso(m);
      ($('mem-barra') as HTMLElement).style.width = `${porcentajeUso(m)}%`;
      const espacios = Object.entries(m.espacios).sort(([a], [b]) => a.localeCompare(b));
      $('mem-vacia').hidden = espacios.some(([, claves]) => Object.keys(claves).length > 0);
      $('mem-lista').replaceChildren(...espacios.map(([espacio, claves]) => {
        const lista = Object.entries(claves).sort(([a], [b]) => a.localeCompare(b));
        const entradas = 1 + lista.reduce((n, [, v]) => n + entradasDe(v), 0);
        const grupo = el('details', 'mem-espacio');
        grupo.open = true;
        const resumen = el('summary', undefined, espacio);
        resumen.append(el('span', 'sub', ` ${lista.length} ${lista.length === 1 ? 'clave' : 'claves'} · ${entradas} entradas`));
        const tabla = el('table');
        for (const [clave, v] of lista) {
          const fila = el('tr', ultima?.espacio === espacio && ultima.clave === clave ? 'reciente' : undefined);
          fila.append(el('td', 'mem-clave', clave), el('td', 'mem-tipo', nombreTipo(v.tipo)), el('td', 'mem-valor', textoValor(v)));
          tabla.append(fila);
        }
        grupo.append(resumen, tabla);
        return grupo;
      }));
    },
    habilitarBorrar(si) { boton.disabled = !si; },
  };
}
