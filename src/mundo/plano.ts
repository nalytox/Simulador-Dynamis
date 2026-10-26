import type { Mundo } from './tipos';

/** Mundo vacío: suelo blanco y plano, sin objetos. */
export function mundoPlano(): Mundo {
  return {
    muestrear: () => ({ r: 255, g: 255, b: 255 }),
    altura: () => 0,
    inclinacion: () => ({ pitch: 0, roll: 0 }),
    raycast: () => null,
    colisiona: () => null,
    objetosCerca: () => [],
  };
}
