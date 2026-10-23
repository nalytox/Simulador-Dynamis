import type { Pose } from '../simulacion/simulador';
import type { Pista } from './tipos';
import { gradosARadianes, poseInicial } from './serializacion';

/** Un lugar desde donde puede partir (o reiniciar) el robot: la partida, un hito o un desafío (F). */
export interface PuntoDePartida {
  id: string;
  nombre: string;
  pose: Pose;
  /** Número del primer hito que queda por delante desde este punto. */
  hitoSiguiente: number;
}

/** Puntos de partida en el orden del recorrido: la partida, y luego hitos y desafíos según el hito que les sigue. */
export function puntosDePartida(p: Pista): PuntoDePartida[] {
  const intermedios: (PuntoDePartida & { esDesafio: boolean })[] = [];
  for (const o of p.objetos) {
    const pose = { x: o.x, y: o.y, yaw: 0 };
    if (o.tipo === 'hito') {
      const n = o.props.numero;
      intermedios.push({ id: `hito-${n}`, nombre: `Hito ${n}`, pose: { ...pose, yaw: gradosARadianes(o.props.yaw) }, hitoSiguiente: n + 1, esDesafio: false });
    } else if (o.tipo === 'desafio') {
      const { nombre, yaw, hitoSiguiente } = o.props;
      intermedios.push({ id: `desafio-${nombre}`, nombre, pose: { ...pose, yaw: gradosARadianes(yaw) }, hitoSiguiente, esDesafio: true });
    }
  }
  intermedios.sort((a, b) =>
    a.hitoSiguiente - b.hitoSiguiente || Number(a.esDesafio) - Number(b.esDesafio) || a.nombre.localeCompare(b.nombre, 'es'));
  const partida: PuntoDePartida = { id: 'partida', nombre: 'Partida', pose: poseInicial(p), hitoSiguiente: 1 };
  return [partida, ...intermedios.map(({ esDesafio: _, ...punto }) => punto)];
}
