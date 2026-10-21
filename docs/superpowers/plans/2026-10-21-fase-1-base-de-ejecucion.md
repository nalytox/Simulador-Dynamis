# Fase 1 — Base de ejecución: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compilar un proyecto Arduino de varios archivos a WebAssembly con Clang y ejecutarlo en Node contra un núcleo Arduino simulado con tiempo virtual, de modo que un sketch que mueve los motores desplace al robot.

**Architecture:**
- **`src/compilador`:** prepara el proyecto como el Arduino IDE (une los `.ino`, agrega `#line` y genera prototipos) y llama a `@yowasp/clang`.
- **`src/nucleo`:** el Arduino core del ESP32 simulado en C++, precompilado a `generado/nucleo.a`.
- **`src/simulacion`:** instancia el `.wasm`, implementa sus imports `dynamis.*` (reloj virtual, pines, Serial) y avanza la física con el modelo de dinámica del profesor (`src/modelos/dinamica.js`).
- Sin UI: todo se prueba en Node con Vitest.

**Tech Stack:** Node 22, TypeScript (strict), Vitest, `@yowasp/clang@22.0.0-git20542-10` (versión probada).

**Spec:** `docs/superpowers/specs/2026-10-17-simulador-dynamis-design.md`. Esta fase cubre §5 (proyecto y preprocesado), §6 (tiempo virtual), §7 (solo la parte Arduino/ESP32 core, sin librerías de sensores ni `String`), §8 (configuración del robot) y §9 (contrato de `dinamica.js` y la interfaz `Mundo`).

**Fases siguientes (cada una con su propio plan, escrito al terminar la anterior):**
- 2: pista, mundo y juez virtual;
- 3: librerías de sensores y `String`;
- 4: UI *Programar*, worker y errores amigables;
- 5: UI *Construir pista* y ventana "Mi robot";
- 6: "Ajustar parámetros";
- 7: ejemplos, ayuda, PWA y despliegue.

**Mediciones previas (spike del 2026-10-21):**
- La primera llamada a Clang en un proceso tarda ~7 s, porque carga LLVM.
- Compilar y enlazar un sketch después de eso: ~200 ms.
- El `.wasm` resultante importa `dynamis.*` y `wasi_snapshot_preview1.{fd_write, fd_close, fd_seek}`, y exporta `memory`, `_initialize`, `dyn_setup` y `dyn_loop`.
- Clang reporta los errores como `archivo:línea:columna: error: mensaje` en stderr y lanza `Exit` (código 1).

## Global Constraints

- **Español:** nombres de archivos, tipos, funciones y mensajes van en español. Los mensajes para estudiantes van tuteando y sin jerga.
- **Opciones de compilación** (en `src/compilador/opciones.json`):
  - C++: `--target=wasm32-wasip1 -O1 -fno-exceptions -std=gnu++17`
  - C: `--target=wasm32-wasip1 -O1 -std=gnu11`
  - Enlace: `--target=wasm32-wasip1 -mexec-model=reactor -Wl,--stack-first -Wl,-z,stack-size=8192` (8 KB es la pila del `loopTask` del ESP32).
- **API del ESP32 Arduino core 3.x:**
  - constantes `INPUT 0x01`, `OUTPUT 0x03`, `INPUT_PULLUP 0x05`, `INPUT_PULLDOWN 0x09`;
  - `analogRead` de 12 bits;
  - `analogWrite` de 8 bits por defecto, con `analogWriteResolution(pin, bits)`;
  - `ledcAttach(pin, freq, res)` y `ledcWrite(pin, duty)`.
- **Reloj virtual** en µs (`number`). La física avanza a paso fijo, `dtFisicaUs = 1000` por defecto.
- **Costos** (spec §6): ver la tabla `COSTOS_US` en la Tarea 6. El Serial solo cuesta tiempo cuando se llena el búfer de 128 bytes, a 10 bits por carácter.
- **Marcos y unidades:**
  - mundo: `x` derecha, `y` arriba, `z` arriba, `yaw` antihorario desde +x;
  - robot: `x` adelante, `y` izquierda (REP-103);
  - unidades: mm, s, rad.
- **Modelos del profesor:** son JavaScript en `src/modelos/`; cada placeholder lleva `TODO(profe)`.
- **Determinismo:** toda aleatoriedad sale de un generador con semilla.
- **Contrato del wasm:** los imports van en el módulo `dynamis`, y los exports son `dyn_setup`, `dyn_loop`, `_initialize` y `memory`.

## Review Focus

1. **Fin de línea de Windows (`\r\n`), BOM, y tildes o ñ en comentarios y cadenas.** Los números de línea de los errores deben coincidir con el archivo, y `Serial.print("¡Señal!")` debe verse bien aunque los bytes lleguen en trozos. Pruebas en las Tareas 2 y 7.
2. **Sketches válidos que confunden al generador de prototipos:** llaves dentro de cadenas, caracteres o comentarios; argumentos por defecto; firmas en varias líneas; `template`; métodos dentro de `class`; `Clase::metodo`. El sketch debe compilar igual que en el Arduino IDE. Prueba en la Tarea 2.
3. **Proyectos poco comunes:** sin `.ino`, con un `.ino` que no se llama como la carpeta, con archivos en `src/` o con archivos `.c`. Deben compilar o dar un diagnóstico claro. Pruebas en las Tareas 1, 2 y 3.
4. **`loop()` vacío y `setup()` que nunca termina:** el tiempo igual avanza y la ejecución se corta en el límite. Prueba en la Tarea 7.
5. **Pines mal usados:**
   - PWM o `digitalWrite` sin `pinMode`;
   - escribir en pines de solo entrada (34–39) o en pines que no existen;
   - `analogWrite(pin, 300)` con 8 bits.

   El valor se recorta o se ignora, queda un aviso y nada se rompe. Prueba en la Tarea 6.

---

### Task 1: Andamiaje y modelo de proyecto

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`
- Create: `src/proyecto/proyecto.ts`
- Test: `tests/unidad/proyecto.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Proyecto { nombre: string; archivos: Record<string, string> } // rutas relativas con '/': 'seguidor.ino', 'src/util.cpp'
  export type TipoArchivo = 'ino' | 'cpp' | 'c' | 'cabecera' | 'otro';
  export function tipoDeArchivo(ruta: string): TipoArchivo; // .ino; .cpp/.cc/.cxx; .c; .h/.hpp; sin distinguir mayúsculas
  export function archivoPrincipal(p: Proyecto): string | null; // `${nombre}.ino` en la raíz; si no existe, el primer .ino de la raíz (orden alfabético); si no hay ninguno, null
  export function ordenarArchivos(p: Proyecto): string[]; // principal primero, luego el resto con localeCompare('es')
  ```

- [ ] **Step 1: Crear el andamiaje.**
  - `npm init -y`. Luego `npm install @yowasp/clang@22.0.0-git20542-10` y `npm install -D typescript vitest @types/node`.
  - `package.json`: `"type": "module"` y los scripts `"test": "vitest run"` y `"typecheck": "tsc --noEmit"`.
  - `tsconfig.json`: `strict`, `target ES2022`, `module ESNext`, `moduleResolution Bundler`, `resolveJsonModule`, `allowJs: true`, `checkJs: false`, `noEmit`, `types: ["node"]`, `include: ["src", "tests", "scripts"]`.
  - `vitest.config.ts`: `include: ['tests/unidad/**/*.test.ts', 'tests/integracion/**/*.test.ts']`.
  - `.gitignore`: `node_modules/`, `generado/`, `dist/`, `coverage/`.

- [ ] **Step 2: Escribir la prueba que falla** (`tests/unidad/proyecto.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { archivoPrincipal, ordenarArchivos, tipoDeArchivo, type Proyecto } from '../../src/proyecto/proyecto';

const p: Proyecto = { nombre: 'seguidor', archivos: { 'pines.h': '', 'seguidor.ino': '', 'motores.ino': '', 'src/util.cpp': '', 'filtro.c': '' } };

describe('proyecto', () => {
  it('elige el .ino con el nombre de la carpeta', () => expect(archivoPrincipal(p)).toBe('seguidor.ino'));
  it('si no hay uno con ese nombre, usa el primero en orden alfabético', () =>
    expect(archivoPrincipal({ nombre: 'x', archivos: { 'b.ino': '', 'a.ino': '', 'src/c.ino': '' } })).toBe('a.ino'));
  it('sin .ino devuelve null', () => expect(archivoPrincipal({ nombre: 'x', archivos: { 'a.h': '' } })).toBeNull());
  it('ordena con el principal primero', () =>
    expect(ordenarArchivos(p)).toEqual(['seguidor.ino', 'filtro.c', 'motores.ino', 'pines.h', 'src/util.cpp']));
  it('clasifica por extensión', () => {
    expect(tipoDeArchivo('a.INO')).toBe('ino');
    expect(tipoDeArchivo('src/x.hpp')).toBe('cabecera');
    expect(tipoDeArchivo('x.c')).toBe('c');
    expect(tipoDeArchivo('x.cc')).toBe('cpp');
    expect(tipoDeArchivo('notas.txt')).toBe('otro');
  });
});
```

- [ ] **Step 3: Verificar que falla.** Run: `npx vitest run tests/unidad/proyecto.test.ts`. Expected: FAIL (no se resuelve `src/proyecto/proyecto`).
- [ ] **Step 4: Implementar `src/proyecto/proyecto.ts`** con las firmas de arriba. Solo los `.ino` de la raíz (sin `/`) cuentan para el principal.
- [ ] **Step 5: Verificar que pasa** (el mismo comando: PASS) y que `npx tsc --noEmit` no da errores.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "Andamiaje del proyecto y modelo de proyecto multiarchivo"`

