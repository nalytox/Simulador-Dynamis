import { buscarAjustables, type Ajustable, type AvisoAjustable } from '../compilador/ajustables';
import { ayudaDe, elecciones, GRUPOS, paraElAgente, type EleccionParametro } from '../ajuste/parametros';
import type { ParametroAgente } from '../ajuste/contrato';
import type { FinEntrenamiento, ResultadoEntrenado } from '../ajuste/entrenamiento';
import type { Proyecto } from '../proyecto/proyecto';

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
  nombrePista(): string;
  entrenar(p: PedidoEntrenamiento): Promise<FinVentana>;
  alVer(m: ResultadoEntrenado): void;
  alUsar(m: ResultadoEntrenado): void;
}

const PRUEBAS = { min: 10, max: 2000, porDefecto: 200 };
const MAXIMO_ROBOTS = 8;

const numero = (v: number) => v.toLocaleString('es-CL', { maximumFractionDigits: 6 });

/** Cuántos robots pueden practicar a la vez: un worker por núcleo, dejando uno para la página (decisión 9). */
export function maximoRobots(nucleos: number | undefined): number {
  return Math.min(MAXIMO_ROBOTS, Math.max(1, (nucleos ?? 2) - 1));
}

/**
 * La ventana "Ajustar parámetros" (spec §11.4): qué valores ajustar y en qué rango, la configuración
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

  let parametros: Ajustable[] = [];
  let eleccion: EleccionParametro[] = [];
  let entrenando: AbortController | null = null;

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, clase?: string, ...hijos: (Node | string)[]) => {
    const e = raiz.createElement(tag);
    if (clase) e.className = clase;
    e.append(...hijos);
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
    fijarEntrenando(true);
    $('aj-chip').textContent = 'Practicando…';
    const fin = await eventos.entrenar({
      parametros: listos.parametros, presupuesto, duracionS: Number(selectDuracion.value), robots: Number(selectRobots.value),
      senal: control.signal, alResultado: () => {},
    });
    entrenando = null;
    fijarEntrenando(false);
    $('aj-chip').textContent = fin.motivo === 'detenido' ? 'Detenido' : fin.motivo === 'completo' ? 'Terminado' : 'Sin empezar';
    if (fin.motivo === 'no-compila') mostrarError(fin.mensaje);
    else if (fin.motivo === 'error' && fin.error) mostrarError(fin.error.mensaje, fin.error.tecnico);
  };
  $('aj-empezar').addEventListener('click', () => {
    if (entrenando) entrenando.abort();
    else void empezar();
  });
  $('aj-cerrar').addEventListener('click', () => ventana.close());

  return {
    abrir() {
      if (!entrenando) {
        const { parametros: encontrados, avisos } = buscarAjustables(eventos.proyecto());
        parametros = encontrados;
        eleccion = elecciones(parametros, eleccion);
        pintarParametros(avisos);
        $('aj-pista').textContent = eventos.nombrePista();
        ocultarError();
      }
      ventana.showModal();
    },
  };
}
