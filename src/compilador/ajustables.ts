import { normalizarTexto } from './preprocesador';
import { ordenarArchivos, tipoDeArchivo, type Proyecto } from '../proyecto/proyecto';

/**
 * Marcas `@ajustar` (spec §11.1): un valor del código marcado en su comentario se puede probar
 * con otros números sin recompilar. Antes de compilar, el inicializador pasa a
 * `__dyn_ajustable(grupo, nombre, valor)`, que en cada prueba responde el simulador.
 */
export interface Ajustable {
  /** `grupo.nombre`. */
  id: string;
  grupo: string;
  nombre: string;
  valor: number;
  entero: boolean;
  min: number | null;
  max: number | null;
  archivo: string;
  /** Desde 1. */
  linea: number;
  forma: 'variable' | 'define';
}

export interface AvisoAjustable { archivo: string; linea: number; mensaje: string }

const NUMERO = String.raw`[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?[fFlLuU]*`;
/** Un número del rango de la marca: acepta coma decimal (0,05..0,1), como se escribe en Chile. */
const NUMERO_RANGO = String.raw`[-+]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][-+]?\d+)?`;
const MODIFICADORES = String.raw`(?:(?:const|static|volatile|unsigned|signed|long|short)\s+)*`;
const TIPOS_REALES = new Set(['float', 'double']);
const TIPO = String.raw`float|double|int|long|short|char|byte|word|size_t|u?int(?:8|16|32|64)_t|unsigned|signed`;
const RE_VARIABLE = new RegExp(String.raw`^(\s*${MODIFICADORES}(${TIPO})\s+)([A-Za-z_]\w*)(\s*=\s*)(${NUMERO})(\s*;\s*)$`);
const RE_DEFINE = new RegExp(String.raw`^(\s*#\s*define\s+)([A-Za-z_]\w*)(\s+)(${NUMERO})(\s*)$`);
const RE_MARCA = /@ajustar\b/;
const RE_GRUPO = new RegExp(String.raw`@ajustar\s+([\p{L}_][\p{L}\p{N}_]*)(?:\s+(${NUMERO_RANGO})\s*\.\.\s*(${NUMERO_RANGO}))?`, 'u');
const RE_RANGO_INTENTADO = /@ajustar\s+\S+\s+\S*\.\./;
const RE_CONSTEXPR = /\bconstexpr\b[^=]*?\b([A-Za-z_]\w*)\s*=/;
const RE_SUFIJO = /[fFlLuU]+$/;

const SIN_NUMERO = 'La marca @ajustar de esta línea debe ir junto a una variable con un número (float kp = 0.5;) o a un #define con un número.';
const SIN_GRUPO = 'A la marca @ajustar le falta el grupo, por ejemplo: // @ajustar siguelineas';
const SIN_RANGO = 'No entendí el rango de la marca @ajustar de esta línea: escríbelo como mínimo..máximo, por ejemplo 0..0.1.';

/** El grupo sin tildes y en minúsculas: "Siguelíneas" y "siguelineas" son el mismo grupo. */
const normalizarGrupo = (g: string) => g.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const numeroDelRango = (texto: string | undefined) => (texto === undefined ? null : Number(texto.replace(',', '.')));
const esConstexpr = (nombre: string) =>
  `${nombre} está marcado con @ajustar pero es constexpr: no puede cambiar mientras corre el programa. Quita constexpr para ajustarlo.`;

/** Dónde empieza el comentario `//` de la línea, sin contar los que están dentro de textos. */
function inicioComentario(linea: string): number {
  let comilla: string | null = null;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (comilla) {
      if (c === '\\') i++;
      else if (c === comilla) comilla = null;
    } else if (c === '"' || c === "'") {
      comilla = c;
    } else if (c === '/' && linea[i + 1] === '/') {
      return i;
    }
  }
  return -1;
}

/** Una línea con una marca válida, partida en lo que va antes del número, el número y lo que sigue. */
interface Marca {
  forma: 'variable' | 'define';
  grupo: string;
  nombre: string;
  numero: string;
  antes: string;
  despues: string;
  entero: boolean;
  min: number | null;
  max: number | null;
  /** Un rango escrito que no se entendió: la marca vale, sin rango. */
  avisoRango: string | null;
}

type Analisis = { marca: Marca } | { aviso: string } | null;

function analizarLinea(linea: string): Analisis {
  const corte = inicioComentario(linea);
  if (corte < 0) return null;
  const codigo = linea.slice(0, corte);
  const comentario = linea.slice(corte);
  if (!RE_MARCA.test(comentario)) return null;
  const grupo = RE_GRUPO.exec(comentario);
  if (!grupo) return { aviso: SIN_GRUPO };
  const constexpr = RE_CONSTEXPR.exec(codigo);
  if (constexpr) return { aviso: esConstexpr(constexpr[1]) };
  const rango = {
    grupo: normalizarGrupo(grupo[1]), min: numeroDelRango(grupo[2]), max: numeroDelRango(grupo[3]),
    avisoRango: grupo[2] === undefined && RE_RANGO_INTENTADO.test(comentario) ? SIN_RANGO : null,
  };

  const variable = RE_VARIABLE.exec(codigo);
  if (variable) {
    const [, tipoYModificadores, tipo, nombre, igual, numero, fin] = variable;
    return { marca: {
      forma: 'variable', nombre, numero, entero: !TIPOS_REALES.has(tipo), ...rango,
      antes: `${tipoYModificadores}${nombre}${igual}`, despues: `${fin}${comentario}`,
    } };
  }
  const define = RE_DEFINE.exec(codigo);
  if (define) {
    const [, directiva, nombre, espacio, numero, fin] = define;
    return { marca: {
      forma: 'define', nombre, numero, entero: !/[.eE]/.test(numero.replace(RE_SUFIJO, '')), ...rango,
      antes: `${directiva}${nombre}${espacio}`, despues: `${fin}${comentario}`,
    } };
  }
  return { aviso: SIN_NUMERO };
}

