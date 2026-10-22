import { PALETA, type Pieza } from './paleta';
import { dibujarMarcasEditor, dibujarMiniatura, dibujarPista, type MarcasEditor } from './dibujo';
import { aMundoDesde, aPantalla, vistaInicial, type Vista } from './vista';
import { registrarPrueba } from './pruebas';
import { baldosaEn, colocarBaldosa, girarBaldosa, vaciarCelda } from '../pista/edicion';
import { celdaDe } from '../pista/baldosas';
import { revisarPista } from '../pista/revision';
import { pistaVacia } from '../pista/serializacion';
import type { Baldosa, Pista } from '../pista/tipos';

export type Seleccion = { clase: 'baldosa'; c: number; r: number } | { clase: 'objeto'; indice: number } | { clase: 'inicio' };

export interface EditorPista {
  /** Muestra otra pista (abierta o nueva) sin avisar un cambio. */
  mostrar(p: Pista): void;
  pista(): Pista;
  seleccion(): Seleccion | null;
  elegir(sel: Seleccion | null): void;
  /** La pieza que se coloca con cada clic, o null con la herramienta Elegir. */
  herramienta(): Pieza | null;
}

type Celda = { c: number; r: number };

const FONDO = '#EAF5FD';
const LADO_MINIATURA_PX = 64;
const FLECHAS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };

/**
 * La vista Construir pista (spec §10.5): la paleta y la grilla. Con Elegir, un clic elige; con una
 * pieza, cada clic la coloca y la elige. Con el teclado: flechas, Enter, R (Mayús+R al revés), Supr y Esc.
 */
