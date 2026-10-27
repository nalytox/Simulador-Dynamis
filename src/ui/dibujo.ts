import type { Vista } from './vista';
import { colorMuestra } from './lecturas';
import { figurasDe, type Figura } from '../pista/catalogo';
import { colorVisible } from '../mundo/superficie';
import { rectanguloGirado } from '../mundo/geometria';
import { gradosARadianes, pistaVacia, poseInicial } from '../pista/serializacion';
import { agregarObjeto, colocarBaldosa } from '../pista/edicion';
import type { Pieza } from './paleta';
import type { Ubicacion } from '../pista/baldosas';
import { TAMANO_BALDOSA as T, type Baldosa, type ObjetoDePista, type Pista } from '../pista/tipos';
import { poseVL53, type LecturaTCS } from '../simulacion/sensores';
import type { EstadoRobot, Pose } from '../simulacion/simulador';
import type { Instantanea } from '../simulacion/ejecucion';
import type { ConfigRobot } from '../robot/config';
import { piezasRobot } from './figura-robot';

/** Colores de la paleta de Dynamis. */
const C = { azul: '#0B0F98', celeste: '#65C7F7', hielo: '#DDF4FF', sol: '#FFD166', rosa: '#FF9FAD', tinta: '#12164A', rejilla: '#CFE7F7' };
/** El verde de la placa de circuito. */
const PLACA = '#1E7B5A';
/** Una lectura del QTR sobre esto se considera "ve línea" en el dibujo. */
const QTR_VE_LINEA = 2000;
const SIN_OBJETIVO_MM = 8190;
const RAYO_MAXIMO_MM = 2000;

/** Pasa a coordenadas de la pista en mm, con y hacia arriba. */
function enMundo(ctx: CanvasRenderingContext2D, v: Vista): void {
  ctx.setTransform(v.escala, 0, 0, -v.escala, v.x0, v.y0);
}

