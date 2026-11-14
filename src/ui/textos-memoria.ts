import { ENTRADAS_NVS, entradasUsadas, type MemoriaNvs, type TipoNvs, type ValorNvs } from '../simulacion/memoria';

/** Cuántos bytes de un bloque se muestran antes de recortar. */
const BYTES_VISIBLES = 8;

const NOMBRES: Record<TipoNvs, string> = {
  i8: 'número (char)', u8: 'número (uchar o bool)', i16: 'número (short)', u16: 'número (ushort)',
  i32: 'número (int)', u32: 'número (uint)', i64: 'número (long64)', u64: 'número (ulong64)',
  str: 'texto', blob: 'bytes',
};

export function nombreTipo(t: TipoNvs): string {
  return NOMBRES[t];
}

export function porcentajeUso(m: MemoriaNvs): number {
  return Math.round((entradasUsadas(m) / ENTRADAS_NVS) * 100);
}

/** «37 de 504 entradas (7 %)». */
export function textoUso(m: MemoriaNvs): string {
  return `${entradasUsadas(m)} de ${ENTRADAS_NVS} entradas (${porcentajeUso(m)} %)`;
}

/** Un decimal con coma, sin ceros de más (hasta 4 decimales). */
function decimal(x: number): string {
  return String(Number(x.toFixed(4))).replace('.', ',');
}

/** El valor como lo leería el programa: números con su signo, textos entre comillas y bloques como lista. */
export function textoValor(v: ValorNvs): string {
  const vista = new DataView(Uint8Array.from(v.bytes).buffer);
  switch (v.tipo) {
    case 'i8': return String(vista.getInt8(0));
    case 'u8': return String(vista.getUint8(0));
    case 'i16': return String(vista.getInt16(0, true));
    case 'u16': return String(vista.getUint16(0, true));
    case 'i32': return String(vista.getInt32(0, true));
    case 'u32': return String(vista.getUint32(0, true));
    case 'i64': return String(vista.getBigInt64(0, true));
    case 'u64': return String(vista.getBigUint64(0, true));
    case 'str': return `«${new TextDecoder().decode(Uint8Array.from(v.bytes))}»`;
    case 'blob': {
      const largo = v.bytes.length;
      const lista = largo > BYTES_VISIBLES
        ? `[${v.bytes.slice(0, BYTES_VISIBLES).join(', ')}, …] (${largo} bytes)`
        : `[${v.bytes.join(', ')}]`;
      if (largo === 4) return `${lista} = ${decimal(vista.getFloat32(0, true))} si es un decimal (float)`;
      if (largo === 8) return `${lista} = ${decimal(vista.getFloat64(0, true))} si es un decimal (double)`;
      return lista;
    }
  }
}
