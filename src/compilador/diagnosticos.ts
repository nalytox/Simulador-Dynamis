export type Severidad = 'error' | 'advertencia' | 'nota';

export interface Diagnostico {
  archivo: string | null;
  linea: number | null;
  columna: number | null;
  severidad: Severidad;
  mensaje: string;
  /** Líneas de contexto que Clang muestra debajo (código y marca ^). */
  detalle: string;
}

const ENCABEZADO = /^(.+?):(\d+):(\d+): (fatal error|error|warning|note): (.*)$/;
const ENLAZADOR = /^wasm-ld: (error|warning): (?:[^:]+\.o: )?(.*)$/;
const RESUMEN = /^\d+ (errors?|warnings?)( and \d+ (errors?|warnings?))? generated\.$/;
const RUIDO = /^clang(\+\+)?: error: linker command failed/;

const SEVERIDADES: Record<string, Severidad> = {
  'fatal error': 'error', error: 'error', warning: 'advertencia', note: 'nota',
};

/** Convierte la salida de error de Clang y wasm-ld en una lista de diagnósticos. */
export function parsearDiagnosticos(salida: string): Diagnostico[] {
  const diagnosticos: Diagnostico[] = [];
  let abierto: Diagnostico | null = null;
  let detalle: string[] = [];
  const cerrar = () => {
    if (abierto) abierto.detalle = detalle.join('\n').replace(/\s+$/, '');
    abierto = null;
    detalle = [];
  };
  for (const linea of salida.split('\n')) {
    const encabezado = linea.match(ENCABEZADO);
    const enlazador = linea.match(ENLAZADOR);
    if (encabezado) {
      cerrar();
      abierto = {
        archivo: encabezado[1].replace(/^\.\//, ''),
        linea: Number(encabezado[2]),
        columna: Number(encabezado[3]),
        severidad: SEVERIDADES[encabezado[4]],
        mensaje: encabezado[5],
        detalle: '',
      };
      diagnosticos.push(abierto);
    } else if (enlazador) {
      cerrar();
      diagnosticos.push({
        archivo: null, linea: null, columna: null,
        severidad: SEVERIDADES[enlazador[1]], mensaje: enlazador[2], detalle: '',
      });
    } else if (RESUMEN.test(linea) || RUIDO.test(linea)) {
      cerrar();
    } else if (abierto) {
      detalle.push(linea);
    }
  }
  cerrar();
  return diagnosticos;
}

const FALLO_SIN_CAUSA = 'El compilador se detuvo sin explicar por qué. Puede faltar memoria: cierra otras pestañas y vuelve a intentar.';

/**
 * Diagnósticos de un paso que falló. Si Clang no dejó ningún error reconocible
 * (por ejemplo, se quedó sin memoria), agrega uno genérico con su salida completa.
 */
export function diagnosticosDeFallo(salida: string): Diagnostico[] {
  const diagnosticos = parsearDiagnosticos(salida);
  if (diagnosticos.some(d => d.severidad === 'error')) return diagnosticos;
  return [...diagnosticos, {
    archivo: null, linea: null, columna: null, severidad: 'error', mensaje: FALLO_SIN_CAUSA, detalle: salida.trim(),
  }];
}
