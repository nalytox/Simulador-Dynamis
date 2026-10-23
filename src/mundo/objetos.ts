import { gradosARadianes } from '../pista/serializacion';
import type { Bache, Obstaculo, Pista } from '../pista/tipos';
import { distanciaAPoligono, penetracion, rectanguloGirado } from './geometria';
import type { Relieve } from './relieve';
import type { Colision, ImpactoRayo, Mundo, ObjetoPista, Punto2, Punto3 } from './tipos';

/**
 * Objetos físicos de la pista: los obstáculos son cajas (chocan y se ven con raycast) y los baches
 * son parte del relieve. Los hitos y los puntos de desafío no existen para los sensores.
 */
export type Objetos = Pick<Mundo, 'colisiona' | 'objetosCerca' | 'raycast'>;

const PASO_SUELO = 2;
const T = 300;
const ITERACIONES_BISECCION = 12;
const sinMenosCero = (x: number) => (x === 0 ? 0 : x);

interface Caja {
  objeto: Obstaculo;
  huella: Punto2[];
  cx: number; cy: number; cos: number; sin: number;
  medioLargo: number; medioAncho: number; base: number; tope: number;
}

/** Tramo [entrada, salida] (s ≥ 0) en que la proyección del rayo está sobre el rectángulo [0, ancho] × [0, alto], o null. */
function tramoSobreLaGrilla(o: Punto3, d: Punto3, ancho: number, alto: number): [number, number] | null {
  let entrada = 0;
  let salida = Infinity;
  for (const [origen, dir, limite] of [[o.x, d.x, ancho], [o.y, d.y, alto]]) {
    if (dir === 0) {
      if (origen < 0 || origen > limite) return null;
      continue;
    }
    const a = -origen / dir;
    const b = (limite - origen) / dir;
    entrada = Math.max(entrada, Math.min(a, b));
    salida = Math.min(salida, Math.max(a, b));
  }
  return salida >= entrada ? [entrada, salida] : null;
}

/** Corte del rayo con una caja en su marco local (test de losas). Devuelve la distancia y la normal en el mundo. */
function rayoContraCaja(k: Caja, o: Punto3, d: Punto3): { distancia: number; normal: Punto3 } | null {
  const ox = o.x - k.cx;
  const oy = o.y - k.cy;
  const origen = [ox * k.cos + oy * k.sin, -ox * k.sin + oy * k.cos, o.z];
  const dir = [d.x * k.cos + d.y * k.sin, -d.x * k.sin + d.y * k.cos, d.z];
  const bajo = [-k.medioLargo, -k.medioAncho, k.base];
  const alto = [k.medioLargo, k.medioAncho, k.tope];
  let tEntrada = -Infinity;
  let tSalida = Infinity;
  let eje = -1;
  let signo = 0;
  for (let i = 0; i < 3; i++) {
    if (dir[i] === 0) {
      if (origen[i] < bajo[i] || origen[i] > alto[i]) return null;
      continue;
    }
    const t1 = (bajo[i] - origen[i]) / dir[i];
    const t2 = (alto[i] - origen[i]) / dir[i];
    const cerca = Math.min(t1, t2);
    if (cerca > tEntrada) {
      tEntrada = cerca;
      eje = i;
      signo = t1 < t2 ? -1 : 1;
    }
    tSalida = Math.min(tSalida, Math.max(t1, t2));
  }
  if (tSalida < Math.max(tEntrada, 0)) return null;
  if (tEntrada < 0) return { distancia: 0, normal: { x: sinMenosCero(-d.x), y: sinMenosCero(-d.y), z: sinMenosCero(-d.z) } };
  const local = [0, 0, 0];
  local[eje] = signo;
  const normal = { x: local[0] * k.cos - local[1] * k.sin, y: local[0] * k.sin + local[1] * k.cos, z: local[2] };
  return { distancia: tEntrada, normal: { x: sinMenosCero(normal.x), y: sinMenosCero(normal.y), z: sinMenosCero(normal.z) } };
}

