import type { Pose } from '../simulacion/simulador';
import { TAMANO_BALDOSA, type Accion, type Baldosa, type Luz, type ObjetoDePista, type Pista, type TipoBaldosa } from './tipos';

export type ResultadoLectura = { ok: true; pista: Pista } | { ok: false; errores: string[] };

type Registro = Record<string, unknown>;

const TIPOS_BALDOSA: readonly TipoBaldosa[] = [
  'vacia', 'recta', 'giroSuave', 'giroL', 'cortes', 'cruce', 'unionT', 'rampa', 'indicadorF2', 'cuadradoF1', 'partida', 'meta',
];
const ROTACIONES = [0, 90, 180, 270];
const LUCES: readonly Luz[] = ['normal', 'fuerte', 'tenue'];
const ACCIONES: readonly Accion[] = ['izq', 'der', 'recto', 'vuelta'];
const LADOS = ['izq', 'der'] as const;
const COLOR_HEX = /^#[0-9A-Fa-f]{6}$/;

const esRegistro = (x: unknown): x is Registro => typeof x === 'object' && x !== null && !Array.isArray(x);
const esNumero = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const esEnteroPositivo = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 1;
const esLado = (x: unknown): x is 'izq' | 'der' => LADOS.includes(x as 'izq');

export const gradosARadianes = (grados: number): number => (grados * Math.PI) / 180;

/** Lee una propiedad opcional: si falta usa el valor por defecto; si es inválida, anota el error. */
function propiedad<T>(props: Registro, clave: string, valida: (v: unknown) => v is T, porDefecto: T, donde: string, errores: string[]): T {
  const valor = props[clave];
  if (valor === undefined) return porDefecto;
  if (valida(valor)) return valor;
  errores.push(`${donde} tiene "${clave}" inválido.`);
  return porDefecto;
}

function propsDeBaldosa(tipo: TipoBaldosa, props: Registro, donde: string, errores: string[]): Registro {
  const p = (clave: string, valida: (v: unknown) => boolean, porDefecto: unknown) =>
    propiedad(props, clave, valida as (v: unknown) => v is unknown, porDefecto, donde, errores);
  const comunes = { invertida: p('invertida', v => typeof v === 'boolean', false) };
  const decision = () => {
    const marcas = esRegistro(props.marcas) ? props.marcas : {};
    const extra: Registro = {
      marcas: { ai: marcas.ai === true, ad: marcas.ad === true, di: marcas.di === true, dd: marcas.dd === true },
    };
    if (props.colorMarca !== undefined) extra.colorMarca = p('colorMarca', v => typeof v === 'string' && COLOR_HEX.test(v), undefined);
    if (props.accion !== undefined) extra.accion = p('accion', v => ACCIONES.includes(v as Accion), undefined);
    return extra;
  };
  switch (tipo) {
    case 'cortes':
      return { ...comunes, guion: p('guion', esNumero, 50), espacio: p('espacio', esNumero, 40) };
    case 'cruce':
      return { ...comunes, ...decision() };
    case 'unionT':
      return { ...comunes, ...decision(), rama: p('rama', esLado, 'izq') };
    case 'rampa':
      return { ...comunes, angulo: p('angulo', esNumero, 20) };
    case 'indicadorF2':
      return { ...comunes, decisiones: p('decisiones', v => Array.isArray(v) && v.length > 0 && v.every(esLado), ['izq']) };
    case 'cuadradoF1':
      return { ...comunes, correcto: p('correcto', esLado, 'izq') };
    default:
      return comunes;
  }
}

