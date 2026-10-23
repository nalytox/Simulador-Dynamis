/** Generador de números aleatorios con semilla, en [0, 1). */
export type Azar = () => number;

/** mulberry32: rápido, determinista y suficiente para simulación. */
export function crearAzar(semilla: number): Azar {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
