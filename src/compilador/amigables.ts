import type { Diagnostico } from './diagnosticos';

/** Un error de compilación explicado para estudiantes de 14 a 16 años (spec §5). */
export interface MensajeAmigable {
  titulo: string;
  mensaje: string;
  /** Pestaña del error, o null si no está en un archivo del proyecto (por ejemplo, en una cabecera del núcleo). */
  archivo: string | null;
  linea: number | null;
  /** El texto original de Clang, para "Ver mensaje técnico". */
  tecnico: string;
}

export const LIBRERIAS_DISPONIBLES = ['Wire.h', 'QTRSensors.h', 'Adafruit_VL53L0X.h', 'MPU6050_light.h', 'Adafruit_TCS34725.h'];

const PUNTO_Y_COMA = 'Falta un punto y coma `;` al final. En C++ cada instrucción termina con `;`.';
const LLAVES = 'Las llaves `{ }` no están parejas.';
const TIPOS = 'Estás guardando un dato de un tipo en una variable de otro tipo.';
const GENERICO = 'El compilador encontró un problema que no sé explicar. Mira el mensaje técnico.';

const PATRONES: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/expected ';'/, () => PUNTO_Y_COMA],
  [/use of undeclared identifier '([^']+)'/, m => `No conozco \`${m[1]}\`. ¿Está bien escrito? ¿Lo declaraste antes de usarlo?`],
  [/'([^']+)' file not found/, m => `No encontramos \`${m[1]}\`. Las librerías disponibles son: ${LIBRERIAS_DISPONIBLES.join(', ')}.`],
  [/expected '\}'|extraneous closing brace/, () => LLAVES],
  [/no matching (?:member )?function for call to '([^']+)'/, m => `\`${m[1]}\` no recibe esos datos. Revisa cuántos y de qué tipo son.`],
  [/redefinition of '([^']+)'/, m => `\`${m[1]}\` está definido dos veces.`],
  [/cannot initialize|no viable conversion|incompatible type/, () => TIPOS],
  [/undefined symbol: (\S+)/, m => `Falta la función \`${m[1]}\`. ¿Está bien escrito su nombre?`],
  // Lo que suele quedar al borrar la única instrucción de un if, else, for o while sin llaves.
  [/expected statement/, () => 'Un `if`, `for` o `while` quedó sin la instrucción que va después (¿borraste esa línea?). Ponle una instrucción, o unas llaves `{ }` vacías.'],
  [/expected expression/, () => 'Aquí falta un valor o una instrucción. Si borraste una línea, revisa que cada `else` tenga su `if` y que ningún `if` haya quedado sin su instrucción.'],
  [/extraneous '\)'/, () => 'Sobra un paréntesis `)`. Revisa que cada `(` tenga su `)`: ¿quedó el final de una instrucción que borraste?'],
];

export function traducirDiagnostico(d: Diagnostico, rutasProyecto: string[]): MensajeAmigable {
  const enProyecto = d.archivo !== null && rutasProyecto.includes(d.archivo);
  const archivo = enProyecto ? d.archivo : null;
  const linea = enProyecto ? d.linea : null;
  let mensaje = GENERICO;
  for (const [patron, texto] of PATRONES) {
    const m = d.mensaje.match(patron);
    if (m) {
      mensaje = texto(m);
      break;
    }
  }
  return {
    titulo: archivo && linea ? `Ups, revisa la línea ${linea} de ${archivo}` : 'Ups, hay un problema en tu programa',
    mensaje, archivo, linea,
    tecnico: d.detalle ? `${d.mensaje}\n${d.detalle}` : d.mensaje,
  };
}

/** El primer error (las advertencias no detienen la compilación), o null si no hay. */
export function primerError(ds: Diagnostico[], rutasProyecto: string[]): MensajeAmigable | null {
  const d = ds.find(x => x.severidad === 'error');
  return d ? traducirDiagnostico(d, rutasProyecto) : null;
}