---

### Task 2: Preprocesador Arduino (unir .ino, #line y prototipos)

**Files:**
- Create: `src/compilador/prototipos.ts`, `src/compilador/preprocesador.ts`
- Test: `tests/unidad/prototipos.test.ts`, `tests/unidad/preprocesador.test.ts`

**Interfaces:**
- Consumes: `Proyecto`, `tipoDeArchivo`, `ordenarArchivos` (Task 1).
- Produces:
  ```ts
  // prototipos.ts
  export interface DefinicionFuncion { prototipo: string; linea: number } // linea: 0-based, donde empieza la firma
  export function buscarDefiniciones(codigo: string): DefinicionFuncion[];
  // preprocesador.ts
  export interface UnidadCompilacion { ruta: string; lenguaje: 'c++' | 'c'; codigo: string }
  export class ErrorProyecto extends Error {}
  export function normalizarTexto(texto: string): string; // quita BOM y convierte \r\n y \r en \n
  export function prepararUnidades(p: Proyecto): UnidadCompilacion[];
  ```

**Reglas de `prepararUnidades`:**
- **Unidad del sketch** (`ruta = `${p.nombre}.ino.cpp``):
  - La línea 1 es `#include <Arduino.h>`.
  - Después vienen los `.ino` de la raíz, en el orden de `ordenarArchivos`, cada uno precedido por `#line 1 "<ruta>"`.
  - Los prototipos de **todas** las funciones de los `.ino` van como un bloque justo antes de la línea donde empieza la primera definición, en el primer archivo que tenga alguna. Después del bloque va `#line <linea+1> "<archivo>"`, para que la numeración siga siendo la del archivo original.
- **Archivos `.cpp` y `.c`** (también en subcarpetas): cada uno es su propia unidad, con la misma ruta y el texto normalizado. Los `.cpp` usan lenguaje `'c++'` y los `.c`, `'c'`.
- **Cabeceras:** no son unidades.
- **Sin ningún `.ino`:** se lanza `ErrorProyecto('Tu proyecto no tiene ningún archivo .ino. Crea uno con el mismo nombre de la carpeta.')`.