export function crearObjetos(p: Pista, relieve: Relieve): Objetos {
  const cajas: Caja[] = p.objetos
    .filter((o): o is Obstaculo => o.tipo === 'obstaculo')
    .map(o => {
      const angulo = gradosARadianes(o.rot);
      const base = relieve.altura(o.x, o.y);
      return {
        objeto: o, huella: rectanguloGirado(o.x, o.y, angulo, o.props.largo, o.props.ancho),
        cx: o.x, cy: o.y, cos: Math.cos(angulo), sin: Math.sin(angulo),
        medioLargo: o.props.largo / 2, medioAncho: o.props.ancho / 2, base, tope: base + o.props.alto,
      };
    });
  const cercanos: { objeto: ObjetoPista; huella: Punto2[] }[] = [
    ...cajas.map(k => ({ objeto: k.objeto, huella: k.huella })),
    ...p.objetos
      .filter((o): o is Bache => o.tipo === 'bache')
      .map(o => ({ objeto: o, huella: rectanguloGirado(o.x, o.y, gradosARadianes(o.rot), o.props.largo, 2 * o.props.radio) })),
  ];

  // Lo más alto que puede estar el suelo: sobre eso, un rayo que no baja ya no choca con él.
  const alturaMaxima = Math.max(0, ...p.baldosas.map(b => b.nivel + (b.tipo === 'rampa' ? Math.max(0, T * Math.tan(gradosARadianes(b.props.angulo))) : 0)))
    + Math.max(0, ...p.objetos.map(o => (o.tipo === 'bache' ? o.props.radio : 0)));

  /**
   * Suelo: marcha de 2 mm sobre el relieve solo mientras el rayo está sobre la grilla y bajo la altura
   * máxima; fuera de la grilla el suelo es plano a altura 0 y se resuelve sin marchar. Así termina con max = Infinity.
   */
  const rayoContraSuelo = (o: Punto3, d: Punto3, max: number): { distancia: number; normal: Punto3 } | null => {
    const debajo = (s: number) => o.z + s * d.z <= relieve.altura(o.x + s * d.x, o.y + s * d.y);
    if (debajo(0)) return { distancia: 0, normal: normalSuelo(o.x, o.y) };
    const plano = (desde: number, hasta: number) => {
      if (d.z >= 0) return null;
      const s = o.z / -d.z;
      return s >= desde && s <= Math.min(hasta, max) ? { distancia: s, normal: { x: 0, y: 0, z: 1 } } : null;
    };
    const tramo = tramoSobreLaGrilla(o, d, p.columnas * T, p.filas * T);
    if (!tramo) return plano(0, Infinity);
    const [entrada, salida] = tramo;
    const antes = plano(0, entrada);
    if (antes) return antes;
    const hasta = Math.min(max, salida);
    for (let s = entrada; s < hasta; ) {
      const siguiente = Math.min(s + PASO_SUELO, hasta);
      if (debajo(siguiente)) {
        let fuera = s;
        let dentro = siguiente;
        for (let i = 0; i < ITERACIONES_BISECCION; i++) {
          const medio = (fuera + dentro) / 2;
          if (debajo(medio)) dentro = medio;
          else fuera = medio;
        }
        return { distancia: dentro, normal: normalSuelo(o.x + dentro * d.x, o.y + dentro * d.y) };
      }
      if (d.z >= 0 && o.z + siguiente * d.z > alturaMaxima) return null;
      s = siguiente;
    }
    return plano(salida, Infinity);
  };

  const normalSuelo = (x: number, y: number): Punto3 => {
    const { dx, dy } = relieve.gradiente(x, y);
    const largo = Math.hypot(dx, dy, 1);
    return { x: sinMenosCero(-dx / largo), y: sinMenosCero(-dy / largo), z: 1 / largo };
  };

  return {
    colisiona(poligono): Colision | null {
      let mejor: Colision | null = null;
      for (const k of cajas) {
        const traslape = penetracion(poligono, k.huella);
        if (traslape !== null && (mejor === null || traslape > mejor.penetracion)) mejor = { objeto: k.objeto, penetracion: traslape };
      }
      return mejor;
    },
    objetosCerca(x, y, radio) {
      return cercanos
        .map(c => ({ objeto: c.objeto, distancia: distanciaAPoligono({ x, y }, c.huella) }))
        .filter(c => c.distancia <= radio)
        .sort((a, b) => a.distancia - b.distancia)
        .map(c => c.objeto);
    },
    raycast(origen, dir, max): ImpactoRayo | null {
      const largo = Math.hypot(dir.x, dir.y, dir.z);
      if (!(largo > 0) || !Number.isFinite(largo)) return null;
      const d = { x: dir.x / largo, y: dir.y / largo, z: dir.z / largo };
      let mejor: ImpactoRayo | null = null;
      for (const k of cajas) {
        const h = rayoContraCaja(k, origen, d);
        if (h && h.distancia <= max && (mejor === null || h.distancia < mejor.distancia)) mejor = { ...h, objeto: k.objeto };
      }
      const suelo = rayoContraSuelo(origen, d, mejor ? mejor.distancia : max);
      if (suelo && (mejor === null || suelo.distancia < mejor.distancia)) mejor = { ...suelo, objeto: null };
      return mejor;
    },
  };
}
