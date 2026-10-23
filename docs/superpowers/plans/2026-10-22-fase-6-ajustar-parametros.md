# Fase 6 — Ajustar parámetros: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el estudiante marque valores de su código con `@ajustar`, que el simulador los pruebe muchas veces en paralelo (sin recompilar) con el agente y la recompensa del profe, y que pueda ver la mejor prueba en la pista y escribir sus valores en el código. El agente y la recompensa quedan como **archivos con su contrato, sin rellenar**: los programa el profe.

**Architecture:**
- **Marcas:** el texto del proyecto se transforma antes de compilar: cada valor marcado pasa por `__dyn_ajustable(grupo, nombre, valor)`, un import del núcleo que responde el simulador con los valores de cada prueba.
- **Motor de pruebas:**
  - Una prueba de entrenamiento es una función pura del worker: Simulador + juez + registro + recompensa del profe.
  - Un pool de workers recibe el `WebAssembly.Module` una vez y corre pruebas.
  - Un bucle de entrenamiento en el hilo principal le pide valores al agente del profe y le devuelve los resultados.
- **Ventana:** un `<dialog>` modal, como "Mi robot".

**Tech Stack:** el de la fase 5. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-10-17-simulador-dynamis-design.md`. Esta fase cubre:
- §11 entero;
- §19, punto 6;
- §14: errores del agente del profe;
- §15: `@ajustar` en el preprocesador, "`@ajustar` cambia el comportamiento sin recompilar", y el e2e "Ajustar parámetros con pocas pruebas y Usar estos valores".

**Cambio pedido por el usuario (2026-10-22):** el profe programa el agente y la recompensa desde cero. Este proyecto crea `src/ajuste/agente.js` y `src/ajuste/recompensa.js` con el contrato y `TODO(profe)`, **sin los placeholders de §11.3** (búsqueda aleatoria y juez + bono). La Tarea 8 lo lleva a la spec (§11.3, §15 y §20).

**Decisiones que toma este plan** (la Tarea 8 las lleva a la spec):
1. **Archivos del profe sin rellenar:**
   - cada función de `agente.js` y `recompensa.js` lanza `FaltaImplementar` (de `src/ajuste/contrato.ts`) con el nombre de la pieza y su archivo;
   - la ventana lo detecta y explica qué falta, sin romper nada.
2. **Sintaxis de la marca:** `@ajustar grupo` o `@ajustar grupo min..max`, dentro del comentario `//` de la misma línea (puede haber texto antes). Vale en:
   - `[const|static|volatile|unsigned|signed|long|short ...] tipo nombre = número;`, con un tipo numérico de Arduino (`float`, `double`, `int`, `long`, `byte`, `uint8_t`… `int32_t`, `size_t`, `word`, `bool` no);
   - `#define NOMBRE número`.

   El grupo son letras, números y `_`. Un `constexpr` marcado, o una marca que no está junto a un número así, da un aviso y no se transforma.
3. **Enteros y reales:**
   - un parámetro es entero si su tipo es entero, o si es un `#define` cuyo número no tiene `.` ni `e`;
   - "Usar estos valores" escribe los enteros redondeados, y los reales con 4 cifras significativas y siempre con punto decimal (`1.0`, no `1`).
4. **Rango de búsqueda:**
   - el de la marca;
   - si no tiene, `[0, 4·valor]` (`[4·valor, 0]` si el valor es negativo; `[0, 1]` si es 0);
   - con `min ≥ max` no se puede empezar.
5. **Valores propuestos por el agente:**
   - solo se usan los ids de los parámetros elegidos;
   - se acotan a su rango;
   - un valor que no es un número finito toma el valor del código.

   Los parámetros sin elegir usan el valor del código.
6. **Registro de cada prueba:**
   - un paso cada 10 ms: `{ t, estado, lecturas, motores, eventos }`;
   - `eventos` son los del juez nuevos en ese paso (`'hito'`, `'meta'`, `'perdio-linea'`, `'toco-obstaculo'`, `'camino-equivocado'`, `'fin-tiempo'`), más `'colision'` (la huella toca un obstáculo) y `'fuera-de-pista'` (el centro sale de la grilla);
   - `fin.motivo` es `'tiempo' | 'termino' | 'juez' | 'error' | 'ciclo-sin-fin'`:
     - `'termino'`: lo pidió `debeTerminar`;
     - `'juez'`: el juez dio la prueba por terminada.
7. **Ciclo sin fin:**
   - un worker sin latido durante 2 s de tiempo real se reemplaza por uno nuevo;
   - la prueba se registra con `fin.motivo = 'ciclo-sin-fin'` y sin pasos;
   - su recompensa la calcula el hilo principal con el mismo `calcularRecompensa`.
8. **Errores:**
   - `FaltaImplementar` detiene el entrenamiento con "Para entrenar falta que tu profe programe {el agente | la recompensa} (`src/ajuste/…`).";
   - otra excepción del agente o de la recompensa, o una recompensa que no es un número finito, lo detiene con "Algo falló en el simulador, avisa a tu profe." y el detalle técnico (archivo y pila, §14);
   - un error de ejecución del programa del estudiante termina esa prueba con `fin.motivo = 'error'`, y el entrenamiento sigue.
9. **Configuración del entrenamiento:**
   - pruebas: de 10 a 2000, 200 por defecto;
   - duración: 10, 20 o 30 s, 20 por defecto;
   - robots a la vez: de 1 a `min(8, núcleos − 1)`, por defecto `min(4, ese máximo)`;
   - la pista es la del editor y el robot el de "Mi robot";
   - siempre desde la partida.
10. **La ventana:**
    - cerrarla ("Volver a mi programa" o `Esc`) no detiene el entrenamiento: al abrirla de nuevo se ve el avance;
    - mientras entrena, los parámetros y la configuración no se editan.
