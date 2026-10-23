import { GUIAS } from '../ayuda/guias';
import { conexionesDe } from '../ayuda/conexiones';
import { puntaje } from '../ayuda/bases';
import type { ConfigRobot } from '../robot/config';

export type PestanaAyuda = 'sensores' | 'conexiones' | 'bases' | 'inicio';
const PESTANAS: PestanaAyuda[] = ['sensores', 'conexiones', 'bases', 'inicio'];
const COPIADO_MS = 2000;

export interface VentanaAyudaEventos {
  robot(): ConfigRobot;
  abrirMiRobot(): void;
  verRecorrido(): void;
}

/** La ventana "Ayuda" (spec §12): guías de los sensores, conexiones de mi robot, las bases y primeros pasos. */
export function crearVentanaAyuda(raiz: Document, eventos: VentanaAyudaEventos): {
  abrir(pestana?: PestanaAyuda): void;
  mostrarInstalar(alInstalar: (() => void) | null): void;
} {
  const $ = (id: string) => raiz.getElementById(id)!;
  const ventana = $('ventana-ayuda') as HTMLDialogElement;
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, clase?: string, texto?: string) => {
    const e = raiz.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  };
  const pestana = (p: PestanaAyuda) => $(`ay-tab-${p}`) as HTMLButtonElement;

  const mostrarPestana = (p: PestanaAyuda) => {
    for (const otra of PESTANAS) {
      const activa = otra === p;
      pestana(otra).setAttribute('aria-selected', String(activa));
      pestana(otra).tabIndex = activa ? 0 : -1;
      $(`ay-${otra}`).hidden = !activa;
    }
  };
  for (const p of PESTANAS) {
    pestana(p).addEventListener('click', () => mostrarPestana(p));
    pestana(p).addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const siguiente = PESTANAS[(PESTANAS.indexOf(p) + (e.key === 'ArrowRight' ? 1 : PESTANAS.length - 1)) % PESTANAS.length];
      mostrarPestana(siguiente);
      pestana(siguiente).focus();
    });
  }

  $('ay-sensores').replaceChildren(...GUIAS.map(g => {
    const articulo = el('article', 'ay-guia');
    articulo.id = `ay-guia-${g.id}`;
    const cabeza = el('header');
    cabeza.append(el('h3', undefined, g.titulo), el('span', 'chip', g.libreria));
    articulo.append(cabeza, ...g.explicacion.map(t => el('p', undefined, t)));
    if (g.aviso) articulo.append(el('p', 'ay-aviso', `⚠ ${g.aviso}`));
    const copiar = el('button', 'btn-mini ay-copiar', 'Copiar');
    copiar.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(g.programa);
        copiar.textContent = '¡Copiado!';
      } catch {
        copiar.textContent = 'No se pudo copiar';
      }
      setTimeout(() => { copiar.textContent = 'Copiar'; }, COPIADO_MS);
    });
    articulo.append(el('pre', 'ay-programa', g.programa), copiar);
    return articulo;
  }));

  $('ay-puntaje').replaceChildren(...puntaje().map(({ regla, puntos }) => {
    const fila = el('tr');
    fila.append(el('th', undefined, regla), el('td', undefined, puntos));
    return fila;
  }));

  const pintarConexiones = () => {
    $('ay-conexiones-lista').replaceChildren(...conexionesDe(eventos.robot()).map(g => {
      const tabla = el('table', 'ay-tabla');
      tabla.append(el('caption', undefined, g.grupo), ...g.filas.map(f => {
        const fila = el('tr');
        fila.append(el('th', undefined, f.que), el('td', undefined, f.pin));
        return fila;
      }));
      return tabla;
    }));
  };

  $('ay-cerrar').addEventListener('click', () => ventana.close());
  $('ay-mi-robot').addEventListener('click', () => {
    ventana.close();
    eventos.abrirMiRobot();
  });
  $('ay-recorrido').addEventListener('click', () => {
    ventana.close();
    eventos.verRecorrido();
  });
  let instalar: (() => void) | null = null;
  $('ay-instalar').addEventListener('click', () => instalar?.());

  return {
    abrir(p = 'sensores') {
      pintarConexiones();
      mostrarPestana(p);
      ventana.showModal();
    },
    mostrarInstalar(alInstalar) {
      instalar = alInstalar;
      $('ay-instalar').hidden = alInstalar === null;
    },
  };
}
