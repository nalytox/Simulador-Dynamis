/**
 * Geometría del gráfico de recompensa por prueba (spec §11.4), sin DOM. La recompensa la define el
 * profe, así que no se supone ninguna escala: puede ser negativa, constante o enorme.
 */
export interface Escala { desde: number; hasta: number; marcas: number[] }

const MARGEN = { izq: 48, der: 50, arriba: 28, abajo: 42 };
const MARCAS_DESEADAS = 4;
const PASOS_REDONDOS = [1, 2, 2.5, 5, 10];

/** El paso "redondo" (1, 2, 2,5 o 5 por una potencia de 10) más chico que sea ≥ `aproximado`. */
function pasoRedondo(aproximado: number): number {
  const potencia = 10 ** Math.floor(Math.log10(aproximado));
  return PASOS_REDONDOS.find(p => p * potencia >= aproximado * (1 - 1e-9))! * potencia;
}

export function escalaY(min: number, max: number): Escala {
  let bajo = min;
  let alto = max;
  if (!(alto - bajo > 1e-9)) {
    const holgura = Math.max(Math.abs(alto) * 0.1, 1);
    bajo -= holgura;
    alto += holgura;
  }
  const paso = pasoRedondo((alto - bajo) / MARCAS_DESEADAS);
  const desde = Math.floor(bajo / paso + 1e-9) * paso;
  const hasta = Math.ceil(alto / paso - 1e-9) * paso;
  const marcas: number[] = [];
  for (let k = 0; desde + k * paso <= hasta + paso * 1e-9; k++) marcas.push(Number((desde + k * paso).toPrecision(12)));
  return { desde, hasta, marcas };
}

export interface PuntoGrafico { i: number; r: number }

export interface Geometria {
  x(i: number): number;
  y(r: number): number;
  escala: Escala;
  /** La línea "mejor hasta ahora" en escalera (atributo d de un path SVG). */
  camino: string;
  /** Los números de las pruebas que fueron récord. */
  records: number[];
  margen: typeof MARGEN;
}

export function geometria(o: { ancho: number; alto: number; total: number; puntos: PuntoGrafico[] }): Geometria {
  const anchoUtil = o.ancho - MARGEN.izq - MARGEN.der;
  const altoUtil = o.alto - MARGEN.arriba - MARGEN.abajo;
  const recompensas = o.puntos.map(p => p.r);
  const escala = recompensas.length > 0 ? escalaY(Math.min(0, ...recompensas), Math.max(...recompensas)) : escalaY(0, 1);
  const x = (i: number) => MARGEN.izq + (o.total > 1 ? (i - 1) / (o.total - 1) : 0) * anchoUtil;
  const y = (r: number) => MARGEN.arriba + (1 - (r - escala.desde) / (escala.hasta - escala.desde)) * altoUtil;

  const records: number[] = [];
  let mejor = -Infinity;
  let camino = '';
  for (const p of o.puntos) {
    if (p.r <= mejor) continue;
    mejor = p.r;
    records.push(p.i);
    camino += camino ? `H${x(p.i).toFixed(1)}V${y(mejor).toFixed(1)}` : `M${x(p.i).toFixed(1)} ${y(mejor).toFixed(1)}`;
  }
  if (camino) camino += `H${x(o.puntos.at(-1)!.i).toFixed(1)}`;
  return { x, y, escala, camino, records, margen: MARGEN };
}