/** Texto derecho (el marco del mundo tiene la y invertida). */
function texto(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, tamano: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, -1);
  ctx.fillStyle = color;
  ctx.font = `600 ${tamano}px Fredoka, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s, 0, 0);
  ctx.restore();
}

function figura(ctx: CanvasRenderingContext2D, f: Figura): void {
  ctx.beginPath();
  if (f.forma === 'rect') ctx.rect(f.u0, f.v0, f.u1 - f.u0, f.v1 - f.v0);
  else {
    ctx.arc(f.cu, f.cv, f.r1, f.a0, f.a1);
    ctx.arc(f.cu, f.cv, f.r0, f.a1, f.a0, true);
    ctx.closePath();
  }
  ctx.fill();
}

/** Una baldosa en su marco local (u desde la entrada, v hacia el norte), con las mismas figuras que siente el robot. */
function baldosa(ctx: CanvasRenderingContext2D, b: Baldosa, colorMarcas?: string): void {
  ctx.save();
  ctx.translate(b.c * T + T / 2, b.r * T + T / 2);
  ctx.rotate(gradosARadianes(b.rot));
  ctx.translate(-T / 2, -T / 2);
  ctx.fillStyle = colorVisible(b, null);
  ctx.fillRect(0, 0, T, T);
  for (const f of figurasDe(b, colorMarcas)) {
    ctx.fillStyle = colorVisible(b, f);
    figura(ctx, f);
  }
  // Decoraciones del relieve: existen solo en pantalla.
  if (b.tipo === 'rampa') {
    const g = ctx.createLinearGradient(0, 0, T, 0);
    g.addColorStop(0, 'rgba(101,199,247,0.04)');
    g.addColorStop(1, 'rgba(101,199,247,0.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, T, T);
    ctx.strokeStyle = 'rgba(11,15,152,0.5)';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const v of [64, 236]) for (const u of [86, 166, 246]) {
      ctx.beginPath();
      ctx.moveTo(u - 18, v - 22);
      ctx.lineTo(u + 4, v);
      ctx.lineTo(u - 18, v + 22);
      ctx.stroke();
    }
  } else if (b.nivel > 0) {
    ctx.fillStyle = 'rgba(101,199,247,0.3)';
    ctx.fillRect(0, 0, T, T);
  }
  ctx.restore();
}

function objeto(ctx: CanvasRenderingContext2D, o: ObjetoDePista): void {
  if (o.tipo === 'obstaculo') {
    const huella = rectanguloGirado(o.x, o.y, gradosARadianes(o.rot), o.props.largo, o.props.ancho);
    ctx.beginPath();
    huella.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = '#A9B4E0';
    ctx.fill();
    ctx.strokeStyle = C.azul;
    ctx.lineWidth = 4;
    ctx.stroke();
  } else if (o.tipo === 'bache') {
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(gradosARadianes(o.rot));
    ctx.beginPath();
    ctx.roundRect(-o.props.largo / 2, -o.props.radio, o.props.largo, 2 * o.props.radio, o.props.radio);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(11,15,152,0.55)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  } else if (o.tipo === 'hito') {
    ctx.beginPath();
    ctx.arc(o.x, o.y, 34, 0, 2 * Math.PI);
    ctx.fillStyle = C.sol;
    ctx.fill();
    ctx.strokeStyle = C.azul;
    ctx.lineWidth = 5;
    ctx.stroke();
    texto(ctx, String(o.props.numero), o.x, o.y, 40, C.azul);
  } else if (o.tipo === 'desafio') {
    ctx.beginPath();
    ctx.roundRect(o.x - 34, o.y - 22, 68, 44, 14);
    ctx.fillStyle = C.rosa;
    ctx.fill();
    ctx.strokeStyle = C.azul;
    ctx.lineWidth = 4;
    ctx.stroke();
    texto(ctx, o.props.nombre, o.x, o.y, 30, C.azul);
  }
}

function flechaInicio(ctx: CanvasRenderingContext2D, pose: Pose): void {
  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.yaw);
  ctx.beginPath();
  ctx.moveTo(-70, -26);
  ctx.lineTo(-30, 0);
  ctx.lineTo(-70, 26);
  ctx.strokeStyle = C.celeste;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

/** La pista: baldosas, rejilla suave, relieve, objetos y la flecha de inicio. */
export function dibujarPista(ctx: CanvasRenderingContext2D, v: Vista, pista: Pista): void {
  enMundo(ctx, v);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, pista.columnas * T, pista.filas * T);
  for (const b of pista.baldosas) baldosa(ctx, b, pista.colorMarcas);
  ctx.strokeStyle = C.rejilla;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let c = 0; c <= pista.columnas; c++) { ctx.moveTo(c * T, 0); ctx.lineTo(c * T, pista.filas * T); }
  for (let r = 0; r <= pista.filas; r++) { ctx.moveTo(0, r * T); ctx.lineTo(pista.columnas * T, r * T); }
  ctx.stroke();
  for (const o of pista.objetos) objeto(ctx, o);
  flechaInicio(ctx, poseInicial(pista));
}

/** Lo que el editor de pista dibuja encima de la pista. */
export interface MarcasEditor {
  /** Celdas con avisos de la revisión de las bases (borde rosado). */
  conAvisos: { c: number; r: number }[];
  /** La pieza que se colocaría bajo el cursor, semitransparente. */
  fantasma: Baldosa | null;
  /** Baldosas con la flecha rosada que muestra por dónde entra el robot. */
  flechas: Ubicacion[];
  /** La celda elegida (borde azul). */
  elegida: { c: number; r: number } | null;
  /** El objeto o el inicio elegido: un anillo azul alrededor. */
  anillo: { x: number; y: number; radio: number } | null;
  /** La celda con el foco del teclado (borde punteado). */
  foco: { c: number; r: number } | null;
}

/** Las marcas del editor sobre la pista ya dibujada con la misma vista. */
export function dibujarMarcasEditor(ctx: CanvasRenderingContext2D, v: Vista, m: MarcasEditor): void {
  enMundo(ctx, v);
  const px = (n: number) => (n * (globalThis.devicePixelRatio || 1)) / v.escala;
  const borde = (c: number, r: number, color: string, ancho: number, guiones: number[] = []) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = px(ancho);
    ctx.setLineDash(guiones.map(px));
    const dentro = px(ancho / 2 + 2);
    ctx.strokeRect(c * T + dentro, r * T + dentro, T - 2 * dentro, T - 2 * dentro);
    ctx.setLineDash([]);
  };
  if (m.fantasma) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    baldosa(ctx, m.fantasma);
    ctx.restore();
  }
  for (const { c, r } of m.conAvisos) borde(c, r, C.rosa, 3);
  for (const b of m.flechas) {
    ctx.save();
    ctx.translate(b.c * T + T / 2, b.r * T + T / 2);
    ctx.rotate(gradosARadianes(b.rot));
    ctx.translate(-T / 2, -T / 2);
    ctx.fillStyle = C.rosa;
    ctx.beginPath();
    ctx.moveTo(6, 108);
    ctx.lineTo(52, 150);
    ctx.lineTo(6, 192);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  if (m.elegida) borde(m.elegida.c, m.elegida.r, C.azul, 4);
  if (m.anillo) {
    ctx.strokeStyle = C.azul;
    ctx.lineWidth = px(4);
    ctx.beginPath();
    ctx.arc(m.anillo.x, m.anillo.y, m.anillo.radio, 0, 2 * Math.PI);
    ctx.stroke();
  }
  if (m.foco) borde(m.foco.c, m.foco.r, C.tinta, 2, [6, 5]);
}

/** La miniatura de una pieza de la paleta: su baldosa, o el objeto o el inicio sobre una recta. */
export function dibujarMiniatura(canvas: HTMLCanvasElement, pieza: Pieza): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  // El inicio queda fuera del dibujo salvo en la pieza "Inicio del robot".
  let pista: Pista = { ...pistaVacia(1, 1), inicio: { x: -10 * T, y: -10 * T, yaw: 0 } };
  if (pieza.clase === 'baldosa') pista = colocarBaldosa(pista, 0, 0, pieza.tipo, 0, pieza.props);
  else {
    pista = colocarBaldosa(pista, 0, 0, 'recta');
    if (pieza.clase === 'objeto') pista = agregarObjeto(pista, pieza.tipo, T / 2, T / 2).pista;
    else pista = { ...pista, inicio: { x: T / 2 + 50, y: T / 2, yaw: 0 } };
  }
  const escala = Math.min(canvas.width, canvas.height) / T;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  dibujarPista(ctx, { escala, x0: (canvas.width - T * escala) / 2, y0: (canvas.height + T * escala) / 2 }, pista);
}

function rayoVL53(ctx: CanvasRenderingContext2D, estado: EstadoRobot, robot: ConfigRobot, distanciaMm: number): void {
  const s = poseVL53(estado, robot);
  const largo = distanciaMm >= SIN_OBJETIVO_MM ? RAYO_MAXIMO_MM : Math.min(distanciaMm, RAYO_MAXIMO_MM);
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.yaw);
  const g = ctx.createLinearGradient(0, 0, largo, 0);
  g.addColorStop(0, 'rgba(101,199,247,.55)');
  g.addColorStop(1, 'rgba(101,199,247,.08)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.lineTo(largo, -10 - largo * 0.03);
  ctx.lineTo(largo, 10 + largo * 0.03);
  ctx.lineTo(0, 4);
  ctx.fill();
  if (distanciaMm < SIN_OBJETIVO_MM && distanciaMm <= RAYO_MAXIMO_MM) {
    ctx.fillStyle = C.celeste;
    ctx.beginPath();
    ctx.arc(largo, 0, 9, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * El robot con cara, su rastro, el rayo del VL53L0X, los puntos del QTR (amarillos si ven línea) y
 * el del TCS34725 con el color que lee. Se agranda un poco al subir (z).
 */
export function dibujarRobot(ctx: CanvasRenderingContext2D, v: Vista, i: Instantanea | null, pose: Pose, robot: ConfigRobot, rastro: { x: number; y: number }[][]): void {
  enMundo(ctx, v);
  ctx.strokeStyle = 'rgba(255,159,173,0.85)';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const tramo of rastro) {
    if (tramo.length < 2) continue;
    ctx.beginPath();
    tramo.forEach((p, k) => (k === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
  }
  const estado: EstadoRobot = i ? { ...i.estado } : { x: pose.x, y: pose.y, z: 0, yaw: pose.yaw, pitch: 0, roll: 0 };
  if (i) rayoVL53(ctx, estado, robot, i.sensores.distanciaMm);

  const { chasis, qtr, tcs34725, tcs34725b, vl53l0x } = robot;
  ctx.save();
  ctx.translate(estado.x, estado.y);
  ctx.rotate(estado.yaw);
  const escala = 1 + Math.min(Math.max(estado.z, 0), 200) / 400;
  ctx.scale(escala, escala);
  // Ruedas (las motrices y las locas), chasis y placa (marco del robot: x adelante, y a la izquierda).
  const piezas = piezasRobot(robot);
  for (const r of piezas.ruedas) {
    ctx.fillStyle = r.tipo === 'motriz' ? '#23285E' : '#4A5090';
    ctx.beginPath();
    ctx.roundRect(r.x - r.largo / 2, r.y - r.ancho / 2, r.largo, r.ancho, Math.min(6, r.ancho / 2));
    ctx.fill();
  }
  const atras = chasis.xDelantero - chasis.largo;
  ctx.fillStyle = C.azul;
  ctx.beginPath();
  ctx.roundRect(atras, -chasis.ancho / 2, chasis.largo, chasis.ancho, Math.min(30, chasis.largo / 4, chasis.ancho / 4));
  ctx.fill();
  const { placa } = piezas;
  ctx.fillStyle = PLACA;
  ctx.beginPath();
  ctx.roundRect(placa.x - placa.largo / 2, -placa.ancho / 2, placa.largo, placa.ancho, 6);
  ctx.fill();
  // El ESP32 sobre la placa.
  ctx.fillStyle = C.tinta;
  ctx.beginPath();
  ctx.roundRect(placa.x - placa.largo / 4, -placa.ancho / 5, placa.largo / 4, placa.ancho * 2 / 5, 3);
  ctx.fill();
  // Sensores: la barra del QTR (el sensor 0 es el de la izquierda, +y), los TCS y el VL53L0X.
  const medio = (qtr.pines.length - 1) / 2;
  ctx.fillStyle = '#060962';
  ctx.beginPath();
  ctx.roundRect(qtr.x - 8, -(medio + 0.8) * qtr.separacion, 16, (2 * medio + 1.6) * qtr.separacion, 6);
  ctx.fill();
  qtr.pines.forEach((_, k) => {
    ctx.fillStyle = i && i.sensores.qtr[k] > QTR_VE_LINEA ? C.sol : '#3A3F8C';
    ctx.beginPath();
    ctx.arc(qtr.x, (medio - k) * qtr.separacion, 3.8, 0, 2 * Math.PI);
    ctx.fill();
  });
  const sensorColor = (s: { x: number; y: number }, c: LecturaTCS | null | undefined) => {
    ctx.fillStyle = c ? colorMuestra(c) : '#FFFFFF';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(s.x - 9, s.y - 9, 18, 18, 5);
    ctx.fill();
    ctx.stroke();
  };
  sensorColor(tcs34725, i?.sensores.color);
  if (tcs34725b?.instalado) sensorColor(tcs34725b, i?.sensores.color2);
  ctx.fillStyle = C.celeste;
  ctx.beginPath();
  ctx.roundRect(vl53l0x.x - 4, vl53l0x.y - 7, 8, 14, 3);
  ctx.fill();
  ctx.restore();
}

/**
 * El robot solo, visto desde arriba y mirando hacia arriba, para la ventana "Mi robot": el mismo
 * dibujo de la pista, el contorno del chasis y el MPU6050 con una flecha en su eje x.
 */
export function dibujarFichaRobot(ctx: CanvasRenderingContext2D, v: Vista, robot: ConfigRobot): void {
  const pose: Pose = { x: 0, y: 0, yaw: Math.PI / 2 };
  dibujarRobot(ctx, v, null, pose, robot, []);
  enMundo(ctx, v);
  ctx.save();
  ctx.rotate(pose.yaw);
  const px = (globalThis.devicePixelRatio || 1) / v.escala;
  ctx.strokeStyle = C.rosa;
  ctx.lineWidth = 2 * px;
  ctx.setLineDash([6 * px, 4 * px]);
  ctx.strokeRect(robot.chasis.xDelantero - robot.chasis.largo, -robot.chasis.ancho / 2, robot.chasis.largo, robot.chasis.ancho);
  ctx.setLineDash([]);
  // El MPU6050 y una flecha hacia donde apunta su eje x.
  const { desde, hasta } = piezasRobot(robot).flechaMPU;
  const sentido = Math.sign(hasta.x - desde.x) || 1;
  ctx.strokeStyle = C.sol;
  ctx.fillStyle = C.sol;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(desde.x, desde.y);
  ctx.lineTo(hasta.x, hasta.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(hasta.x + sentido * 6, hasta.y);
  ctx.lineTo(hasta.x - sentido * 4, hasta.y + 6);
  ctx.lineTo(hasta.x - sentido * 4, hasta.y - 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = C.tinta;
  ctx.lineWidth = 1.5 * px;
  ctx.beginPath();
  ctx.roundRect(desde.x - 6, desde.y - 6, 12, 12, 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** El recorrido de una prueba (mm del mundo), como una línea amarilla sobre la pista ya dibujada. */
export function dibujarTrayectoria(ctx: CanvasRenderingContext2D, v: Vista, puntos: { x: number; y: number }[]): void {
  if (puntos.length < 2) return;
  enMundo(ctx, v);
  ctx.strokeStyle = 'rgba(255,209,102,.95)';
  ctx.lineWidth = (5 * (globalThis.devicePixelRatio || 1)) / v.escala;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  puntos.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
}
