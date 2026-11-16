/**
 * Las ventanas de Programar que se agrandan desde una esquina: la manilla de «Mi programa» (abajo a la
 * derecha) y la de «Pista» (abajo a la izquierda), las esquinas que dan hacia la otra columna.
 * De lado cambian el reparto entre las dos columnas; hacia arriba o abajo, el alto de su ventana.
 */
export interface Tamanos {
  /** La parte del ancho que se lleva la columna de «Mi programa», de 0,3 a 0,7. */
  columna: number;
  /** El alto del editor en px; null es el de siempre. */
  altoEditor: number | null;
  /** El alto de la pista en px; null es el de siempre (4:3 con el ancho de su columna). */
  altoPista: number | null;
}

export const TAMANOS_ORIGINALES: Readonly<Tamanos> = { columna: 0.47, altoEditor: null, altoPista: null };

const COLUMNA = { min: 0.3, max: 0.7 };
const ALTO_EDITOR = { min: 200, max: 1200 };
const ALTO_PISTA_MIN = 200;
const PASO_PX = 10;
const PASO_PX_GRANDE = 50;
const PASO_COLUMNA = 0.02;
const PASO_COLUMNA_GRANDE = 0.1;
/** Con una sola columna (igual que en tema.css) solo cambia el alto. */
const PANTALLA_ANGOSTA = '(max-width: 1100px)';

const esNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const entre = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const alto = (v: unknown, min: number, max: number) => (esNumero(v) ? Math.round(entre(v, min, Math.max(min, max))) : null);

/** Deja los tamaños dentro de sus límites; lo que no es un número vuelve al original. */
export function acotar(t: Partial<Tamanos> | null | undefined, altoPantalla: number): Tamanos {
  return {
    columna: esNumero(t?.columna) ? Math.round(entre(t.columna, COLUMNA.min, COLUMNA.max) * 1000) / 1000 : TAMANOS_ORIGINALES.columna,
    altoEditor: alto(t?.altoEditor, ALTO_EDITOR.min, ALTO_EDITOR.max),
    altoPista: alto(t?.altoPista, ALTO_PISTA_MIN, altoPantalla),
  };
}

const iguales = (a: Tamanos, b: Tamanos) => a.columna === b.columna && a.altoEditor === b.altoEditor && a.altoPista === b.altoPista;

export interface OpcionesManillas {
  inicial: Tamanos;
  /** Al soltar la manilla, con las flechas o con doble clic: para guardarlo. */
  alCambiar(t: Tamanos): void;
}

export function crearManillas(raiz: Document, o: OpcionesManillas): void {
  const ventana = raiz.defaultView ?? window;
  const grilla = raiz.querySelector<HTMLElement>('.grid-programar')!;
  const lienzo = raiz.getElementById('lienzo-sim')!;
  const editor = () => raiz.querySelector<HTMLElement>('#editor .cm-editor') ?? raiz.getElementById('editor')!;
  const angosta = () => ventana.matchMedia(PANTALLA_ANGOSTA).matches;
  /** El ancho que se reparten las dos columnas (sin el espacio entre ellas). */
  const anchoRepartido = () => grilla.getBoundingClientRect().width - (parseFloat(ventana.getComputedStyle(grilla).columnGap) || 0);
  const manillas = [
    { el: raiz.getElementById('manilla-editor')!, clave: 'altoEditor' as const, medir: () => editor().getBoundingClientRect().height },
    { el: raiz.getElementById('manilla-pista')!, clave: 'altoPista' as const, medir: () => lienzo.getBoundingClientRect().height },
  ];

  let actual = acotar(o.inicial, ventana.innerHeight);
  const ponerAlto = (variable: string, px: number | null) => {
    if (px === null) grilla.style.removeProperty(variable);
    else grilla.style.setProperty(variable, `${px}px`);
  };
  const aplicar = (t: Tamanos) => {
    actual = t;
    const izquierda = Math.round(t.columna * 1000);
    grilla.style.setProperty('--columnas', `minmax(0, ${izquierda}fr) minmax(0, ${1000 - izquierda}fr)`);
    ponerAlto('--alto-editor', t.altoEditor);
    ponerAlto('--alto-pista', t.altoPista);
    grilla.classList.toggle('pista-con-alto', t.altoPista !== null);
    for (const m of manillas) m.el.setAttribute('aria-valuenow', String(Math.round(t.columna * 100)));
  };
  const fijar = (t: Tamanos) => {
    const nuevo = acotar(t, ventana.innerHeight);
    if (iguales(nuevo, actual)) return;
    aplicar(nuevo);
    o.alCambiar(nuevo);
  };
  aplicar(actual);

  for (const m of manillas) {
    let inicio: { x: number; y: number; columna: number; alto: number; altoEra: number | null; ancho: number; antes: Tamanos } | null = null;
    m.el.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      m.el.setPointerCapture(e.pointerId);
      inicio = {
        x: e.clientX, y: e.clientY, columna: actual.columna, alto: m.medir(), altoEra: actual[m.clave],
        ancho: anchoRepartido(), antes: actual,
      };
    });
    m.el.addEventListener('pointermove', e => {
      if (!inicio || !m.el.hasPointerCapture(e.pointerId)) return;
      const dx = e.clientX - inicio.x;
      const dy = e.clientY - inicio.y;
      aplicar(acotar({
        ...actual,
        columna: angosta() || inicio.ancho <= 0 ? actual.columna : inicio.columna + dx / inicio.ancho,
        // Solo de lado: el alto queda como estaba (el de siempre, si no se había cambiado).
        [m.clave]: dy === 0 && inicio.altoEra === null ? null : inicio.alto + dy,
      }, ventana.innerHeight));
    });
    const terminar = () => {
      if (!inicio) return;
      const { antes } = inicio;
      inicio = null;
      if (!iguales(antes, actual)) o.alCambiar(actual);
    };
    m.el.addEventListener('pointerup', terminar);
    m.el.addEventListener('lostpointercapture', terminar);
    m.el.addEventListener('dblclick', () => fijar({ ...TAMANOS_ORIGINALES }));
    m.el.addEventListener('keydown', e => {
      const grande = e.shiftKey;
      const signo = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (angosta()) return;
        fijar({ ...actual, columna: actual.columna + signo * (grande ? PASO_COLUMNA_GRANDE : PASO_COLUMNA) });
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        fijar({ ...actual, [m.clave]: m.medir() + signo * (grande ? PASO_PX_GRANDE : PASO_PX) });
      } else {
        return;
      }
      e.preventDefault();
    });
  }

  // Si la pantalla se achica, la pista no queda más alta que ella (no se guarda: es solo por ahora).
  ventana.addEventListener('resize', () => aplicar(acotar(actual, ventana.innerHeight)));
}
