/**
 * Bloque de control compartido entre la UI y el worker de simulación. El worker no
 * atiende mensajes mientras corre el programa, así que la pausa, la velocidad y los pedidos del
 * juez se leen de aquí en cada punto de sincronización, y el worker deja un latido para el vigilante.
 */
export const IDX = { estado: 0, velocidad: 1, pedido: 2, latido: 3 } as const;
export const CORRIENDO = 0;
export const PAUSA = 1;

export type Pedido = 'ultimo' | 'siguiente';
const CODIGO_PEDIDO: Record<Pedido, number> = { ultimo: 1, siguiente: 2 };
const PEDIDO_DE: Record<number, Pedido> = { 1: 'ultimo', 2: 'siguiente' };

/** Más que esto atrasada, la simulación se pone al día en vez de correr a ráfagas. */
const ATRASO_MAXIMO_MS = 250;
/** Cada tramo de espera dura a lo más esto, para que el latido siga subiendo. */
const TRAMO_MS = 50;

export function crearControl(): Int32Array {
  const c = new Int32Array(new SharedArrayBuffer(4 * Int32Array.BYTES_PER_ELEMENT));
  c[IDX.velocidad] = 100;
  return c;
}

export function pausar(c: Int32Array, enPausa: boolean): void {
  Atomics.store(c, IDX.estado, enPausa ? PAUSA : CORRIENDO);
  Atomics.notify(c, IDX.estado);
}

/** Centésimas de la velocidad real: 100 = ×1; 0 = lo más rápido posible. */
export function fijarVelocidad(c: Int32Array, centesimas: number): void {
  Atomics.store(c, IDX.velocidad, centesimas);
  Atomics.notify(c, IDX.estado);
}

export function pedir(c: Int32Array, p: Pedido): void {
  Atomics.store(c, IDX.pedido, CODIGO_PEDIDO[p]);
}

/** El pedido pendiente, que sale una sola vez. */
export function tomarPedido(c: Int32Array): Pedido | null {
  return PEDIDO_DE[Atomics.exchange(c, IDX.pedido, 0)] ?? null;
}

export interface Reloj {
  ahora(): number;
  dormir(ms: number): void;
}

/** Reloj real del worker: dormir despierta antes si cambian la pausa o la velocidad. */
function relojReal(c: Int32Array): Reloj {
  return {
    ahora: () => performance.now(),
    dormir: ms => { Atomics.wait(c, IDX.estado, Atomics.load(c, IDX.estado), ms); },
  };
}

/** Hace que el tiempo virtual avance al ritmo del real multiplicado por la velocidad. */
export class Ritmo {
  /** Instante real (ms) que corresponde al tiempo virtual 0 con la velocidad actual. */
  private base = 0;
  private velocidad: number | null = null;
  private ultimoUs: number | null = null;

  constructor(private readonly control: Int32Array, private readonly reloj: Reloj = relojReal(control)) {}

  /** Se llama en cada punto de sincronización con el tiempo virtual (µs). */
  esperar(tUs: number): void {
    const c = this.control;
    this.latir();
    if (Atomics.load(c, IDX.estado) === PAUSA) {
      while (Atomics.load(c, IDX.estado) === PAUSA) {
        this.reloj.dormir(TRAMO_MS);
        this.latir();
      }
      this.ultimoUs = tUs;
      if (this.velocidad) this.rebasar(tUs, this.velocidad);
    }
    const v = Atomics.load(c, IDX.velocidad) / 100;
    if (v <= 0) {
      this.velocidad = 0;
      this.ultimoUs = tUs;
      return;
    }
    // Al cambiar de velocidad, el tramo ya recorrido queda como está: se rebasa en el último instante.
    if (v !== this.velocidad) this.rebasar(this.ultimoUs ?? tUs, v);
    this.velocidad = v;
    let objetivo = this.base + tUs / 1000 / v;
    if (this.reloj.ahora() - objetivo > ATRASO_MAXIMO_MS) {
      this.rebasar(tUs, v);
      objetivo = this.reloj.ahora();
    }
    for (let falta = objetivo - this.reloj.ahora(); falta > 1 && Atomics.load(c, IDX.estado) === CORRIENDO; falta = objetivo - this.reloj.ahora()) {
      this.reloj.dormir(Math.min(falta, TRAMO_MS));
      this.latir();
    }
    this.ultimoUs = tUs;
  }

  private rebasar(tUs: number, v: number): void {
    this.base = this.reloj.ahora() - tUs / 1000 / v;
  }

  private latir(): void {
    Atomics.add(this.control, IDX.latido, 1);
  }
}
