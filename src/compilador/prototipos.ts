/**
 * Busca las definiciones de funciones de nivel superior de un archivo .ino para
 * generar sus prototipos, como hace el Arduino IDE.
 */
export interface DefinicionFuncion {
  prototipo: string;
  /** Línea (0-based) donde empieza la firma. */
  linea: number;
}

const PALABRAS_EXCLUIDAS = /^(template|struct|class|union|enum|namespace|extern|typedef)\b/;

/**
 * Reemplaza comentarios, literales de texto o carácter y líneas de preprocesador
 * por espacios, conservando los saltos de línea y las posiciones.
 */
function limpiar(codigo: string): string {
  const salida = codigo.split('');
  const borrar = (desde: number, hasta: number) => {
    for (let k = desde; k < hasta; k++) if (salida[k] !== '\n') salida[k] = ' ';
  };
  let i = 0;
  let inicioDeLinea = true;
  while (i < codigo.length) {
    const c = codigo[i];
    const sig = codigo[i + 1];
    if (inicioDeLinea && c === '#') {
      let j = i;
      while (j < codigo.length && !(codigo[j] === '\n' && codigo[j - 1] !== '\\')) j++;
      borrar(i, j);
      i = j;
      continue;
    }
    if (c === '\n') { inicioDeLinea = true; i++; continue; }
    if (c !== ' ' && c !== '\t') inicioDeLinea = false;
    if (c === '/' && sig === '/') {
      let j = i;
      while (j < codigo.length && codigo[j] !== '\n') j++;
      borrar(i, j);
      i = j;
    } else if (c === '/' && sig === '*') {
      const fin = codigo.indexOf('*/', i + 2);
      const j = fin < 0 ? codigo.length : fin + 2;
      borrar(i, j);
      i = j;
    } else if (c === '"' || c === '\'') {
      let j = i + 1;
      while (j < codigo.length && codigo[j] !== c && codigo[j] !== '\n') j += codigo[j] === '\\' ? 2 : 1;
      borrar(i, j + 1);
      i = j + 1;
    } else {
      i++;
    }
  }
  return salida.join('');
}

/** Índice del '(' que corresponde al ')' en la posición `cierre`. */
function aperturaDe(texto: string, cierre: number): number {
  let profundidad = 0;
  for (let k = cierre; k >= 0; k--) {
    if (texto[k] === ')') profundidad++;
    else if (texto[k] === '(' && --profundidad === 0) return k;
  }
  return -1;
}

/** Divide los parámetros por comas de nivel superior y quita los argumentos por defecto. */
function parametrosSinDefecto(params: string): string[] {
  const partes: string[] = [];
  let profundidad = 0;
  let actual = '';
  for (const c of params) {
    if (c === '(' || c === '<' || c === '[' || c === '{') profundidad++;
    else if (c === ')' || c === '>' || c === ']' || c === '}') profundidad--;
    if (c === ',' && profundidad === 0) { partes.push(actual); actual = ''; } else actual += c;
  }
  partes.push(actual);
  return partes
    .map(parte => {
      let prof = 0;
      for (let k = 0; k < parte.length; k++) {
        const c = parte[k];
        if (c === '(' || c === '<' || c === '[') prof++;
        else if (c === ')' || c === '>' || c === ']') prof--;
        else if (c === '=' && prof === 0) return parte.slice(0, k);
      }
      return parte;
    })
    .map(parte => parte.trim())
    .filter((parte, i, todas) => parte !== '' || todas.length > 1);
}

const colapsar = (texto: string) => texto.replace(/\s+/g, ' ').trim();

function prototipoDe(sentencia: string): string | null {
  const texto = sentencia.trimEnd();
  if (!texto.endsWith(')')) return null;
  const apertura = aperturaDe(texto, texto.length - 1);
  if (apertura <= 0) return null;
  const cabeza = texto.slice(0, apertura);
  const cabezaLimpia = colapsar(cabeza);
  if (!cabezaLimpia || cabeza.includes('=') || cabeza.includes('::') || cabeza.includes('(')) return null;
  if (PALABRAS_EXCLUIDAS.test(cabezaLimpia)) return null;
  if (!/[A-Za-z_]\w*\s*$/.test(cabeza)) return null;
  const params = parametrosSinDefecto(texto.slice(apertura + 1, texto.length - 1));
  return `${cabezaLimpia}(${params.map(colapsar).join(', ')});`;
}

export function buscarDefiniciones(codigo: string): DefinicionFuncion[] {
  const limpio = limpiar(codigo);
  const definiciones: DefinicionFuncion[] = [];
  let profundidad = 0;
  let inicio = 0;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (c === '{') {
      if (profundidad === 0) {
        const sentencia = limpio.slice(inicio, i);
        const desplazamiento = sentencia.length - sentencia.trimStart().length;
        const prototipo = prototipoDe(sentencia.trimStart());
        if (prototipo) {
          const posicion = inicio + desplazamiento;
          const linea = codigo.slice(0, posicion).split('\n').length - 1;
          definiciones.push({ prototipo, linea });
        }
      }
      profundidad++;
    } else if (c === '}') {
      profundidad = Math.max(0, profundidad - 1);
      if (profundidad === 0) inicio = i + 1;
    } else if (c === ';' && profundidad === 0) {
      inicio = i + 1;
    }
  }
  return definiciones;
}
