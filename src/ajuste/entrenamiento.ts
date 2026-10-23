import { esFaltaImplementar, type Agente, type CrearAgente, type ParametroAgente } from './contrato';
import type { PoolPruebas } from './pool';
import type { ResultadoPrueba } from './prueba';

export type ResultadoEntrenado = ResultadoPrueba & { indice: number };

export interface FinEntrenamiento {
  motivo: 'completo' | 'detenido' | 'error';
  error?: { mensaje: string; tecnico: string; faltaImplementar: boolean };
  mejor: ResultadoEntrenado | null;
}

export interface OpcionesEntrenamiento {
  crearAgente: CrearAgente;
  parametros: ParametroAgente[];
  presupuesto: number;
  pool: PoolPruebas;
  semilla(): number;
  senal: AbortSignal;
  alResultado(r: ResultadoEntrenado & { record: boolean }): void;
}

const ALGO_FALLO = 'Algo falló en el simulador, avisa a tu profe.';

const acotar = (v: number, p: ParametroAgente) => Math.min(p.max, Math.max(p.min, v));

/** Un entero se redondea dentro del rango: la prueba corre con el mismo valor que después se escribe en el código. */
function acotarEntero(v: number, p: ParametroAgente): number {
  const [bajo, alto] = [Math.ceil(p.min), Math.floor(p.max)];
  return bajo <= alto ? Math.min(alto, Math.max(bajo, Math.round(v))) : Math.round(acotar(v, p));
}

/**
 * Lo que propone el agente, saneado (decisión 5 de la fase 6): solo los ids de los parámetros elegidos,
 * acotados a su rango, y los enteros redondeados; un valor que no es un número finito toma el valor del código.
 */
export function acotarPropuesta(valores: Record<string, number>, parametros: ParametroAgente[]): Record<string, number> {
  return Object.fromEntries(parametros.map(p => {
    const v = valores?.[p.id];
    const propuesto = typeof v === 'number' && Number.isFinite(v) ? v : p.valor;
    return [p.id, p.entero ? acotarEntero(propuesto, p) : acotar(propuesto, p)];
  }));
}

/** El error para la ventana: FaltaImplementar se explica tal cual; lo demás es del profe (spec §14). */
export function describirError(e: unknown, origen: string): NonNullable<FinEntrenamiento['error']> {
  const error = e instanceof Error ? e : new Error(String(e));
  if (esFaltaImplementar(e)) return { mensaje: error.message, tecnico: '', faltaImplementar: true };
  const propio = (e as { tecnico?: unknown }).tecnico;
  const tecnico = typeof propio === 'string' && propio ? propio : `Error en ${origen}: ${error.message}${error.stack ? `\n${error.stack}` : ''}`;
  return { mensaje: ALGO_FALLO, tecnico, faltaImplementar: false };
}

/**
 * El bucle del entrenamiento (spec §11.2), en el hilo principal: le pide valores al agente del profe,
 * mantiene tantas pruebas en curso como workers tiene el pool y le devuelve cada resultado.
 */
export function entrenar(o: OpcionesEntrenamiento): Promise<FinEntrenamiento> {
  return new Promise(resolver => {
    let mejor: ResultadoEntrenado | null = null;
    let terminado = false;
    let lanzadas = 0;
    let terminadas = 0;
    const terminar = (fin: FinEntrenamiento) => {
      if (terminado) return;
      terminado = true;
      o.pool.cerrar();
      resolver(fin);
    };
    const fallar = (e: unknown, origen: string) => terminar({ motivo: 'error', error: describirError(e, origen), mejor });

    let agente: Agente;
    try {
      agente = o.crearAgente({ parametros: o.parametros, presupuesto: o.presupuesto });
    } catch (e) {
      return fallar(e, 'el agente del profe');
    }
    if (o.senal.aborted) return terminar({ motivo: 'detenido', mejor });
    o.senal.addEventListener('abort', () => terminar({ motivo: 'detenido', mejor }), { once: true });

    const alTerminarPrueba = (r: ResultadoPrueba) => {
      if (terminado) return;
      terminadas++;
      const record = mejor === null || r.recompensa > mejor.recompensa;
      const entrenado = { ...r, indice: terminadas };
      if (record) mejor = entrenado;
      o.alResultado({ ...entrenado, record });
      try {
        agente.aprender(r.valores, r.recompensa, r.resumen);
      } catch (e) {
        return fallar(e, 'el agente del profe');
      }
      if (terminadas >= o.presupuesto) return terminar({ motivo: 'completo', mejor });
      lanzar();
    };

    function lanzar(): void {
      while (!terminado && lanzadas < o.presupuesto && lanzadas - terminadas < o.pool.tamano) {
        let valores: Record<string, number>;
        try {
          valores = acotarPropuesta(agente.proponer(), o.parametros);
        } catch (e) {
          return fallar(e, 'el agente del profe');
        }
        lanzadas++;
        o.pool.probar(valores, o.semilla()).then(alTerminarPrueba, e => { if (!terminado) fallar(e, 'la recompensa del profe'); });
      }
    }
    lanzar();
  });
}
