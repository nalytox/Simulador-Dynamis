import type { Punto2 } from './tipos';

/** Geometría 2D para la huella del robot y los objetos de la pista (polígonos convexos). */

/** Ejes de separación de un polígono convexo: las normales unitarias de sus aristas. */
function ejes(pol: Punto2[]): Punto2[] {
  const salida: Punto2[] = [];
  pol.forEach((p, i) => {
    const q = pol[(i + 1) % pol.length];
    const largo = Math.hypot(q.x - p.x, q.y - p.y);
    if (largo > 0) salida.push({ x: -(q.y - p.y) / largo, y: (q.x - p.x) / largo });
  });
  return salida;
}

function proyectar(pol: Punto2[], eje: Punto2): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const p of pol) {
    const d = p.x * eje.x + p.y * eje.y;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return [min, max];
}

/** Traslape mínimo entre dos polígonos convexos (SAT), o null si no se tocan. Tocarse en un borde da 0. */
export function penetracion(a: Punto2[], b: Punto2[]): number | null {
  let minimo = Infinity;
  for (const eje of [...ejes(a), ...ejes(b)]) {
    const [minA, maxA] = proyectar(a, eje);
    const [minB, maxB] = proyectar(b, eje);
    const traslape = Math.min(maxA, maxB) - Math.max(minA, minB);
    if (traslape < 0) return null;
    minimo = Math.min(minimo, traslape);
  }
  return minimo === Infinity ? null : minimo;
}

export function puntoEnPoligono(p: Punto2, pol: Punto2[]): boolean {
  let dentro = false;
  for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) {
    const a = pol[i];
    const b = pol[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro;
  }
  return dentro;
}

function distanciaASegmento(p: Punto2, a: Punto2, b: Punto2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const largo2 = dx * dx + dy * dy;
  const t = largo2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / largo2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Distancia de un punto al polígono: 0 si está dentro. */
export function distanciaAPoligono(p: Punto2, pol: Punto2[]): number {
  if (puntoEnPoligono(p, pol)) return 0;
  let minimo = Infinity;
  pol.forEach((a, i) => { minimo = Math.min(minimo, distanciaASegmento(p, a, pol[(i + 1) % pol.length])); });
  return minimo;
}

/** Esquinas (antihorario) de un rectángulo centrado en (cx, cy), con su largo a lo largo de `angulo` (rad). */
export function rectanguloGirado(cx: number, cy: number, angulo: number, largo: number, ancho: number): Punto2[] {
  const c = Math.cos(angulo);
  const s = Math.sin(angulo);
  return [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([i, j]) => {
    const lx = (i * largo) / 2;
    const ly = (j * ancho) / 2;
    return { x: cx + lx * c - ly * s, y: cy + lx * s + ly * c };
  });
}