function normalizarBaldosas(datos: unknown, columnas: number | null, filas: number | null, errores: string[]): Baldosa[] {
  if (datos === undefined) return [];
  if (!Array.isArray(datos)) {
    errores.push('"baldosas" debe ser una lista.');
    return [];
  }
  const baldosas: Baldosa[] = [];
  const ocupadas = new Set<string>();
  datos.forEach((b, i) => {
    if (!esRegistro(b) || !Number.isInteger(b.c) || !Number.isInteger(b.r)) {
      errores.push(`La baldosa ${i + 1} no tiene una posición (c, r) válida.`);
      return;
    }
    const c = b.c as number;
    const r = b.r as number;
    const donde = `La baldosa en (${c}, ${r})`;
    if (!TIPOS_BALDOSA.includes(b.tipo as TipoBaldosa)) {
      errores.push(`${donde} tiene un tipo desconocido: ${JSON.stringify(b.tipo)}.`);
      return;
    }
    if (columnas !== null && filas !== null && (c < 0 || r < 0 || c >= columnas || r >= filas)) {
      errores.push(`${donde} queda fuera de la grilla de ${columnas} × ${filas}.`);
      return;
    }
    const rot = b.rot ?? 0;
    if (!ROTACIONES.includes(rot as number)) errores.push(`${donde} tiene rot ${JSON.stringify(rot)}: usa 0, 90, 180 o 270.`);
    const nivel = b.nivel ?? 0;
    if (!esNumero(nivel)) errores.push(`${donde} tiene "nivel" inválido.`);
    const clave = `${c},${r}`;
    if (ocupadas.has(clave)) errores.push(`Hay dos baldosas en (${c}, ${r}).`);
    ocupadas.add(clave);
    const tipo = b.tipo as TipoBaldosa;
    const props = propsDeBaldosa(tipo, esRegistro(b.props) ? b.props : {}, donde, errores);
    baldosas.push({ c, r, rot, nivel, tipo, props } as Baldosa);
  });
  return baldosas;
}

function normalizarObjetos(datos: unknown, errores: string[]): ObjetoDePista[] {
  if (datos === undefined) return [];
  if (!Array.isArray(datos)) {
    errores.push('"objetos" debe ser una lista.');
    return [];
  }
  const objetos: ObjetoDePista[] = [];
  datos.forEach((o, i) => {
    const n = i + 1;
    if (!esRegistro(o)) {
      errores.push(`El objeto ${n} no es válido.`);
      return;
    }
    const props = esRegistro(o.props) ? o.props : {};
    const base = { x: o.x, y: o.y, rot: o.rot ?? 0 };
    const p = <T>(clave: string, valida: (v: unknown) => v is T, porDefecto: T) =>
      propiedad(props, clave, valida, porDefecto, `El objeto ${n} (${o.tipo})`, errores);
    if (!['obstaculo', 'bache', 'hito', 'desafio'].includes(o.tipo as string)) {
      errores.push(`El objeto ${n} tiene un tipo desconocido: ${JSON.stringify(o.tipo)}.`);
      return;
    }
    if (!esNumero(base.x) || !esNumero(base.y) || !esNumero(base.rot)) {
      errores.push(`El objeto ${n} no tiene una posición válida.`);
      return;
    }
    switch (o.tipo) {
      case 'obstaculo':
        objetos.push({ tipo: 'obstaculo', ...base, props: { ancho: p('ancho', esNumero, 100), largo: p('largo', esNumero, 100), alto: p('alto', esNumero, 100) } } as ObjetoDePista);
        break;
      case 'bache':
        objetos.push({ tipo: 'bache', ...base, props: { largo: p('largo', esNumero, 300), radio: p('radio', esNumero, 6) } } as ObjetoDePista);
        break;
      case 'hito':
        if (!esNumero(props.numero)) errores.push(`El objeto ${n} (hito) no tiene número.`);
        objetos.push({ tipo: 'hito', ...base, props: { numero: props.numero, yaw: p('yaw', esNumero, 0) } } as ObjetoDePista);
        break;
      case 'desafio':
        if (typeof props.nombre !== 'string' || props.nombre.trim() === '') errores.push(`El objeto ${n} (desafío) no tiene nombre.`);
        if (!esNumero(props.hitoSiguiente)) errores.push(`El objeto ${n} (desafío) no dice cuál es el hito siguiente.`);
        objetos.push({ tipo: 'desafio', ...base, props: { nombre: props.nombre, yaw: p('yaw', esNumero, 0), hitoSiguiente: props.hitoSiguiente } } as ObjetoDePista);
        break;
    }
  });
  return objetos;
}