11. **"Ver esta prueba en la pista":** cierra la ventana, va a Programar y corre una prueba normal con los valores y la semilla de la mejor, desde la partida.
12. **"Usar estos valores":**
    - busca cada marca por su id en el código actual, aunque se haya movido de línea, y reescribe su número;
    - abre el archivo del primer cambio y resalta las líneas cambiadas hasta la próxima edición;
    - el cambio se deshace con `Ctrl+Z`;
    - si una marca ya no está, lo dice.
13. **Ejemplo inicial:** `VELOCIDAD` (`@ajustar siguelineas 50..200`) y `KP` (`@ajustar siguelineas 0..0.1`) quedan marcados, para que la ventana tenga algo que mostrar.
14. **"Mejor resultado"** muestra la recompensa y el número de la prueba. No compara con "tus valores": no hay una prueba base.

## Global Constraints

- **Lo de las fases 4 y 5 sigue:**
  - español de Chile, tuteando;
  - paleta y tipografías;
  - teclado y foco visible;
  - sin framework de UI;
  - **sin `innerHTML` con texto del estudiante** (los nombres de los parámetros vienen de su código).
- **Compilar una vez:** el proyecto se compila **una vez** por entrenamiento y el `WebAssembly.Module` se envía a los N workers.
- **Cada prueba:**
  - es una instancia nueva del módulo, con los valores propuestos, en la partida y con una semilla nueva;
  - corre `setup()` y `loop()` sin ritmo de tiempo real, hasta la duración o hasta que `debeTerminar` lo indique (§11.2).
- **La recompensa se calcula en el worker.** Al hilo principal solo vuelven `{ valores, recompensa, resumen, trayectoria (diezmada), semilla }`. La trayectoria tiene a lo más 200 puntos.
- **Contrato del profe (§11.3), exacto:**
  - `crearAgente({ parametros: [{ id, grupo, nombre, valor, min, max }], presupuesto })` devuelve `{ proponer(): { [id]: number }, aprender(valores, recompensa, resumen): void }`;
  - `calcularRecompensa(registro): number`;
  - `debeTerminar(paso, mundo): false | string`.

  El agente corre en el hilo principal, y la recompensa en los workers. Los ids son `grupo.nombre`.
- **Transformación (§11.1):**
  - `float kp = 0.08;` pasa a `float kp = __dyn_ajustable("siguelineas", "kp", 0.08);`;
  - `#define KD 0.6` pasa a `#define KD (__dyn_ajustable("siguelineas", "KD", 0.6))`;
  - **los números de línea se mantienen**;
  - las marcas pueden estar en cualquier archivo, también en `.h`.
- **Grupos con nombre amigable (§11.1):**
  - `siguelineas` → Siguelíneas, QTR-MX-8A;
  - `giroscopio` → Giroscopio, MPU6050;
  - `distancia` → Distancia, VL53L0X;
  - `posicion` → Posición, "Posición del robot";
  - cualquier otro grupo es un "Grupo propio".
- **Gráfico (§11.4):**
  - puntos de cada prueba `#2C93D3`;
  - línea "mejor hasta ahora" `#4049D8`;
  - récords `#FFD166`;
  - con leyenda y tooltip.
- **Textos de la maqueta:**
  - Ayudas:
    - `kp`: "Qué tan fuerte corrige";
    - `ki`: "Corrige el error que se va acumulando";
    - `kd`: "Frena los zigzags";
    - el resto: "Valor ajustable".
  - Grupo que falta: "Todavía no está en tu código. Marca sus variables así:" y `float kp = 1.0;  // @ajustar <grupo>`.
  - Botones: "Empezar a entrenar" y "Detener entrenamiento".
  - Estado: "Sin empezar", "Practicando…" y "Terminado".
  - Progreso: "Prueba n de N".
  - Gráfico vacío: "Presiona «Empezar a entrenar» para ver cómo mejora tu robot".
  - Nota: "La recompensa es el puntaje de cada prueba: mientras más alto, mejor lo hizo el robot."
  - Botones del mejor resultado: "Ver esta prueba en la pista" y "Usar estos valores".
  - Al usarlos: "¡Tu robot aprendió! Cambiamos los valores marcados en tu código."

## Review Focus

1. **Archivos del profe sin rellenar.** Con `agente.js` y `recompensa.js` tal como quedan, "Empezar a entrenar" explica qué falta, no deja workers vivos y la app sigue funcionando. Pruebas en las Tareas 5 y 7.
2. **No hay nada que ajustar.** Ninguna marca en el código, todos los interruptores apagados, o un rango con `min ≥ max` o vacío: un mensaje claro, y no se puede empezar. Pruebas en la Tarea 6.
3. **El programa del estudiante falla durante el entrenamiento:**
   - un `while (true) {}` sin tiempo, o una división por cero: la prueba se registra (`'ciclo-sin-fin'` o `'error'`) y el entrenamiento sigue;
   - el worker colgado se reemplaza y no queda vivo.

   Pruebas en las Tareas 4 y 5.
4. **El agente del profe entrega basura:** `NaN`, un valor fuera de rango, ids que sobran o que faltan. Se sanea sin romper el worker. Prueba en la Tarea 5.
5. **"Usar estos valores" después de editar el código:** una marca que cambió de línea se encuentra igual; una marca borrada se informa y no se toca otra línea. Pruebas en las Tareas 1 y 8.

---

### Task 1: Las marcas `@ajustar` en el texto del proyecto

**Files:**
- Create: `src/compilador/ajustables.ts`
- Test: `tests/unidad/ajustables.test.ts`

