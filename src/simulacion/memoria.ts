/**
 * La memoria del robot que usa Preferences.h: la NVS (non-volatile storage) de la flash del ESP32.
 * Guarda pares clave-valor en espacios de nombres y sobrevive a apagar el robot. Aquí se cuenta el
 * espacio como la NVS real: entradas de 32 bytes en una partición de 20 KB.
 */

/** Los tipos de la NVS, en el orden del enum PreferenceType de Preferences.h (PT_I8 = 0 … PT_BLOB = 9). */
export type TipoNvs = 'i8' | 'u8' | 'i16' | 'u16' | 'i32' | 'u32' | 'i64' | 'u64' | 'str' | 'blob';
export const TIPOS_NVS: TipoNvs[] = ['i8', 'u8', 'i16', 'u16', 'i32', 'u32', 'i64', 'u64', 'str', 'blob'];
/** PT_INVALID: la clave no existe. */
export const TIPO_INVALIDO = 10;

/** Un valor guardado: sus bytes en little-endian; un texto, en UTF-8 sin el 0 final. */
export interface ValorNvs { tipo: TipoNvs; bytes: number[] }
export interface MemoriaNvs { espacios: Record<string, Record<string, ValorNvs>> }
export interface ClaveEscrita { espacio: string; clave: string }

/**
 * Entradas disponibles en la partición NVS por defecto (20 KB = 5 páginas de 126 entradas; una
 * página queda libre para reordenar). Aproximado a la NVS real.
 */
export const ENTRADAS_NVS = 504;
const BYTES_POR_ENTRADA = 32;
const LARGO_MAXIMO_NOMBRE = 15;
const LARGO_MAXIMO_TEXTO = 4000;
/** Más escrituras que esto en un segundo de tiempo virtual: la flash se gasta. */
const ESCRITURAS_POR_SEGUNDO = 20;

export const AVISO_FLASH = 'Escribes la memoria muy seguido: la flash del ESP32 se gasta. Guarda solo cuando algo cambie.';
const avisoNombreLargo = (nombre: string) => `El nombre "${nombre}" tiene más de 15 letras: la memoria no lo acepta.`;
const avisoSoloLectura = (espacio: string) => `Abriste la memoria "${espacio}" en solo lectura: no se puede escribir en ella.`;
const avisoOtroTipo = (clave: string) => `Leíste "${clave}" con otro tipo del que guardaste.`;
const AVISO_TEXTO_LARGO = 'Ese texto es muy largo: la memoria guarda textos de hasta 4000 bytes.';

export function memoriaVacia(): MemoriaNvs {
  return { espacios: {} };
}

/** Un número ocupa 1 entrada; un texto, 1 más sus bytes con el 0 final; un bloque, 2 más sus bytes. */
export function entradasDe(v: ValorNvs): number {
  if (v.tipo === 'str') return 1 + Math.ceil((v.bytes.length + 1) / BYTES_POR_ENTRADA);
  if (v.tipo === 'blob') return 2 + Math.ceil(v.bytes.length / BYTES_POR_ENTRADA);
  return 1;
}

/** Las entradas que ocupan todas las claves, más 1 por cada espacio de nombres. */
export function entradasUsadas(m: MemoriaNvs): number {
  let total = 0;
  for (const claves of Object.values(m.espacios)) {
    total += 1;
    for (const v of Object.values(claves)) total += entradasDe(v);
  }
  return total;
}

export function copiarMemoria(m: MemoriaNvs): MemoriaNvs {
  return {
    espacios: Object.fromEntries(Object.entries(m.espacios).map(([espacio, claves]) => [espacio,
      Object.fromEntries(Object.entries(claves).map(([clave, v]) => [clave, { tipo: v.tipo, bytes: [...v.bytes] }]))])),
  };
}

const nombreValido = (nombre: string) => nombre.length > 0 && nombre.length <= LARGO_MAXIMO_NOMBRE;

/** La memoria durante una prueba: lo que pide Preferences.h desde el programa. */
export class MemoriaRobot {
  private readonly datos: MemoriaNvs;
  /** Espacios abiertos con begin(), y si quedaron en solo lectura. */
  private readonly abiertos = new Map<string, boolean>();
  private recientes: number[] = [];
  private avisoFlash = false;
  private cuentaEscrituras = 0;
  private ultimaEscrita: ClaveEscrita | null = null;

