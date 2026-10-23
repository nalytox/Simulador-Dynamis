import { textoTiempoRestante } from './lecturas';
import { PUNTOS_HITO, type EstadoJuez } from '../juez/juez';
import { puntosDePartida } from '../pista/puntos';
import type { Pista } from '../pista/tipos';
import type { Pedido } from '../simulacion/control';

const PUNTOS_META = 15;
const MAXIMO_REINICIOS = 3;
const EVENTOS_VISIBLES = 3;

export interface TarjetaJuez {
  mostrarPista(p: Pista): void;
  mostrar(e: EstadoJuez | null): void;
  habilitar(corriendo: boolean): void;
  desde(): string;
  /** Elige desde dónde partir, si ese punto está en la pista. */
  elegirDesde(id: string): void;
}

/** La tarjeta del juez virtual: hitos y meta, puntaje, tiempo, reinicios, últimos eventos y desde dónde partir. */
export function crearTarjetaJuez(raiz: Document, eventos: { alPedir(p: Pedido): void; alElegirDesde(id: string): void }): TarjetaJuez {
  const $ = (id: string) => raiz.getElementById(id)!;
  const seleccion = $('sel-desde') as HTMLSelectElement;
  const ultimo = $('btn-ultimo-hito') as HTMLButtonElement;
  const saltar = $('btn-saltar-hito') as HTMLButtonElement;
  const lista = raiz.createElement('ul');
  lista.className = 'juez-eventos';
  lista.setAttribute('aria-live', 'polite');
  $('hitos').closest('.juez-cuerpo')!.append(lista);
  let circulos: HTMLElement[] = [];
  let corriendo = false;
  let reinicios = 0;

  ultimo.addEventListener('click', () => eventos.alPedir('ultimo'));
  saltar.addEventListener('click', () => eventos.alPedir('siguiente'));
  seleccion.addEventListener('change', () => eventos.alElegirDesde(seleccion.value));

  const actualizarBotones = () => {
    const puede = corriendo && reinicios < MAXIMO_REINICIOS;
    ultimo.disabled = !puede;
    saltar.disabled = !puede;
  };

  return {
    mostrarPista(p) {
      const hitos = p.objetos.flatMap(o => (o.tipo === 'hito' ? [o.props.numero] : [])).sort((a, b) => a - b);
      circulos = [...hitos.map(n => [String(n), `+${PUNTOS_HITO[n - 1] ?? 0}`]), ['M', `+${PUNTOS_META}`]].map(([marca, puntos]) => {
        const div = raiz.createElement('div');
        div.className = 'hito';
        const b = raiz.createElement('b');
        b.textContent = marca;
        div.append(b, puntos);
        return div;
      });
      $('hitos').replaceChildren(...circulos);
      // Si el punto elegido sigue en la pista nueva, se mantiene.
      const antes = seleccion.value;
      const puntos = puntosDePartida(p);
      seleccion.replaceChildren(...puntos.map(punto => new Option(punto.nombre, punto.id)));
      if (puntos.some(punto => punto.id === antes)) seleccion.value = antes;
    },
    mostrar(e) {
      reinicios = e?.reinicios ?? 0;
      circulos.forEach((c, i) => {
        const esMeta = i === circulos.length - 1;
        const estado = esMeta ? (e?.meta ? 'alcanzado' : 'pendiente') : (e?.hitos[i] ?? 'pendiente');
        c.classList.toggle('ok', estado === 'alcanzado');
        c.classList.toggle('saltado', estado === 'saltado');
      });
      $('juez-pts').textContent = String(Math.round(e?.puntaje ?? 0));
      $('juez-rein').textContent = `${reinicios} de ${MAXIMO_REINICIOS}`;
      $('juez-tiempo').textContent = textoTiempoRestante(e?.tiempo ?? null);
      lista.replaceChildren(...(e?.eventos ?? []).slice(-EVENTOS_VISIBLES).map(ev => {
        const li = raiz.createElement('li');
        li.textContent = ev.mensaje;
        return li;
      }));
      actualizarBotones();
    },
    habilitar(c) {
      corriendo = c;
      seleccion.disabled = c;
      actualizarBotones();
    },
    desde: () => seleccion.value,
    elegirDesde(id) {
      if ([...seleccion.options].some(o => o.value === id)) seleccion.value = id;
    },
  };
}
