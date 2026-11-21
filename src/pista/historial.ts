/**
 * Deshacer y rehacer: guarda los estados anteriores (hasta `limite`, olvidando los más viejos) y los
 * que se deshicieron, para rehacerlos. Hacer algo nuevo borra lo que se podía rehacer.
 */
export class Historial<T> {
  private atras: T[] = [];
  private adelante: T[] = [];

  constructor(private readonly limite = 100) {}

  get puedeDeshacer(): boolean { return this.atras.length > 0; }
  get puedeRehacer(): boolean { return this.adelante.length > 0; }

  /** Antes de un cambio: `antes` es el estado que había. */
  hacer(antes: T): void {
    this.atras.push(antes);
    if (this.atras.length > this.limite) this.atras.shift();
    this.adelante = [];
  }

  /** El estado anterior, o null si no hay; `actual` queda para rehacer. */
  deshacer(actual: T): T | null {
    if (this.atras.length === 0) return null;
    this.adelante.push(actual);
    return this.atras.pop()!;
  }

  rehacer(actual: T): T | null {
    if (this.adelante.length === 0) return null;
    this.atras.push(actual);
    return this.adelante.pop()!;
  }

  vaciar(): void {
    this.atras = [];
    this.adelante = [];
  }
}
