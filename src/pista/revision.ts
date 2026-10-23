import { distanciaAPoligono, rectanguloGirado } from '../mundo/geometria';
import { alturaBaldosa } from '../mundo/relieve';
import { aLocal, aMundo, celdaDe, crearIndice, ladoEnMundo } from './baldosas';
import { accionEsperada, bocasDe } from './catalogo';
import { gradosARadianes } from './serializacion';
import { TAMANO_BALDOSA, type Baldosa, type Lado, type Pista } from './tipos';

/** Aviso sobre una pista que no cumple las bases (spec §10.4). Avisa, no bloquea. */
export interface AvisoPista {
  mensaje: string;
  baldosas?: { c: number; r: number }[];
  /** Índice del objeto en pista.objetos. */
  objeto?: number;
}

const ESPACIO_MAXIMO_MM = 40;
const RAMPA_MAXIMA_GRADOS = 35;
const DISTANCIA_A_VERTICE_MM = 250;
const BACHE_MAXIMO_MM = 300;
const HITOS_DE_LAS_BASES = 8;
const ESCALON_TOLERADO_MM = 5;

const cm = (mm: number) => (mm / 10).toLocaleString('es-CL', { maximumFractionDigits: 1 });
const numero = (n: number) => n.toLocaleString('es-CL', { maximumFractionDigits: 1 });

const VECINO: Record<Lado, [number, number]> = { este: [1, 0], oeste: [-1, 0], norte: [0, 1], sur: [0, -1] };

function revisarEscalones(p: Pista, avisos: AvisoPista[]): void {
  const indice = crearIndice(p);
  const vistos = new Set<string>();
  const alturaEn = (b: Baldosa | null, x: number, y: number) => {
    if (!b) return 0;
    const { u, v } = aLocal(b, x, y);
    const acotar = (n: number) => Math.min(TAMANO_BALDOSA, Math.max(0, n));
    return alturaBaldosa(b, acotar(u), acotar(v));
  };
  for (const b of p.baldosas) {
    for (const boca of bocasDe(b)) {
      const lado = ladoEnMundo(b, boca);
      const [dc, dr] = VECINO[lado];
      const c = b.c + dc;
      const r = b.r + dr;
      if (c < 0 || r < 0 || c >= p.columnas || r >= p.filas) continue;
      const clave = [`${b.c},${b.r}`, `${c},${r}`].sort().join('|');
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      const x = (b.c + 0.5 + dc / 2) * TAMANO_BALDOSA;
      const y = (b.r + 0.5 + dr / 2) * TAMANO_BALDOSA;
      const salto = Math.abs(alturaEn(b, x, y) - alturaEn(indice(c, r), x, y));
      if (salto > ESCALON_TOLERADO_MM) {
        avisos.push({ mensaje: `Hay un escalón de ${cm(salto)} cm entre estas baldosas.`, baldosas: [{ c: b.c, r: b.r }, { c, r }] });
      }
    }
  }
}

export function revisarPista(p: Pista): AvisoPista[] {
  const avisos: AvisoPista[] = [];
  const en = (b: Baldosa) => [{ c: b.c, r: b.r }];

  for (const b of p.baldosas) {
    if (b.tipo === 'cortes' && b.props.espacio > ESPACIO_MAXIMO_MM) {
      avisos.push({ mensaje: `Los cortes de esta baldosa miden ${cm(b.props.espacio)} cm; las bases permiten hasta 4 cm.`, baldosas: en(b) });
    }
    if (b.tipo === 'rampa' && b.props.angulo > RAMPA_MAXIMA_GRADOS) {
      avisos.push({ mensaje: `Esta rampa sube ${numero(b.props.angulo)}°; las bases permiten hasta 35°.`, baldosas: en(b) });
    }
    if (b.tipo === 'unionT') {
      const accion = accionEsperada(b);
      const falta = accion === 'izq' && b.props.rama === 'der' ? 'izquierda' : accion === 'der' && b.props.rama === 'izq' ? 'derecha' : null;
      if (falta) {
        avisos.push({ mensaje: `La marca pide girar a la ${falta}, pero esta unión en T no tiene camino a la ${falta}.`, baldosas: en(b) });
      }
    }
  }

  const vertices = p.baldosas.filter(b => b.tipo === 'giroL').map(b => ({ b, punto: aMundo(b, 150, 150) }));
  p.objetos.forEach((o, i) => {
    if (o.tipo === 'obstaculo') {
      const huella = rectanguloGirado(o.x, o.y, gradosARadianes(o.rot), o.props.largo, o.props.ancho);
      for (const { b, punto } of vertices) {
        const distancia = distanciaAPoligono(punto, huella);
        if (distancia <= DISTANCIA_A_VERTICE_MM) {
          avisos.push({ mensaje: `El obstáculo está a ${cm(distancia)} cm de un giro en L; las bases piden más de 25 cm.`, objeto: i, baldosas: en(b) });
        }
      }
    }
    if (o.tipo === 'bache' && o.props.largo > BACHE_MAXIMO_MM) {
      avisos.push({ mensaje: `Este bache mide ${cm(o.props.largo)} cm; las bases permiten hasta 30 cm.`, objeto: i });
    }
  });

  const hitos = p.objetos.flatMap(o => (o.tipo === 'hito' ? [o.props.numero] : [])).sort((a, b) => a - b);
  if (hitos.length !== HITOS_DE_LAS_BASES) avisos.push({ mensaje: `La pista tiene ${hitos.length} hitos; las bases piden 8.` });
  if (hitos.some((n, i) => n !== i + 1)) avisos.push({ mensaje: 'Los hitos deben estar numerados del 1 al 8, sin repetir.' });

  const nombres = new Map<string, number>();
  p.objetos.forEach((o, i) => {
    if (o.tipo !== 'desafio') return;
    const { nombre, hitoSiguiente } = o.props;
    nombres.set(nombre, (nombres.get(nombre) ?? 0) + 1);
    if (nombres.get(nombre) === 2) avisos.push({ mensaje: `Hay dos desafíos llamados ${nombre}.`, objeto: i });
    if (hitoSiguiente < 1 || hitoSiguiente > hitos.length + 1) {
      avisos.push({ mensaje: `${nombre} dice que después viene el hito ${hitoSiguiente}, pero la pista tiene ${hitos.length} hitos.`, objeto: i });
    }
  });

  revisarEscalones(p, avisos);

  const partidas = p.baldosas.filter(b => b.tipo === 'partida');
  if (partidas.length === 0) avisos.push({ mensaje: 'La pista necesita una baldosa de partida.' });
  if (!p.baldosas.some(b => b.tipo === 'meta')) avisos.push({ mensaje: 'La pista necesita una baldosa de meta.' });
  const celdaInicio = celdaDe(p.inicio.x, p.inicio.y);
  if (partidas.length > 0 && !partidas.some(b => b.c === celdaInicio.c && b.r === celdaInicio.r)) {
    avisos.push({ mensaje: 'El robot debe empezar dentro de la baldosa de partida.' });
  }
  return avisos;
}