**Algoritmo de `buscarDefiniciones`** (no lo determina la firma):
1. Recorre el texto con un pequeño autómata (normal, cadena, carácter, comentario de línea, comentario de bloque) y produce un texto "limpio": comentarios, literales y líneas de preprocesador (incluidas las continuadas con `\`) se reemplazan por espacios, conservando los saltos de línea y las posiciones.
2. Sobre ese texto, a profundidad de llaves 0: el inicio de cada sentencia queda después de `;`, `}` o del final de una línea de preprocesador.
3. Al encontrar `{` a profundidad 0, la sentencia es una definición de función si:
   - termina en `)` (opcionalmente seguido de `const`);
   - contiene `(`;
   - no tiene `=` antes del primer `(`;
   - no contiene `::` antes del `(`;
   - no empieza con `template`, `struct`, `class`, `union`, `enum`, `namespace` ni `extern`.
4. El prototipo se arma con el texto **original** desde el inicio de la sentencia hasta el `)` que cierra los parámetros:
   - se quitan los argumentos por defecto (`= valor` dentro de los parámetros, a profundidad 0 de paréntesis);
   - los espacios en blanco se colapsan a uno;
   - se agrega `;`.

- [ ] **Step 1: Escribir las pruebas que fallan** (`tests/unidad/prototipos.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { buscarDefiniciones } from '../../src/compilador/prototipos';
const protos = (c: string) => buscarDefiniciones(c).map(d => d.prototipo);

describe('buscarDefiniciones', () => {
  it('encuentra funciones de nivel superior con su línea', () =>
    expect(buscarDefiniciones('int a = 3;\nvoid setup() {\n}\nfloat calcular(int x, float y) { return x * y; }\n')).toEqual([
      { prototipo: 'void setup();', linea: 1 }, { prototipo: 'float calcular(int x, float y);', linea: 3 }]));
  it('quita argumentos por defecto y une firmas en varias líneas', () =>
    expect(protos('void mover(int izq,\n           int der = 100) {\n}\n')).toEqual(['void mover(int izq, int der);']));
  it('ignora llaves en cadenas, caracteres y comentarios', () =>
    expect(protos('const char* s = "{ no }";\nchar k = \'{\';\n// void falsa() {\n/* int otra() { */\nvoid real() { if (1) { } }\n')).toEqual(['void real();']));
  it('ignora templates, métodos de clase y Clase::metodo; conserva static inline', () =>
    expect(protos('template <typename T> T doble(T x) { return 2 * x; }\nclass Pid { public: float paso(float e) { return e; } };\nfloat Pid2::paso(float e) { return e; }\nstatic inline int uno() { return 1; }\n')).toEqual(['static inline int uno();']));
  it('no confunde objetos, constructores con argumentos ni lambdas', () =>
    expect(protos('VL53L0X sensor;\nServo s(3);\nauto f = []() { return 1; };\n#define MAX(a, b) { a }\n')).toEqual([]));
  it('acepta tipos de retorno compuestos y punteros', () =>
    expect(protos('unsigned long tiempo() { return 0; }\nconst char* nombre(void) { return ""; }\n')).toEqual(['unsigned long tiempo();', 'const char* nombre(void);']));
});
```

`tests/unidad/preprocesador.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { prepararUnidades, ErrorProyecto } from '../../src/compilador/preprocesador';
import type { Proyecto } from '../../src/proyecto/proyecto';

const p: Proyecto = { nombre: 'robot', archivos: {
  'robot.ino': '﻿#include "pines.h"\r\nvoid setup() { avanzar(); }\r\nvoid loop() {}\r\n',
  'motores.ino': '// ¡Motores! ñandú\nvoid avanzar() { analogWrite(PWM_IZQ, 200); }\n',
  'pines.h': '#define PWM_IZQ 18\n', 'src/filtro.cpp': 'int f() { return 1; }\n', 'util.c': 'int g(void) { return 2; }\n' } };

describe('prepararUnidades', () => {
  it('crea una unidad para el sketch, otra por cada .cpp y otra por cada .c', () =>
    expect(prepararUnidades(p).map(u => [u.ruta, u.lenguaje])).toEqual([['robot.ino.cpp', 'c++'], ['src/filtro.cpp', 'c++'], ['util.c', 'c']]));
  it('incluye Arduino.h, inserta prototipos y conserva la numeración', () => {
    const [u] = prepararUnidades(p);
    const lineas = u.codigo.split('\n');
    expect(lineas[0]).toBe('#include <Arduino.h>');
    expect(lineas[1]).toBe('#line 1 "robot.ino"');
    expect(u.codigo).toContain('void avanzar();');
    expect(u.codigo).not.toMatch(/[\r﻿]/);
    const i = lineas.findIndex(l => l.startsWith('void setup()'));
    expect(lineas[i - 1]).toBe('#line 2 "robot.ino"');
    expect(u.codigo.indexOf('#line 1 "motores.ino"')).toBeGreaterThan(u.codigo.indexOf('void loop()'));
    expect(u.codigo).toContain('// ¡Motores! ñandú');
  });
  it('sin .ino lanza un error claro', () => {
    expect(() => prepararUnidades({ nombre: 'x', archivos: { 'a.h': '' } })).toThrow(ErrorProyecto);
    expect(() => prepararUnidades({ nombre: 'x', archivos: { 'a.h': '' } })).toThrow('Tu proyecto no tiene ningún archivo .ino');
  });
});
```

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run tests/unidad/prototipos.test.ts tests/unidad/preprocesador.test.ts`. Expected: FAIL (no se resuelven los módulos).
- [ ] **Step 3: Implementar `buscarDefiniciones`** en `src/compilador/prototipos.ts` siguiendo el algoritmo de arriba.
- [ ] **Step 4: Implementar `normalizarTexto` y `prepararUnidades`** en `src/compilador/preprocesador.ts` según las reglas.
- [ ] **Step 5: Verificar que pasan** (mismo comando: PASS).
- [ ] **Step 6: Commit.** `git commit -m "Preprocesador Arduino: unión de .ino, #line y prototipos"`

---

### Task 3: Compilador (diagnósticos y `compilar`)

**Files:**
- Create: `src/compilador/opciones.json`, `src/compilador/diagnosticos.ts`, `src/compilador/arbol.ts`, `src/compilador/compilar.ts`
- Create: `tests/ayuda/compilar-prueba.ts`
- Test: `tests/unidad/diagnosticos.test.ts`, `tests/integracion/compilar.test.ts`

**Interfaces:**
- Consumes: `Proyecto` (Task 1), `prepararUnidades`, `ErrorProyecto` (Task 2).
- Produces:
  ```ts
  // opciones.json
  { "cpp": [...], "c": [...], "enlace": [...] } // valores exactos de Global Constraints
  // diagnosticos.ts
  export type Severidad = 'error' | 'advertencia' | 'nota';
  export interface Diagnostico { archivo: string | null; linea: number | null; columna: number | null; severidad: Severidad; mensaje: string; detalle: string }
  export function parsearDiagnosticos(salida: string): Diagnostico[];
  // arbol.ts — el sistema de archivos virtual de @yowasp/clang es un árbol anidado
  export type Arbol = { [nombre: string]: Arbol | string | Uint8Array };
  export function aArbol(planos: Record<string, string | Uint8Array>): Arbol;
  export function leerDeArbol(arbol: Arbol, ruta: string): string | Uint8Array | undefined;
  // compilar.ts
  export interface ArchivosNucleo { cabeceras: Record<string, string>; biblioteca: Uint8Array | null } // cabeceras: ruta relativa a include/
  export type ResultadoCompilacion =
    | { ok: true; wasm: Uint8Array; diagnosticos: Diagnostico[] }
    | { ok: false; diagnosticos: Diagnostico[] };
  export async function compilar(p: Proyecto, nucleo: ArchivosNucleo): Promise<ResultadoCompilacion>;
  // tests/ayuda/compilar-prueba.ts
  export async function compilarParaPrueba(archivos: Record<string, string>, nucleo: ArchivosNucleo, nombre?: string): Promise<WebAssembly.Module>; // lanza un Error con los diagnósticos formateados si falla
  ```

**`parsearDiagnosticos`:**
- **Encabezados:** las líneas `archivo:L:C: (error|fatal error|warning|note): mensaje` abren un diagnóstico. `fatal error` cuenta como `error`, y `warning`, como `advertencia`.
- **`detalle`:** las líneas siguientes, hasta el próximo encabezado o hasta la línea `N error(s)/warning(s) generated.`, unidas con `\n` y sin salto final.
- **Enlazador:** `wasm-ld: error: <obj>: mensaje` se convierte en `{ archivo: null, linea: null, columna: null, severidad: 'error', mensaje }`, donde `mensaje` es lo que va después del objeto.
- Se descarta la línea `clang…: error: linker command failed…`.

**`compilar`:**
- **Sistema de archivos virtual:** los archivos del proyecto en sus rutas, las unidades de `prepararUnidades`, `nucleo/include/<cabecera>` y `nucleo/nucleo.a` (si `biblioteca`).
- **Compilación:** cada unidad se compila por separado con `runClang`:
  - `clang++` y `opciones.cpp` para `'c++'`, o `clang` y `opciones.c` para `'c'`;
  - más `-Inucleo/include -c <ruta> -o <ruta>.o`;
  - `stderr` se captura con la opción `stderr`;
  - si Clang lanza `Exit`, se guardan sus diagnósticos y se sigue con las demás unidades.
- **Enlace:** si ninguna unidad falló, `clang++` con `opciones.enlace`, los `.o`, `nucleo/nucleo.a` y `-o programa.wasm`.
- **`ErrorProyecto`** se convierte en `{ ok: false, diagnosticos: [{ archivo: null, linea: null, columna: null, severidad: 'error', mensaje, detalle: '' }] }`.
- **Si hubo éxito**, `diagnosticos` lleva las advertencias.

- [ ] **Step 1: Escribir las pruebas que fallan.** `tests/unidad/diagnosticos.test.ts`, con la salida real que dio Clang en el spike:

```ts
import { it, expect } from 'vitest';
import { parsearDiagnosticos } from '../../src/compilador/diagnosticos';

it('lee errores de Clang con su detalle', () => {
  const salida = "seguidor.ino:1:24: error: expected ';' at end of declaration\n    1 | void setup(){ int x = 3\n      |                        ^\n      |                        ;\npines.h:1:9: error: expected expression\n    1 | int a = ;\n      |         ^\n2 errors generated.\n";
  expect(parsearDiagnosticos(salida)).toEqual([
    { archivo: 'seguidor.ino', linea: 1, columna: 24, severidad: 'error', mensaje: "expected ';' at end of declaration", detalle: '    1 | void setup(){ int x = 3\n      |                        ^\n      |                        ;' },
    { archivo: 'pines.h', linea: 1, columna: 9, severidad: 'error', mensaje: 'expected expression', detalle: '    1 | int a = ;\n      |         ^' }]);
});
it('lee advertencias', () =>
  expect(parsearDiagnosticos('a.ino:3:1: warning: non-void function does not return a value [-Wreturn-type]\n')[0]).toMatchObject({ archivo: 'a.ino', linea: 3, severidad: 'advertencia' }));
it('lee errores del enlazador y descarta el resumen', () =>
  expect(parsearDiagnosticos('wasm-ld: error: robot.ino.cpp.o: undefined symbol: loop()\nclang++: error: linker command failed with exit code 1 (use -v to see invocation)\n')).toEqual([
    { archivo: null, linea: null, columna: null, severidad: 'error', mensaje: 'undefined symbol: loop()', detalle: '' }]));
```

`tests/integracion/compilar.test.ts` usa un núcleo falso. El "pegamento" de exports va en un `.cpp` del propio proyecto de prueba:

```ts
import { describe, it, expect } from 'vitest';
import { compilar, type ArchivosNucleo } from '../../src/compilador/compilar';

const NUCLEO_FALSO: ArchivosNucleo = { cabeceras: { 'Arduino.h': '#pragma once\n#define LED 2\n' }, biblioteca: null };
const PEGAMENTO = 'void setup(); void loop();\nextern "C" __attribute__((export_name("dyn_setup"))) void dyn_setup() { setup(); }\nextern "C" __attribute__((export_name("dyn_loop"))) void dyn_loop() { loop(); }\n';

describe('compilar', { timeout: 120_000 }, () => {
  it('compila un proyecto con .ino, .h, src/*.cpp y .c', async () => {
    const r = await compilar({ nombre: 'robot', archivos: {
      'robot.ino': '#include "pines.h"\nint valor = LED + PIN;\nvoid setup() { avanzar(); }\nvoid loop() {}\n',
      'motores.ino': 'void avanzar() { valor++; }\n', 'pines.h': '#define PIN 18\n',
      'src/extra.cpp': 'int extra() { return 1; }\n', 'util.c': 'int g(void) { return 2; }\n', 'pegamento.cpp': PEGAMENTO } }, NUCLEO_FALSO);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const nombres = WebAssembly.Module.exports(await WebAssembly.compile(r.wasm)).map(e => e.name);
    expect(nombres).toEqual(expect.arrayContaining(['memory', '_initialize', 'dyn_setup', 'dyn_loop']));
  });
  it('informa el archivo y la línea originales', async () => {
    const r = await compilar({ nombre: 'robot', archivos: { 'robot.ino': 'void setup() {}\nvoid loop() {}\n', 'motores.ino': 'void avanzar() {\n  int x = 3\n}\n' } }, NUCLEO_FALSO);
    expect(r.ok).toBe(false);
    expect(r.diagnosticos[0]).toMatchObject({ archivo: 'motores.ino', linea: 2, severidad: 'error' });
  });
  it('informa funciones que faltan al enlazar', async () => {
    const r = await compilar({ nombre: 'robot', archivos: { 'robot.ino': 'void avanzar();\nvoid setup() { avanzar(); }\nvoid loop() {}\n', 'pegamento.cpp': PEGAMENTO } }, NUCLEO_FALSO);
    expect(r).toMatchObject({ ok: false, diagnosticos: [{ archivo: null, severidad: 'error', mensaje: expect.stringContaining('avanzar') }] });
  });
  it('sin .ino responde con un diagnóstico claro', async () => {
    const r = await compilar({ nombre: 'x', archivos: { 'a.h': '' } }, NUCLEO_FALSO);
    expect(r).toMatchObject({ ok: false, diagnosticos: [{ mensaje: expect.stringContaining('no tiene ningún archivo .ino') }] });
  });
});
```

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run tests/unidad/diagnosticos.test.ts tests/integracion/compilar.test.ts`. Expected: FAIL (no se resuelven los módulos).
- [ ] **Step 3: Implementar** `opciones.json`, `diagnosticos.ts`, `arbol.ts`, `compilar.ts` y `tests/ayuda/compilar-prueba.ts`, con las firmas y reglas de arriba.
- [ ] **Step 4: Verificar que pasan** (mismo comando: PASS; la primera prueba de integración tarda unos 7 s en cargar LLVM).
- [ ] **Step 5: Commit.** `git commit -m "Compilador: diagnósticos de Clang y compilación multiarchivo a wasm"`

---

### Task 4: Contrato núcleo ↔ simulador (imports `dynamis`, WASI mínimo y errores de ejecución)

**Files:**
- Create: `src/nucleo/include/dynamis_host.h`, `src/simulacion/puente.ts`, `src/simulacion/errores.ts`
- Create: `tests/ayuda/anfitrion-falso.ts`
- Test: `tests/integracion/puente.test.ts`

**Interfaces:**
- Consumes: `compilarParaPrueba`, `ArchivosNucleo` (Task 3).
- Produces: `dynamis_host.h` declara, con `#define DYN_IMPORTAR(n) __attribute__((import_module("dynamis"), import_name(n)))` y dentro de `extern "C"` cuando es C++, las funciones de esta tabla. Cada una corresponde a un método de `Anfitrion`:

| Import wasm | Declaración C | Método de `Anfitrion` |
|---|---|---|
| `millis` | `uint32_t dyn_millis(void)` | `millis(): number` |
| `micros` | `uint32_t dyn_micros(void)` | `micros(): number` |
| `delay` | `void dyn_delay(uint32_t ms)` | `delay(ms: number): void` |
| `delay_us` | `void dyn_delay_us(uint32_t us)` | `delayUs(us: number): void` |
| `yield` | `void dyn_yield(void)` | `rendir(): void` |
| `pin_mode` | `void dyn_pin_mode(uint8_t pin, uint8_t modo)` | `pinMode(pin, modo): void` |
| `digital_write` | `void dyn_digital_write(uint8_t pin, uint8_t valor)` | `digitalWrite(pin, valor): void` |
| `digital_read` | `int dyn_digital_read(uint8_t pin)` | `digitalRead(pin): number` |
| `analog_read` | `uint16_t dyn_analog_read(uint8_t pin)` | `analogRead(pin): number` |
| `analog_read_resolution` | `void dyn_analog_read_resolution(uint8_t bits)` | `analogReadResolution(bits): void` |
| `analog_write` | `void dyn_analog_write(uint8_t pin, int valor)` | `analogWrite(pin, valor): void` |
| `analog_write_resolution` | `void dyn_analog_write_resolution(uint8_t pin, uint8_t bits)` | `analogWriteResolution(pin, bits): void` (pin 255 = todos) |
| `ledc_attach` | `int dyn_ledc_attach(uint8_t pin, uint32_t freq, uint8_t bits)` | `ledcAttach(pin, freq, bits): boolean` |
| `ledc_write` | `int dyn_ledc_write(uint8_t pin, uint32_t duty)` | `ledcWrite(pin, duty): boolean` |
| `ledc_detach` | `int dyn_ledc_detach(uint8_t pin)` | `ledcDetach(pin): boolean` |
| `serial_begin` | `void dyn_serial_begin(uint32_t baudios)` | `serialBegin(baudios): void` |
| `serial_write` | `void dyn_serial_write(const uint8_t* datos, size_t largo)` | `serialWrite(bytes: Uint8Array): void` |
| `azar_u32` | `uint32_t dyn_azar_u32(void)` | `azarU32(): number` |

  ```ts
  // puente.ts
  export interface Anfitrion { /* los métodos de la tabla, más: */ salidaEstandar(bytes: Uint8Array): void; tiempoNs(): bigint }
  export class SalidaPrograma extends Error { constructor(public codigo: number) }
  export function crearImports(modulo: WebAssembly.Module, anfitrion: Anfitrion, memoria: () => WebAssembly.Memory): WebAssembly.Imports;
  // errores.ts
  export type TipoErrorEjecucion = 'division-por-cero' | 'memoria' | 'pila' | 'sin-return' | 'salida' | 'desconocido';
  export interface ErrorEjecucion { tipo: TipoErrorEjecucion; mensaje: string; tecnico: string }
  export function clasificarErrorEjecucion(e: unknown): ErrorEjecucion;
  // tests/ayuda/anfitrion-falso.ts
  export function crearAnfitrionFalso(): { anfitrion: Anfitrion; llamadas: unknown[][]; texto(): string };
  // llamadas: [nombreMetodo, ...args]; serialWrite y salidaEstandar se registran como texto UTF-8
  ```

**Reglas de `crearImports`:**
- **Argumentos `uint32_t`** (ms, us, freq, duty, baudios): se convierten con `>>> 0`. Los booleanos se devuelven como 1 o 0.
- **`serial_write`:** se copian los bytes (`.slice()`) desde `memoria().buffer`.
- **Funciones WASI:** para cada import de `wasi_snapshot_preview1` que aparece en `WebAssembly.Module.imports(modulo)`:
  - `fd_write` (fd 1 o 2) junta los iovecs, llama a `salidaEstandar`, escribe `nwritten` y devuelve 0;
  - `clock_time_get` escribe `tiempoNs()` como u64;
  - `random_get` llena el búfer con `azarU32()`;
  - `proc_exit(c)` lanza `new SalidaPrograma(c)`;
  - `sched_yield` devuelve 0;
  - cualquier otra devuelve 52 (`ENOSYS`).
- **Imports desconocidos:** un import `dynamis.X` que no está en la tabla lanza `Error('El núcleo pide una función desconocida: X')`.

**`clasificarErrorEjecucion`** (`tecnico` = mensaje original):

| Error | `tipo` | Mensaje |
|---|---|---|
| `RuntimeError` con "divide by zero" | `division-por-cero` | `Tu programa dividió por cero. Revisa las divisiones (/) y los restos (%).` |
| … con "out of bounds" | `memoria` | `Tu programa usó memoria que no le pertenece: un arreglo fuera de sus límites o una función que se llama a sí misma sin parar.` |
| … con "unreachable" | `sin-return` | `Una función que debía devolver un valor terminó sin return.` |
| `RangeError` (pila de JS) | `pila` | `Una función se llama a sí misma sin parar.` |
| `SalidaPrograma` | `salida` | `Tu programa terminó (se llamó a exit).` |
| otro | `desconocido` | `Tu programa se detuvo por un error inesperado.` |

- [ ] **Step 1: Escribir las pruebas que fallan** (`tests/integracion/puente.test.ts`). Usan dos ayudantes locales:
  - `correr(codigo, anfitrion)` compila `{ 'p.ino': codigo, 'pegamento.cpp': PEGAMENTO }` (el `PEGAMENTO` de la Task 3) con `compilarParaPrueba` y un núcleo de prueba `{ cabeceras: { 'Arduino.h': '#pragma once\n#include "dynamis_host.h"\n#include <stdio.h>\n#include <stdlib.h>\n', 'dynamis_host.h': <contenido real leído de src/nucleo/include/dynamis_host.h> }, biblioteca: null }`. Luego instancia con `crearImports(modulo, anfitrion, () => instancia.exports.memory)` y llama `_initialize` y después `dyn_setup`.
  - `correrEsperandoError(codigo)` hace lo mismo con un anfitrión falso nuevo, y devuelve el error que lanza `dyn_setup` (falla la prueba si no lanza).

```ts
it('traduce cada import al anfitrión con valores sin signo y textos UTF-8', async () => {
  const { anfitrion, llamadas, texto } = crearAnfitrionFalso();
  await correr('void setup() { dyn_pin_mode(18, 3); dyn_digital_write(18, 1); dyn_delay(3000000000u); dyn_serial_write((const uint8_t*)"\\xC2\\xA1ol\\xC3\\xA1", 6); dyn_ledc_attach(21, 5000, 10); }\nvoid loop() {}', anfitrion);
  expect(llamadas.filter(l => l[0] !== 'serialWrite')).toEqual([['pinMode', 18, 3], ['digitalWrite', 18, 1], ['delay', 3000000000], ['ledcAttach', 21, 5000, 10]]);
  expect(texto()).toBe('¡olá');
});
it('printf llega por la salida estándar', async () => { /* setup: printf("x=%d\\n", 5); fflush(stdout); → texto() === 'x=5\n' */ });
it.each([
  ['division-por-cero', 'void setup() { volatile int z = 0; volatile int r = 10 / z; }'],
  ['memoria', 'void setup() { *(volatile int*)0x7ffffff0 = 1; }'],
  ['memoria', 'int f(int n) { volatile char a[512]; a[0] = n; return f(n + 1) + a[0]; }\nvoid setup() { f(0); }'],
  ['sin-return', 'int f(int x) { if (x > 0) return 1; }\nvoid setup() { volatile int r = f(0); }'],
  ['salida', 'void setup() { exit(3); }'],
])('clasifica el error de ejecución %s', async (tipo, codigo) => {
  const err = await correrEsperandoError(codigo + '\nvoid loop() {}');
  expect(clasificarErrorEjecucion(err).tipo).toBe(tipo);
});
it('rechaza imports desconocidos', async () => { /* .ino que declara DYN_IMPORTAR("inexistente") void x(void); y la llama → crearImports lanza 'El núcleo pide una función desconocida: inexistente' */ });
```

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run tests/integracion/puente.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementar** `dynamis_host.h`, `puente.ts`, `errores.ts` y `tests/ayuda/anfitrion-falso.ts`.
- [ ] **Step 4: Verificar que pasan** (mismo comando: PASS).
- [ ] **Step 5: Commit.** `git commit -m "Contrato núcleo-simulador: imports dynamis, WASI mínimo y errores de ejecución"`

---

### Task 5: Núcleo Arduino del ESP32 (C++) y su construcción

**Files:**
- Create:
  - `src/nucleo/include/Arduino.h`, `src/nucleo/include/Print.h`, `src/nucleo/include/HardwareSerial.h`
  - `src/nucleo/src/principal.cpp`, `src/nucleo/src/wiring.cpp`, `src/nucleo/src/Print.cpp`, `src/nucleo/src/HardwareSerial.cpp`
  - `scripts/construir-nucleo.mjs`, `src/compilador/nucleo-node.ts`, `tests/configurar-nucleo.ts`
- Modify: `vitest.config.ts` (agregar `globalSetup: ['tests/configurar-nucleo.ts']`), `package.json` (script `"nucleo": "node scripts/construir-nucleo.mjs"`)
- Test: `tests/integracion/nucleo.test.ts`

**Interfaces:**
- Consumes: `dynamis_host.h`, `crearImports`, `crearAnfitrionFalso` (Task 4); `compilarParaPrueba`, `ArchivosNucleo`, `opciones.json` (Task 3).
- Produces:
  ```ts
  export async function cargarNucleoDesdeDisco(raiz?: string): Promise<ArchivosNucleo>; // src/nucleo/include/** + generado/nucleo.a
  ```
  ```js
  // scripts/construir-nucleo.mjs
  export async function construirNucleo({ raiz = process.cwd(), forzar = false } = {}); // → generado/nucleo.a
  ```
- **Exports del wasm** (en `principal.cpp`): `dyn_setup` y `dyn_loop`, que llaman a `setup()` y `loop()` del estudiante.

**API de `Arduino.h`** (usable desde C; las partes de C++ van con `#ifdef __cplusplus`):
- **Incluye:** `<stdint.h>`, `<stdbool.h>`, `<stddef.h>`, `<stdlib.h>`, `<string.h>`, `<math.h>` y `"dynamis_host.h"`. En C++ también `<algorithm>`, `"Print.h"` y `"HardwareSerial.h"`.
- **Constantes:**
  - `HIGH 1`, `LOW 0`, `INPUT 0x01`, `OUTPUT 0x03`, `INPUT_PULLUP 0x05`, `INPUT_PULLDOWN 0x09`;
  - `DEC 10`, `HEX 16`, `OCT 8`, `BIN 2`;
  - `PI`, `HALF_PI`, `TWO_PI`, `DEG_TO_RAD`, `RAD_TO_DEG`;
  - los tipos `byte`, `boolean`, `word`.
- **Funciones en línea sobre `dyn_*`:** `millis`, `micros`, `delay`, `delayMicroseconds`, `yield`, `pinMode`, `digitalWrite`, `digitalRead`, `analogRead`, `analogReadResolution`, `analogWrite`, `ledcAttach`, `ledcWrite`, `ledcDetach`.
- **`analogWriteResolution`** con dos sobrecargas en C++: `(pin, bits)` y `(bits)`; esta última aplica a todos, con pin 255.
- **Utilidades:**
  - `using std::min; using std::max;` (como el core 3.x del ESP32: `min(int, long)` no compila, igual que en el robot);
  - `constrain`, `map(long, long, long, long, long)`, `sq`, `radians`, `degrees`, `bitRead/bitSet/bitClear/bitWrite/bit`, `lowByte/highByte`;
  - `random(long)`, `random(long, long)`, `randomSeed(unsigned long)`.
- **Semántica de `random`** (en `wiring.cpp`):
  - antes de `randomSeed(s≠0)`: `dyn_azar_u32() % max`;
  - después: `srand(s)` y `rand() % max`;
  - `random(0)` es 0;
  - `random(min, max)` es `min + random(max − min)`.
- **`Print`:**
  - `virtual size_t write(uint8_t) = 0`, `write(const uint8_t*, size_t)` y `write(const char*)`;
  - `print` y `println` para `const char*`, `char`, `unsigned char`/`int`/`unsigned`/`long`/`unsigned long`/`long long`/`unsigned long long` (con `base = DEC`) y `double` (con `digits = 2`);
  - `println()`, y `printf(const char*, ...)` con `vsnprintf`;
  - `println` agrega `"\r\n"`;
  - `double` imprime `nan`, `inf` u `ovf` (si |x| > 4294967040) como Arduino.
- **`HardwareSerial : Print`:**
  - `begin(unsigned long baudios, ...)` llama a `dyn_serial_begin`; `end()`;
  - `available()` devuelve 0, `read()` y `peek()` devuelven -1; `flush()`;
  - `operator bool()` devuelve true;
  - `write` llama a `dyn_serial_write`;
  - instancia global `Serial`.

**`construirNucleo`:**
- Compila cada `src/nucleo/src/*.cpp` con `runClang` (`clang++`, `opciones.cpp`, `-Inucleo/include -c`) y lo archiva con `runLLVM(['ar', 'rcs', 'nucleo.a', ...])` en `generado/nucleo.a`.
- No hace nada si `nucleo.a` es más nuevo que todos los archivos de `src/nucleo/**`, salvo con `forzar`.
- Se puede usar como CLI (`node scripts/construir-nucleo.mjs [--forzar]`).
- Importa las opciones con `import opciones from '../src/compilador/opciones.json' with { type: 'json' }`.
- `tests/configurar-nucleo.ts` la llama desde el `globalSetup` de Vitest.

- [ ] **Step 1: Escribir las pruebas que fallan** (`tests/integracion/nucleo.test.ts`). Usan `cargarNucleoDesdeDisco()`, compilan con `compilarParaPrueba` y corren `_initialize` y luego `dyn_setup` con el anfitrión falso:

```ts
it('solo importa dynamis.* y funciones WASI conocidas, y exporta lo esperado', async () => {
  const m = await compilarParaPrueba({ 'p.ino': 'void setup() { Serial.begin(115200); Serial.printf("%d", 1); }\nvoid loop() {}' }, await cargarNucleoDesdeDisco(), 'p');
  const wasi = ['fd_write', 'fd_close', 'fd_seek', 'proc_exit', 'environ_get', 'environ_sizes_get', 'clock_time_get', 'random_get', 'sched_yield'];
  for (const i of WebAssembly.Module.imports(m)) expect(i.module === 'dynamis' || (i.module === 'wasi_snapshot_preview1' && wasi.includes(i.name))).toBe(true);
  expect(WebAssembly.Module.exports(m).map(e => e.name)).toEqual(expect.arrayContaining(['memory', '_initialize', 'dyn_setup', 'dyn_loop']));
});
it('Serial imprime como Arduino', async () => {
  const { texto } = await correrSetup('Serial.begin(115200); Serial.println("hola"); Serial.println(3.14159); Serial.println(42); Serial.print(255, HEX); Serial.printf(" %d", 7); Serial.println(1.0 / 0.0);');
  expect(texto()).toBe('hola\r\n3.14\r\n42\r\nFF 7inf\r\n');
});
it('las funciones de pines usan los valores del ESP32', async () => {
  const { llamadas } = await correrSetup('pinMode(18, OUTPUT); digitalWrite(18, HIGH); analogWrite(19, 128); analogWriteResolution(10); ledcAttach(21, 5000, 10); ledcWrite(21, 512); pinMode(4, INPUT_PULLUP);');
  expect(llamadas).toEqual([['pinMode', 18, 3], ['digitalWrite', 18, 1], ['analogWrite', 19, 128], ['analogWriteResolution', 255, 10], ['ledcAttach', 21, 5000, 10], ['ledcWrite', 21, 512], ['pinMode', 4, 5]]);
});
it('map, constrain, min y max funcionan como en el ESP32', async () => {
  const { texto } = await correrSetup('Serial.begin(9600); Serial.println(map(512, 0, 1023, 0, 255)); Serial.println(constrain(300, 0, 255)); Serial.println(min(3, 7)); Serial.println(max(3, 7));');
  expect(texto()).toBe('127\r\n255\r\n3\r\n7\r\n');
});
it('random usa al anfitrión hasta que se llama a randomSeed', async () => {
  const { llamadas } = await correrSetup('volatile long a = random(10); randomSeed(42); volatile long b = random(10);');
  expect(llamadas.filter(l => l[0] === 'azarU32')).toHaveLength(1);
});
```

`correrSetup(cuerpo)` es una función local de la prueba. Compila `void setup() { <cuerpo> }\nvoid loop() {}` con el núcleo real, instancia con `crearImports` y el anfitrión falso (que registra también `azarU32`), llama `_initialize` y `dyn_setup`, y devuelve `{ llamadas, texto }`.

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run tests/integracion/nucleo.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementar** las cabeceras, los `.cpp` del núcleo, `construir-nucleo.mjs`, `nucleo-node.ts` y `configurar-nucleo.ts`, y ajustar `vitest.config.ts` y `package.json`.
- [ ] **Step 4: Verificar que pasan.** Run: `npm run nucleo && npx vitest run tests/integracion/nucleo.test.ts`. Expected: se crea `generado/nucleo.a` y PASS.
- [ ] **Step 5: Commit.** `git commit -m "Núcleo Arduino del ESP32 simulado y construcción de nucleo.a"`

---

### Task 6: Configuración del robot, pines y motores

**Files:**
- Create: `src/robot/config.ts`, `src/simulacion/costos.ts`, `src/simulacion/pines.ts`, `src/simulacion/motores.ts`
- Test: `tests/unidad/robot.test.ts`, `tests/unidad/pines.test.ts`, `tests/unidad/motores.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // robot/config.ts
  export interface PinesMotor { pwm: number; in1: number; in2: number; invertir?: boolean }
  export interface ConfigRobot {
    chasis: { largo: number; ancho: number; alto: number; xDelantero: number }; // xDelantero: borde delantero en el marco del robot (decisión de este plan; la spec §8 no lo fija)
    ruedas: { diametro: number; trocha: number; x: number };
    motores: { driver: 'TB6612'; izq: PinesMotor; der: PinesMotor; stby: number | null };
    qtr: { pines: number[]; emisor: number | null; x: number; separacion: number; altura: number };
    vl53l0x: { x: number; y: number; z: number; yaw: number; pitch: number };
    tcs34725: { x: number; y: number; z: number; led: number | null };
    mpu6050: { x: number; y: number; z: number; orientacion: 'z-arriba-x-adelante' };
  }
  export const ROBOT_POR_DEFECTO: ConfigRobot; // spec §8, con chasis.xDelantero = 96
  export const GPIO_ESP32: ReadonlySet<number>;        // 0–19, 21–23, 25–27, 32–39
  export const SOLO_ENTRADA_ESP32: ReadonlySet<number>; // 34–39
  export interface AvisoRobot { campo: string; mensaje: string }
  export function validarRobot(r: ConfigRobot): AvisoRobot[];
  export function huellaRobot(x: number, y: number, yaw: number, r: ConfigRobot): { x: number; y: number }[]; // esquinas del chasis en el mundo, antihorario desde la delantera izquierda
  // simulacion/costos.ts
  export const COSTOS_US = { millis: 1, micros: 1, pinMode: 1, digitalWrite: 1, digitalRead: 1, analogRead: 10, analogWrite: 2, ledcWrite: 2, llamadaLoop: 1, yield: 1 } as const;
  export const BUFER_SERIAL_BYTES = 128;
  export function usPorCaracter(baudios: number): number; // 10e6 / baudios
  // simulacion/pines.ts
  export interface AvisoPin { pin: number; mensaje: string }
  export class Pines {
    readonly avisos: AvisoPin[]; // sin repetir el mismo pin con el mismo mensaje
    pinMode(pin: number, modo: number): void;
    digitalWrite(pin: number, valor: number): void;
    digitalRead(pin: number): 0 | 1;   // salida: lo escrito; INPUT_PULLUP: 1; si no: 0
    analogWriteResolution(pin: number, bits: number): void; // pin 255 = todos; por defecto 8 bits
    analogWrite(pin: number, valor: number): void;          // recorta a [0, 2^bits − 1]; no requiere pinMode (el ESP32 conecta el LEDC solo)
    ledcAttach(pin: number, freq: number, bits: number): boolean;
    ledcWrite(pin: number, duty: number): boolean;
    ledcDetach(pin: number): boolean;
    nivel(pin: number): number;       // 0…1: ciclo PWM si el pin tiene PWM; si no, el nivel digital
  }
  // simulacion/motores.ts
  export type ModoMotor = 'avance' | 'retroceso' | 'freno' | 'libre';
  export interface EstadoMotor { duty: number; modo: ModoMotor } // duty ∈ [−1, 1]; 0 en freno o libre
  export interface Motores { izq: EstadoMotor; der: EstadoMotor }
  export function pinesAMotores(p: Pines, m: ConfigRobot['motores']): Motores;
  ```

**Reglas** (los textos de los avisos son exactos):

| Situación | Efecto | Aviso / mensaje |
|---|---|---|
| Pin fuera de `GPIO_ESP32` | Sin efecto | `El pin N no existe en el ESP32.` |
| Escribir en un pin de `SOLO_ENTRADA_ESP32` | Sin efecto | `El pin N solo puede leer: no sirve como salida.` |
| `digitalWrite` sin `pinMode(N, OUTPUT)` | El nivel no cambia | `Usa pinMode(N, OUTPUT) antes de digitalWrite(N, …).` |
| `analogWrite` fuera de rango | Se recorta | `analogWrite(N, V) está fuera de rango: con B bits el máximo es M.` |
| `ledcWrite` sin `ledcAttach` | Devuelve false | `Usa ledcAttach(N, frecuencia, bits) antes de ledcWrite(N, …).` |
| `validarRobot`: medida mayor a 200 mm | — | `El robot mide X cm de <largo\|ancho\|alto>; las bases permiten hasta 20 cm.` |
| `validarRobot`: pin repetido | — | `El pin N está usado dos veces.` |
| `validarRobot`: pin inexistente o de solo entrada usado como salida de motor | — | Los mismos textos de arriba |
| `validarRobot`: el QTR no tiene 8 pines | — | `El QTR-MX-8A necesita 8 pines.` |

- `digitalWrite` en un pin con PWM le quita el PWM.
- En `validarRobot`, X va con una decimal en es-CL (por ejemplo, `23` o `20,5`).
- **Tabla del TB6612 en `pinesAMotores`:**

| IN1 | IN2 | Resultado |
|---|---|---|
| 1 | 0 | `avance`, duty = +nivel(pwm) |
| 0 | 1 | `retroceso`, duty = −nivel(pwm) |
| 1 | 1 | `freno`, duty 0 |
| 0 | 0 | `libre`, duty 0 |

  - Con `invertir`, se intercambian avance y retroceso y se cambia el signo.
  - Si `stby` no es `null` y el pin está en LOW, ambos motores quedan `libre`.

- [ ] **Step 1: Escribir las pruebas que fallan.** Son las de abajo, más las de la tabla: avance, retroceso con `analogWrite(18, 128)` → duty ≈ −128/255, freno, libre, `invertir`, `stby` en LOW y PWM por `ledcAttach(18, 5000, 10)` + `ledcWrite(18, 1023)` → duty 1.

```ts
// pines.test.ts
it('analogWrite recorta, avisa y normaliza según la resolución', () => {
  const p = new Pines();
  p.analogWrite(18, 300);
  expect(p.nivel(18)).toBe(1);
  expect(p.avisos).toContainEqual({ pin: 18, mensaje: 'analogWrite(18, 300) está fuera de rango: con 8 bits el máximo es 255.' });
  p.analogWriteResolution(18, 10); p.analogWrite(18, 512);
  expect(p.nivel(18)).toBeCloseTo(512 / 1023);
});
it('digitalWrite sin pinMode no mueve el pin y avisa una sola vez', () => {
  const p = new Pines(); p.digitalWrite(16, 1); p.digitalWrite(16, 1);
  expect(p.nivel(16)).toBe(0);
  expect(p.avisos).toEqual([{ pin: 16, mensaje: 'Usa pinMode(16, OUTPUT) antes de digitalWrite(16, …).' }]);
});
it('los pines 34 a 39 solo leen y los inexistentes avisan', () => {
  const p = new Pines(); p.pinMode(34, 0x03); p.digitalWrite(34, 1); p.digitalWrite(50, 1);
  expect(p.nivel(34)).toBe(0);
  expect(p.avisos.map(a => a.mensaje)).toEqual(['El pin 34 solo puede leer: no sirve como salida.', 'El pin 50 no existe en el ESP32.']);
});
it('digitalRead: una salida devuelve lo escrito; INPUT_PULLUP lee 1', () => {
  const p = new Pines(); p.pinMode(16, 0x03); p.digitalWrite(16, 1); p.pinMode(4, 0x05);
  expect([p.digitalRead(16), p.digitalRead(4), p.digitalRead(5)]).toEqual([1, 1, 0]);
});
// robot.test.ts
it('el robot por defecto es válido', () => expect(validarRobot(ROBOT_POR_DEFECTO)).toEqual([]));
it('avisa si el robot es más grande que lo permitido o repite pines', () => {
  const r = structuredClone(ROBOT_POR_DEFECTO); r.chasis.largo = 230; r.motores.der.pwm = 18;
  expect(validarRobot(r).map(a => a.mensaje)).toEqual(expect.arrayContaining(['El robot mide 23 cm de largo; las bases permiten hasta 20 cm.', 'El pin 18 está usado dos veces.']));
});
it('huellaRobot rota el chasis', () => {
  const h = huellaRobot(100, 0, Math.PI / 2, ROBOT_POR_DEFECTO);
  expect(h[0].x).toBeCloseTo(34); expect(h[0].y).toBeCloseTo(96); // (96, 66) rotado 90° + (100, 0)
  expect(huellaRobot(0, 0, 0, ROBOT_POR_DEFECTO)).toEqual([{ x: 96, y: 66 }, { x: -60, y: 66 }, { x: -60, y: -66 }, { x: 96, y: -66 }]);
});
```

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run tests/unidad/robot.test.ts tests/unidad/pines.test.ts tests/unidad/motores.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementar** `config.ts`, `costos.ts`, `pines.ts` y `motores.ts`.
- [ ] **Step 4: Verificar que pasan** (mismo comando: PASS).
- [ ] **Step 5: Commit.** `git commit -m "Configuración del robot, pines del ESP32 y driver de motores TB6612"`

---

### Task 7: Simulador (reloj virtual, física, Serial) y placeholder de dinámica

**Files:**
- Create: `src/simulacion/azar.ts`, `src/simulacion/simulador.ts`, `src/mundo/tipos.ts`, `src/mundo/plano.ts`
- Create: `src/modelos/dinamica.js`, `src/modelos/parametros.js`, `src/modelos/README.md`
- Test: `tests/unidad/azar.test.ts`, `tests/integracion/simulador.test.ts`

**Interfaces:**
- Consumes: `crearImports`, `Anfitrion`, `clasificarErrorEjecucion`, `ErrorEjecucion` (Task 4); `cargarNucleoDesdeDisco` (Task 5); `ConfigRobot`, `ROBOT_POR_DEFECTO`, `huellaRobot`, `Pines`, `pinesAMotores`, `Motores`, `COSTOS_US`, `BUFER_SERIAL_BYTES`, `usPorCaracter` (Task 6).
- Produces:
  ```ts
  // azar.ts
  export type Azar = () => number;                 // [0, 1)
  export function crearAzar(semilla: number): Azar; // mulberry32
  // mundo/tipos.ts (contrato de la spec §9; la Fase 2 lo implementa de verdad)
  export interface Punto2 { x: number; y: number }
  export interface Punto3 { x: number; y: number; z: number }
  export interface ObjetoPista { tipo: string; x: number; y: number; rot: number; props: Record<string, unknown> }
  export interface ImpactoRayo { distancia: number; objeto: ObjetoPista | null; normal: Punto3 }
  export interface Colision { objeto: ObjetoPista; penetracion: number }
  export interface Mundo {
    muestrear(x: number, y: number): { r: number; g: number; b: number };
    altura(x: number, y: number): number;
    inclinacion(x: number, y: number, yaw: number): { pitch: number; roll: number };
    raycast(origen: Punto3, dir: Punto3, max: number): ImpactoRayo | null;
    colisiona(poligono: Punto2[]): Colision | null;
    objetosCerca(x: number, y: number, radio: number): ObjetoPista[];
  }
  // mundo/plano.ts
  export function mundoPlano(): Mundo; // blanco (255,255,255), altura 0, inclinación 0, sin objetos
  // simulador.ts
  export interface Pose { x: number; y: number; yaw: number }
  export interface EstadoRobot { x: number; y: number; z: number; yaw: number; pitch: number; roll: number; [campo: string]: unknown }
  export interface ModeloDinamica {
    estadoInicial(pose: Pose, robot: ConfigRobot, mundo: Mundo): EstadoRobot;
    pasoDinamica(e: EstadoRobot, m: Motores, dt: number, mundo: Mundo, robot: ConfigRobot, azar: Azar): EstadoRobot;
  }
  export interface OpcionesSimulador {
    modulo: WebAssembly.Module; robot?: ConfigRobot; mundo?: Mundo; dinamica?: ModeloDinamica;
    poseInicial?: Pose; semilla?: number; dtFisicaUs?: number;
    alAvanzar?: (sim: Simulador) => void;
    lectorAnalogico?: (pin: number, sim: Simulador) => number; // ADC crudo de 12 bits; por defecto 0 (la Fase 3 conecta el QTR)
  }
  export interface ResultadoEjecucion { motivo: 'tiempo' | 'error'; tiempoUs: number; error?: ErrorEjecucion }
  export class Simulador {
    static crear(o: OpcionesSimulador): Promise<Simulador>; // instancia el módulo y llama a _initialize
    ejecutar(duracionUs: number): ResultadoEjecucion;      // una sola vez por instancia
    get tiempoUs(): number; get estado(): EstadoRobot; get motores(): Motores; get pines(): Pines;
    get avisos(): string[];  // avisos de pines + propios, sin repetir
    tomarSerial(): string;   // entrega y vacía el texto acumulado
  }
  ```
  ```js
  // modelos/dinamica.js (JSDoc con los tipos de arriba)
  export function estadoInicial(pose, robot, mundo); export function pasoDinamica(estado, motores, dt, mundo, robot, azar);
  // modelos/parametros.js
  export const PARAMETROS = { vMaxMmS: 600 }; // TODO(profe)
  ```

**Comportamiento del `Simulador`:**
- **`avanzar(us)`** (interno; todas las llamadas del núcleo pasan por aquí):
  1. `t = min(t + us, límite)`;
  2. ejecuta pasos de física de `dtFisicaUs` mientras `tFisica + dt ≤ t`, con `motores = pinesAMotores(...)` y `estado = dinamica.pasoDinamica(estado, motores, dt / 1e6, ...)`;
  3. llama a `alAvanzar`;
  4. si `t ≥ límite`, lanza un `FinDeTiempo` interno.
- **`ejecutar(duracionUs)`:** fija el límite y llama a `dyn_setup`. Después repite `avanzar(COSTOS_US.llamadaLoop); dyn_loop()`. Atrapa `FinDeTiempo` y devuelve `{ motivo: 'tiempo' }`; cualquier otro error se clasifica y devuelve `{ motivo: 'error', error }`. Si se llama dos veces, lanza `Error('ejecutar solo se puede llamar una vez por simulador')`.
- **Costos:** cada método de `Anfitrion` cobra su costo de `COSTOS_US` antes de actuar.
  - `millis()` devuelve `Math.floor(t / 1000)`, y `micros()` devuelve `t`; el puente los convierte a u32.
  - `delay` y `delayUs` avanzan exactamente lo pedido.
  - `analogRead` devuelve `lectorAnalogico(pin)` escalado de 12 bits a la resolución actual (12 por defecto).
- **Serial:**
  - Sin `serialBegin`, los bytes se descartan y queda el aviso `Usaste Serial.print sin Serial.begin(): en el robot real no se verá nada.`
  - Con `serialBegin`, el texto se decodifica con `TextDecoder('utf-8')` en modo `stream`.
  - Búfer de transmisión: `cola = max(0, cola − (t − tUltimo) / usPorCaracter(baudios))`. Si `largo > 128 − cola`, se avanza `(largo − (128 − cola)) · usPorCaracter`; después, `cola = min(128, cola + largo)`.
  - `salidaEstandar` (printf) siempre se agrega, porque en el ESP32 `printf` sale por UART0.
- **Azar:** `azarU32()` es `Math.floor(azar() * 2 ** 32)`, con el generador de la semilla (por defecto 1).
- **Placeholder de `dinamica.js`** (con `TODO(profe)`):
  - `vIzq = duty_izq · PARAMETROS.vMaxMmS`, `vDer = …`, `v = (vIzq + vDer) / 2`, `ω = (vDer − vIzq) / robot.ruedas.trocha`;
  - integración de Euler de `yaw`, `x` e `y`;
  - `z = mundo.altura(x, y)`; `pitch` y `roll` salen de `mundo.inclinacion`;
  - si `mundo.colisiona(huellaRobot(nuevo))`, se conservan `x` e `y` anteriores.
- **`src/modelos/README.md`:** explica el contrato de `dinamica.js` (firmas, unidades, marcos de §9 y qué es cada campo de `motores`) y avisa que los modelos de sensores llegan en la Fase 3.

- [ ] **Step 1: Escribir las pruebas que fallan.**
  - `azar.test.ts`: la misma semilla da la misma secuencia de 5 valores; semillas distintas difieren; todos los valores están en [0, 1).
  - `simulador.test.ts`: un ayudante local `crearSim(codigo, opciones?)` compila `{ 'p.ino': codigo }` con el núcleo real y llama a `Simulador.crear`.

```ts
const AVANZAR = `void setup() {
  pinMode(16, OUTPUT); pinMode(17, OUTPUT); pinMode(4, OUTPUT); pinMode(5, OUTPUT);
  digitalWrite(16, HIGH); digitalWrite(17, LOW); digitalWrite(4, HIGH); digitalWrite(5, LOW);
  analogWrite(18, 255); analogWrite(19, 255);
}
void loop() {}`;
it('un sketch que avanza mueve al robot hacia adelante', async () => {
  const sim = await crearSim(AVANZAR);
  expect(sim.ejecutar(2_000_000)).toEqual({ motivo: 'tiempo', tiempoUs: 2_000_000 });
  expect(sim.estado.x).toBeGreaterThan(1195); expect(sim.estado.x).toBeLessThanOrEqual(1200); // 600 mm/s × 2 s
  expect(Math.abs(sim.estado.y)).toBeLessThan(1);
  expect(sim.motores).toEqual({ izq: { duty: 1, modo: 'avance' }, der: { duty: 1, modo: 'avance' } });
});
it('girar en el lugar cambia el rumbo sin desplazarse', async () => {
  const sim = await crearSim(AVANZAR.replace('digitalWrite(4, HIGH); digitalWrite(5, LOW)', 'digitalWrite(4, LOW); digitalWrite(5, HIGH)'));
  sim.ejecutar(500_000);
  expect(sim.estado.yaw).toBeCloseTo(-(1200 / 140) * 0.5, 1); expect(Math.hypot(sim.estado.x, sim.estado.y)).toBeLessThan(1);
});
it('millis y delay avanzan el reloj virtual', async () => {
  const sim = await crearSim('void setup() { Serial.begin(115200); }\nvoid loop() { Serial.println(millis()); delay(100); }');
  sim.ejecutar(350_000);
  expect(sim.tomarSerial()).toBe('0\r\n100\r\n200\r\n300\r\n');
});
it('el búfer del Serial a 9600 baudios toma tiempo', async () => {
  const sim = await crearSim('void setup() { Serial.begin(9600); for (int i = 0; i < 1000; i++) Serial.write(\'x\'); unsigned long t = millis(); Serial.println(); Serial.println(t); }\nvoid loop() {}');
  sim.ejecutar(3_000_000);
  const t = Number(sim.tomarSerial().trim().split('\r\n').pop());
  expect(t).toBeGreaterThanOrEqual(905); expect(t).toBeLessThanOrEqual(911); // (1000 − 128) × 10 / 9600 s
});
it('los textos con tildes llegan bien aunque se escriban de a un byte', async () => {
  const sim = await crearSim('void setup() { Serial.begin(115200); Serial.print("¡Hola, "); Serial.write((uint8_t)0xC3); Serial.write((uint8_t)0xB1); Serial.println("o!"); }\nvoid loop() {}');
  sim.ejecutar(10_000); expect(sim.tomarSerial()).toBe('¡Hola, ño!\r\n');
});
it('Serial sin begin no imprime y avisa', async () => {
  const sim = await crearSim('void setup() { Serial.println("nada"); }\nvoid loop() {}');
  sim.ejecutar(10_000);
  expect(sim.tomarSerial()).toBe(''); expect(sim.avisos).toContain('Usaste Serial.print sin Serial.begin(): en el robot real no se verá nada.');
});
it('un setup que nunca termina se corta en el límite', async () => {
  const sim = await crearSim('void setup() { while (true) { delay(10); } }\nvoid loop() {}');
  expect(sim.ejecutar(1_000_000)).toEqual({ motivo: 'tiempo', tiempoUs: 1_000_000 });
});
it('un loop vacío igual hace avanzar el tiempo', async () => {
  const sim = await crearSim('void setup() {}\nvoid loop() {}');
  expect(sim.ejecutar(1_000)).toEqual({ motivo: 'tiempo', tiempoUs: 1_000 });
});
it('esperar con millis() dentro de un while termina', async () => {
  const sim = await crearSim('void setup() { Serial.begin(115200); while (millis() < 500) {} Serial.println("listo"); }\nvoid loop() {}');
  sim.ejecutar(1_000_000); expect(sim.tomarSerial()).toBe('listo\r\n');
});
it('la misma semilla repite random(); otra semilla cambia', async () => {
  const cod = 'void setup() { Serial.begin(115200); for (int i = 0; i < 5; i++) Serial.println(random(1000)); }\nvoid loop() {}';
  const salida = async (semilla: number) => { const s = await crearSim(cod, { semilla }); s.ejecutar(10_000); return s.tomarSerial(); };
  expect(await salida(7)).toBe(await salida(7)); expect(await salida(7)).not.toBe(await salida(8));
});
it('un error de ejecución termina con motivo error y el tiempo en que ocurrió', async () => {
  const sim = await crearSim('void setup() { delay(100); volatile int z = 0; volatile int r = 10 / z; }\nvoid loop() {}');
  const r = sim.ejecutar(1_000_000);
  expect(r.motivo).toBe('error'); expect(r.error?.tipo).toBe('division-por-cero');
  expect(r.tiempoUs).toBeGreaterThanOrEqual(100_000); expect(r.tiempoUs).toBeLessThan(101_000);
});
it('analogRead usa el lector analógico y la resolución', async () => {
  const sim = await crearSim('void setup() { Serial.begin(115200); Serial.println(analogRead(36)); analogReadResolution(10); Serial.println(analogRead(36)); }\nvoid loop() {}', { lectorAnalogico: () => 4095 });
  sim.ejecutar(10_000); expect(sim.tomarSerial()).toBe('4095\r\n1023\r\n');
});
it('alAvanzar recibe un tiempo que siempre crece', async () => {
  const tiempos: number[] = [];
  const sim = await crearSim('void setup() {}\nvoid loop() { delay(10); }', { alAvanzar: s => tiempos.push(s.tiempoUs) });
  sim.ejecutar(100_000);
  expect(tiempos.length).toBeGreaterThan(9); expect(tiempos.every((t, i) => i === 0 || t >= tiempos[i - 1])).toBe(true);
});
```

- [ ] **Step 2: Verificar que fallan.** Run: `npx vitest run tests/unidad/azar.test.ts tests/integracion/simulador.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementar** `azar.ts`, `mundo/tipos.ts`, `mundo/plano.ts`, `simulador.ts`, `modelos/dinamica.js`, `modelos/parametros.js` y `modelos/README.md`.
- [ ] **Step 4: Verificar.** Run: `npx vitest run tests/unidad/azar.test.ts tests/integracion/simulador.test.ts`, luego `npm test` y `npm run typecheck`. Expected: todo PASS y sin errores de tipos.
- [ ] **Step 5: Commit.** `git commit -m "Simulador con reloj virtual, física a paso fijo, Serial y dinámica placeholder"`

---

### Task 8: Medición de la compilación y README

**Files:**
- Create: `vitest.medicion.config.ts`, `tests/medicion/compilacion.test.ts`
- Modify: `package.json` (script `"medir": "vitest run --config vitest.medicion.config.ts"`), `README.md`

**Interfaces:**
- Consumes: `compilar` (Task 3), `cargarNucleoDesdeDisco` (Task 5), `Simulador` (Task 7).

**Medición:** `tests/medicion/compilacion.test.ts` (fuera de `npm test`) compila un proyecto de 3 archivos: `seguidor.ino`, más `motores.ino` y `pines.h` con un PID de ~60 líneas. Imprime con `console.table`:
- la primera compilación (incluye cargar LLVM);
- la mediana de 5 compilaciones en caliente;
- el tamaño del `.wasm`;
- el tiempo real de simular 10 s del robot sin ritmo de tiempo real.

Afirma solo cotas holgadas (en caliente < 10 s; 10 s simulados en < 10 s reales) para no ser frágil.

**README:**
- qué es el simulador y su estado ("Fase 1: base de ejecución, sin interfaz todavía");
- requisitos (Node 22);
- comandos: `npm install`, `npm test`, `npm run nucleo`, `npm run medir`, `npm run typecheck`;
- estructura de `src/`;
- dónde están los modelos del profesor (`src/modelos/`, con enlace a su README);
- enlaces a la spec y a este plan.

- [ ] **Step 1: Escribir la medición**, con su configuración y el script `medir`.
- [ ] **Step 2: Correrla.** Run: `npm run medir`. Expected: PASS y una tabla con los cuatro números. Copiar los números a la sección "Mediciones" del README, con la fecha y el equipo.
- [ ] **Step 3: Escribir el README.**
- [ ] **Step 4: Verificación final.** Run: `npm test && npm run typecheck`. Expected: todo PASS y sin errores de tipos.
- [ ] **Step 5: Commit.** `git commit -m "Medición de compilación y README de la fase 1"`
