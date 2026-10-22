import { it, expect } from 'vitest';
import { Juez } from '../../src/juez/juez';
import { crearMundo } from '../../src/mundo/pista';
import { ROBOT_POR_DEFECTO } from '../../src/robot/config';
import type { Marcas } from '../../src/pista/tipos';
import { pistaDe } from '../ayuda/pistas';

/**
 * Mueve el robot por los puntos [t, x, y], interpolando en línea recta, y llama a actualizar cada `paso`.
 * El robot mira hacia donde se mueve; si está quieto conserva el rumbo anterior (al principio, 0).
 */
function recorrer(juez: Juez, puntos: [number, number, number][], paso = 0.001) {
  let yaw = 0;
  const t0 = puntos[0][0];
  const n = Math.round((puntos[puntos.length - 1][0] - t0) / paso);
  for (let i = 0; i <= n; i++) {
    const t = t0 + i * paso;
    let k = 0;
    while (k < puntos.length - 2 && t > puntos[k + 1][0]) k++;
    const [ta, xa, ya] = puntos[k];
    const [tb, xb, yb] = puntos[k + 1] ?? puntos[k];
    const f = tb > ta ? Math.min(1, Math.max(0, (t - ta) / (tb - ta))) : 0;
    if (xb !== xa || yb !== ya) yaw = Math.atan2(yb - ya, xb - xa);
    juez.actualizar(t * 1e6, { x: xa + f * (xb - xa), y: ya + f * (yb - ya), yaw });
  }
}

const recta6 = (objetos: Record<string, unknown>[] = []) =>
  pistaDe({ columnas: 6, filas: 1, baldosas: [0, 1, 2, 3, 4, 5].map(c => ({ c, r: 0, tipo: 'recta' })), objetos });
const tipos = (j: Juez, tipo: string) => j.estado.eventos.filter(e => e.tipo === tipo);

it('perdió la línea después de 0,5 s, una vez por salida', () => {
  const j = new Juez(crearMundo(recta6()), ROBOT_POR_DEFECTO);
  recorrer(j, [[0, 300, 150], [0.1, 300, 350], [0.5, 300, 350]]); expect(tipos(j, 'perdio-linea')).toEqual([]); // fuera desde ~0,04 s
  recorrer(j, [[0.5, 300, 350], [0.7, 300, 350]]); expect(tipos(j, 'perdio-linea')).toHaveLength(1);
  recorrer(j, [[0.7, 300, 350], [0.8, 300, 150], [0.9, 300, 350], [1.6, 300, 350]]);
  expect(tipos(j, 'perdio-linea').map(e => e.mensaje)).toEqual(['Perdiste la línea.', 'Perdiste la línea.']);
});

it('al rodear el obstáculo no pierde la línea hasta volver a ella', () => {
  const j = new Juez(crearMundo(recta6([{ tipo: 'obstaculo', x: 900, y: 150, rot: 0 }])), ROBOT_POR_DEFECTO);
  recorrer(j, [[0, 700, 150], [0.2, 800, 320], [2, 1000, 320], [2.3, 1200, 150]]); expect(tipos(j, 'perdio-linea')).toEqual([]);
  recorrer(j, [[2.3, 1200, 150], [2.4, 1500, 400], [3.2, 1500, 400]]); expect(tipos(j, 'perdio-linea')).toHaveLength(1);
});

it('tocó el obstáculo, una vez por contacto', () => {
  const j = new Juez(crearMundo(recta6([{ tipo: 'obstaculo', x: 900, y: 150, rot: 0 }])), ROBOT_POR_DEFECTO);
  recorrer(j, [[0, 700, 150], [0.2, 800, 150], [1, 800, 150]]);
  expect(tipos(j, 'toco-obstaculo').map(e => e.mensaje)).toEqual(['Tocaste el obstáculo.']);
});

const conCruce = (marcas: Partial<Marcas>) => pistaDe({ columnas: 3, filas: 3,
  baldosas: [{ c: 1, r: 1, tipo: 'cruce', props: { marcas: { ai: false, ad: false, di: false, dd: false, ...marcas } } }] });

it('cruce: marca a la derecha obliga a salir por el sur', () => {
  const bien = new Juez(crearMundo(conCruce({ ad: true })), ROBOT_POR_DEFECTO);
  recorrer(bien, [[0, 200, 450], [0.5, 450, 450], [1, 450, 200]]); expect(tipos(bien, 'camino-equivocado')).toEqual([]);
  const mal = new Juez(crearMundo(conCruce({ ad: true })), ROBOT_POR_DEFECTO);
  recorrer(mal, [[0, 200, 450], [0.5, 450, 450], [1, 450, 700]]);
  expect(tipos(mal, 'camino-equivocado')).toMatchObject([{ mensaje: 'Tomaste el camino equivocado en el cruce.', baldosa: { c: 1, r: 1 } }]);
  // Entrando por el sur, `ad` queda antes y a la izquierda: hay que salir por el oeste.
  const otroLado = new Juez(crearMundo(conCruce({ ad: true })), ROBOT_POR_DEFECTO);
  recorrer(otroLado, [[0, 450, 200], [0.5, 450, 450], [1, 450, 700]]); expect(tipos(otroLado, 'camino-equivocado')).toHaveLength(1);
  const otroLadoBien = new Juez(crearMundo(conCruce({ ad: true })), ROBOT_POR_DEFECTO);
  recorrer(otroLadoBien, [[0, 450, 200], [0.5, 450, 450], [1, 200, 450]]); expect(tipos(otroLadoBien, 'camino-equivocado')).toEqual([]);
});

it('cuadrado F1: el lado correcto no genera evento y el otro sí', () => {
  const f1 = pistaDe({ columnas: 3, filas: 1, baldosas: [{ c: 1, r: 0, tipo: 'cuadradoF1', props: { correcto: 'izq' } }] });
  const arriba = new Juez(crearMundo(f1), ROBOT_POR_DEFECTO);
  recorrer(arriba, [[0, 200, 150], [0.3, 340, 150], [0.6, 400, 255], [0.9, 560, 150], [1.2, 650, 150]]);
  expect(tipos(arriba, 'camino-equivocado')).toEqual([]);
  const abajo = new Juez(crearMundo(f1), ROBOT_POR_DEFECTO);
  recorrer(abajo, [[0, 200, 150], [0.3, 340, 150], [0.6, 400, 45], [0.9, 560, 150], [1.2, 650, 150]]);
  expect(tipos(abajo, 'camino-equivocado').map(e => e.mensaje)).toEqual(['Tomaste el camino equivocado en el cuadrado F1.']);
});

it('unión en T por la rama: la marca decide hacia dónde girar', () => {
  const conT = pistaDe({ columnas: 3, filas: 3, baldosas: [{ c: 1, r: 1, tipo: 'unionT', props: { rama: 'izq', marcas: { ai: false, ad: false, di: true, dd: false } } }] });
  const bien = new Juez(crearMundo(conT), ROBOT_POR_DEFECTO);
  recorrer(bien, [[0, 450, 700], [0.5, 450, 450], [1, 700, 450]]); expect(tipos(bien, 'camino-equivocado')).toEqual([]);
  const mal = new Juez(crearMundo(conT), ROBOT_POR_DEFECTO);
  recorrer(mal, [[0, 450, 700], [0.5, 450, 450], [1, 200, 450]]);
  expect(tipos(mal, 'camino-equivocado').map(e => e.mensaje)).toEqual(['Tomaste el camino equivocado en la unión en T.']);
});
