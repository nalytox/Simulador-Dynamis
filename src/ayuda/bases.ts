import { DESCUENTO_POR_CM, DESCUENTO_REINICIO, MAXIMO_REINICIOS, PUNTOS_HITO, PUNTOS_META, TIEMPO_LIMITE_S } from '../juez/juez';

/** Cómo se puntúa (spec §10.6), con los mismos números que usa el juez virtual. */
export function puntaje(): { regla: string; puntos: string }[] {
  const hitos = PUNTOS_HITO.map(String);
  return [
    { regla: `Hitos 1 a ${PUNTOS_HITO.length}`, puntos: `${hitos.slice(0, -1).join(', ')} y ${hitos.at(-1)}` },
    { regla: 'Meta (detenido sobre la línea)', puntos: String(PUNTOS_META) },
    { regla: 'Tiempo (solo si llega a la meta)', puntos: `(${TIEMPO_LIMITE_S} − segundos) ÷ 4` },
    { regla: `Cada reinicio (máximo ${MAXIMO_REINICIOS})`, puntos: `−${DESCUENTO_REINICIO}` },
    { regla: 'Robot más grande que 20 × 20 × 20 cm', puntos: `−${DESCUENTO_POR_CM} por cada cm de más` },
  ];
}
