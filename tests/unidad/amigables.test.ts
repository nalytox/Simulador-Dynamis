import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { traducirDiagnostico, primerError, LIBRERIAS_DISPONIBLES } from '../../src/compilador/amigables';
import type { Diagnostico } from '../../src/compilador/diagnosticos';

const RUTAS = ['seguidor.ino', 'pines.h'];
const diag = (mensaje: string, extra: Partial<Diagnostico> = {}): Diagnostico =>
  ({ archivo: 'seguidor.ino', linea: 20, columna: 5, severidad: 'error', mensaje, detalle: '  int x = 1\n          ^', ...extra });
const mensajeDe = (m: string) => traducirDiagnostico(diag(m), RUTAS).mensaje;

describe('errores amigables', () => {
  it.each([
    ["expected ';' after expression", 'Falta un punto y coma `;` al final. En C++ cada instrucción termina con `;`.'],
    ["expected ';' at end of declaration", 'Falta un punto y coma `;` al final. En C++ cada instrucción termina con `;`.'],
    ["use of undeclared identifier 'velocidad'", 'No conozco `velocidad`. ¿Está bien escrito? ¿Lo declaraste antes de usarlo?'],
    ["'Servo.h' file not found", `No encontramos \`Servo.h\`. Las librerías disponibles son: ${LIBRERIAS_DISPONIBLES.join(', ')}.`],
    ["expected '}'", 'Las llaves `{ }` no están parejas.'],
    ["extraneous closing brace ('}')", 'Las llaves `{ }` no están parejas.'],
    ["no matching function for call to 'motores'", '`motores` no recibe esos datos. Revisa cuántos y de qué tipo son.'],
    ["no matching member function for call to 'requestFrom'", '`requestFrom` no recibe esos datos. Revisa cuántos y de qué tipo son.'],
    ["redefinition of 'x'", '`x` está definido dos veces.'],
    ["cannot initialize a variable of type 'int *' with an rvalue of type 'int'", 'Estás guardando un dato de un tipo en una variable de otro tipo.'],
    ["no viable conversion from 'String' to 'int'", 'Estás guardando un dato de un tipo en una variable de otro tipo.'],
    ["assigning to 'int *' from incompatible type 'int'", 'Estás guardando un dato de un tipo en una variable de otro tipo.'],
    ['undefined symbol: loop', 'Falta la función `loop`. ¿Está bien escrito su nombre?'],
    // Lo que queda al borrar la única instrucción de un if, else, for o while sin llaves.
    ['expected statement', 'Un `if`, `for` o `while` quedó sin la instrucción que va después (¿borraste esa línea?). Ponle una instrucción, o unas llaves `{ }` vacías.'],
    ['expected expression', 'Aquí falta un valor o una instrucción. Si borraste una línea, revisa que cada `else` tenga su `if` y que ningún `if` haya quedado sin su instrucción.'],
    ["extraneous ')' before ';'", 'Sobra un paréntesis `)`. Revisa que cada `(` tenga su `)`: ¿quedó el final de una instrucción que borraste?'],
    ["unknown type name 'foo'", 'El compilador encontró un problema que no sé explicar. Mira el mensaje técnico.'],
  ])('%s', (mensaje, esperado) => {
    expect(mensajeDe(mensaje)).toBe(esperado);
  });

  it('el título nombra la línea y el archivo del proyecto', () => {
    const m = traducirDiagnostico(diag("expected ';' after expression"), RUTAS);
    expect(m).toMatchObject({ titulo: 'Ups, revisa la línea 20 de seguidor.ino', archivo: 'seguidor.ino', linea: 20 });
    expect(m.tecnico).toBe("expected ';' after expression\n  int x = 1\n          ^");
  });

  it('un error en una cabecera del núcleo no tiene archivo ni línea de pestaña', () => {
    const m = traducirDiagnostico(diag("redefinition of 'x'", { archivo: 'nucleo/include/Arduino.h', linea: 12 }), RUTAS);
    expect(m).toMatchObject({ titulo: 'Ups, hay un problema en tu programa', archivo: null, linea: null });
  });

  it('primerError salta las advertencias', () => {
    const ds = [diag('unused variable', { severidad: 'advertencia' }), diag("redefinition of 'x'", { linea: 7 })];
    expect(primerError(ds, RUTAS)?.linea).toBe(7);
    expect(primerError([ds[0]], RUTAS)).toBeNull();
  });

  it('las librerías disponibles son las del núcleo simulado', () => {
    expect(LIBRERIAS_DISPONIBLES).toEqual(['Wire.h', 'QTRSensors.h', 'Adafruit_VL53L0X.h', 'MPU6050_light.h', 'Adafruit_TCS34725.h']);
    for (const l of LIBRERIAS_DISPONIBLES) expect(existsSync(`src/nucleo/include/${l}`), l).toBe(true);
  });
});