export function crearEditorPista(raiz: Document, eventos: { alCambiar(p: Pista): void; alElegir(sel: Seleccion | null): void }): EditorPista {
  const canvas = raiz.getElementById('lienzo-editor') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const chip = raiz.getElementById('chip-herr')!;
  const botonElegir = raiz.getElementById('btn-elegir')!;
  const dpr = () => window.devicePixelRatio || 1;

  let pista: Pista = pistaVacia();
  let celdasConAvisos: Celda[] = [];
  let sel: Seleccion | null = null;
  let herramienta: Pieza | null = null;
  let cursor: Celda | null = null;
  let foco: Celda = { c: 0, r: 0 };
  let conTeclado = false;
  let vista: Vista = { escala: 0, x0: 0, y0: 0 };
  let pendiente = false;

  // La paleta: un botón por pieza, con su miniatura.
  const botones = new Map<Pieza, HTMLButtonElement>();
  const contenedor = raiz.getElementById('paleta-baldosas')!;
  for (const grupo of PALETA) {
    const titulo = raiz.createElement('h3');
    titulo.textContent = grupo.grupo;
    const piezas = raiz.createElement('div');
    piezas.className = 'piezas';
    for (const pieza of grupo.piezas) {
      const boton = raiz.createElement('button');
      boton.type = 'button';
      boton.className = 'pieza';
      boton.setAttribute('aria-pressed', 'false');
      const miniatura = raiz.createElement('canvas');
      miniatura.width = miniatura.height = Math.round(LADO_MINIATURA_PX * dpr());
      miniatura.setAttribute('aria-hidden', 'true');
      dibujarMiniatura(miniatura, pieza);
      boton.append(miniatura, pieza.nombre);
      boton.addEventListener('click', () => usar(herramienta === pieza ? null : pieza));
      botones.set(pieza, boton);
      piezas.append(boton);
    }
    contenedor.append(titulo, piezas);
  }
  botonElegir.addEventListener('click', () => usar(null));

  const usar = (pieza: Pieza | null) => {
    herramienta = pieza;
    for (const [p, b] of botones) b.setAttribute('aria-pressed', String(p === pieza));
    botonElegir.setAttribute('aria-pressed', String(pieza === null));
    chip.textContent = pieza ? `Pieza: ${pieza.nombre}` : 'Elegir';
    pedirDibujo();
  };

  const dentro = ({ c, r }: Celda) => c >= 0 && r >= 0 && c < pista.columnas && r < pista.filas;
  const baldosaElegida = (): Baldosa | null => (sel?.clase === 'baldosa' ? baldosaEn(pista, sel.c, sel.r) : null);

  const ajustarVista = () => {
    if (canvas.width > 0) vista = vistaInicial(canvas.width, canvas.height, pista.columnas, pista.filas);
  };

  const fantasma = (): Baldosa | null => {
    if (!cursor || herramienta?.clase !== 'baldosa' || !dentro(cursor)) return null;
    const rot = baldosaEn(pista, cursor.c, cursor.r)?.rot ?? 0;
    return baldosaEn(colocarBaldosa(pista, cursor.c, cursor.r, herramienta.tipo, rot, herramienta.props), cursor.c, cursor.r);
  };

  const dibujar = () => {
    pendiente = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = FONDO;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (vista.escala === 0) return;
    dibujarPista(ctx, vista, pista);
    const sobre = fantasma() ?? (cursor && dentro(cursor) ? baldosaEn(pista, cursor.c, cursor.r) : null);
    const elegida = baldosaElegida();
    const marcas: MarcasEditor = {
      conAvisos: celdasConAvisos,
      fantasma: fantasma(),
      flechas: [elegida, sobre].filter((b): b is Baldosa => b !== null),
      elegida: sel?.clase === 'baldosa' ? sel : null,
      anillo: null,
      foco: conTeclado && raiz.activeElement === canvas ? foco : null,
    };
    dibujarMarcasEditor(ctx, vista, marcas);
  };
  const pedirDibujo = () => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(dibujar);
  };

  const cambiar = (p: Pista) => {
    const otroTamano = p.columnas !== pista.columnas || p.filas !== pista.filas;
    pista = p;
    celdasConAvisos = revisarPista(p).flatMap(a => a.baldosas ?? []);
    if (otroTamano) ajustarVista();
    pedirDibujo();
  };

  const elegir = (s: Seleccion | null) => {
    sel = s;
    if (s?.clase === 'baldosa') foco = { c: s.c, r: s.r };
    eventos.alElegir(s);
    pedirDibujo();
  };

  const editar = (p: Pista) => {
    cambiar(p);
    eventos.alCambiar(p);
  };

  /** Lo que hace un clic (o Enter) en la celda según la herramienta. */
  const aplicar = (celda: Celda) => {
    if (!dentro(celda)) {
      elegir(null);
      return;
    }
    if (herramienta?.clase === 'baldosa') {
      const rot = baldosaEn(pista, celda.c, celda.r)?.rot ?? 0;
      editar(colocarBaldosa(pista, celda.c, celda.r, herramienta.tipo, rot, herramienta.props));
    }
    elegir({ clase: 'baldosa', ...celda });
  };

  const celdaDelEvento = (e: MouseEvent): Celda => {
    const { x, y } = aMundoDesde(vista, e.offsetX * dpr(), e.offsetY * dpr());
    return celdaDe(x, y);
  };

  new ResizeObserver(() => {
    const ancho = Math.round(canvas.clientWidth * dpr());
    const alto = Math.round(canvas.clientHeight * dpr());
    if (ancho === canvas.width && alto === canvas.height) return;
    canvas.width = ancho;
    canvas.height = alto;
    ajustarVista();
    pedirDibujo();
  }).observe(canvas);

  canvas.tabIndex = 0;
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0 || vista.escala === 0) return;
    conTeclado = false;
    aplicar(celdaDelEvento(e));
  });
  canvas.addEventListener('pointermove', e => {
    if (vista.escala === 0) return;
    const celda = celdaDelEvento(e);
    if (cursor?.c === celda.c && cursor.r === celda.r) return;
    cursor = celda;
    pedirDibujo();
  });
  canvas.addEventListener('pointerleave', () => {
    cursor = null;
    pedirDibujo();
  });
  canvas.addEventListener('focus', pedirDibujo);
  canvas.addEventListener('blur', pedirDibujo);
  canvas.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const flecha = FLECHAS[e.key];
    const elegida = baldosaElegida();
    if (flecha) {
      conTeclado = true;
      foco = {
        c: Math.min(pista.columnas - 1, Math.max(0, foco.c + flecha[0])),
        r: Math.min(pista.filas - 1, Math.max(0, foco.r + flecha[1])),
      };
      pedirDibujo();
    } else if (e.key === 'Enter' || e.key === ' ') {
      conTeclado = true;
      aplicar(foco);
    } else if (e.key === 'r' || e.key === 'R') {
      if (elegida) editar(girarBaldosa(pista, elegida.c, elegida.r, e.shiftKey ? -1 : 1));
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (elegida) editar(vaciarCelda(pista, elegida.c, elegida.r));
      if (sel) elegir(sel);
    } else if (e.key === 'Escape') {
      usar(null);
    } else return;
    e.preventDefault();
  });

  registrarPrueba('editorPista', {
    pista: () => pista,
    seleccion: () => sel,
    aPantalla(x: number, y: number) {
      const { px, py } = aPantalla(vista, x, y);
      return { x: px / dpr(), y: py / dpr() };
    },
  });

  usar(null);
  return {
    mostrar(p) {
      cambiar(p);
      ajustarVista();
      foco = { c: 0, r: 0 };
      elegir(null);
    },
    pista: () => pista,
    seleccion: () => sel,
    elegir,
    herramienta: () => herramienta,
  };
}
