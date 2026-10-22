import type { LecturaTCS } from '../simulacion/sensores';

/** Con menos luz que esto el sensor de color ve negro (con 24 ms y ganancia 4, el blanco da c ≈ 2880). */
const POCA_LUZ = 300;

const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0');

/** Color para mostrar lo que lee el TCS34725: el canal más alto llega a 255. */
export function colorMuestra(c: LecturaTCS): string {
  if (c.c < POCA_LUZ) return '#000000';
  const maximo = Math.max(c.r, c.g, c.b, 1);
  return `#${hex2((c.r / maximo) * 255)}${hex2((c.g / maximo) * 255)}${hex2((c.b / maximo) * 255)}`;
}
