/** Las líneas de "Mensajes del robot", sin DOM: el Serial cortado en líneas y los avisos del sistema. */
export interface LineaConsola { t: number; texto: string; tipo: 'serial' | 'sistema' }

/** "12,3 s": el tiempo simulado de cada línea. */
export function formatoTiempo(t: number): string {
  return `${t.toFixed(1).replace('.', ',')} s`;
}

export class Bitacora {
  private cerradas: LineaConsola[] = [];
  private enCurso: LineaConsola | null = null;
  private cambios = 0;

  constructor(private readonly maximo = 500) {}

  /** Texto del Serial: corta en '\n', quita '\r' y deja abierta la línea sin terminar. */
  agregarSerial(t: number, texto: string): void {
    if (texto === '') return;
    const partes = texto.replace(/\r/g, '').split('\n');
    partes.forEach((parte, i) => {
      if (this.enCurso) this.enCurso.texto += parte;
      else if (parte !== '' || i < partes.length - 1) this.enCurso = { t, texto: parte, tipo: 'serial' };
      if (i < partes.length - 1) {
        this.cerrar(this.enCurso ?? { t, texto: '', tipo: 'serial' });
        this.enCurso = null;
      }
    });
    this.cambios++;
  }

  agregarSistema(t: number, texto: string): void {
    this.cerrar({ t, texto, tipo: 'sistema' });
    this.cambios++;
  }

  get lineas(): LineaConsola[] { return this.cerradas; }
  get abierta(): LineaConsola | null { return this.enCurso && { ...this.enCurso }; }
  /** Sube con cada cambio: la consola redibuja solo si cambió. */
  get version(): number { return this.cambios; }

  limpiar(): void {
    this.cerradas = [];
    this.enCurso = null;
    this.cambios++;
  }

  private cerrar(linea: LineaConsola): void {
    this.cerradas.push(linea);
    if (this.cerradas.length > this.maximo) this.cerradas.splice(0, this.cerradas.length - this.maximo);
  }
}