const conMarcas = (ruta: string) => ['ino', 'cpp', 'c', 'cabecera'].includes(tipoDeArchivo(ruta));

interface Encontrada { archivo: string; indice: number; marca: Marca; repetida: boolean }

/** Recorre las marcas del proyecto en orden; una repetida queda marcada como tal. */
function recorrer(p: Proyecto): { encontradas: Encontrada[]; avisos: AvisoAjustable[] } {
  const encontradas: Encontrada[] = [];
  const avisos: AvisoAjustable[] = [];
  const vistos = new Set<string>();
  for (const archivo of ordenarArchivos(p).filter(conMarcas)) {
    normalizarTexto(p.archivos[archivo]).split('\n').forEach((linea, indice) => {
      const a = analizarLinea(linea);
      if (!a) return;
      if ('aviso' in a) {
        avisos.push({ archivo, linea: indice + 1, mensaje: a.aviso });
        return;
      }
      if (a.marca.avisoRango) avisos.push({ archivo, linea: indice + 1, mensaje: a.marca.avisoRango });
      const id = `${a.marca.grupo}.${a.marca.nombre}`;
      const repetida = vistos.has(id);
      if (repetida) avisos.push({ archivo, linea: indice + 1, mensaje: `El valor ${id} está marcado dos veces: se usa el primero.` });
      vistos.add(id);
      encontradas.push({ archivo, indice, marca: a.marca, repetida });
    });
  }
  return { encontradas, avisos };
}

export function buscarAjustables(p: Proyecto): { parametros: Ajustable[]; avisos: AvisoAjustable[] } {
  const { encontradas, avisos } = recorrer(p);
  const parametros = encontradas.filter(e => !e.repetida).map(({ archivo, indice, marca: m }): Ajustable => ({
    id: `${m.grupo}.${m.nombre}`, grupo: m.grupo, nombre: m.nombre, valor: Number(m.numero.replace(RE_SUFIJO, '')),
    entero: m.entero, min: m.min, max: m.max, archivo, linea: indice + 1, forma: m.forma,
  }));
  return { parametros, avisos };
}

/** Cambia las líneas indicadas de cada archivo; los demás archivos quedan idénticos. */
function conLineas(p: Proyecto, cambios: Map<string, Map<number, string>>): Proyecto {
  const archivos = { ...p.archivos };
  for (const [archivo, lineas] of cambios) {
    const texto = normalizarTexto(p.archivos[archivo]).split('\n');
    for (const [indice, nueva] of lineas) texto[indice] = nueva;
    archivos[archivo] = texto.join('\n');
  }
  return { ...p, archivos };
}

function agregar(cambios: Map<string, Map<number, string>>, archivo: string, indice: number, linea: string): void {
  if (!cambios.has(archivo)) cambios.set(archivo, new Map());
  cambios.get(archivo)!.set(indice, linea);
}

/**
 * El proyecto que se compila: cada valor marcado pasa por __dyn_ajustable. Las líneas no cambian de número.
 * Un #define conserva el tipo de su número (`__typeof__`): si no, un entero pasaría a double y
 * `min(N, 255)` o `x % N` dejarían de compilar.
 */
export function conAjustables(p: Proyecto): Proyecto {
  const cambios = new Map<string, Map<number, string>>();
  for (const { archivo, indice, marca: m, repetida } of recorrer(p).encontradas) {
    if (repetida) continue;
    const llamada = `__dyn_ajustable(${JSON.stringify(m.grupo)}, ${JSON.stringify(m.nombre)}, ${m.numero})`;
    agregar(cambios, archivo, indice, `${m.antes}${m.forma === 'define' ? `((__typeof__(${m.numero}))${llamada})` : llamada}${m.despues}`);
  }
  return conLineas(p, cambios);
}

/** Enteros redondeados; reales con 4 cifras significativas y siempre con punto decimal (o exponente). */
export function formatearValor(v: number, entero: boolean): string {
  if (entero) return String(Math.round(v));
  const texto = String(Number(v.toPrecision(4)));
  return /[.e]/.test(texto) ? texto : `${texto}.0`;
}

/**
 * "Usar estos valores" (decisión 12 de la fase 6): busca cada marca por su id en el código actual,
 * aunque se haya movido de línea, y reescribe solo su número.
 */
export function reescribirAjustables(p: Proyecto, valores: Record<string, number>): {
  proyecto: Proyecto; cambiadas: { archivo: string; linea: number }[]; faltan: string[];
} {
  const cambios = new Map<string, Map<number, string>>();
  const cambiadas: { archivo: string; linea: number }[] = [];
  const encontrados = new Set<string>();
  for (const { archivo, indice, marca: m, repetida } of recorrer(p).encontradas) {
    const id = `${m.grupo}.${m.nombre}`;
    if (repetida || !(id in valores)) continue;
    encontrados.add(id);
    agregar(cambios, archivo, indice, `${m.antes}${formatearValor(valores[id], m.entero)}${m.despues}`);
    cambiadas.push({ archivo, linea: indice + 1 });
  }
  return { proyecto: conLineas(p, cambios), cambiadas, faltan: Object.keys(valores).filter(id => !encontrados.has(id)) };
}
