import { distanciaAPoligono, penetracion, puntoEnPoligono, rectanguloGirado } from '../mundo/geometria';
import type { MundoPista } from '../mundo/pista';
import type { Punto2 } from '../mundo/tipos';
import { aLocal, aMundo } from '../pista/baldosas';
import { accionEsperada, BARRA_META } from '../pista/catalogo';
import { puntosDePartida, type PuntoDePartida } from '../pista/puntos';
import { gradosARadianes } from '../pista/serializacion';
import { TAMANO_BALDOSA, type Accion, type Baldosa, type Hito, type Lado, type Obstaculo } from '../pista/tipos';
import { huellaRobot, type ConfigRobot } from '../robot/config';
import type { Pose } from '../simulacion/simulador';

/**
 * Juez virtual (spec §10.6): puntúa una ejecución como lo dicen las bases FIRVI. Es lógica pura:
 * recibe la pose del robot en cada paso de física y lleva hitos, meta, tiempo, reinicios y eventos.
 */
export const PUNTOS_HITO = [5, 10, 20, 20, 10, 15, 15, 20];
export type EstadoHito = 'pendiente' | 'alcanzado' | 'saltado';
export type TipoEvento = 'hito' | 'meta' | 'perdio-linea' | 'toco-obstaculo' | 'camino-equivocado' | 'reinicio' | 'fin-tiempo';

export interface EventoJuez { t: number; tipo: TipoEvento; mensaje: string; baldosa?: { c: number; r: number } }

export interface EstadoJuez {
  /** Punto de partida de la prueba ('partida', 'hito-n' o 'desafio-F1'). */
  desde: string;
  hitos: EstadoHito[];
  meta: boolean;
  /** Segundos desde que la huella salió de la partida; null si todavía no sale. */
  tiempo: number | null;
  reinicios: number;
  eventos: EventoJuez[];
  puntaje: number;
  terminado: boolean;
}

export interface OpcionesJuez {
  /** Segundos fuera de la línea antes de avisar (0,5 por defecto). */
  perdidaLineaS?: number;
  /** Cerca de un obstáculo, salir de la línea para rodearlo no cuenta (300 mm por defecto). */
  radioObstaculoMm?: number;
  /** Cada cuánto tiempo virtual evalúa el juez (10 ms por defecto). */
  pasoUs?: number;
  /** Id del punto de partida de la prueba ('partida' por defecto). */
  desde?: string;
}

const PUNTOS_META = 15;
const TIEMPO_LIMITE_S = 300;
const MAXIMO_REINICIOS = 3;
const DESCUENTO_REINICIO = 10;
const DESCUENTO_POR_CM = 20;
const LIMITE_TAMANO_MM = 200;
const VELOCIDAD_DETENIDO_MM_S = 5;
const DETENIDO_EN_META_S = 1;
const EPSILON_US = 1e-3;
/** Separación de la grilla de puntos de la huella con que se busca la línea bajo el robot. */
const PASO_HUELLA_MM = 5;
/** Lado por donde debe salir el robot de un cruce, si entró por la flecha (oeste). */
const SALIDA_ESPERADA: Record<Accion, Lado> = { recto: 'este', izq: 'norte', der: 'sur', vuelta: 'oeste' };
const NOMBRE_DECISION = { cruce: 'el cruce', unionT: 'la unión en T' } as const;

