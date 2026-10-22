import { acercar, aPantalla, desplazar, vistaInicial, type Vista } from './vista';
import { dibujarPista, dibujarRobot } from './dibujo';
import type { Instantanea } from '../simulacion/ejecucion';
import type { Pose } from '../simulacion/simulador';
import type { Pista } from '../pista/tipos';
import type { ConfigRobot } from '../robot/config';

export interface Lienzo {
  mostrarPista(p: Pista): void;
  mostrarInstantanea(i: Instantanea): void;
  /** Deja al robot quieto en `pose`, sin lecturas ni rastro. */
  reiniciar(pose: Pose): void;
  /** Para las pruebas: píxel del lienzo (en píxeles del dispositivo) de un punto de la pista. */
  aPantalla(x: number, y: number): { px: number; py: number };
  vista(): Vista;
}

const MAXIMO_RASTRO = 4000;
const PASO_ZOOM = 1.2;
const PASO_TECLADO_PX = 40;
const FONDO = '#EAF5FD';

/** La pista y el robot (spec §12): rueda para acercar, arrastrar para mover, doble clic para ver todo. */
export function crearLienzo(canvas: HTMLCanvasElement, robot: ConfigRobot): Lienzo {
  const ctx = canvas.getContext('2d')!;
  let pista: Pista | null = null;
  let vista: Vista = { escala: 0, x0: 0, y0: 0 };
  let minima = 0;
  let ajustada = true;
  let pose: Pose = { x: 0, y: 0, yaw: 0 };
  let instantanea: Instantanea | null = null;
  let rastro: { x: number; y: number }[][] = [];
  let reinicio = -1;
  let pendiente = false;

  const dpr = () => window.devicePixelRatio || 1;
  const ajustar = () => {
    if (!pista || canvas.width === 0) return;
    const inicial = vistaInicial(canvas.width, canvas.height, pista.columnas, pista.filas);
    minima = inicial.escala;
    if (ajustada) vista = inicial;
  };
  const dibujar = () => {
    pendiente = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = FONDO;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!pista || vista.escala === 0) return;
    dibujarPista(ctx, vista, pista);
    dibujarRobot(ctx, vista, instantanea, pose, robot, rastro);
  };
  const pedirDibujo = () => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(dibujar);
  };
  const cambiarVista = (v: Vista) => {
    vista = v;
    ajustada = false;
    pedirDibujo();
  };

  new ResizeObserver(() => {
    const ancho = Math.round(canvas.clientWidth * dpr());
    const alto = Math.round(canvas.clientHeight * dpr());
    if (ancho === canvas.width && alto === canvas.height) return;
    canvas.width = ancho;
    canvas.height = alto;
    ajustar();
    pedirDibujo();
  }).observe(canvas);

  canvas.tabIndex = 0;
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    cambiarVista(acercar(vista, e.deltaY < 0 ? PASO_ZOOM : 1 / PASO_ZOOM, e.offsetX * dpr(), e.offsetY * dpr(), minima));
  }, { passive: false });
  let arrastre: { x: number; y: number } | null = null;
  canvas.addEventListener('pointerdown', e => {
    arrastre = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!arrastre) return;
    cambiarVista(desplazar(vista, (e.clientX - arrastre.x) * dpr(), (e.clientY - arrastre.y) * dpr()));
    arrastre = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', () => { arrastre = null; });
  const verTodo = () => {
    ajustada = true;
    ajustar();
    pedirDibujo();
  };
  canvas.addEventListener('dblclick', verTodo);
  canvas.addEventListener('keydown', e => {
    const centro = [canvas.width / 2, canvas.height / 2] as const;
    const paso = PASO_TECLADO_PX * dpr();
    const acciones: Record<string, () => void> = {
      '+': () => cambiarVista(acercar(vista, PASO_ZOOM, ...centro, minima)),
      '=': () => cambiarVista(acercar(vista, PASO_ZOOM, ...centro, minima)),
      '-': () => cambiarVista(acercar(vista, 1 / PASO_ZOOM, ...centro, minima)),
      '0': verTodo,
      ArrowLeft: () => cambiarVista(desplazar(vista, paso, 0)),
      ArrowRight: () => cambiarVista(desplazar(vista, -paso, 0)),
      ArrowUp: () => cambiarVista(desplazar(vista, 0, paso)),
      ArrowDown: () => cambiarVista(desplazar(vista, 0, -paso)),
    };
    const accion = acciones[e.key];
    if (!accion) return;
    e.preventDefault();
    accion();
  });

  return {
    mostrarPista(p) {
      pista = p;
      ajustada = true;
      ajustar();
      pedirDibujo();
    },
    mostrarInstantanea(i) {
      if (i.reinicio !== reinicio) {
        reinicio = i.reinicio;
        rastro.push([]);
      }
      rastro.at(-1)!.push({ x: i.estado.x, y: i.estado.y });
      let total = rastro.reduce((n, t) => n + t.length, 0);
      while (total > MAXIMO_RASTRO) {
        rastro[0].shift();
        total--;
        if (rastro[0].length === 0) rastro.shift();
      }
      instantanea = i;
      pose = { x: i.estado.x, y: i.estado.y, yaw: i.estado.yaw };
      pedirDibujo();
    },
    reiniciar(p) {
      pose = p;
      instantanea = null;
      rastro = [];
      reinicio = -1;
      pedirDibujo();
    },
    aPantalla: (x, y) => aPantalla(vista, x, y),
    vista: () => vista,
  };
}