**Interfaces:**
- Consumes: `Proyecto`, `tipoDeArchivo` (`src/proyecto/proyecto.ts`) y `normalizarTexto` (`preprocesador.ts`).
- Produces:
  - **`interface Ajustable`:** `{ id: string; grupo: string; nombre: string; valor: number; entero: boolean; min: number | null; max: number | null; archivo: string; linea: number; forma: 'variable' | 'define' }`. `linea` empieza en 1; `id` es `${grupo}.${nombre}`.
  - **`interface AvisoAjustable`:** `{ archivo: string; linea: number; mensaje: string }`.
  - **`buscarAjustables(p: Proyecto): { parametros: Ajustable[]; avisos: AvisoAjustable[] }`:**
    - recorre los `.ino`, `.cpp`, `.c`, `.h` y `.hpp`, en el orden de `ordenarArchivos`;
    - un id repetido da el aviso "El valor {id} está marcado dos veces: se usa el primero.".
  - **`conAjustables(p: Proyecto): Proyecto`:** el proyecto con cada marca válida transformada (decisión 2 y Global Constraints), y la misma cantidad de líneas en cada archivo.
  - **`reescribirAjustables(p: Proyecto, valores: Record<string, number>): { proyecto: Proyecto; cambiadas: { archivo: string; linea: number }[]; faltan: string[] }`:** decisiones 3 y 12. Solo cambia el número: lo demás de la línea queda igual.
  - **`formatearValor(v: number, entero: boolean): string`.**
  - **Textos de los avisos:**
    - "{nombre} está marcado con @ajustar pero es constexpr: no puede cambiar mientras corre el programa. Quita constexpr para ajustarlo.";
    - "La marca @ajustar de esta línea debe ir junto a una variable con un número (float kp = 0.5;) o a un #define con un número.".

