/** Las líneas de "Mensajes del robot", sin DOM: el Serial cortado en líneas y los avisos del sistema. */
export interface LineaConsola { t: number; texto: string; tipo: 'serial' | 'sistema' }

/** "12,3 s": el tiempo simulado de cada línea. */
export function formatoTiempo(t: number): string {
  return `${t.toFixed(1).replace('.', ',')} s`;
}

/** Una línea más larga se corta: un Serial.print sin salto de línea no puede crecer sin fin. */
export const LARGO_MAXIMO = 1000;

export class Bitacora {
  private cerradas: LineaConsola[] = [];
  private enCurso: LineaConsola | null = null;
  private cambios = 0;
  private cerradasEnTotal = 0;
  private vecesLimpiada = 0;

  constructor(private readonly maximo = 500) {}

  /** Texto del Serial: corta en '\n', quita '\r' y deja abierta la línea sin terminar. */
  agregarSerial(t: number, texto: string): void {
    if (texto === '') return;
    // split con el separador capturado deja cada '\n' como su propio elemento.
    for (const parte of texto.replace(/\r/g, '').split(/(\n)/)) {
      if (parte === '\n') {
        this.cerrar(this.enCurso ?? { t, texto: '', tipo: 'serial' });
        this.enCurso = null;
        continue;
      }
      let resto = parte;
      while (resto !== '') {
        this.enCurso ??= { t, texto: '', tipo: 'serial' };
        const cabe = LARGO_MAXIMO - this.enCurso.texto.length;
        this.enCurso.texto += resto.slice(0, cabe);
        resto = resto.slice(cabe);
        if (this.enCurso.texto.length >= LARGO_MAXIMO) {
          this.cerrar(this.enCurso);
          this.enCurso = null;
        }
      }
    }
    this.cambios++;
  }

  agregarSistema(t: number, texto: string): void {
    this.cerrar({ t, texto, tipo: 'sistema' });
    this.cambios++;
  }

  get lineas(): LineaConsola[] { return this.cerradas; }

  /** Lo que se dibuja: las últimas `maximo` líneas, contando la que está a medio escribir. */
  visibles(): LineaConsola[] {
    const abierta = this.abierta;
    return abierta ? [...this.cerradas.slice(-(this.maximo - 1)), abierta] : this.cerradas;
  }
  get abierta(): LineaConsola | null { return this.enCurso && { ...this.enCurso }; }
  /** Sube con cada cambio: la consola redibuja solo si cambió. */
  get version(): number { return this.cambios; }
  /** Cuántas líneas se cerraron desde la última limpieza (para dibujar solo las nuevas). */
  get totalCerradas(): number { return this.cerradasEnTotal; }
  get limpiezas(): number { return this.vecesLimpiada; }

  limpiar(): void {
    this.cerradas = [];
    this.enCurso = null;
    this.cerradasEnTotal = 0;
    this.vecesLimpiada++;
    this.cambios++;
  }

  private cerrar(linea: LineaConsola): void {
    this.cerradasEnTotal++;
    this.cerradas.push(linea);
    if (this.cerradas.length > this.maximo) this.cerradas.splice(0, this.cerradas.length - this.maximo);
  }
}