  constructor(inicial: MemoriaNvs, private readonly avisar: (texto: string) => void) {
    this.datos = copiarMemoria(inicial);
  }

  get escrituras(): number { return this.cuentaEscrituras; }
  get ultima(): ClaveEscrita | null { return this.ultimaEscrita; }

  instantanea(): MemoriaNvs {
    return copiarMemoria(this.datos);
  }

  abrir(espacio: string, soloLectura: boolean): boolean {
    if (!nombreValido(espacio)) {
      if (espacio.length > LARGO_MAXIMO_NOMBRE) this.avisar(avisoNombreLargo(espacio));
      return false;
    }
    if (!(espacio in this.datos.espacios)) {
      if (soloLectura || this.libres() < 1) return false;
      this.datos.espacios[espacio] = {};
    }
    this.abiertos.set(espacio, soloLectura);
    return true;
  }

  /** Bytes escritos, o 0 si no se pudo (sin abrir, solo lectura, nombre largo, texto largo o sin espacio). */
  poner(espacio: string, clave: string, tipo: TipoNvs, bytes: Uint8Array, tUs: number): number {
    const claves = this.claves(espacio);
    if (!claves) return 0;
    if (this.abiertos.get(espacio)) {
      this.avisar(avisoSoloLectura(espacio));
      return 0;
    }
    if (!nombreValido(clave)) {
      if (clave.length > LARGO_MAXIMO_NOMBRE) this.avisar(avisoNombreLargo(clave));
      return 0;
    }
    if (tipo === 'str' && bytes.length > LARGO_MAXIMO_TEXTO) {
      this.avisar(AVISO_TEXTO_LARGO);
      return 0;
    }
    const nuevo: ValorNvs = { tipo, bytes: Array.from(bytes) };
    const anterior = claves[clave];
    const usadas = entradasUsadas(this.datos) - (anterior ? entradasDe(anterior) : 0) + entradasDe(nuevo);
    if (usadas > ENTRADAS_NVS) return 0;
    claves[clave] = nuevo;
    this.cuentaEscrituras++;
    this.ultimaEscrita = { espacio, clave };
    this.vigilarFlash(tUs);
    return bytes.length;
  }

  /** El largo del valor si existe con ese tipo (null: cualquiera); −1 si no existe o es de otro tipo. */
  largo(espacio: string, clave: string, tipo: TipoNvs | null): number {
    const v = this.claves(espacio)?.[clave];
    if (!v) return -1;
    if (tipo !== null && v.tipo !== tipo) {
      this.avisar(avisoOtroTipo(clave));
      return -1;
    }
    return v.bytes.length;
  }

  leer(espacio: string, clave: string): Uint8Array | null {
    const v = this.claves(espacio)?.[clave];
    return v ? Uint8Array.from(v.bytes) : null;
  }

  tipo(espacio: string, clave: string): number {
    const v = this.claves(espacio)?.[clave];
    return v ? TIPOS_NVS.indexOf(v.tipo) : TIPO_INVALIDO;
  }

  quitar(espacio: string, clave: string): boolean {
    const claves = this.clavesEscribibles(espacio);
    if (!claves || !(clave in claves)) return false;
    delete claves[clave];
    return true;
  }

  vaciar(espacio: string): boolean {
    const claves = this.clavesEscribibles(espacio);
    if (!claves) return false;
    for (const clave of Object.keys(claves)) delete claves[clave];
    return true;
  }

  libres(): number {
    return Math.max(0, ENTRADAS_NVS - entradasUsadas(this.datos));
  }

  private claves(espacio: string): Record<string, ValorNvs> | null {
    return this.abiertos.has(espacio) ? this.datos.espacios[espacio] ?? null : null;
  }

  private clavesEscribibles(espacio: string): Record<string, ValorNvs> | null {
    const claves = this.claves(espacio);
    if (!claves) return null;
    if (this.abiertos.get(espacio)) {
      this.avisar(avisoSoloLectura(espacio));
      return null;
    }
    return claves;
  }

  private vigilarFlash(tUs: number): void {
    this.recientes = this.recientes.filter(t => tUs - t < 1_000_000);
    this.recientes.push(tUs);
    if (!this.avisoFlash && this.recientes.length > ESCRITURAS_POR_SEGUNDO) {
      this.avisoFlash = true;
      this.avisar(AVISO_FLASH);
    }
  }
}
