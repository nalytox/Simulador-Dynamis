import { buscarAjustables, formatearValor, type Ajustable, type AvisoAjustable } from '../compilador/ajustables';
import { ayudaDe, elecciones, GRUPOS, paraElAgente, type EleccionParametro } from '../ajuste/parametros';
import type { ParametroAgente } from '../ajuste/contrato';
import { describirError, type FinEntrenamiento, type ResultadoEntrenado } from '../ajuste/entrenamiento';
import { geometria, type Geometria } from './grafico';
import { dibujarPista, dibujarTrayectoria } from './dibujo';
import { vistaInicial } from './vista';
import type { Proyecto } from '../proyecto/proyecto';
import type { Pista } from '../pista/tipos';

/** Lo que la ventana le pide a la app para entrenar: compilar, armar el pool y correr el bucle. */
export interface PedidoEntrenamiento {
  parametros: ParametroAgente[];
  presupuesto: number;
  duracionS: number;
  robots: number;
  senal: AbortSignal;
  alResultado(r: ResultadoEntrenado & { record: boolean }): void;
}

export type FinVentana = FinEntrenamiento | { motivo: 'no-compila'; mensaje: string };

export interface VentanaAjusteEventos {
  proyecto(): Proyecto;
  /** La pista del editor: con ella se entrena y se dibuja el recorrido del mejor. */
  pista(): Pista;
  entrenar(p: PedidoEntrenamiento): Promise<FinVentana>;
  alVer(m: ResultadoEntrenado): void;
  alUsar(m: ResultadoEntrenado): void;
}

const PRUEBAS = { min: 10, max: 2000, porDefecto: 200 };
const MAXIMO_ROBOTS = 8;
const ALTO_GRAFICO = 260;
const SVG = 'http://www.w3.org/2000/svg';

const numero = (v: number, decimales = 6) => v.toLocaleString('es-CL', { maximumFractionDigits: decimales });
/** Un valor ajustado, como se escribiría en el código (entero, o real con 4 cifras), con coma decimal. */
const valorAjustado = (v: number, entero: boolean) => numero(Number(formatearValor(v, entero)));

/** Cuántos robots pueden practicar a la vez: un worker por núcleo, dejando uno para la página (decisión 9). */
export function maximoRobots(nucleos: number | undefined): number {
  return Math.min(MAXIMO_ROBOTS, Math.max(1, (nucleos ?? 2) - 1));
}

/**
 * La ventana "Ajustar parámetros": qué valores ajustar y en qué rango, la configuración
 * del entrenamiento, el progreso con su gráfico y el mejor resultado. Se construye con textContent:
 * los nombres de los valores vienen del código del estudiante.
 */