/** Valida una pista leída de JSON y completa los valores por defecto. Nunca lanza. */
export function normalizarPista(datos: unknown): ResultadoLectura {
  if (!esRegistro(datos)) return { ok: false, errores: ['El archivo no es una pista válida.'] };
  const errores: string[] = [];
  for (const campo of ['version', 'nombre', 'tamanoBaldosa', 'columnas', 'filas', 'inicio']) {
    if (datos[campo] === undefined) errores.push(`Falta "${campo}".`);
  }
  if (datos.version !== undefined && datos.version !== 1) {
    errores.push(`Esta pista es de una versión desconocida (version: ${JSON.stringify(datos.version)}).`);
  }
  if (datos.nombre !== undefined && typeof datos.nombre !== 'string') errores.push('"nombre" debe ser un texto.');
  if (datos.tamanoBaldosa !== undefined && datos.tamanoBaldosa !== TAMANO_BALDOSA) {
    errores.push('Por ahora las baldosas miden 30 cm: tamanoBaldosa debe ser 300.');
  }
  for (const campo of ['columnas', 'filas']) {
    if (datos[campo] !== undefined && !esEnteroPositivo(datos[campo])) errores.push(`"${campo}" debe ser un número entero mayor que 0.`);
  }
  const columnas = esEnteroPositivo(datos.columnas) ? datos.columnas : null;
  const filas = esEnteroPositivo(datos.filas) ? datos.filas : null;

  const ambiente = datos.ambiente ?? { luz: 'normal' };
  if (!esRegistro(ambiente) || !LUCES.includes(ambiente.luz as Luz)) {
    errores.push('La luz del ambiente debe ser "normal", "fuerte" o "tenue".');
  }
  if (datos.colorMarcas !== undefined && !(typeof datos.colorMarcas === 'string' && COLOR_HEX.test(datos.colorMarcas))) {
    errores.push('"colorMarcas" debe ser un color como "#00A651".');
  }
  const inicio = datos.inicio;
  if (inicio !== undefined && !(esRegistro(inicio) && esNumero(inicio.x) && esNumero(inicio.y) && esNumero(inicio.yaw ?? 0))) {
    errores.push('El inicio necesita "x", "y" y "yaw" numéricos.');
  }

  const baldosas = normalizarBaldosas(datos.baldosas, columnas, filas, errores);
  const objetos = normalizarObjetos(datos.objetos, errores);
  if (errores.length > 0) return { ok: false, errores };

  const pista: Pista = {
    version: 1,
    nombre: datos.nombre as string,
    tamanoBaldosa: TAMANO_BALDOSA,
    columnas: columnas!,
    filas: filas!,
    ambiente: { luz: (ambiente as Registro).luz as Luz },
    baldosas,
    objetos,
    inicio: { x: (inicio as Registro).x as number, y: (inicio as Registro).y as number, yaw: ((inicio as Registro).yaw ?? 0) as number },
  };
  if (datos.colorMarcas !== undefined) pista.colorMarcas = datos.colorMarcas as string;
  return { ok: true, pista };
}

export function leerPista(texto: string): ResultadoLectura {
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    return { ok: false, errores: ['El archivo no es una pista válida (no es JSON).'] };
  }
  return normalizarPista(datos);
}

export function escribirPista(p: Pista): string {
  return JSON.stringify(p, null, 2);
}

/** Pista vacía de 8 × 6 baldosas (2,4 × 1,8 m), como el escenario de las bases. */
export function pistaVacia(columnas = 8, filas = 6): Pista {
  return {
    version: 1, nombre: 'Pista nueva', tamanoBaldosa: TAMANO_BALDOSA, columnas, filas,
    ambiente: { luz: 'normal' }, baldosas: [], objetos: [], inicio: { x: 150, y: 150, yaw: 0 },
  };
}

/** Pose inicial del robot en el marco del mundo, con yaw en radianes. */
export function poseInicial(p: Pista): Pose {
  return { x: p.inicio.x, y: p.inicio.y, yaw: gradosARadianes(p.inicio.yaw) };
}
