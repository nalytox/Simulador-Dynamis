import type { Proyecto } from '../proyecto/proyecto';
import type { Diagnostico } from './diagnosticos';
import type { ResultadoCompilacion } from './compilar';
import type { MensajeAlCompilador, MensajeDelCompilador } from './trabajador';

export type CompilacionWeb =
  | { ok: true; modulo: WebAssembly.Module; diagnosticos: Diagnostico[] }
  | { ok: false; diagnosticos: Diagnostico[] };

/** Igual para dos proyectos con los mismos archivos y contenidos, en cualquier orden. */
export function firmaProyecto(p: Proyecto): string {
  return JSON.stringify([p.nombre, ...Object.keys(p.archivos).sort().map(ruta => [ruta, p.archivos[ruta]])]);
}

interface Preparacion {
  promesa: Promise<void>;
  resolver(): void;
  rechazar(e: Error): void;
  alProgresar(hecho: number, total: number): void;
}

/**
 * Habla con el worker del compilador desde el hilo principal. Guarda el último módulo que compiló
 * bien: si el proyecto no cambió, lo devuelve sin volver a compilar.
 */
export class ClienteCompilador {
  private trabajador: Worker | null = null;
  private siguienteId = 1;
  private readonly pendientes = new Map<number, (r: ResultadoCompilacion) => void>();
  private preparacion: Preparacion | null = null;
  private cache: { firma: string; resultado: CompilacionWeb } | null = null;

  constructor(
    private readonly crearTrabajador: () => Worker = () => new Worker(new URL('./trabajador.ts', import.meta.url), { type: 'module' }),
  ) {}

  /** Descarga y prepara LLVM y el núcleo. Si falla, rechaza con el mensaje; otra llamada vuelve a intentar. */
  preparar(alProgresar: (hecho: number, total: number) => void): Promise<void> {
    if (this.preparacion) return this.preparacion.promesa;
    let resolver!: () => void;
    let rechazar!: (e: Error) => void;
    const promesa = new Promise<void>((res, rej) => { resolver = res; rechazar = rej; });
    this.preparacion = { promesa, resolver, rechazar, alProgresar };
    this.enviar({ tipo: 'preparar' });
    return promesa;
  }

  async compilar(p: Proyecto): Promise<CompilacionWeb> {
    const firma = firmaProyecto(p);
    if (this.cache?.firma === firma) return this.cache.resultado;
    const id = this.siguienteId++;
    const respuesta = new Promise<ResultadoCompilacion>(resolver => this.pendientes.set(id, resolver));
    this.enviar({ tipo: 'compilar', id, proyecto: p });
    const r = await respuesta;
    if (!r.ok) return r;
    const resultado: CompilacionWeb = { ok: true, modulo: await WebAssembly.compile(r.wasm), diagnosticos: r.diagnosticos };
    this.cache = { firma, resultado };
    return resultado;
  }

  private enviar(m: MensajeAlCompilador): void {
    if (!this.trabajador) {
      this.trabajador = this.crearTrabajador();
      this.trabajador.onmessage = e => this.recibir(e.data as MensajeDelCompilador);
    }
    this.trabajador.postMessage(m);
  }

  private recibir(m: MensajeDelCompilador): void {
    const prep = this.preparacion;
    switch (m.tipo) {
      case 'progreso':
        prep?.alProgresar(m.hecho, m.total);
        break;
      case 'preparado':
        this.preparacion = null;
        prep?.resolver();
        break;
      case 'error-preparar':
        this.preparacion = null;
        prep?.rechazar(new Error(m.mensaje));
        break;
      case 'compilado':
        this.pendientes.get(m.id)?.(m.resultado);
        this.pendientes.delete(m.id);
        break;
    }
  }
}