export function crearVentanaAjuste(raiz: Document, eventos: VentanaAjusteEventos): { abrir(): void } {
  const $ = <E extends HTMLElement>(id: string) => raiz.getElementById(id) as E;
  const ventana = $<HTMLDialogElement>('ventana-ajuste');
  const contenedor = $('aj-pids');
  const listaAvisos = $('aj-avisos');
  const inputPruebas = $<HTMLInputElement>('aj-pruebas');
  const selectDuracion = $<HTMLSelectElement>('aj-duracion');
  const selectRobots = $<HTMLSelectElement>('aj-robots');
  const cajaError = $('aj-error');
  const botonTecnico = $<HTMLButtonElement>('aj-error-tecnico-btn');
  const textoTecnico = $('aj-error-tecnico');
  const svg = $('aj-grafico') as unknown as SVGSVGElement;
  const cajaGrafico = $('aj-grafico-caja');
  const tip = $('aj-tip');
  const botonVer = $<HTMLButtonElement>('aj-ver');
  const botonUsar = $<HTMLButtonElement>('aj-usar');

  let parametros: Ajustable[] = [];
  let eleccion: EleccionParametro[] = [];
  let entrenando: AbortController | null = null;
  /** El entrenamiento que se muestra: el en curso o el último. */
  let actual: {
    total: number;
    parametros: ParametroAgente[];
    pista: Pista;
    resultados: (ResultadoEntrenado & { record: boolean })[];
    mejor: ResultadoEntrenado | null;
  } | null = null;
  let geo: Geometria | null = null;
  let dibujoPendiente = false;

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, clase?: string, ...hijos: (Node | string)[]) => {
    const e = raiz.createElement(tag);
    if (clase) e.className = clase;
    e.append(...hijos);
    return e;
  };
  const elSvg = (tag: string, atributos: Record<string, string | number>, texto?: string) => {
    const e = raiz.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(atributos)) e.setAttribute(k, String(v));
    if (texto !== undefined) e.textContent = texto;
    return e;
  };

  const maximo = maximoRobots(navigator.hardwareConcurrency);
  for (let n = 1; n <= maximo; n++) selectRobots.append(new Option(String(n), String(n)));
  selectRobots.value = String(Math.min(4, maximo));

  // ¿Qué quieres ajustar?
  const tarjetaParametro = (p: Ajustable, i: number) => {
    const e = eleccion.find(x => x.id === p.id)!;
    const interruptor = el('input');
    Object.assign(interruptor, { type: 'checkbox', id: `aj-p${i}`, checked: e.ajustar });
    interruptor.addEventListener('change', () => { e.ajustar = interruptor.checked; });
    const etiqueta = el('label', 'interruptor', interruptor, el('span', undefined, p.nombre));
    etiqueta.htmlFor = interruptor.id;
    const limite = (cual: 'min' | 'max') => {
      const input = el('input');
      Object.assign(input, { type: 'number', step: 'any', id: `aj-p${i}-${cual}`, value: Number.isFinite(e[cual]) ? String(e[cual]) : '' });
      input.setAttribute('aria-label', `${cual === 'min' ? 'Mínimo' : 'Máximo'} de ${p.nombre}`);
      input.addEventListener('change', () => { e[cual] = input.value.trim() === '' ? NaN : Number(input.value); });
      return input;
    };
    return el('div', 'param', etiqueta, el('span', 'param-val', numero(p.valor)), el('span', 'param-ayuda', ayudaDe(p.nombre)),
      el('span', 'param-rango', 'Buscar de ', limite('min'), ' a ', limite('max')));
  };

  const pintarParametros = (avisos: AvisoAjustable[]) => {
    const propios = [...new Set(parametros.map(p => p.grupo))].filter(g => !GRUPOS.some(x => x.id === g))
      .map(g => ({ id: g, nombre: g, sensor: 'Grupo propio' }));
    contenedor.replaceChildren(...[...GRUPOS, ...propios].map(g => {
      const delGrupo = parametros.map((p, i) => ({ p, i })).filter(({ p }) => p.grupo === g.id);
      const cabecera = el('header', undefined, el('h3', undefined, g.nombre), el('small', undefined, g.sensor));
      if (delGrupo.length === 0) {
        return el('section', 'pid falta', cabecera, el('p', undefined, 'Todavía no está en tu código. Marca sus variables así:'),
          el('pre', undefined, `float kp = 1.0;  // @ajustar ${g.id}`));
      }
      cabecera.append(el('span', 'chip ok', 'En tu código'));
      return el('section', 'pid', cabecera, ...delGrupo.map(({ p, i }) => tarjetaParametro(p, i)));
    }));
    listaAvisos.replaceChildren(...avisos.map(a => el('li', undefined, `${a.mensaje} (${a.archivo}, línea ${a.linea})`)));
    listaAvisos.hidden = avisos.length === 0;
  };

  const ocultarError = () => { cajaError.hidden = true; };
  const mostrarError = (mensaje: string, tecnico = '') => {
    $('aj-error-txt').textContent = mensaje;
    textoTecnico.textContent = tecnico;
    textoTecnico.hidden = true;
    botonTecnico.hidden = tecnico === '';
    cajaError.hidden = false;
  };
  botonTecnico.addEventListener('click', () => { textoTecnico.hidden = !textoTecnico.hidden; });

  // Progreso, gráfico y mejor resultado.
  const pintarGrafico = () => {
    const ancho = cajaGrafico.clientWidth;
    if (ancho === 0) return;
    const total = actual?.total ?? (Number(inputPruebas.value) || PRUEBAS.porDefecto);
    const puntos = (actual?.resultados ?? []).map(r => ({ i: r.indice, r: r.recompensa }));
    geo = geometria({ ancho, alto: ALTO_GRAFICO, total, puntos });
    const { x, y, escala, margen } = geo;
    const hijos: Element[] = [elSvg('text', { x: margen.izq - 8, y: margen.arriba - 14, class: 'g-eje' }, 'Recompensa')];
    for (const m of escala.marcas) {
      hijos.push(elSvg('line', { x1: margen.izq, x2: ancho - margen.der, y1: y(m), y2: y(m), class: 'g-grid' }));
      hijos.push(elSvg('text', { x: margen.izq - 8, y: y(m) + 4, 'text-anchor': 'end', class: 'g-eje' }, numero(m, 2)));
    }
    for (const t of [...new Set([1, Math.round(total / 4), Math.round(total / 2), Math.round((total * 3) / 4), total])].filter(t => t >= 1)) {
      hijos.push(elSvg('text', { x: x(t), y: ALTO_GRAFICO - margen.abajo + 18, 'text-anchor': 'middle', class: 'g-eje' }, numero(t)));
    }
    hijos.push(elSvg('text', { x: margen.izq + (ancho - margen.izq - margen.der) / 2, y: ALTO_GRAFICO - 4, 'text-anchor': 'middle', class: 'g-eje' }, 'Número de prueba'));
    if (puntos.length === 0) {
      const medio = margen.izq + (ancho - margen.izq - margen.der) / 2;
      const vacio = elSvg('text', { x: medio, y: margen.arriba + (ALTO_GRAFICO - margen.arriba - margen.abajo) / 2 - 8, 'text-anchor': 'middle', class: 'g-vacio' });
      vacio.append(elSvg('tspan', { x: medio }, 'Presiona «Empezar a entrenar»'), elSvg('tspan', { x: medio, dy: 18 }, 'para ver cómo mejora tu robot'));
      hijos.push(vacio);
    } else {
      for (const p of puntos) hijos.push(elSvg('circle', { cx: x(p.i).toFixed(1), cy: y(p.r).toFixed(1), r: 4, class: 'g-punto' }));
      hijos.push(elSvg('path', { d: geo.camino, class: 'g-linea' }));
      for (const i of geo.records) {
        const r = puntos.find(p => p.i === i)!.r;
        hijos.push(elSvg('circle', { cx: x(i).toFixed(1), cy: y(r).toFixed(1), r: 6, class: 'g-record' }));
      }
    }
    hijos.push(elSvg('circle', { id: 'aj-foco', r: 8, class: 'g-foco', style: 'display:none' }));
    svg.setAttribute('viewBox', `0 0 ${ancho} ${ALTO_GRAFICO}`);
    svg.setAttribute('height', String(ALTO_GRAFICO));
    svg.replaceChildren(...hijos);
  };

  const pintarMejor = () => {
    const m = actual?.mejor ?? null;
    $('aj-mejor-r').textContent = m ? numero(m.recompensa, 2) : '—';
    $('aj-mejor-sub').textContent = m ? `Recompensa de la prueba ${numero(m.indice)}` : 'Todavía no hay un mejor resultado.';
    $('aj-tabla').replaceChildren(...(actual?.parametros ?? []).map(p => {
      const nombre = el('th', undefined, p.nombre, el('small', undefined, GRUPOS.find(g => g.id === p.grupo)?.nombre ?? p.grupo));
      nombre.scope = 'row';
      const mejor = el('td', m ? 'mejora' : undefined, m ? valorAjustado(m.valores[p.id], p.entero) : '—');
      return el('tr', undefined, nombre, el('td', undefined, numero(p.valor)), mejor);
    }));
    botonVer.disabled = botonUsar.disabled = !m || entrenando !== null;
    const lienzo = $<HTMLCanvasElement>('aj-mini');
    const dpr = window.devicePixelRatio || 1;
    const anchoPx = Math.round(lienzo.clientWidth * dpr);
    const altoPx = Math.round(lienzo.clientHeight * dpr);
    if (anchoPx === 0 || !actual) return;
    lienzo.width = anchoPx;
    lienzo.height = altoPx;
    const ctx = lienzo.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#EAF5FD';
    ctx.fillRect(0, 0, anchoPx, altoPx);
    const vista = vistaInicial(anchoPx, altoPx, actual.pista.columnas, actual.pista.filas);
    dibujarPista(ctx, vista, actual.pista);
    if (m) dibujarTrayectoria(ctx, vista, m.trayectoria);
  };

  const pintarProgreso = () => {
    const n = actual?.resultados.length ?? 0;
    const total = actual?.total ?? 0;
    $('aj-barra').style.width = total ? `${(n / total) * 100}%` : '0%';
    if (actual) $('aj-progreso').textContent = n === 0 ? 'Compilando tu programa…' : `Prueba ${numero(n)} de ${numero(total)}`;
  };

  /** Redibuja el gráfico y el mejor resultado una vez por cuadro, aunque lleguen muchos resultados. */
  const pedirDibujo = () => {
    if (dibujoPendiente) return;
    dibujoPendiente = true;
    requestAnimationFrame(() => {
      dibujoPendiente = false;
      pintarProgreso();
      pintarGrafico();
      pintarMejor();
    });
  };

  svg.addEventListener('pointermove', e => {
    const resultados = actual?.resultados ?? [];
    if (!geo || resultados.length === 0) return;
    const caja = svg.getBoundingClientRect();
    const xPuntero = e.clientX - caja.left;
    const cercano = resultados.reduce((a, b) => (Math.abs(geo!.x(b.indice) - xPuntero) < Math.abs(geo!.x(a.indice) - xPuntero) ? b : a));
    const cx = geo.x(cercano.indice);
    const cy = geo.y(cercano.recompensa);
    const valores = (actual?.parametros ?? []).map(p => `${p.nombre} ${valorAjustado(cercano.valores[p.id], p.entero)}`).join(' · ');
    tip.replaceChildren(el('b', undefined, `Prueba ${numero(cercano.indice)} · recompensa ${numero(cercano.recompensa, 2)}`), el('div', undefined, valores));
    tip.style.left = `${Math.min(caja.width - 90, Math.max(90, cx))}px`;
    tip.style.top = `${cy}px`;
    tip.hidden = false;
    const foco = svg.querySelector('#aj-foco');
    if (foco) {
      foco.setAttribute('cx', String(cx));
      foco.setAttribute('cy', String(cy));
      foco.setAttribute('style', '');
    }
  });
  svg.addEventListener('pointerleave', () => {
    tip.hidden = true;
    svg.querySelector('#aj-foco')?.setAttribute('style', 'display:none');
  });
  new ResizeObserver(() => { if (ventana.open) pedirDibujo(); }).observe(cajaGrafico);

  const fijarEntrenando = (si: boolean) => {
    for (const c of [...contenedor.querySelectorAll('input'), inputPruebas, selectDuracion, selectRobots]) c.disabled = si;
    $('aj-empezar-txt').textContent = si ? 'Detener entrenamiento' : 'Empezar a entrenar';
    $('aj-ico').setAttribute('d', si ? 'M6 6h12v12H6z' : 'M7 4.5v15l12.5-7.5z');
  };

  const empezar = async () => {
    ocultarError();
    const listos = paraElAgente(parametros, eleccion);
    if (!listos.ok) return mostrarError(listos.problema);
    const pruebas = Math.round(Number(inputPruebas.value));
    const presupuesto = Number.isFinite(pruebas) ? Math.min(PRUEBAS.max, Math.max(PRUEBAS.min, pruebas)) : PRUEBAS.porDefecto;
    inputPruebas.value = String(presupuesto);
    const control = new AbortController();
    entrenando = control;
    actual = { total: presupuesto, parametros: listos.parametros, pista: eventos.pista(), resultados: [], mejor: null };
    fijarEntrenando(true);
    $('aj-chip').textContent = 'Practicando…';
    pedirDibujo();
    let fin: FinVentana;
    try {
      fin = await eventos.entrenar({
        parametros: listos.parametros, presupuesto, duracionS: Number(selectDuracion.value), robots: Number(selectRobots.value),
        senal: control.signal,
        alResultado: r => {
          if (entrenando !== control || !actual) return;
          actual.resultados.push(r);
          if (r.record) actual.mejor = r;
          pedirDibujo();
        },
      });
    } catch (e) {
      // Si el entrenamiento no pudo partir (sin workers, por ejemplo), la ventana no queda entrenando.
      fin = { motivo: 'error', error: describirError(e, 'el entrenamiento'), mejor: actual?.mejor ?? null };
    }
    entrenando = null;
    fijarEntrenando(false);
    $('aj-chip').textContent = { completo: 'Terminado', detenido: 'Detenido', error: 'Sin terminar', 'no-compila': 'Sin empezar' }[fin.motivo];
    if (fin.motivo === 'no-compila') mostrarError(fin.mensaje);
    else if (fin.motivo === 'error' && fin.error) mostrarError(fin.error.mensaje, fin.error.tecnico);
    if (actual && actual.resultados.length === 0) $('aj-progreso').textContent = 'Aún no hay pruebas.';
    pedirDibujo();
  };
  $('aj-empezar').addEventListener('click', () => {
    if (entrenando) entrenando.abort();
    else void empezar();
  });
  $('aj-cerrar').addEventListener('click', () => ventana.close());
  ventana.addEventListener('close', () => { tip.hidden = true; });
  botonVer.addEventListener('click', () => {
    if (!actual?.mejor) return;
    ventana.close();
    eventos.alVer(actual.mejor);
  });
  botonUsar.addEventListener('click', () => {
    if (!actual?.mejor) return;
    ventana.close();
    eventos.alUsar(actual.mejor);
  });

  return {
    abrir() {
      if (!entrenando) {
        const { parametros: encontrados, avisos } = buscarAjustables(eventos.proyecto());
        parametros = encontrados;
        eleccion = elecciones(parametros, eleccion);
        pintarParametros(avisos);
        $('aj-pista').textContent = eventos.pista().nombre;
        ocultarError();
      }
      ventana.showModal();
      pedirDibujo();
    },
  };
}