/** Por qué borde de la baldosa queda un punto que está fuera de ella (null si está dentro). */
function ladoFuera(b: Baldosa, x: number, y: number): Lado | null {
  const { u, v } = aLocal(b, x, y);
  if (u >= 0 && u < TAMANO_BALDOSA && v >= 0 && v < TAMANO_BALDOSA) return null;
  const excesos: [Lado, number][] = [['oeste', -u], ['este', u - TAMANO_BALDOSA], ['sur', -v], ['norte', v - TAMANO_BALDOSA]];
  return excesos.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

/** "a la partida", "al hito 2" o "a F1", para los mensajes. */
function aPunto(p: PuntoDePartida): string {
  if (p.id === 'partida') return 'a la partida';
  if (p.id.startsWith('hito-')) return `al hito ${p.id.slice('hito-'.length)}`;
  return `a ${p.nombre}`;
}

function cuadrado(c: number, r: number): Punto2[] {
  const x = c * TAMANO_BALDOSA;
  const y = r * TAMANO_BALDOSA;
  return [{ x, y }, { x: x + TAMANO_BALDOSA, y }, { x: x + TAMANO_BALDOSA, y: y + TAMANO_BALDOSA }, { x, y: y + TAMANO_BALDOSA }];
}

export class Juez {
  private readonly puntos: PuntoDePartida[];
  private readonly hitos: Hito[];
  private readonly estadosHito: EstadoHito[];
  private readonly partidas: Punto2[][];
  private readonly barrasMeta: Punto2[][];
  private readonly penalizacionTamano: number;
  private readonly pasoUs: number;
  private readonly desde: PuntoDePartida;

  private ultimoPunto: PuntoDePartida;
  private relojUs = 0;
  private tPrevioUs = 0;
  private ultimaEvalUs: number | null = null;
  private posePrevia: Pose | null = null;
  private inicioTiempo: number | null = null;
  private tiempoFinal: number | null = null;
  private paradaDesde: number | null = null;
  private meta = false;
  private terminado = false;
  private reinicios = 0;
  private intentado = false;
  private sinTiempo: boolean;
  private readonly eventos: EventoJuez[] = [];

  private readonly obstaculos: Punto2[][];
  private readonly perdidaLineaS: number;
  private readonly radioObstaculoMm: number;
  private fueraDeLineaDesde: number | null = null;
  private avisoLinea = false;
  private rodeando = false;
  private tocando = false;
  /** Baldosa bajo el centro del robot (undefined antes de la primera evaluación). */
  private baldosaActual: Baldosa | null | undefined = undefined;
  private entrada: Lado | null = null;
  private ladoF1Decidido = false;

  constructor(private readonly mundo: MundoPista, private readonly robot: ConfigRobot, opciones: OpcionesJuez = {}) {
    const pista = mundo.pista;
    this.pasoUs = opciones.pasoUs ?? 10_000;
    this.perdidaLineaS = opciones.perdidaLineaS ?? 0.5;
    this.radioObstaculoMm = opciones.radioObstaculoMm ?? 300;
    this.obstaculos = pista.objetos
      .filter((o): o is Obstaculo => o.tipo === 'obstaculo')
      .map(o => rectanguloGirado(o.x, o.y, gradosARadianes(o.rot), o.props.largo, o.props.ancho));
    this.puntos = puntosDePartida(pista);
    const idDesde = opciones.desde ?? 'partida';
    const desde = this.puntos.find(p => p.id === idDesde);
    if (!desde) throw new Error(`No existe el punto de partida "${idDesde}".`);
    this.desde = desde;
    this.ultimoPunto = desde;
    this.sinTiempo = desde.id !== 'partida';
    this.hitos = pista.objetos.filter((o): o is Hito => o.tipo === 'hito').sort((a, b) => a.props.numero - b.props.numero);
    this.estadosHito = this.hitos.map(h => (h.props.numero < desde.hitoSiguiente ? 'saltado' : 'pendiente'));
    this.partidas = pista.baldosas.filter(b => b.tipo === 'partida').map(b => cuadrado(b.c, b.r));
    this.barrasMeta = pista.baldosas
      .filter(b => b.tipo === 'meta')
      .map(b => [
        aMundo(b, BARRA_META.u0, BARRA_META.v0), aMundo(b, BARRA_META.u1, BARRA_META.v0),
        aMundo(b, BARRA_META.u1, BARRA_META.v1), aMundo(b, BARRA_META.u0, BARRA_META.v1),
      ]);
    const { largo, ancho, alto } = robot.chasis;
    this.penalizacionTamano = DESCUENTO_POR_CM *
      [largo, ancho, alto].reduce((suma, medida) => suma + Math.ceil(Math.max(0, medida - LIMITE_TAMANO_MM) / 10), 0);
  }

  get estado(): EstadoJuez {
    return {
      desde: this.desde.id,
      hitos: [...this.estadosHito],
      meta: this.meta,
      tiempo: this.tiempo,
      reinicios: this.reinicios,
      eventos: this.eventos.map(e => ({ ...e })),
      puntaje: this.puntaje,
      terminado: this.terminado,
    };
  }

  private get reloj(): number { return this.relojUs / 1e6; }

  private get tiempo(): number | null {
    if (this.tiempoFinal !== null) return this.tiempoFinal;
    return this.inicioTiempo === null ? null : this.reloj - this.inicioTiempo;
  }

  private get puntaje(): number {
    let puntaje = 0 - this.penalizacionTamano - DESCUENTO_REINICIO * this.reinicios; // 0 − 0 da 0, no −0
    this.estadosHito.forEach((e, i) => { if (e === 'alcanzado') puntaje += PUNTOS_HITO[this.hitos[i].props.numero - 1] ?? 0; });
    if (this.meta) {
      puntaje += PUNTOS_META;
      if (!this.sinTiempo && !this.estadosHito.includes('saltado')) puntaje += Math.max(0, (TIEMPO_LIMITE_S - (this.tiempo ?? 0)) / 4);
    }
    return puntaje;
  }

  /** Índice del primer hito pendiente, o −1. */
  private get pendiente(): number { return this.estadosHito.indexOf('pendiente'); }

  private puntoDeHito(i: number): PuntoDePartida {
    return this.puntos.find(p => p.id === `hito-${this.hitos[i].props.numero}`)!;
  }

  private anotar(tipo: TipoEvento, mensaje: string, baldosa?: { c: number; r: number }): void {
    this.eventos.push({ t: this.reloj, tipo, mensaje, ...(baldosa ? { baldosa } : {}) });
  }

  /** tUs: reloj del simulador actual (vuelve a 0 después de reiniciar). */
  actualizar(tUs: number, pose: Pose): void {
    if (this.terminado) return;
    const delta = Math.max(0, tUs - this.tPrevioUs);
    this.tPrevioUs = tUs;
    this.relojUs += delta;
    if (delta > 0 && this.pendiente >= 0) this.intentado = true;
    if (this.ultimaEvalUs !== null && this.relojUs - this.ultimaEvalUs < this.pasoUs - EPSILON_US) return;
    this.evaluar(pose);
    this.ultimaEvalUs = this.relojUs;
    this.posePrevia = pose;
  }

  private evaluar(pose: Pose): void {
    const t = this.reloj;
    const huella = huellaRobot(pose.x, pose.y, pose.yaw, this.robot);

    if (this.inicioTiempo === null && !this.partidas.some(p => penetracion(huella, p) !== null)) this.inicioTiempo = t;

    for (let i = this.pendiente; i >= 0 && puntoEnPoligono(this.hitos[i], huella); i = this.pendiente) {
      this.estadosHito[i] = 'alcanzado';
      this.ultimoPunto = this.puntoDeHito(i);
      this.intentado = false;
      const numero = this.hitos[i].props.numero;
      this.anotar('hito', `Llegaste al hito ${numero} (+${PUNTOS_HITO[numero - 1] ?? 0}).`);
    }

    this.revisarLinea(pose, t);
    this.revisarObstaculo(huella);
    this.revisarDecisiones(pose);

    const velocidad = this.posePrevia && this.ultimaEvalUs !== null && this.relojUs > this.ultimaEvalUs
      ? Math.hypot(pose.x - this.posePrevia.x, pose.y - this.posePrevia.y) / ((this.relojUs - this.ultimaEvalUs) / 1e6)
      : Infinity;
    const enMeta = this.barrasMeta.some(b => penetracion(huella, b) !== null);
    if (enMeta && velocidad < VELOCIDAD_DETENIDO_MM_S) this.paradaDesde ??= t;
    else this.paradaDesde = null;
    if (this.paradaDesde !== null && t - this.paradaDesde >= DETENIDO_EN_META_S - 1e-9) {
      this.meta = true;
      this.terminado = true;
      this.tiempoFinal = this.paradaDesde - (this.inicioTiempo ?? this.paradaDesde);
      this.anotar('meta', 'Llegaste a la meta y te detuviste (+15).');
      return;
    }

    if (this.inicioTiempo !== null && t - this.inicioTiempo >= TIEMPO_LIMITE_S) {
      this.terminado = true;
      this.tiempoFinal = t - this.inicioTiempo;
      this.anotar('fin-tiempo', 'Se acabaron los 5 minutos.');
    }
  }

  /** ¿Algún punto de una grilla de 5 mm dentro de la huella cae sobre la cinta? */
  private sobreLaLinea(pose: Pose): boolean {
    const { xDelantero, largo, ancho } = this.robot.chasis;
    const c = Math.cos(pose.yaw);
    const s = Math.sin(pose.yaw);
    for (let lx = xDelantero - largo; lx <= xDelantero; lx += PASO_HUELLA_MM) {
      for (let ly = -ancho / 2; ly <= ancho / 2; ly += PASO_HUELLA_MM) {
        if (this.mundo.esLinea(pose.x + lx * c - ly * s, pose.y + lx * s + ly * c)) return true;
      }
    }
    return false;
  }

  private revisarLinea(pose: Pose, t: number): void {
    if (this.sobreLaLinea(pose)) {
      this.fueraDeLineaDesde = null;
      this.avisoLinea = false;
      this.rodeando = false;
      return;
    }
    if (!this.rodeando && this.obstaculos.some(o => distanciaAPoligono(pose, o) <= this.radioObstaculoMm)) this.rodeando = true;
    if (this.rodeando) return;
    this.fueraDeLineaDesde ??= t;
    if (!this.avisoLinea && t - this.fueraDeLineaDesde > this.perdidaLineaS) {
      this.avisoLinea = true;
      this.anotar('perdio-linea', 'Perdiste la línea.');
    }
  }

  private revisarObstaculo(huella: Punto2[]): void {
    const toca = this.mundo.colisiona(huella)?.objeto.tipo === 'obstaculo';
    if (toca && !this.tocando) this.anotar('toco-obstaculo', 'Tocaste el obstáculo.');
    this.tocando = toca;
  }

  /** Cruces, uniones en T y cuadrado F1: solo se evalúan si el robot entró por la flecha (oeste). */
  private revisarDecisiones(pose: Pose): void {
    const baldosa = this.mundo.baldosaEn(pose.x, pose.y);
    if (baldosa !== this.baldosaActual) {
      const anterior = this.baldosaActual;
      if (anterior && (anterior.tipo === 'cruce' || anterior.tipo === 'unionT') && this.entrada === 'oeste') {
        const salida = ladoFuera(anterior, pose.x, pose.y);
        if (salida !== SALIDA_ESPERADA[accionEsperada(anterior)!]) {
          this.anotar('camino-equivocado', `Tomaste el camino equivocado en ${NOMBRE_DECISION[anterior.tipo]}.`, { c: anterior.c, r: anterior.r });
        }
      }
      this.baldosaActual = baldosa;
      this.entrada = baldosa && this.posePrevia ? ladoFuera(baldosa, this.posePrevia.x, this.posePrevia.y) : null;
      this.ladoF1Decidido = false;
    }
    if (baldosa?.tipo === 'cuadradoF1' && this.entrada === 'oeste' && !this.ladoF1Decidido) {
      const { u, v } = aLocal(baldosa, pose.x, pose.y);
      if (u >= TAMANO_BALDOSA / 2) {
        this.ladoF1Decidido = true;
        if ((v >= TAMANO_BALDOSA / 2 ? 'izq' : 'der') !== baldosa.props.correcto) {
          this.anotar('camino-equivocado', 'Tomaste el camino equivocado en el cuadrado F1.', { c: baldosa.c, r: baldosa.r });
        }
      }
    }
  }

  /** Destinos de reinicio permitidos ahora, en el orden del recorrido. */
  puntosDeReinicio(): PuntoDePartida[] {
    const desde = this.puntos.findIndex(p => p.id === this.ultimoPunto.id);
    const i = this.pendiente;
    const hasta = i >= 0 ? this.puntos.findIndex(p => p.id === this.puntoDeHito(i).id) : this.puntos.length - 1;
    return this.puntos.slice(desde, hasta + 1);
  }

  /** 'ultimo', 'siguiente' (el hito pendiente) o el id de un punto de puntosDeReinicio(). */
  reiniciar(destino: string): { ok: true; pose: Pose } | { ok: false; mensaje: string } {
    if (this.terminado) return { ok: false, mensaje: 'La prueba ya terminó.' };
    if (this.reinicios >= MAXIMO_REINICIOS) return { ok: false, mensaje: 'Ya usaste los 3 reinicios.' };
    let punto: PuntoDePartida | undefined;
    if (destino === 'ultimo') punto = this.ultimoPunto;
    else if (destino === 'siguiente') {
      if (this.pendiente < 0) return { ok: false, mensaje: 'No quedan hitos para saltar.' };
      punto = this.puntoDeHito(this.pendiente);
    } else {
      punto = this.puntos.find(p => p.id === destino);
      if (!punto) return { ok: false, mensaje: `No existe el punto de partida "${destino}".` };
    }
    if (!this.puntosDeReinicio().some(p => p.id === punto.id)) return { ok: false, mensaje: `No puedes reiniciar en ${punto.nombre} ahora.` };

    const esSalto = punto.id !== this.ultimoPunto.id;
    if (esSalto && !this.intentado) return { ok: false, mensaje: `Para saltar ${aPunto(punto)} primero tienes que intentarlo.` };
    if (esSalto) {
      this.hitos.forEach((h, i) => {
        if (this.estadosHito[i] === 'pendiente' && h.props.numero < punto.hitoSiguiente) this.estadosHito[i] = 'saltado';
      });
      this.sinTiempo = true;
    }
    this.reinicios++;
    this.anotar('reinicio', esSalto
      ? `Saltaste ${aPunto(punto)}: ya no hay puntaje de tiempo (−10).`
      : `Volviste ${aPunto(punto)} (−10).`);
    this.ultimoPunto = punto;
    this.tPrevioUs = 0;
    this.ultimaEvalUs = null;
    this.posePrevia = null;
    this.paradaDesde = null;
    this.intentado = false;
    this.fueraDeLineaDesde = null;
    this.avisoLinea = false;
    this.rodeando = false;
    this.tocando = false;
    this.baldosaActual = undefined;
    this.entrada = null;
    return { ok: true, pose: { ...punto.pose } };
  }
}