- [ ] **Step 1: Escribir las pruebas que fallan** en `tests/unidad/ajustables.test.ts`:
  - `encuentra variables y #define marcados, con grupo y rango`:
    - `float kp = 0.08;  // @ajustar siguelineas` da `{ id: 'siguelineas.kp', valor: 0.08, entero: false, min: null, max: null, linea: 1, forma: 'variable' }`;
    - `const int VEL = 100; // rápido @ajustar siguelineas 50..200` da `entero: true, min: 50, max: 200`;
    - `#define KD 0.6 // @ajustar siguelineas` da `forma: 'define', entero: false`;
    - `#define N 3 // @ajustar mio` da `entero: true`;
    - las marcas de un `config.h` también aparecen, con su archivo.
  - `constexpr y marcas sueltas dan avisos y no se transforman`: `constexpr float kp = 1.0; // @ajustar a` y `// @ajustar a` en una línea sin número.
  - `conAjustables transforma sin cambiar la cantidad de líneas`:
    - la variable queda `float kp = __dyn_ajustable("siguelineas", "kp", 0.08);  // @ajustar siguelineas`;
    - el define queda `#define KD (__dyn_ajustable("siguelineas", "KD", 0.6)) // @ajustar siguelineas`;
    - el mismo número de `\n` en cada archivo;
    - los archivos sin marcas quedan idénticos.
  - `una variable sin marca, o un comentario que menciona ajustar, no se toca`.
  - `reescribirAjustables cambia solo el número y respeta enteros y reales`:
    - `{ 'siguelineas.kp': 0.123456, 'siguelineas.VEL': 120.6 }` da `float kp = 0.1235;  // @ajustar…` y `const int VEL = 121; // rápido @ajustar…`;
    - un real entero se escribe `2.0`.
  - `reescribirAjustables encuentra una marca que cambió de línea e informa las que faltan`:
    - se agregan 2 líneas arriba y se borra la marca de `KD`;
    - `cambiadas` trae la línea nueva de `kp`;
    - `faltan` es `['siguelineas.KD']`;
    - ninguna otra línea cambia.
  - `formatearValor`: `(0.0001234567, false)` da `'0.0001235'`; `(3, false)` da `'3.0'`; `(2.5, true)` da `'3'`; `(-1.25, false)` da `'-1.25'`.

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/unidad/ajustables.test.ts`
Expected: FAIL (no existe `ajustables.ts`).

- [ ] **Step 3: Implementar** `src/compilador/ajustables.ts` con expresiones regulares por línea; no hace falta un parser de C++. La marca se reconoce en el comentario `//` final de la línea. El número acepta signo, decimales, exponente y sufijos `f`/`F`/`L`/`u` (se quitan en el valor).

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/unidad/ajustables.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/compilador/ajustables.ts tests/unidad/ajustables.test.ts
git commit -m "Marcas @ajustar: buscarlas, transformarlas para el simulador y reescribir sus valores"
```

---

### Task 2: El valor ajustable llega al programa sin recompilar

**Files:**
- Modify:
  - `src/nucleo/include/dynamis_host.h` (import `ajustable`);
  - `src/simulacion/puente.ts`, `src/simulacion/simulador.ts`, `src/compilador/compilar.ts`;
  - `src/simulacion/ejecucion.ts`, `src/simulacion/trabajador.ts`, `src/simulacion/cliente.ts` (`ajustes` en la prueba normal);
  - `src/ejemplos/seguidor/seguidor.ino` (decisión 13).
- Test: `tests/integracion/ajustar.test.ts`, `tests/integracion/puente.test.ts` (un caso)

**Interfaces:**
- Consumes: `conAjustables` (Tarea 1).
- Produces:
  - **C:** `DYN_IMPORTAR("ajustable") double __dyn_ajustable(const char* grupo, const char* nombre, double valor);` en `dynamis_host.h`, dentro del `extern "C"`, visible desde `Arduino.h`.
  - **`Anfitrion.ajustable(grupo: string, nombre: string, valor: number): number`:** el puente lee las dos cadenas C, terminadas en 0, de la memoria.
  - **`OpcionesSimulador.ajustes?: Record<string, number>`:** `__dyn_ajustable` responde `ajustes[\`${grupo}.${nombre}\`]`, o el `valor` del código si no está. No cuesta tiempo virtual.
  - **`compilar(p, nucleo)`:** compila `conAjustables(p)`. Los diagnósticos siguen apuntando al archivo y la línea originales.
  - **`OpcionesPrueba.ajustes?` y `OpcionesInicio.ajustes?`:** opcionales, para "Ver esta prueba en la pista" (Tarea 8).

- [ ] **Step 1: Escribir las pruebas que fallan.**
  - **`tests/integracion/ajustar.test.ts`** (compila con `@yowasp/clang` en Node, como `compilar.test.ts`):
    - Un sketch con `float v = 0.5; // @ajustar prueba` en el `.ino` y `#define LADO 2 // @ajustar prueba` en `config.h`, que imprime `v` y `LADO * 1.5` en `setup()`.
    - **`@ajustar cambia el comportamiento sin recompilar`:**
      - el **mismo** `WebAssembly.Module`, sin `ajustes`, imprime `0.50 3.00`;
      - con `{ 'prueba.v': 2.25, 'prueba.LADO': 4 }`, imprime `2.25 6.00`.
    - **`un error de compilación sigue apuntando a la línea original`:** un error en la línea 3 de un sketch con marcas en las líneas 1 y 2 da el diagnóstico en la línea 3.
  - **`tests/integracion/puente.test.ts`:** `el import ajustable lee las cadenas de la memoria`.

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/integracion/ajustar.test.ts tests/integracion/puente.test.ts`
Expected: FAIL (el import no existe).

- [ ] **Step 3: Implementar** el import, `ajustes`, `compilar` con `conAjustables`, `ajustes` en la prueba normal, y las marcas del ejemplo. El núcleo se reconstruye solo (`npm test` lo hace si cambió una cabecera).

- [ ] **Step 4: Correr las pruebas**

Run: `npm test && npm run typecheck`
Expected: PASS. Las pruebas del seguidor y la e2e `revision.spec.ts` (que compara el ejemplo con el archivo) siguen pasando.

- [ ] **Step 5: Commit**

```bash
git add src tests/integracion/ajustar.test.ts tests/integracion/puente.test.ts
git commit -m "El valor de @ajustar llega al programa en cada prueba, sin recompilar"
```

---

### Task 3: El contrato del profe y sus archivos, sin rellenar

**Files:**
- Create:
  - `src/ajuste/contrato.ts`;
  - `src/ajuste/agente.js`, `src/ajuste/recompensa.js` (del profe, sin rellenar);
  - `src/ajuste/README.md`;
  - `tests/ayuda/ajuste-de-prueba.ts`.
- Test: `tests/unidad/contrato-ajuste.test.ts`

**Interfaces:**
- Produces, en `contrato.ts`:
  - **`ParametroAgente`:** `{ id: string; grupo: string; nombre: string; valor: number; min: number; max: number }`.
  - **`Agente`:** `{ proponer(): Record<string, number>; aprender(valores: Record<string, number>, recompensa: number, resumen: ResumenPrueba): void }`.
  - **`CrearAgente`:** `(o: { parametros: ParametroAgente[]; presupuesto: number }) => Agente`.
  - **`PasoRegistro`:** `{ t: number; estado: { x; y; z; yaw; pitch; roll: number }; lecturas: LecturasVista; motores: Motores; eventos: string[] }`.
  - **`MotivoFin`:** `'tiempo' | 'termino' | 'juez' | 'error' | 'ciclo-sin-fin'`.
  - **`RegistroPrueba`:** `{ valores: Record<string, number>; semilla: number; duracionS: number; pasos: PasoRegistro[]; juez: EstadoJuez | null; fin: { motivo: MotivoFin; detalle: string | null } }`.
  - **`ResumenPrueba`:** `{ motivo: MotivoFin; detalle: string | null; t: number; puntaje: number; hitos: number; meta: boolean }`.
  - **`ModuloRecompensa`:** `{ calcularRecompensa(r: RegistroPrueba): number; debeTerminar(paso: PasoRegistro, mundo: Mundo): false | string }`.
  - **`class FaltaImplementar extends Error`:**
    - `constructor(pieza: 'el agente' | 'la recompensa', archivo: string)`;
    - `name = 'FaltaImplementar'`;
    - el mensaje es "Para entrenar falta que tu profe programe {pieza} ({archivo}).".
  - **`esFaltaImplementar(e: unknown): boolean`:** mira `name`, que sobrevive al cruzar del worker.
- Produces, archivos del profe (JS con JSDoc, como `src/modelos/`):
  - **`agente.js`:** `export function crearAgente({ parametros, presupuesto })`. Encabezado "AGENTE DE APRENDIZAJE POR REFUERZO — lo implementa el profesor." y un `TODO(profe)` que describe qué debe hacer `proponer` y `aprender`. Su cuerpo es solo `throw new FaltaImplementar('el agente', 'src/ajuste/agente.js')`.
  - **`recompensa.js`:** `export function calcularRecompensa(registro)` y `export function debeTerminar(paso, mundo)`. Igual: JSDoc, `TODO(profe)` y `throw new FaltaImplementar('la recompensa', 'src/ajuste/recompensa.js')`.
  - **`README.md` de `src/ajuste/`:**
    - el contrato completo: qué recibe cada función, con las tablas de `RegistroPrueba`, `PasoRegistro` y `ResumenPrueba`;
    - unidades, dónde corre cada cosa y cuándo se llama;
    - que `proponer` puede llamarse varias veces antes de recibir resultados;
    - que los valores se acotan al rango;
    - qué pasa si una función lanza una excepción;
    - cómo probar su código.
- Produces, en `tests/ayuda/ajuste-de-prueba.ts`:
  - **`agenteDePrueba(semilla: number): CrearAgente`:** recorre el rango de forma determinista, con `crearAzar`.
  - **`recompensaDePrueba: ModuloRecompensa`:** el puntaje del juez más `x / 1000` del último paso. `debeTerminar` corta con `'perdio-linea'`.

  Solo los usan las pruebas; no son los placeholders de la spec.

- [ ] **Step 1: Escribir las pruebas que fallan** en `tests/unidad/contrato-ajuste.test.ts`:
  - `los archivos del profe lanzan FaltaImplementar con su archivo`:
    - `crearAgente(...)`, `calcularRecompensa(...)` y `debeTerminar(...)` lanzan;
    - `esFaltaImplementar(e)` es `true`;
    - el mensaje nombra `src/ajuste/agente.js` o `src/ajuste/recompensa.js`.
  - `esFaltaImplementar reconoce el error después de pasar por structuredClone` (un `{ name, message }` plano).
  - `los dobles de prueba cumplen el contrato`: el agente de prueba propone dentro del rango, solo con los ids dados; la recompensa de prueba da un número.

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/unidad/contrato-ajuste.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** los cinco archivos.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/unidad/contrato-ajuste.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ajuste tests/ayuda/ajuste-de-prueba.ts tests/unidad/contrato-ajuste.test.ts
git commit -m "Contrato del agente y la recompensa, con sus archivos para el profe sin rellenar"
```

---

### Task 4: Una prueba de entrenamiento

**Files:**
- Create: `src/ajuste/prueba.ts`
- Test: `tests/integracion/prueba-ajuste.test.ts`

**Interfaces:**
- Consumes:
  - `Simulador.crear({ ..., ajustes, alPasoFisica })` (Tarea 2) y `Juez`;
  - `crearMundo`, `puntosDePartida`, `huellaRobot`, `crearAzar`;
  - los tipos de la Tarea 3.
- Produces:
  - **`interface ResultadoPrueba`:** `{ valores: Record<string, number>; recompensa: number; resumen: ResumenPrueba; trayectoria: { x: number; y: number }[]; semilla: number }`.
  - **`ejecutarPruebaDeAjuste(o: { modulo: WebAssembly.Module; pista: Pista; robot: ConfigRobot; valores: Record<string, number>; semilla: number; duracionS: number; recompensa: ModuloRecompensa; intervaloMs?: number; alLatido?: () => void }): Promise<ResultadoPrueba>`**:
    - parte desde `'partida'`, sin ritmo de tiempo real;
    - arma el registro (decisión 6);
    - llama a `debeTerminar` en cada paso del registro, y a `calcularRecompensa` al final;
    - diezma la trayectoria a ≤ 200 puntos (el primero y el último siempre);
    - `alLatido` se llama en cada paso de física.
  - **`registroDeCicloSinFin(valores, semilla, duracionS): RegistroPrueba`:** sin pasos, `juez: null`, `fin.motivo = 'ciclo-sin-fin'`. Lo usa la Tarea 5.
  - **Errores:**
    - el error de ejecución del programa termina la prueba con `fin = { motivo: 'error', detalle: error.mensaje }`;
    - una excepción de `recompensa`, o una recompensa que no es un número finito, se lanza como `ErrorSimulador('la recompensa del profe', causa)`, salvo `FaltaImplementar`, que se relanza tal cual.

- [ ] **Step 1: Escribir las pruebas que fallan** en `tests/integracion/prueba-ajuste.test.ts`. Compila una vez el seguidor del ejemplo (con sus marcas) y una pista recta corta de `pistaDe`:
  - `el registro tiene un paso cada 10 ms con estado, lecturas, motores y eventos`: con 2 s, unos 200 pasos; `fin.motivo === 'tiempo'`.
  - `los valores cambian la prueba y la misma semilla la repite`:
    - `KP` 0 y `KP` 0.05 dan trayectorias distintas;
    - los mismos valores y la misma semilla dan un resultado idéntico.
  - `debeTerminar corta la prueba con su motivo`: un `debeTerminar` que corta en `t ≥ 0.5` da `fin = { motivo: 'termino', detalle: … }` y `t ≈ 0.5`.
  - `la trayectoria tiene a lo más 200 puntos`: con 30 s.
  - `un error del programa termina la prueba y la recompensa igual se calcula`: un sketch que divide por cero da `motivo: 'error'`, y la recompensa de prueba se llama.
  - `si la recompensa del profe falta, se relanza FaltaImplementar`: con `src/ajuste/recompensa.js` tal como queda.

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/integracion/prueba-ajuste.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** `src/ajuste/prueba.ts`. Para que la prueba sea reproducible, el registro mide las lecturas con su propio azar, `crearAzar(semilla ^ 0x5bd1e995)`, como la vista.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/integracion/prueba-ajuste.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ajuste/prueba.ts tests/integracion/prueba-ajuste.test.ts
git commit -m "Una prueba de entrenamiento: registro, debeTerminar, recompensa y trayectoria"
```

---

### Task 5: El pool de workers y el bucle de entrenamiento

**Files:**
- Create: `src/ajuste/trabajador.ts`, `src/ajuste/pool.ts`, `src/ajuste/entrenamiento.ts`
- Test: `tests/unidad/pool-ajuste.test.ts`, `tests/unidad/entrenamiento.test.ts`

**Interfaces:**
- Consumes: `ejecutarPruebaDeAjuste` y `registroDeCicloSinFin` (Tarea 4); `FaltaImplementar` y `esFaltaImplementar` (Tarea 3); `calcularRecompensa` de `recompensa.js` en el hilo principal (decisión 7).
- Produces:
  - **Worker (`trabajador.ts`):**
    - recibe `{ tipo: 'iniciar', modulo, pista, robot, duracionS, latidos: SharedArrayBuffer, indice }` y después `{ tipo: 'probar', id, valores, semilla }`;
    - responde `{ tipo: 'resultado', id, resultado: ResultadoPrueba }` o `{ tipo: 'error', id, error: { nombre: string; mensaje: string; tecnico: string } }`;
    - cada paso de física suma 1 en `latidos[indice]`.
  - **`interface PoolPruebas`:** `{ readonly tamano: number; probar(valores, semilla): Promise<ResultadoPrueba>; cerrar(): void }`.
  - **`crearPool(o: { modulo; pista; robot; duracionS; tamano; crearTrabajador: () => Worker; recompensaPrincipal: ModuloRecompensa['calcularRecompensa']; esperaCicloSinFinMs?: number /* 2000 */ }): PoolPruebas`:**
    - cada worker libre toma la próxima prueba pendiente;
    - un worker sin latidos durante `esperaCicloSinFinMs` se termina y se reemplaza (decisión 7);
    - un `{ tipo: 'error' }` rechaza la promesa con un `Error` del mismo `name` y mensaje;
    - `cerrar()` termina todos los workers y rechaza lo pendiente con `name === 'Cancelado'`.
  - **`acotarPropuesta(valores: Record<string, number>, parametros: ParametroAgente[]): Record<string, number>`:** decisión 5.
  - **`entrenar(o: { crearAgente: CrearAgente; parametros: ParametroAgente[]; presupuesto: number; pool: PoolPruebas; semilla(): number; senal: AbortSignal; alResultado(r: ResultadoPrueba & { indice: number; record: boolean }): void }): Promise<FinEntrenamiento>`:**
    - `FinEntrenamiento = { motivo: 'completo' | 'detenido' | 'error'; error?: { mensaje: string; tecnico: string; faltaImplementar: boolean }; mejor: (ResultadoPrueba & { indice: number }) | null }`;
    - mantiene `pool.tamano` pruebas en curso;
    - `indice` empieza en 1 y sigue el orden de llegada;
    - aplica la decisión 8 y cierra el pool al terminar.

- [ ] **Step 1: Escribir las pruebas que fallan.**
  - **`tests/unidad/entrenamiento.test.ts`** (pool falso con promesas controladas y agente falso):
    - `respeta el presupuesto y la cantidad de pruebas a la vez`: con presupuesto 7 y tamaño 3, nunca más de 3 a la vez, 7 resultados, `motivo: 'completo'`.
    - `el agente aprende cada resultado y se marca el récord`: con recompensas 5, 3, 8, el récord está en las pruebas 1 y 3, y `mejor.indice === 3`.
    - `acotarPropuesta sanea lo que propone el agente`: `{ a: NaN, b: 99, c: 1 }`, con `a` y `b` de rango `[0, 10]` y valor 4, da `{ a: 4, b: 10 }`.
    - `un agente que falta detiene el entrenamiento con faltaImplementar`: el `crearAgente` real de `src/ajuste/agente.js` da `motivo: 'error'`, `faltaImplementar: true`, y el pool cerrado.
    - `una excepción del agente o una recompensa que falta lo detienen`: `proponer` que lanza, y un pool que rechaza con `name: 'FaltaImplementar'`.
    - `detener con la señal cierra el pool y da 'detenido'`.
  - **`tests/unidad/pool-ajuste.test.ts`** (`TrabajadorFalso` como `cliente-simulacion.test.ts` y temporizadores falsos):
    - `cada worker recibe el módulo una vez y las pruebas se reparten`.
    - `un worker sin latidos se reemplaza y la prueba da ciclo-sin-fin`: después de 2 s sin cambiar `latidos[i]`:
      - el worker está `terminado`;
      - hay uno nuevo, iniciado;
      - la promesa resuelve con `resumen.motivo === 'ciclo-sin-fin'` y la recompensa que dio `recompensaPrincipal`.
    - `cerrar termina todos los workers y cancela lo pendiente`.

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/unidad/entrenamiento.test.ts tests/unidad/pool-ajuste.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** los tres archivos. El pool revisa los latidos con un `setInterval` de 500 ms.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/unidad/entrenamiento.test.ts tests/unidad/pool-ajuste.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ajuste tests/unidad/entrenamiento.test.ts tests/unidad/pool-ajuste.test.ts
git commit -m "Pool de workers con aviso de ciclo sin fin, y el bucle de entrenamiento con el agente del profe"
```

---

### Task 6: La ventana "Ajustar parámetros": qué ajustar y la configuración

**Files:**
- Create: `src/ajuste/parametros.ts`, `src/ui/ajustar.ts`
- Modify:
  - `index.html` (el `<dialog id="ventana-ajuste">` de la maqueta; `btn-ajustar` habilitado);
  - `src/ui/aplicacion.ts`, `src/ui/tema.css`.
- Test: `tests/unidad/parametros-ajuste.test.ts`, `tests/e2e/ajustar.spec.ts`

**Interfaces:**
- Consumes: `buscarAjustables` (Tarea 1); `ParametroAgente` (Tarea 3).
- Produces:
  - **`parametros.ts`** (sin DOM):
    - `GRUPOS: { id: string; nombre: string; sensor: string }[]` (Global Constraints);
    - `ayudaDe(nombre: string): string`, sin distinguir mayúsculas;
    - `rangoPorDefecto(a: Ajustable): [number, number]` (decisión 4);
    - `interface EleccionParametro { id: string; ajustar: boolean; min: number; max: number }`;
    - `elecciones(parametros: Ajustable[], previas: EleccionParametro[]): EleccionParametro[]`: conserva lo que eligió el estudiante para los ids que siguen;
    - `paraElAgente(parametros: Ajustable[], elecciones: EleccionParametro[]): { ok: true; parametros: ParametroAgente[] } | { ok: false; problema: string }`.
  - **Problemas de `paraElAgente`:**
    - "Tu código no tiene valores marcados con @ajustar.";
    - "Elige al menos un valor para ajustar.";
    - "El rango de {nombre} no sirve: el mínimo debe ser menor que el máximo.".
  - **`crearVentanaAjuste(raiz: Document, eventos: VentanaAjusteEventos): { abrir(): void }`.** `VentanaAjusteEventos` es `{ proyecto(): Proyecto; nombrePista(): string; entrenar(o: { parametros: ParametroAgente[]; presupuesto: number; duracionS: number; robots: number }): void; detener(): void; alVer(m: ResultadoPrueba): void; alUsar(m: ResultadoPrueba): void }`. La Tarea 7 completa `entrenar`.
    - **"¿Qué quieres ajustar?" (`aj-pids`):**
      - una tarjeta por grupo de `GRUPOS`, más los grupos propios;
      - cada parámetro trae su interruptor (etiquetado con su nombre), el valor del código, la ayuda y "Buscar de [min] a [max]";
      - los grupos sin marcas muestran cómo marcarlos;
      - los avisos de `buscarAjustables` se muestran arriba.
    - **"Entrenamiento":** `aj-pruebas`, `aj-duracion`, `aj-robots` y "Pista: {nombre}" (decisión 9).
    - **Al abrir:** relee el proyecto.
    - **"Empezar a entrenar":** si `paraElAgente` no está ok, muestra el problema en `aj-error` (`role="alert"`) y no empieza.
    - **Cerrar:** "Volver a mi programa" (`aj-cerrar`) y `Esc` cierran (decisión 10).

- [ ] **Step 1: Escribir las pruebas que fallan.**
  - **`tests/unidad/parametros-ajuste.test.ts`:**
    - `rangoPorDefecto` con 0.08, −2, 0 y el rango de la marca;
    - `ayudaDe('KP')`;
    - `elecciones conserva lo elegido para los ids que siguen y agrega los nuevos encendidos`;
    - `paraElAgente`: sus 3 problemas, y un ok que solo trae los encendidos, con `valor`, `min` y `max`.
  - **`tests/e2e/ajustar.spec.ts`:**
    - `Ajustar parámetros muestra los valores marcados del ejemplo`:
      - el grupo Siguelíneas trae `VELOCIDAD` (100, de 50 a 200) y `KP` (0,025, de 0 a 0,1), con su ayuda;
      - Giroscopio muestra "Todavía no está en tu código";
      - "Pista: Práctica".
    - `sin valores elegidos no se puede empezar`: con los dos interruptores apagados, "Empezar a entrenar" muestra "Elige al menos un valor para ajustar.".
    - `un rango al revés no deja empezar`.
    - `un constexpr marcado muestra su aviso` (con `__pruebas.abrirProyecto`).
    - `Esc y "Volver a mi programa" cierran la ventana y el foco vuelve al botón`.

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/unidad/parametros-ajuste.test.ts; npx playwright test tests/e2e/ajustar.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** `parametros.ts`, `ajustar.ts` y la ventana en `index.html`. Se construye con `createElement` y `textContent`, nunca con `innerHTML`. Los ids de los controles salen del índice del parámetro (`aj-p3`, `aj-p3-min`), no de su nombre.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/unidad/parametros-ajuste.test.ts && npx playwright test tests/e2e/ajustar.spec.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html src tests/unidad/parametros-ajuste.test.ts tests/e2e/ajustar.spec.ts
git commit -m "Ventana Ajustar parámetros: qué ajustar, rangos y configuración del entrenamiento"
```

---

### Task 7: Entrenar desde la ventana: progreso, gráfico y mejor resultado

**Files:**
- Create: `src/ui/grafico.ts`
- Modify: `src/ui/ajustar.ts`, `src/ui/aplicacion.ts`, `src/ui/dibujo.ts` (trayectoria en el mini lienzo)
- Test: `tests/unidad/grafico.test.ts`, `tests/e2e/entrenar.spec.ts`, `tests/e2e/ayuda/ajuste.ts`

**Interfaces:**
- Consumes:
  - `crearPool` y `entrenar` (Tarea 5);
  - `crearAgente` de `src/ajuste/agente.js`, y `calcularRecompensa` de `recompensa.js` para el pool;
  - el compilador de la app (`ClienteCompilador`).
- Produces:
  - **`grafico.ts`** (sin DOM): `escalaY(min: number, max: number): { desde: number; hasta: number; marcas: number[] }`.
    - Da 4–6 marcas "redondas" que contienen el rango.
    - Funciona con recompensas negativas, todas iguales o enormes, porque la recompensa es del profe y no hay que suponer una escala.
    - `geometria(o: { ancho: number; alto: number; total: number; puntos: { i: number; r: number }[] }): { x(i): number; y(r): number; escala; camino: string; records: number[] }`: `camino` es la línea "mejor hasta ahora" en escalera, como la maqueta.
  - **La ventana:**
    - "Empezar a entrenar" compila el proyecto actual. Si no compila: "Tu programa tiene errores: pruébalo con «Probar mi robot» para verlos.".
    - Después crea el pool con la pista y el robot editados y llama a `entrenar`.
    - El botón pasa a "Detener entrenamiento".
    - El chip dice "Sin empezar", "Practicando…" o "Terminado" (o "Detenido").
    - La barra y "Prueba n de N".
    - El gráfico SVG con leyenda, y el tooltip "Prueba n · recompensa r" con los valores de esa prueba (con `textContent`).
    - **"Mejor resultado"** (decisión 14):
      - la recompensa y "Recompensa de la prueba n";
      - la tabla "Valor | Ahora | Mejor";
      - el mini lienzo `aj-mini` con la pista y la trayectoria de la mejor, en amarillo;
      - "Ver esta prueba en la pista" y "Usar estos valores", habilitados al haber un mejor y no estar entrenando.
    - **Errores (decisión 8):** se muestran en `aj-error`, y el error del profe trae "Ver detalle técnico".
  - **Workers del entrenamiento:** se crean con la misma fábrica que cuenta los vivos (`__pruebas.trabajadoresVivos`).
  - **`tests/e2e/ayuda/ajuste.ts`:** `usarAjusteDePrueba(page)` reemplaza, con `page.route`, las respuestas de `**/src/ajuste/agente.js*` y `**/src/ajuste/recompensa.js*` por versiones de prueba en JS:
    - un agente que recorre el rango;
    - la recompensa `juez.puntaje + x/1000`.

    Si `page.route` no alcanza los pedidos del worker, se usa un alias de Vite activado por una variable de entorno del `webServer` de Playwright, con ruling.

- [ ] **Step 1: Escribir las pruebas que fallan.**
  - **`tests/unidad/grafico.test.ts`:**
    - `escalaY(0, 1000)` incluye 0 y 1000 con marcas cada 250;
    - `escalaY(-35, 12)` contiene el rango;
    - `escalaY(5, 5)` no divide por cero;
    - `geometria` pone la prueba 1 en el borde izquierdo y la última en el derecho;
    - el camino sube solo en los récords.
  - **`tests/e2e/entrenar.spec.ts`:**
    - `sin el agente del profe, Empezar explica qué falta y no deja workers` (sin reemplazos):
      - `aj-error` dice "Para entrenar falta que tu profe programe el agente (src/ajuste/agente.js).";
      - `trabajadoresVivos() === 0`;
      - "Probar mi robot" sigue funcionando.
    - `con 10 pruebas, el gráfico y el mejor resultado se llenan` (con `usarAjusteDePrueba`):
      - "Prueba 10 de 10" y "Terminado";
      - 10 puntos `.g-punto`;
      - el mejor resultado tiene una recompensa;
      - los botones del mejor quedan habilitados;
      - `trabajadoresVivos() === 0` al terminar.
    - `Detener entrenamiento cierra los workers`.
    - `un programa que se cuelga no detiene el entrenamiento`:
      - un proyecto con `while (true) {}` en `loop()`, con 2 pruebas;
      - se termina con "Prueba 2 de 2";
      - no quedan workers vivos.

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/unidad/grafico.test.ts; npx playwright test tests/e2e/entrenar.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** `grafico.ts`, el entrenamiento en la ventana y la conexión en `aplicacion.ts`.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/unidad/grafico.test.ts && npx playwright test tests/e2e/entrenar.spec.ts tests/e2e/ajustar.spec.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src tests/unidad/grafico.test.ts tests/e2e/entrenar.spec.ts tests/e2e/ayuda/ajuste.ts
git commit -m "Entrenar desde la ventana: pool de workers, gráfico de recompensa y mejor resultado"
```

---

### Task 8: "Ver esta prueba en la pista", "Usar estos valores" y documentación

**Files:**
- Modify:
  - `src/ui/editor.ts` (`cambiarLineas` y `resaltarLineas`);
  - `src/ui/programa.ts` (`aplicarAjustes`);
  - `src/ui/aplicacion.ts`, `src/ui/ajustar.ts`, `src/ui/tema.css`;
  - `README.md`, la spec.
- Test: `tests/e2e/usar-valores.spec.ts`

**Interfaces:**
- Consumes: `reescribirAjustables` (Tarea 1); `OpcionesInicio.ajustes` (Tarea 2); `alVer` y `alUsar` (Tareas 6 y 7).
- Produces:
  - **`EditorCodigo`:**
    - `cambiarLineas(cambios: { linea: number; texto: string }[]): void`: una transacción, que se deshace con `Ctrl+Z`;
    - `resaltarLineas(lineas: number[]): void`: clase `linea-ajustada`, que se quita al editar.
  - **`PanelPrograma.aplicarAjustes(valores: Record<string, number>): { cambiadas: { archivo: string; linea: number }[]; faltan: string[] }`** (decisión 12):
    - el archivo del primer cambio queda abierto, con `cambiarLineas` y `resaltarLineas`;
    - los otros archivos cambian en el proyecto.
  - **`aplicacion.ts`:**
    - **`alVer`** (decisión 11): `probar({ ajustes: m.valores, semilla: m.semilla, desde: 'partida' })`.
    - **`alUsar`:**
      - cierra la ventana y vuelve a Programar;
      - aplica los valores;
      - muestra el logro "¡Tu robot aprendió! Cambiamos los valores marcados en tu código.";
      - escribe en los mensajes "Usé los valores del entrenamiento: KP = 0,031, VELOCIDAD = 140.";
      - si faltan marcas: "No encontré en tu código: {ids}. Esos valores no cambiaron.".

- [ ] **Step 1: Escribir las pruebas de punta a punta que fallan** en `tests/e2e/usar-valores.spec.ts` (con `usarAjusteDePrueba`):
  - `Usar estos valores reescribe las marcas y se puede deshacer`:
    - entrena 10 pruebas y aprieta "Usar estos valores";
    - el `seguidor.ino` guardado en IndexedDB (como `revision.spec.ts`) tiene el `KP` y la `VELOCIDAD` del mejor, en sus líneas;
    - hay líneas `.linea-ajustada`;
    - aparece el logro;
    - `Ctrl+Z` en el editor vuelve el `KP` original.
  - `una marca que cambió de línea se encuentra igual`: se agrega una línea arriba de `KP` antes de usar; el valor se escribe en la línea nueva.
  - `Ver esta prueba en la pista corre la mejor prueba`: cierra la ventana; el estado es "El robot está corriendo"; el robot se mueve.

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx playwright test tests/e2e/usar-valores.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** lo de arriba.

- [ ] **Step 4: Correr todas las pruebas**

Run: `npm test && npx playwright test && npm run typecheck && npm run build`
Expected: todas pasan; el build genera `dist/` con los workers del entrenamiento.

- [ ] **Step 5: Documentación.**
  - **`README.md`:**
    - estado "fase 6 de 7 — ajustar parámetros";
    - cómo marcar con `@ajustar`;
    - que el agente y la recompensa los programa el profe (enlace a `src/ajuste/README.md`);
    - el enlace al plan.
  - **Spec:**
    - §11.1 a §11.4: las decisiones 1 a 14;
    - §11.3: sin placeholders (cambio pedido por el usuario);
    - §15: quitar "placeholders del agente y la recompensa" de las pruebas de unidad;
    - §20: "Confirmado por el usuario (2026-10-22): el profe programa el agente y la recompensa; el proyecto deja sus archivos con el contrato, sin rellenar."

- [ ] **Step 6: Commit**

```bash
git add src tests/e2e/usar-valores.spec.ts README.md docs/superpowers/specs/2026-10-17-simulador-dynamis-design.md
git commit -m "Ver la mejor prueba y usar sus valores en el código; documentación de la fase 6"
```
