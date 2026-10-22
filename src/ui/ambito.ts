/**
 * Lo que un worker usa de su ámbito global. El proyecto compila con la lib DOM (no con la de
 * webworker), así que cada worker toma `self as unknown as AmbitoTrabajador`.
 */
export interface AmbitoTrabajador {
  postMessage(mensaje: unknown, transferibles?: Transferable[]): void;
  onmessage: ((evento: MessageEvent) => void) | null;
}
