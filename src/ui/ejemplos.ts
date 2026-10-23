import { PISTAS_DE_EJEMPLO, PROYECTOS_DE_EJEMPLO, type EjemploPista } from '../ejemplos';
import { dibujarPista } from './dibujo';
import { vistaInicial } from './vista';
import type { Pista } from '../pista/tipos';
import type { Proyecto } from '../proyecto/proyecto';

export interface VentanaEjemplosEventos {
  /** Pide confirmar si hace falta; dice si lo abrió. */
  abrirProyecto(p: Proyecto): Promise<boolean>;
  abrirPista(p: Pista): Promise<boolean>;
  /** Después de abrir algo (la app vuelve a Programar). */
  alAbrir(): void;
}

const MINIATURA = { ancho: 160, alto: 120 };

/** La ventana "Ejemplos" (spec §12): proyectos de ejemplo y pistas para probarlos. */
export function crearVentanaEjemplos(raiz: Document, eventos: VentanaEjemplosEventos): { abrir(): void } {
  const $ = (id: string) => raiz.getElementById(id)!;
  const ventana = $('ventana-ejemplos') as HTMLDialogElement;
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, clase?: string, texto?: string) => {
    const e = raiz.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  };
  const boton = (clase: string, texto: string, alClic: () => Promise<boolean>) => {
    const b = el('button', clase, texto);
    b.addEventListener('click', async () => {
      if (!(await alClic())) return;
      ventana.close();
      eventos.alAbrir();
    });
    return b;
  };
  // Cada ejemplo se abre como copia: lo que el estudiante cambie no toca el catálogo.
  const abrirPista = (e: EjemploPista) => eventos.abrirPista(structuredClone(e.pista));
  const miniaturas: { canvas: HTMLCanvasElement; pista: Pista }[] = [];

  $('ej-proyectos').replaceChildren(...PROYECTOS_DE_EJEMPLO.map(e => {
    const pista = PISTAS_DE_EJEMPLO.find(p => p.id === e.pista)!;
    const li = el('li', 'ej-tarjeta');
    li.id = `ej-proyecto-${e.id}`;
    const acciones = el('div', 'ej-acciones');
    acciones.append(
      boton('btn-sec ej-abrir', 'Abrir', () => eventos.abrirProyecto(structuredClone(e.proyecto))),
      boton('btn-mini ej-abrir-pista', 'Abrir esa pista', () => abrirPista(pista)),
    );
    li.append(el('h3', undefined, e.nombre), el('p', undefined, e.descripcion), el('p', 'ej-pista', `Se prueba en la pista «${pista.nombre}»`), acciones);
    return li;
  }));

  $('ej-pistas').replaceChildren(...PISTAS_DE_EJEMPLO.map(e => {
    const li = el('li', 'ej-tarjeta ej-tarjeta-pista');
    li.id = `ej-pista-${e.id}`;
    const canvas = el('canvas', 'ej-miniatura');
    canvas.width = MINIATURA.ancho;
    canvas.height = MINIATURA.alto;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `Dibujo de la pista ${e.nombre}`);
    miniaturas.push({ canvas, pista: e.pista });
    const texto = el('div');
    const acciones = el('div', 'ej-acciones');
    acciones.append(boton('btn-sec ej-abrir', 'Abrir', () => abrirPista(e)));
    texto.append(el('h3', undefined, e.nombre), el('p', undefined, e.descripcion), acciones);
    li.append(canvas, texto);
    return li;
  }));

  $('ej-cerrar').addEventListener('click', () => ventana.close());

  return {
    abrir() {
      ventana.showModal();
      for (const { canvas, pista } of miniaturas) {
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        dibujarPista(ctx, vistaInicial(canvas.width, canvas.height, pista.columnas, pista.filas), pista);
      }
    },
  };
}
