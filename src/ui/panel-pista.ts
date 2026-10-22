import { NOMBRE_TIPO } from './paleta';
import { textoAccion, textoAltura, textoPosicion, textoSubida } from './textos-pista';
import type { Seleccion } from './editor-pista';
import {
  baldosaEn, cambiarBaldosa, cambiarObjeto, girarBaldosa, girarObjeto, moverInicio, quitarObjeto, subidaRampa, vaciarCelda,
} from '../pista/edicion';
import { celdaDe } from '../pista/baldosas';
import { accionEsperada } from '../pista/catalogo';
import { revisarPista } from '../pista/revision';
import type { Baldosa, Marcas, ObjetoDePista, Pista } from '../pista/tipos';

export interface PanelPista { mostrar(p: Pista, sel: Seleccion | null): void }

type Hijo = Node | string;

const MARCAS: [keyof Marcas, string][] = [
  ['ai', 'Antes del cruce, a la izquierda'], ['ad', 'Antes del cruce, a la derecha'],
  ['di', 'Después del cruce, a la izquierda'], ['dd', 'Después del cruce, a la derecha'],
];
const DIRECCIONES: [number, string][] = [[0, 'Hacia la derecha (0°)'], [90, 'Hacia arriba (90°)'], [180, 'Hacia la izquierda (180°)'], [270, 'Hacia abajo (270°)']];
const LADOS: [string, string][] = [['izq', 'Izquierda'], ['der', 'Derecha']];
const MAXIMO_DECISIONES = 3;
const cm = (mm: number) => (mm / 10).toLocaleString('es-CL', { maximumFractionDigits: 1 });
const acotar = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * El panel de la derecha de Construir pista (spec §10.5): lo elegido (baldosa, objeto o inicio)
 * con sus propiedades, y debajo de la pista la lista "Revisión de las bases". Cada cambio se avisa
 * con la pista nueva; los números escritos a mano se acotan a su rango.
 */
export function crearPanelPista(raiz: Document, eventos: { alCambiar(p: Pista): void; alElegir(sel: Seleccion | null): void }): PanelPista {
  const titulo = raiz.getElementById('panel-titulo')!;
  const cuerpo = raiz.getElementById('panel-pista')!;
  const listaAvisos = raiz.getElementById('avisos-pista')!;

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, clase?: string, ...hijos: Hijo[]): HTMLElementTagNameMap[K] => {
    const e = raiz.createElement(tag);
    if (clase) e.className = clase;
    e.append(...hijos);
    return e;
  };
  const bloque = (...hijos: Hijo[]) => el('div', 'bloque', ...hijos);
  const etiqueta = (texto: string) => el('span', 'etq', texto);
  const nota = (texto: string) => el('span', 'nota-props', texto);
  /** El id deja el foco en el mismo botón cuando el panel se vuelve a dibujar. */
  const boton = (id: string, texto: string, alClic: () => void, deshabilitado = false) => {
    const b = el('button', 'btn-sec', texto);
    b.type = 'button';
    if (id) b.id = id;
    b.disabled = deshabilitado;
    b.addEventListener('click', alClic);
    return b;
  };

  /** Un número con su rango: al confirmarlo (Enter o salir) se acota; si no es un número, vuelve al valor anterior. */
  const numero = (o: { id: string; texto: string; valor: number; min: number; max: number; paso: number; alCambiar(v: number): void }) => {
    const input = el('input');
    Object.assign(input, { type: 'number', id: o.id, min: String(o.min), max: String(o.max), step: String(o.paso), value: String(o.valor) });
    input.addEventListener('change', () => {
      const v = Number.parseFloat(input.value);
      if (!Number.isFinite(v)) {
        input.value = String(o.valor);
        return;
      }
      const acotado = acotar(v, o.min, o.max);
      input.value = String(acotado);
      o.alCambiar(acotado);
    });
    const label = el('label', 'opcion-rango', o.texto, input);
    label.htmlFor = o.id;
    return label;
  };
  const selector = (o: { id: string; texto: string; valor: string; opciones: [string, string][]; alCambiar(v: string): void }) => {
    const select = el('select');
    select.id = o.id;
    for (const [valor, texto] of o.opciones) {
      const opcion = el('option', undefined, texto);
      opcion.value = valor;
      select.append(opcion);
    }
    select.value = o.valor;
    select.addEventListener('change', () => o.alCambiar(select.value));
    const label = el('label', 'opcion-sel', o.texto, select);
    label.htmlFor = o.id;
    return label;
  };
  const casilla = (o: { id: string; texto: string; marcada: boolean; alCambiar(v: boolean): void }) => {
    const input = el('input');
    Object.assign(input, { type: 'checkbox', id: o.id, checked: o.marcada });
    input.addEventListener('change', () => o.alCambiar(input.checked));
    const label = el('label', 'opcion', input, o.texto);
    label.htmlFor = o.id;
    return label;
  };
  const direccion = (valor: number, alCambiar: (v: number) => void) => {
    const opciones = DIRECCIONES.map(([g, t]): [string, string] => [String(g), t]);
    if (!DIRECCIONES.some(([g]) => g === valor)) opciones.push([String(valor), `${valor}°`]);
    return selector({ id: 'pp-yaw', texto: 'Dirección', valor: String(valor), opciones, alCambiar: v => alCambiar(Number(v)) });
  };

  function propiedadesDeBaldosa(p: Pista, b: Baldosa): HTMLElement[] {
    const cambiar = (props: Record<string, unknown>) => eventos.alCambiar(cambiarBaldosa(p, b.c, b.r, { props }));
    const partes: HTMLElement[] = [];
    if (b.tipo === 'cruce' || b.tipo === 'unionT') {
      const marcas = b.props.marcas;
      partes.push(bloque(
        etiqueta('Marcas de color'),
        ...MARCAS.map(([k, texto]) => casilla({ id: `pp-marca-${k}`, texto, marcada: marcas[k], alCambiar: v => cambiar({ marcas: { ...marcas, [k]: v } }) })),
        nota('Izquierda y derecha se miran desde la flecha rosada, que muestra por dónde entra el robot.'),
        el('span', 'accion', 'El robot debe: ', el('b', undefined, textoAccion(accionEsperada(b)!))),
      ));
      if (b.tipo === 'unionT') {
        partes.push(bloque(selector({ id: 'pp-rama', texto: 'Rama', valor: b.props.rama, opciones: [['izq', 'A la izquierda'], ['der', 'A la derecha']], alCambiar: v => cambiar({ rama: v }) })));
      }
    } else if (b.tipo === 'rampa') {
      partes.push(bloque(
        numero({ id: 'pp-angulo', texto: 'Inclinación (°)', valor: b.props.angulo, min: 5, max: 35, paso: 1, alCambiar: v => cambiar({ angulo: v }) }),
        el('span', 'val', textoSubida(subidaRampa(b))),
        nota('Las bases permiten hasta 35°. La baldosa que sigue queda a la altura de la parte alta.'),
      ));
    } else if (b.tipo === 'cortes') {
      partes.push(bloque(
        etiqueta('Cortes'),
        numero({ id: 'pp-espacio', texto: 'Espacio entre trazos (mm)', valor: b.props.espacio, min: 10, max: 40, paso: 1, alCambiar: v => cambiar({ espacio: v }) }),
        numero({ id: 'pp-guion', texto: 'Largo de cada trazo (mm)', valor: b.props.guion, min: 20, max: 80, paso: 1, alCambiar: v => cambiar({ guion: v }) }),
        nota('Las bases permiten cortes de hasta 4 cm.'),
      ));
    } else if (b.tipo === 'indicadorF2') {
      const decisiones = b.props.decisiones;
      partes.push(bloque(
        etiqueta('Decisiones'),
        ...decisiones.map((d, i) => selector({
          id: `pp-decision-${i}`, texto: `Decisión ${i + 1}`, valor: d, opciones: LADOS,
          alCambiar: v => cambiar({ decisiones: decisiones.map((x, j) => (j === i ? v : x)) }),
        })),
        el('div', 'fila-botones',
          boton('pp-agregar-decision', 'Agregar decisión', () => cambiar({ decisiones: [...decisiones, 'izq'] }), decisiones.length >= MAXIMO_DECISIONES),
          boton('pp-quitar-decision', 'Quitar la última', () => cambiar({ decisiones: decisiones.slice(0, -1) }), decisiones.length <= 1)),
      ));
    } else if (b.tipo === 'cuadradoF1') {
      partes.push(bloque(
        selector({ id: 'pp-correcto', texto: 'Camino correcto', valor: b.props.correcto, opciones: [['izq', 'Por la izquierda'], ['der', 'Por la derecha']], alCambiar: v => cambiar({ correcto: v }) }),
        nota('Solo uno de los dos caminos es correcto. Lo indica el F2 que va antes.'),
      ));
    }
    partes.push(bloque(casilla({ id: 'pp-invertida', texto: 'Línea blanca sobre fondo negro', marcada: b.props.invertida, alCambiar: v => cambiar({ invertida: v }) })));
    return partes;
  }

  function mostrarBaldosa(p: Pista, c: number, r: number): HTMLElement[] {
    const b = baldosaEn(p, c, r);
    if (!b) {
      return [bloque(etiqueta('Tipo'), el('span', 'grande', 'Celda vacía'), el('span', 'sub', `Columna ${c + 1}, fila ${r + 1}`)),
        nota('Elige una pieza de la paleta y haz clic aquí para colocarla.')];
    }
    return [
      bloque(etiqueta('Tipo'), el('span', 'grande', NOMBRE_TIPO[b.tipo]), el('span', 'sub', textoPosicion(b))),
      bloque(
        numero({ id: 'pp-altura', texto: 'Altura (cm)', valor: Number((b.nivel / 10).toFixed(1)), min: 0, max: 50, paso: 0.1, alCambiar: v => eventos.alCambiar(cambiarBaldosa(p, c, r, { nivel: v * 10 })) }),
        nota(b.nivel > 0 ? `Esta baldosa está a ${textoAltura(b.nivel)} del suelo.` : 'Esta baldosa está en el suelo.'),
      ),
      ...propiedadesDeBaldosa(p, b),
      bloque(etiqueta('Girar'), el('div', 'fila-botones',
        boton('pp-girar-izq', 'Izquierda', () => eventos.alCambiar(girarBaldosa(p, c, r, 1))),
        boton('pp-girar-der', 'Derecha', () => eventos.alCambiar(girarBaldosa(p, c, r, -1))))),
      bloque(etiqueta('Quitar'), boton('pp-vaciar', 'Dejar vacía', () => eventos.alCambiar(vaciarCelda(p, c, r)))),
    ];
  }

  function mostrarObjeto(p: Pista, i: number, o: ObjetoDePista): HTMLElement[] {
    const cambiar = (cambios: Record<string, unknown>) => eventos.alCambiar(cambiarObjeto(p, i, cambios));
    const medida = (id: string, texto: string, mm: number, max: number, clave: string) =>
      numero({ id, texto, valor: mm / 10, min: 1, max, paso: 0.5, alCambiar: v => cambiar({ [clave]: v * 10 }) });
    const nombre = { obstaculo: 'Obstáculo', bache: 'Bache', hito: o.tipo === 'hito' ? `Hito ${o.props.numero}` : '', desafio: o.tipo === 'desafio' ? `Desafío ${o.props.nombre}` : '' }[o.tipo];
    const partes = [bloque(etiqueta('Tipo'), el('span', 'grande', nombre), el('span', 'sub', `x = ${cm(o.x)} cm, y = ${cm(o.y)} cm`))];
    if (o.tipo === 'obstaculo') {
      partes.push(bloque(etiqueta('Medidas'),
        medida('pp-ancho', 'Ancho (cm)', o.props.ancho, 30, 'ancho'),
        medida('pp-largo', 'Largo (cm)', o.props.largo, 30, 'largo'),
        medida('pp-alto', 'Alto (cm)', o.props.alto, 30, 'alto')));
    } else if (o.tipo === 'bache') {
      const { c, r } = celdaDe(o.x, o.y);
      const linea = baldosaEn(p, c, r)?.rot ?? 0;
      partes.push(bloque(etiqueta('Medidas'),
        medida('pp-largo', 'Largo (cm)', o.props.largo, 30, 'largo'),
        numero({ id: 'pp-radio', texto: 'Radio (mm)', valor: o.props.radio, min: 1, max: 6, paso: 0.5, alCambiar: v => cambiar({ radio: v }) }),
        nota('Las bases permiten baches de hasta 30 cm de largo y 6 mm de radio.')));
      partes.push(bloque(etiqueta('Orientación'), el('div', 'fila-botones',
        boton('pp-recto', 'Recto', () => cambiar({ rot: (linea + 90) % 360 })),
        boton('pp-diagonal', 'Diagonal', () => cambiar({ rot: (linea + 45) % 360 })))));
    } else if (o.tipo === 'hito') {
      partes.push(bloque(
        numero({ id: 'pp-numero', texto: 'Número', valor: o.props.numero, min: 1, max: 99, paso: 1, alCambiar: v => cambiar({ numero: Math.round(v) }) }),
        direccion(o.props.yaw, v => cambiar({ yaw: v }))));
    } else {
      const input = el('input');
      Object.assign(input, { type: 'text', id: 'pp-nombre', value: o.props.nombre, maxLength: 12 });
      input.addEventListener('change', () => {
        const nombreNuevo = input.value.trim();
        if (nombreNuevo === '') input.value = o.props.nombre;
        else cambiar({ nombre: nombreNuevo });
      });
      const label = el('label', 'opcion-sel', 'Nombre', input);
      label.htmlFor = 'pp-nombre';
      partes.push(bloque(label, direccion(o.props.yaw, v => cambiar({ yaw: v })),
        numero({ id: 'pp-siguiente', texto: 'Hito siguiente', valor: o.props.hitoSiguiente, min: 1, max: 99, paso: 1, alCambiar: v => cambiar({ hitoSiguiente: Math.round(v) }) })));
    }
    partes.push(bloque(etiqueta('Girar'), boton('pp-girar', o.tipo === 'bache' ? 'Girar 45°' : 'Girar 90°', () => eventos.alCambiar(girarObjeto(p, i)))));
    partes.push(bloque(etiqueta('Quitar'), boton('pp-quitar', 'Quitar', () => {
      eventos.alCambiar(quitarObjeto(p, i));
      eventos.alElegir(null);
    })));
    return partes;
  }

  function mostrarInicio(p: Pista): HTMLElement[] {
    return [
      bloque(etiqueta('Dónde parte el robot'), el('span', 'sub', `x = ${cm(p.inicio.x)} cm, y = ${cm(p.inicio.y)} cm`)),
      bloque(direccion(p.inicio.yaw, v => eventos.alCambiar(moverInicio(p, p.inicio.x, p.inicio.y, v))),
        nota('Arrastra el inicio en la pista para moverlo.')),
    ];
  }

  function mostrarAvisos(p: Pista) {
    const avisos = revisarPista(p);
    if (avisos.length === 0) {
      listaAvisos.replaceChildren(el('li', 'ok', 'Tu pista cumple lo que revisamos de las bases.'));
      return;
    }
    listaAvisos.replaceChildren(...avisos.map(a => {
      const destino: Seleccion | null = a.objeto !== undefined ? { clase: 'objeto', indice: a.objeto }
        : a.baldosas?.length ? { clase: 'baldosa', ...a.baldosas[0] } : null;
      if (!destino) return el('li', undefined, a.mensaje);
      const b = boton('', a.mensaje, () => eventos.alElegir(destino));
      b.className = 'aviso-pista';
      return el('li', undefined, b);
    }));
  }

  return {
    mostrar(p, sel) {
      const enfocado = cuerpo.contains(raiz.activeElement) ? raiz.activeElement!.id : '';
      let partes: HTMLElement[];
      if (sel?.clase === 'baldosa') {
        titulo.textContent = 'Baldosa elegida';
        partes = mostrarBaldosa(p, sel.c, sel.r);
      } else if (sel?.clase === 'objeto' && p.objetos[sel.indice]) {
        titulo.textContent = 'Objeto elegido';
        partes = mostrarObjeto(p, sel.indice, p.objetos[sel.indice]);
      } else if (sel?.clase === 'inicio') {
        titulo.textContent = 'Inicio del robot';
        partes = mostrarInicio(p);
      } else {
        titulo.textContent = 'Baldosa elegida';
        partes = [nota('Elige una baldosa o un objeto de la pista para ver y cambiar sus propiedades.')];
      }
      cuerpo.replaceChildren(...partes);
      if (enfocado) raiz.getElementById(enfocado)?.focus();
      mostrarAvisos(p);
    },
  };
}
