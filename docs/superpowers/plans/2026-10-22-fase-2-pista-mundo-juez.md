# Fase 2 — Pista, mundo y juez: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una pista FIRVI descrita en JSON se convierta en el `Mundo` que usan los modelos (color del suelo, relieve, objetos y rayos) y que un juez virtual puntúe cada ejecución como lo dicen las bases, todo probado en Node.

**Architecture:**
- **`src/pista`:** el modelo de la pista (tipos, lectura y escritura del JSON, transformaciones de baldosa), el **catálogo** de piezas como listas de figuras (rectángulos y arcos de cinta, marcas de color) y la revisión de las reglas de las bases (avisos).
- **`src/mundo`:** arma el `Mundo` de la fase 1 a partir de una pista:
  - `superficie.ts`: color y "¿hay cinta aquí?", evaluando las mismas figuras del catálogo;
  - `relieve.ts`: altura e inclinación analíticas (niveles, rampas y baches);
  - `objetos.ts`: colisiones, objetos cercanos y `raycast` 3D;
  - `pista.ts`: `crearMundo`.
- **`src/juez`:** el juez virtual como lógica pura. Recibe la pose del robot en cada paso de física y lleva hitos, meta, tiempo, reinicios, eventos y puntaje.
- **`src/simulacion/simulador.ts`:** gana el gancho `alPasoFisica`, para que el juez vea cada paso aunque el programa esté dentro de un `delay` largo.

**Tech Stack:** Node 22, TypeScript (strict), Vitest. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-10-17-simulador-dynamis-design.md`. Esta fase cubre §9 (primitivas del mundo), §10.1–10.4 (escenario, modelo JSON, catálogo, relieve, superficie y validaciones) y §10.6 (juez virtual como lógica pura). No incluye nada de UI: el dibujo en pantalla, el editor (§10.5) y la tarjeta del juez van en las fases 4 y 5. Las pistas de ejemplo y el ajuste automático del `nivel` al colocar una rampa (§10.4, es del editor) van en la fase 5.

**Decisiones que toma este plan** (la Tarea 9 las lleva a la spec):
1. **La superficie se evalúa como figuras, no como raster.** La spec pedía dibujar un `OffscreenCanvas` a 1 px = 1 mm. Este plan cumple su intención ("lo que se ve es lo que siente el robot") con una lista de figuras por pieza: la pantalla las dibujará en la fase 4 y `muestrear` las evalúa directamente. Así funciona en Node, en el worker y en el pool de entrenamiento, sin 17 MB de raster por worker y con bordes exactos.
2. **Ángulos del JSON en grados** (`rot`, `inicio.yaw`, `hito.yaw`, `rampa.angulo`, `bache.rot`); dentro del simulador, radianes. `r` cuenta las filas desde abajo (`y = r · 300`). `tamanoBaldosa` es siempre 300.
3. **Inclinación con la regla de la mano derecha (REP-103):** `pitch < 0` cuando la nariz sube y `roll > 0` cuando el lado izquierdo queda más alto.
4. **Unión en T con `rama: 'izq' | 'der'`** (por defecto `'izq'`). La rotación no puede reflejar una pieza, y sin esta propiedad no habría T con la rama a la derecha de la flecha.
5. **Indicador F2:** L1 es una barra de 120 mm que cruza la línea. Cada decisión es una barra de 60 mm hacia el lado del giro, separadas 60 mm. Caben hasta 3 decisiones.
6. **El juez evalúa las decisiones** (cruce, T y F1) solo cuando el robot entra por la flecha de la baldosa (borde oeste local), que es como están definidas las marcas.
7. **El juez evalúa cada 10 ms de tiempo virtual** (configurable).
8. **Puntos de desafío (F) y punto de partida elegible** (lo pidió el usuario el 2026-10-22):
   - en la pista se marca dónde está cada F con el objeto `desafio`, con su nombre (`F1`, `F2`, `F3`, `F4`…), una pose y el número del hito que viene después;
   - una prueba puede empezar desde la partida, un hito o una F; lo anterior no suma y no hay puntaje de tiempo;
   - durante la prueba, saltar una F que no se logra completar es un reinicio de las bases: −10, máximo 3, sin puntaje de tiempo.

## Global Constraints

- **Español:** nombres de archivos, tipos, funciones y mensajes van en español; los mensajes para estudiantes, tuteando y sin jerga.
- **Unidades:** mm, s y rad dentro del código; grados solo en el JSON (decisión 2).
- **Marco del mundo:** origen en la esquina inferior izquierda; `x` derecha, `y` arriba, `z` arriba; `yaw` antihorario desde +x. **Marco del robot:** `x` adelante, `y` izquierda (REP-103).
- **Marco local de una baldosa:** `u` de 0 a 300 desde el borde de entrada (oeste) hacia el este, y `v` de 0 a 300 hacia el norte, que es la izquierda de la flecha. `rot` gira la pieza en sentido antihorario alrededor del centro de la baldosa.
- **Medidas fijas** (`src/pista/tipos.ts`): `TAMANO_BALDOSA = 300`, `ANCHO_CINTA = 19` y línea centrada en `v = 150`, es decir, en `v ∈ [140.5, 159.5)`.
- **Colores** (`src/pista/tipos.ts`): fondo `#FFFFFF`, cinta `#000000` y marca `#00A651` por defecto. En una baldosa `invertida` se intercambian fondo y cinta; las marcas conservan su color.
- **El contrato `Mundo` de `src/mundo/tipos.ts` no cambia:** los modelos del profesor no se tocan.
- **Determinismo:** nada usa `Math.random()`.
- **Sin `−0`:** las funciones devuelven `0`, nunca `−0` (por ejemplo, `−atan(0)` o `−dx` con `dx = 0`), porque las pruebas comparan con `toEqual`.
- **Puntajes de las bases:**
  - hitos 1–8: `[5, 10, 20, 20, 10, 15, 15, 20]`;
  - meta: 15;
  - tiempo: `(300 − t)/4`;
  - reinicios: máximo 3, −10 cada uno;
  - tamaño: −20 por cada cm sobre 20 cm en cada medida.

## Review Focus

1. **Piezas rotadas (90°, 180° y 270°):** las marcas, la rama de la T, el lado de F1/F2 y la subida de la rampa tienen que girar con la baldosa, y "izquierda" sigue siendo la de la flecha. Pruebas en las Tareas 2, 3 y 4.
2. **Bordes y fuera de la grilla:**
   - un punto justo en `x = 300` pertenece a la baldosa `c = 1`;
   - fuera de la grilla, `muestrear`, `altura` e `inclinacion` dan fondo blanco, 0 y plano, sin lanzar errores.
   
   Pruebas en las Tareas 2 y 4.
3. **Baldosas invertidas:** la cinta blanca sobre fondo negro sigue contando como línea para el juez, y las marcas conservan su color. Pruebas en las Tareas 2 y 3.
4. **Reinicios:**
   - el reloj del juez sigue sumando aunque el simulador nuevo parta de `tUs = 0`;
   - saltar (a un hito o a una F) exige haber intentado el hito pendiente, se permiten máximo 3 reinicios, y cualquier salto anula el puntaje de tiempo;
   - una prueba que empieza en una F o un hito marca lo anterior como saltado.
   
   Prueba en la Tarea 7.
5. **Rayos raros:** dirección `(0,0,0)`, componentes en cero, origen dentro de un obstáculo o bajo el suelo, y el límite `max`. Deben dar `null` o distancia 0, nunca `NaN`. Prueba en la Tarea 5.

---

### Task 1: Modelo de pista y JSON

**Files:**
- Create: `src/pista/tipos.ts`, `src/pista/serializacion.ts`, `src/pista/puntos.ts`, `tests/ayuda/pistas.ts`
- Test: `tests/unidad/pista-serializacion.test.ts`

**Interfaces:**
- Consumes: `Pose` de `src/simulacion/simulador.ts`.
- Produces (en `src/pista/tipos.ts`):

```ts
export const TAMANO_BALDOSA = 300;
export const ANCHO_CINTA = 19;
export const COLOR_FONDO = '#FFFFFF', COLOR_CINTA = '#000000', COLOR_MARCA = '#00A651';
export type Luz = 'normal' | 'fuerte' | 'tenue';
export type Rotacion = 0 | 90 | 180 | 270;
export type Lado = 'oeste' | 'este' | 'norte' | 'sur';
export type Accion = 'izq' | 'der' | 'recto' | 'vuelta';
export type Marcas = { ai: boolean; ad: boolean; di: boolean; dd: boolean };
type Base<T extends string, P> = { c: number; r: number; rot: Rotacion; nivel: number; tipo: T; props: { invertida: boolean } & P };
export type Baldosa =
  | Base<'vacia' | 'recta' | 'giroSuave' | 'giroL' | 'partida' | 'meta', {}>
  | Base<'cortes', { guion: number; espacio: number }>
  | Base<'cruce', { marcas: Marcas; colorMarca?: string; accion?: Accion }>
  | Base<'unionT', { marcas: Marcas; colorMarca?: string; accion?: Accion; rama: 'izq' | 'der' }>
  | Base<'rampa', { angulo: number }>
  | Base<'indicadorF2', { decisiones: ('izq' | 'der')[] }>
  | Base<'cuadradoF1', { correcto: 'izq' | 'der' }>;
export type TipoBaldosa = Baldosa['tipo'];
// Alias de tipo (no interfaces) para que sean asignables al ObjetoPista genérico de src/mundo/tipos.ts.
export type Obstaculo = { tipo: 'obstaculo'; x: number; y: number; rot: number; props: { ancho: number; largo: number; alto: number } };
export type Bache = { tipo: 'bache'; x: number; y: number; rot: number; props: { largo: number; radio: number } };
export type Hito = { tipo: 'hito'; x: number; y: number; rot: number; props: { numero: number; yaw: number } };
/** Dónde empieza un desafío (F1, F2, F4…): punto de partida elegible. hitoSiguiente: el hito que viene después (n + 1 = la meta). */
export type Desafio = { tipo: 'desafio'; x: number; y: number; rot: number; props: { nombre: string; yaw: number; hitoSiguiente: number } };
export type ObjetoDePista = Obstaculo | Bache | Hito | Desafio;
export interface Pista {
  version: 1; nombre: string; tamanoBaldosa: 300; columnas: number; filas: number;
  ambiente: { luz: Luz }; colorMarcas?: string;
  baldosas: Baldosa[]; objetos: ObjetoDePista[]; inicio: { x: number; y: number; yaw: number };
}
```

- Produces (en `src/pista/serializacion.ts`):
  - `type ResultadoLectura = { ok: true; pista: Pista } | { ok: false; errores: string[] }`;
  - `normalizarPista(datos: unknown): ResultadoLectura`, que valida y completa los valores por defecto;
  - `leerPista(texto: string): ResultadoLectura`;
  - `escribirPista(p: Pista): string`, que es `JSON.stringify(p, null, 2)`;
  - `pistaVacia(columnas = 8, filas = 6): Pista`;
  - `poseInicial(p: Pista): Pose`, que convierte `yaw` a radianes.
- Produces (en `src/pista/puntos.ts`):
  - `interface PuntoDePartida { id: string; nombre: string; pose: Pose; hitoSiguiente: number }`;
  - `puntosDePartida(p: Pista): PuntoDePartida[]`, en el orden del recorrido:
    - primero `{ id: 'partida', nombre: 'Partida', hitoSiguiente: 1 }`;
    - después los hitos (`'hito-{n}'`, `'Hito {n}'`, `hitoSiguiente: n + 1`) y los desafíos (`'desafio-{nombre}'`, `'{nombre}'`), ordenados por `hitoSiguiente`;
    - con el mismo `hitoSiguiente`, el hito va antes que los desafíos, y los desafíos se ordenan por nombre;
    - la pose usa `yaw` en radianes.
- Produces (en `tests/ayuda/pistas.ts`): `pistaDe(datos: Record<string, unknown>): Pista`. Completa `version: 1`, `nombre: 'prueba'`, `tamanoBaldosa: 300`, `ambiente`, `baldosas: []`, `objetos: []` e `inicio: { x: 150, y: 150, yaw: 0 }` si faltan, llama a `normalizarPista` y lanza un `Error` con los errores unidos si falla.

**Valores por defecto** que completa `normalizarPista`:

| Dónde | Valor por defecto |
|---|---|
| baldosa | `nivel: 0`, `rot: 0`, `props.invertida: false` |
| `cortes` | `guion: 50`, `espacio: 40` |
| `cruce` y `unionT` | `marcas` en `false` (sin `accion`: se deduce) |
| `unionT` | `rama: 'izq'` |
| `rampa` | `angulo: 20` |
| `indicadorF2` | `decisiones: ['izq']` |
| `cuadradoF1` | `correcto: 'izq'` |
| `obstaculo` | `100 × 100 × 100` |
| `bache` | `largo: 300`, `radio: 6` |
| `hito` | `yaw: 0` (`numero` es obligatorio) |
| `desafio` | `yaw: 0` (`nombre` y `hitoSiguiente` son obligatorios) |
| pista | `ambiente: { luz: 'normal' }`, `objetos: []` |

- [ ] **Step 1: Escribir las pruebas que fallan** en `tests/unidad/pista-serializacion.test.ts`:

```ts
it('completa los valores por defecto', () => {
  const r = normalizarPista({ version: 1, nombre: 'a', tamanoBaldosa: 300, columnas: 2, filas: 1, inicio: { x: 150, y: 150, yaw: 0 },
    baldosas: [{ c: 0, r: 0, tipo: 'cortes' }, { c: 1, r: 0, tipo: 'unionT', rot: 90 }], objetos: [{ tipo: 'hito', x: 1, y: 2, rot: 0, props: { numero: 1 } }] });
  expect(r.ok && r.pista.baldosas).toEqual([
    { c: 0, r: 0, rot: 0, nivel: 0, tipo: 'cortes', props: { invertida: false, guion: 50, espacio: 40 } },
    { c: 1, r: 0, rot: 90, nivel: 0, tipo: 'unionT', props: { invertida: false, marcas: { ai: false, ad: false, di: false, dd: false }, rama: 'izq' } }]);
  expect(r.ok && r.pista.ambiente).toEqual({ luz: 'normal' });
  expect(r.ok && r.pista.objetos[0]).toEqual({ tipo: 'hito', x: 1, y: 2, rot: 0, props: { numero: 1, yaw: 0 } });
});
it('ida y vuelta por JSON deja la pista igual', () => { const p = pistaDe({ columnas: 3, filas: 2, baldosas: [{ c: 2, r: 1, tipo: 'rampa', props: { angulo: 25 } }] });
  expect(leerPista(escribirPista(p))).toEqual({ ok: true, pista: p }); });
it('pistaVacia es de 8 × 6 y poseInicial pasa a radianes', () => {
  expect(pistaVacia()).toMatchObject({ columnas: 8, filas: 6, baldosas: [], objetos: [] });
  expect(poseInicial(pistaDe({ columnas: 1, filas: 1, inicio: { x: 10, y: 20, yaw: 90 } }))).toEqual({ x: 10, y: 20, yaw: Math.PI / 2 }); });
it('informa todos los problemas sin lanzar', () => {
  expect(leerPista('{nope')).toEqual({ ok: false, errores: ['El archivo no es una pista válida (no es JSON).'] });
  const r = normalizarPista({ version: 1, nombre: 'a', tamanoBaldosa: 250, filas: 1, inicio: { x: 0, y: 0, yaw: 0 }, ambiente: { luz: 'rara' },
    baldosas: [{ c: 0, r: 0, tipo: 'puente' }, { c: 9, r: 0, tipo: 'recta' }, { c: 1, r: 0, tipo: 'recta', rot: 45 }, { c: 1, r: 0, tipo: 'recta' }],
    objetos: [{ tipo: 'pelota', x: 0, y: 0, rot: 0 }, { tipo: 'hito', x: 0, y: 0, rot: 0, props: {} }] });
  expect(r.ok).toBe(false);
  expect(!r.ok && r.errores).toEqual(expect.arrayContaining([
    'Falta "columnas".',
    'Por ahora las baldosas miden 30 cm: tamanoBaldosa debe ser 300.',
    'La luz del ambiente debe ser "normal", "fuerte" o "tenue".',
    'La baldosa en (0, 0) tiene un tipo desconocido: "puente".',
    'La baldosa en (1, 0) tiene rot 45: usa 0, 90, 180 o 270.',
    'Hay dos baldosas en (1, 0).',
    'El objeto 1 tiene un tipo desconocido: "pelota".',
    'El objeto 2 (hito) no tiene número.']));
  expect(normalizarPista({ version: 2 })).toMatchObject({ ok: false, errores: expect.arrayContaining(['Esta pista es de una versión desconocida (version: 2).']) });
  expect(normalizarPista({ version: 1, nombre: 'a', tamanoBaldosa: 300, columnas: 8, filas: 6, inicio: { x: 0, y: 0, yaw: 0 }, baldosas: [{ c: 9, r: 0, tipo: 'recta' }] }))
    .toMatchObject({ ok: false, errores: ['La baldosa en (9, 0) queda fuera de la grilla de 8 × 6.'] });
});
it('los puntos de desafío necesitan nombre y hito siguiente', () => {
  const r = normalizarPista({ version: 1, nombre: 'a', tamanoBaldosa: 300, columnas: 1, filas: 1, inicio: { x: 0, y: 0, yaw: 0 },
    objetos: [{ tipo: 'desafio', x: 600, y: 150, rot: 0, props: { nombre: 'F1', hitoSiguiente: 2 } }, { tipo: 'desafio', x: 0, y: 0, rot: 0, props: {} }] });
  expect(r).toEqual({ ok: false, errores: ['El objeto 2 (desafío) no tiene nombre.', 'El objeto 2 (desafío) no dice cuál es el hito siguiente.'] });
});
it('puntos de partida en el orden del recorrido', () => {
  const p = pistaDe({ columnas: 4, filas: 1, objetos: [
    { tipo: 'hito', x: 750, y: 150, rot: 0, props: { numero: 2 } },
    { tipo: 'desafio', x: 600, y: 150, rot: 0, props: { nombre: 'F1', hitoSiguiente: 2, yaw: 90 } },
    { tipo: 'hito', x: 450, y: 150, rot: 0, props: { numero: 1 } }] });
  expect(puntosDePartida(p).map(q => [q.id, q.nombre, q.hitoSiguiente]))
    .toEqual([['partida', 'Partida', 1], ['hito-1', 'Hito 1', 2], ['desafio-F1', 'F1', 2], ['hito-2', 'Hito 2', 3]]);
  expect(puntosDePartida(p)[2].pose).toEqual({ x: 600, y: 150, yaw: Math.PI / 2 });
});
```

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/unidad/pista-serializacion.test.ts`
Expected: FAIL (no existe `src/pista/serializacion`).

- [ ] **Step 3: Implementar `src/pista/tipos.ts`, `src/pista/serializacion.ts` y `tests/ayuda/pistas.ts`** con las firmas de arriba.
  - `normalizarPista` nunca lanza: junta todos los errores y devuelve `ok: false` si hay alguno.
  - `columnas` y `filas` son enteros ≥ 1.
  - Los objetos se numeran desde 1 en los mensajes.
  - `poseInicial` convierte `yaw` a radianes con `yaw · π / 180`.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/unidad/pista-serializacion.test.ts && npm run typecheck`
Expected: PASS y el typecheck sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/pista tests/ayuda/pistas.ts tests/unidad/pista-serializacion.test.ts
git commit -m "Modelo de pista FIRVI: tipos, JSON y puntos de partida"
```

---

### Task 2: Baldosas, figuras básicas y superficie

**Files:**
- Create: `src/pista/baldosas.ts`, `src/pista/catalogo.ts`, `src/mundo/superficie.ts`
- Test: `tests/unidad/baldosas.test.ts`, `tests/unidad/superficie.test.ts`

**Interfaces:**
- Consumes: `Pista`, `Baldosa`, `Lado` y las constantes de la Tarea 1.
- Produces (en `src/pista/baldosas.ts`):
  - `aLocal(b: { c: number; r: number; rot: Rotacion }, x: number, y: number): { u: number; v: number }`;
  - `aMundo(b, u: number, v: number): { x: number; y: number }`. Usa `cos` y `sin` exactos (0, ±1) para los múltiplos de 90°, sin ruido de punto flotante;
  - `ladoEnMundo(b, lado: Lado): Lado`. Con `rot` 90, `oeste → sur`, `este → norte` y `norte → oeste`;
  - `crearIndice(p: Pista): (c: number, r: number) => Baldosa | null`;
  - `celdaDe(x: number, y: number): { c: number; r: number }`, que usa `Math.floor(x / 300)` y por eso `x = 300` cae en `c = 1`.
- Produces (en `src/pista/catalogo.ts`):
  - `type RolFigura = 'linea' | 'marca'`;
  - `type Figura = { forma: 'rect'; u0; v0; u1; v1; rol; color?: string } | { forma: 'arco'; cu; cv; r0; r1; a0; a1; rol }`, en coordenadas locales. El rectángulo es semiabierto, `[u0, u1) × [v0, v1)`. El arco contiene los puntos con `r0 ≤ d < r1` y `a0 ≤ atan2(v − cv, u − cu) ≤ a1`;
  - `figurasDe(b: Baldosa, colorMarcas?: string): Figura[]`, en orden de pintado;
  - `bocasDe(b: Baldosa): Lado[]` (locales);
  - `BARRA_META = { u0: 140.5, v0: 90, u1: 159.5, v1: 210 }`.
- Produces (en `src/mundo/superficie.ts`): `crearSuperficie(p: Pista): { color(x: number, y: number): { r: number; g: number; b: number }; esLinea(x: number, y: number): boolean }`. Toma la última figura de la baldosa que contiene el punto. Una figura con `rol: 'linea'` toma el color de la cinta de esa baldosa. Si ninguna figura contiene el punto, o la celda está vacía o fuera de la grilla, es fondo (blanco fuera de la grilla). `esLinea` es `true` si esa figura tiene rol `'linea'`.

**Geometría de esta tarea** (local, con la línea en `v ∈ [140.5, 159.5)`):

| Pieza | Figuras | Bocas |
|---|---|---|
| `vacia` | ninguna | — |
| `recta`, `rampa` | rect `u ∈ [0, 300)` | oeste, este |
| `giroSuave` | arco con centro `(0, 300)`, `r ∈ [140.5, 159.5)` y ángulos de −π/2 a 0 | oeste, norte |
| `giroL` | rect `u ∈ [0, 159.5)`, y rect `u ∈ [140.5, 159.5)`, `v ∈ [140.5, 300)` | oeste, norte |
| `cortes` | guiones `u ∈ [k·(guion+espacio), mín(k·(guion+espacio)+guion, 300))` para cada `k` con `k·(guion+espacio) < 300` | oeste, este |
| `partida` | la recta, más una barra `u ∈ [281, 300)`, `v ∈ [90, 210)` | oeste, este |
| `meta` | rect `u ∈ [0, 150)`, más `BARRA_META` | oeste |

- [ ] **Step 1: Escribir las pruebas que fallan.**

`tests/unidad/baldosas.test.ts`:

```ts
it('aMundo y aLocal son inversas y rotan en sentido antihorario', () => {
  expect(aMundo({ c: 1, r: 0, rot: 90 }, 10, 150)).toEqual({ x: 450, y: 10 });
  expect(aMundo({ c: 0, r: 0, rot: 180 }, 10, 150)).toEqual({ x: 290, y: 150 });
  const b = { c: 1, r: 2, rot: 270 as const }, w = aMundo(b, 37, 212);
  expect(aLocal(b, w.x, w.y)).toEqual({ u: 37, v: 212 });
});
it('ladoEnMundo gira los bordes con la pieza', () => {
  expect(['oeste', 'este', 'norte', 'sur'].map(l => ladoEnMundo({ c: 0, r: 0, rot: 90 }, l as Lado))).toEqual(['sur', 'norte', 'oeste', 'este']);
});
it('celdaDe: el borde pertenece a la baldosa siguiente', () => expect(celdaDe(300, 299.9)).toEqual({ c: 1, r: 0 }));
```

`tests/unidad/superficie.test.ts` (con un helper `sup(tipo, props?, rot?)` que arma una pista de 1 × 1 con esa baldosa y devuelve `crearSuperficie(pista)`, y los colores `NEGRO`, `BLANCO`):

```ts
it('recta: cinta de 19 mm centrada', () => {
  const s = sup('recta');
  expect([140, 141, 159, 160].map(v => s.esLinea(150, v))).toEqual([false, true, true, false]);
  expect(s.color(150, 150)).toEqual(NEGRO); expect(s.color(150, 50)).toEqual(BLANCO);
});
it('recta rotada 90° es vertical', () => { const s = sup('recta', {}, 90); expect(s.esLinea(150, 20)).toBe(true); expect(s.esLinea(20, 150)).toBe(false); });
it('giro suave: cuarto de círculo de radio 150 hacia el norte', () => {
  const s = sup('giroSuave');
  expect([[1, 150], [106, 194], [150, 299]].every(([u, v]) => s.esLinea(u, v))).toBe(true);
  expect(s.esLinea(150, 150)).toBe(false); expect(s.esLinea(116, 183)).toBe(false); // radio ≈ 165
});
it('giro en L', () => { const s = sup('giroL'); expect([s.esLinea(75, 150), s.esLinea(150, 225), s.esLinea(225, 150), s.esLinea(150, 75)]).toEqual([true, true, false, false]); });
it('cortes: guiones de 50 y espacios de 40 mm, sin espacio mayor que 4 cm', () => {
  const s = sup('cortes');
  expect([25, 70, 115, 160, 205, 250, 285].map(u => s.esLinea(u, 150))).toEqual([true, false, true, false, true, false, true]);
  let hueco = 0, maximo = 0; for (let u = 0; u < 300; u++) { hueco = s.esLinea(u, 150) ? 0 : hueco + 1; maximo = Math.max(maximo, hueco); }
  expect(maximo).toBe(40);
});
it('partida y meta', () => {
  const p = sup('partida'); expect(p.esLinea(290, 100)).toBe(true);
  const m = sup('meta'); expect([m.esLinea(75, 150), m.esLinea(200, 150), m.esLinea(150, 100)]).toEqual([true, false, true]);
});
it('invertida: cinta blanca sobre fondo negro, y sigue siendo línea', () => {
  const s = sup('recta', { invertida: true });
  expect(s.color(150, 150)).toEqual(BLANCO); expect(s.esLinea(150, 150)).toBe(true); expect(s.color(150, 50)).toEqual(NEGRO);
});
it('fuera de la grilla y celdas sin baldosa: fondo blanco', () => {
  const s = crearSuperficie(pistaDe({ columnas: 2, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'recta' }] }));
  expect([s.color(-5, 150), s.color(450, 150), s.color(700, 150)]).toEqual([BLANCO, BLANCO, BLANCO]);
  expect(s.esLinea(-5, 150)).toBe(false);
});
```

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/unidad/baldosas.test.ts tests/unidad/superficie.test.ts`
Expected: FAIL (no existen los módulos).

- [ ] **Step 3: Implementar `baldosas.ts`, las piezas de la tabla en `catalogo.ts` y `superficie.ts`.**
  - Las piezas de la Tarea 3 todavía devuelven `[]` en `figurasDe`, con su `TODO`.
  - `crearSuperficie` calcula las figuras de cada baldosa una sola vez, al crearse.
  - Para muestrear: busca la celda con `celdaDe`, la baldosa con el índice, pasa el punto con `aLocal` y prueba las figuras.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/unidad/baldosas.test.ts tests/unidad/superficie.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pista/baldosas.ts src/pista/catalogo.ts src/mundo/superficie.ts tests/unidad/baldosas.test.ts tests/unidad/superficie.test.ts
git commit -m "Catálogo de piezas de línea y superficie de la pista"
```

---

### Task 3: Cruces, uniones en T, F1, F2 y marcas de color

**Files:**
- Modify: `src/pista/catalogo.ts`
- Test: `tests/unidad/superficie.test.ts` (agregar), `tests/unidad/catalogo.test.ts`

**Interfaces:**
- Consumes: `figurasDe`, `crearSuperficie`, `aMundo` y `bocasDe` de la Tarea 2.
- Produces: `accionEsperada(b: Baldosa): Accion | null`. Devuelve `null` si `b` no es `cruce` ni `unionT`. Usa `props.accion` si está definida. Si no: `ai` y `ad` dan `'vuelta'`, solo `ai` da `'izq'`, solo `ad` da `'der'`, y ninguna da `'recto'`. Las marcas `di` y `dd` no cuentan.

**Geometría** (local):

| Pieza | Figuras | Bocas |
|---|---|---|
| `cruce` | rect horizontal `u ∈ [0, 300)`; rect vertical `u ∈ [140.5, 159.5)`, `v ∈ [0, 300)`; marcas | las 4 |
| `unionT` | horizontal completa; rama `u ∈ [140.5, 159.5)` con `v ∈ [140.5, 300)` si es `'izq'` o `v ∈ [0, 159.5)` si es `'der'`; marcas | oeste, este, y norte (izq) o sur (der) |
| `indicadorF2` | horizontal completa; L1 `u ∈ [50.5, 69.5)`, `v ∈ [90, 210)`; la decisión `k` (1, 2, 3) centrada en `u = 60 + 60k`, ancho 19, con `v ∈ [150, 210)` si es `'izq'` o `v ∈ [90, 150)` si es `'der'` | oeste, este |
| `cuadradoF1` | entrada `u ∈ [0, 45)`; salida `u ∈ [255, 300)`; lados del cuadrado de 210 mm medido al centro de la cinta (anillo exterior `[35.5, 264.5)²` menos el interior `[54.5, 245.5)²`, como 4 rects) | oeste, este |

**Marcas** de 25 × 25 mm, `rol: 'marca'`, pegadas a la esquina de la intersección:

| Marca | `u` | `v` |
|---|---|---|
| `ai` | `[115.5, 140.5)` | `[159.5, 184.5)` |
| `ad` | `[115.5, 140.5)` | `[115.5, 140.5)` |
| `di` | `[159.5, 184.5)` | `[159.5, 184.5)` |
| `dd` | `[159.5, 184.5)` | `[115.5, 140.5)` |

El color es `props.colorMarca ?? pista.colorMarcas ?? COLOR_MARCA`.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
// superficie.test.ts
const VERDE = { r: 0, g: 166, b: 81 };
it('cruce: las 4 marcas pegadas a la esquina, en su color', () => {
  const s = sup('cruce', { marcas: { ai: true, ad: true, di: true, dd: true } });
  expect([[128, 172], [128, 128], [172, 172], [172, 128]].map(([u, v]) => s.color(u, v))).toEqual([VERDE, VERDE, VERDE, VERDE]);
  expect(s.esLinea(150, 20)).toBe(true); expect(s.esLinea(128, 172)).toBe(false); expect(s.color(100, 200)).toEqual(BLANCO);
});
it('cruce rotado 90°: "antes a la izquierda" queda al suroeste', () => {
  const s = sup('cruce', { marcas: { ai: true, ad: false, di: false, dd: false } }, 90);
  expect(s.color(128, 128)).toEqual(VERDE); expect(s.color(172, 128)).toEqual(BLANCO);
});
it('marcas de otro color, también en una baldosa invertida', () => {
  expect(sup('cruce', { marcas: { ai: true, ad: false, di: false, dd: false }, colorMarca: '#FF0000', invertida: true }).color(128, 172)).toEqual({ r: 255, g: 0, b: 0 });
});
it('unión en T con la rama a la derecha', () => { const s = sup('unionT', { rama: 'der' }); expect(s.esLinea(150, 40)).toBe(true); expect(s.esLinea(150, 260)).toBe(false); });
it('indicador F2: L1 cruza y cada decisión va hacia su lado', () => {
  const s = sup('indicadorF2', { decisiones: ['izq', 'der'] });
  expect([s.esLinea(60, 100), s.esLinea(60, 200), s.esLinea(120, 190), s.esLinea(120, 110), s.esLinea(180, 110), s.esLinea(180, 190)])
    .toEqual([true, true, true, false, true, false]);
});
it('cuadrado F1 de 21 cm con entrada y salida centradas', () => {
  const s = sup('cuadradoF1');
  expect([[20, 150], [150, 255], [150, 45], [45, 100], [280, 150]].every(([u, v]) => s.esLinea(u, v))).toBe(true);
  expect(s.esLinea(150, 150)).toBe(false);
});
// catalogo.test.ts
it.each([
  [{ ai: true, ad: false, di: false, dd: false }, 'izq'], [{ ai: false, ad: true, di: false, dd: false }, 'der'],
  [{ ai: true, ad: true, di: false, dd: false }, 'vuelta'], [{ ai: false, ad: false, di: true, dd: true }, 'recto'],
  [{ ai: true, ad: true, di: true, dd: true }, 'vuelta'],
])('accionEsperada(%o) = %s', (marcas, accion) =>
  expect(accionEsperada(pistaDe({ columnas: 1, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'cruce', props: { marcas } }] }).baldosas[0])).toBe(accion));
it('la acción elegida a mano gana a la deducida', () => expect(accionEsperada(pistaDe({ columnas: 1, filas: 1,
  baldosas: [{ c: 0, r: 0, tipo: 'cruce', props: { marcas: { ai: true, ad: false, di: false, dd: false }, accion: 'recto' } }] }).baldosas[0])).toBe('recto'));
it('las piezas sin decisión no tienen acción', () => expect(accionEsperada(pistaDe({ columnas: 1, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'recta' }] }).baldosas[0])).toBeNull());
it('bocas de la T según la rama', () => expect(bocasDe(pistaDe({ columnas: 1, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'unionT', props: { rama: 'der' } }] }).baldosas[0]))
  .toEqual(['oeste', 'este', 'sur']));
```

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/unidad/superficie.test.ts tests/unidad/catalogo.test.ts`
Expected: FAIL en las piezas nuevas y en `accionEsperada`.

- [ ] **Step 3: Implementar las piezas de la tabla y `accionEsperada`** en `catalogo.ts`. Las marcas se pintan después de las líneas.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/unidad/superficie.test.ts tests/unidad/catalogo.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pista/catalogo.ts tests/unidad/superficie.test.ts tests/unidad/catalogo.test.ts
git commit -m "Cruces y uniones en T con marcas de color, cuadrado F1 e indicador F2"
```

---

### Task 4: Relieve: niveles, rampas y baches

**Files:**
- Create: `src/mundo/relieve.ts`
- Test: `tests/unidad/relieve.test.ts`

**Interfaces:**
- Consumes: `crearIndice`, `celdaDe` y `aLocal` de la Tarea 2.
- Produces:
  - `alturaBaldosa(b: Baldosa, u: number, v: number): number`. Es `b.nivel`, más `u · tan(angulo)` si es una rampa (sube hacia +u local);
  - `crearRelieve(p: Pista): { altura(x: number, y: number): number; gradiente(x: number, y: number): { dx: number; dy: number }; inclinacion(x: number, y: number, yaw: number): { pitch: number; roll: number } }`.
- **altura:**
  - en una celda sin baldosa o fuera de la grilla, es 0;
  - sobre eso se suma cada bache con su perfil de medio cilindro. Con `a` la coordenada a lo largo del eje del bache (que apunta según `rot`) y `d` la coordenada transversal: suma `√(radio² − d²)` si `|a| ≤ largo/2` y `|d| < radio`.
- **gradiente:** diferencia central con δ = 0,5 mm.
- **inclinacion** (algoritmo):

```
sf = dx·cos(yaw) + dy·sin(yaw)         // pendiente hacia adelante
sl = −dx·sin(yaw) + dy·cos(yaw)        // pendiente hacia la izquierda
pitch = −atan(sf)                      // REP-103: nariz arriba ⇒ pitch < 0
roll  = asin(sl / √(1 + sf² + sl²))    // lado izquierdo más alto ⇒ roll > 0
```

- [ ] **Step 1: Escribir las pruebas que fallan** (con `const TAN20 = Math.tan(20 * Math.PI / 180)`):

```ts
const rampa = (rot: number) => crearRelieve(pistaDe({ columnas: 3, filas: 1, baldosas: [{ c: 1, r: 0, tipo: 'rampa', rot, props: { angulo: 20 } }] }));
it('la rampa sube hacia +u local y gira con la baldosa', () => {
  expect(rampa(0).altura(310, 150)).toBeCloseTo(10 * TAN20); expect(rampa(0).altura(590, 150)).toBeCloseTo(290 * TAN20);
  expect(rampa(90).altura(450, 10)).toBeCloseTo(10 * TAN20); expect(rampa(90).altura(450, 290)).toBeCloseTo(290 * TAN20);
  expect(rampa(180).altura(310, 150)).toBeCloseTo(290 * TAN20); expect(rampa(270).altura(450, 290)).toBeCloseTo(10 * TAN20);
});
it('nivel de la baldosa, celdas vacías y fuera de la grilla', () => {
  const r = crearRelieve(pistaDe({ columnas: 2, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'recta', nivel: 109 }] }));
  expect([r.altura(150, 150), r.altura(450, 150), r.altura(-10, 150), r.altura(150, 400)]).toEqual([109, 0, 0, 0]);
  expect(r.inclinacion(-10, 150, 0)).toEqual({ pitch: 0, roll: 0 });
});
it('inclinación en la rampa: de frente, de espaldas y de costado', () => {
  const r = rampa(0);
  expect(r.inclinacion(450, 150, 0).pitch).toBeCloseTo(-20 * Math.PI / 180, 4);
  expect(r.inclinacion(450, 150, Math.PI).pitch).toBeCloseTo(20 * Math.PI / 180, 4);
  const lado = r.inclinacion(450, 150, Math.PI / 2);
  expect(lado.pitch).toBeCloseTo(0, 4); expect(lado.roll).toBeCloseTo(-20 * Math.PI / 180, 4);
});
it('bache: medio cilindro que no cambia el color del suelo', () => {
  const p = pistaDe({ columnas: 3, filas: 1, baldosas: [{ c: 1, r: 0, tipo: 'recta' }], objetos: [{ tipo: 'bache', x: 450, y: 150, rot: 90, props: { largo: 300, radio: 6 } }] });
  const r = crearRelieve(p);
  expect(r.altura(450, 150)).toBeCloseTo(6); expect(r.altura(453, 150)).toBeCloseTo(Math.sqrt(27)); expect(r.altura(456.5, 150)).toBe(0);
  expect(r.altura(450, 299)).toBeCloseTo(6); expect(r.altura(450, 301)).toBe(0);
  expect(crearSuperficie(p).esLinea(450, 150)).toBe(true);
});
```

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/unidad/relieve.test.ts`
Expected: FAIL (no existe `src/mundo/relieve`).

- [ ] **Step 3: Implementar `src/mundo/relieve.ts`** con las firmas y el algoritmo de arriba.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/unidad/relieve.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mundo/relieve.ts tests/unidad/relieve.test.ts
git commit -m "Relieve analítico de la pista: niveles, rampas rotadas y baches"
```

---

### Task 5: Objetos, colisiones, `raycast` y `crearMundo`

**Files:**
- Create: `src/mundo/geometria.ts`, `src/mundo/objetos.ts`, `src/mundo/pista.ts`
- Test: `tests/unidad/objetos.test.ts`

**Interfaces:**
- Consumes: `crearSuperficie`, `crearRelieve`, `crearIndice`, `celdaDe` y `huellaRobot` (de `src/robot/config.ts`).
- Produces (en `src/mundo/geometria.ts`):
  - `penetracion(a: Punto2[], b: Punto2[]): number | null`. Usa SAT entre polígonos convexos; devuelve el traslape mínimo, o `null` si no se tocan. Tocarse en un borde cuenta como traslape 0;
  - `puntoEnPoligono(p: Punto2, pol: Punto2[]): boolean`;
  - `distanciaAPoligono(p: Punto2, pol: Punto2[]): number`, que es 0 si el punto está dentro.
- Produces (en `src/mundo/objetos.ts`): `crearObjetos(p: Pista, relieve): { colisiona; objetosCerca; raycast }`, con las firmas de `Mundo`.
  - El obstáculo es una caja: `largo` a lo largo de `rot`, `ancho` transversal. Se apoya en `relieve.altura` de su centro y mide `alto`.
  - El bache cuenta como el rectángulo `largo × 2·radio`, pero solo en `objetosCerca`.
  - Los hitos y los puntos de desafío no existen para los sensores ni para las colisiones.
- Produces (en `src/mundo/pista.ts`): `interface MundoPista extends Mundo { readonly pista: Pista; esLinea(x: number, y: number): boolean; baldosaEn(x: number, y: number): Baldosa | null }` y `crearMundo(p: Pista): MundoPista`.
- **colisiona:** devuelve el obstáculo con mayor `penetracion` contra el polígono, o `null`.
- **objetosCerca(x, y, radio):** obstáculos y baches cuya huella está a `≤ radio` del punto, del más cercano al más lejano.
- **raycast(origen, dir, max)** (algoritmo):

```
si |dir| = 0 → null; normalizar dir
cajas: test de losas en el marco local de cada caja (ejes con dir = 0 sin dividir por cero);
       el origen dentro de una caja → distancia 0, normal = −dir; si no, la cara de entrada
suelo: s = 0, 2, 4… ≤ max; el primer s con p(s).z ≤ altura(p(s)) → bisección de 12 iteraciones
       entre s − 2 y s; normal = normalizar(−dx, −dy, 1) del gradiente; origen bajo el suelo → 0
devolver el impacto más cercano con distancia ≤ max (objeto = la caja, o null para el suelo)
```

- [ ] **Step 1: Escribir las pruebas que fallan** (`tests/unidad/objetos.test.ts`, con `caja = { tipo: 'obstaculo', x: 500, y: 150, rot: 0 }` en una pista de 4 × 1 con rectas):

```ts
it('raycast contra la cara de una caja', () => {
  const m = crearMundo(pistaDe({ columnas: 4, filas: 1, objetos: [caja] }));
  const h = m.raycast({ x: 0, y: 150, z: 35 }, { x: 1, y: 0, z: 0 }, 2000)!;
  expect(h.distancia).toBeCloseTo(450); expect(h.objeto).toBe(m.pista.objetos[0]); expect(h.normal).toEqual({ x: -1, y: 0, z: 0 });
  expect(m.raycast({ x: 0, y: 150, z: 35 }, { x: 1, y: 0, z: 0 }, 400)).toBeNull();
  expect(m.raycast({ x: 0, y: 150, z: 150 }, { x: 2, y: 0, z: 0 }, 2000)).toBeNull(); // pasa por encima
});
it('raycast contra una caja girada 45°', () => {
  const m = crearMundo(pistaDe({ columnas: 4, filas: 1, objetos: [{ ...caja, rot: 45 }] }));
  const h = m.raycast({ x: 393.934, y: 43.934, z: 50 }, { x: 1, y: 1, z: 0 }, 2000)!;
  expect(h.distancia).toBeCloseTo(100, 1); expect(h.normal.x).toBeCloseTo(-Math.SQRT1_2); expect(h.normal.y).toBeCloseTo(-Math.SQRT1_2);
});
it('raycast ve la subida de la rampa y el suelo', () => {
  const alto = 300 * Math.tan(20 * Math.PI / 180);
  const m = crearMundo(pistaDe({ columnas: 3, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'recta' }, { c: 1, r: 0, tipo: 'rampa' }, { c: 2, r: 0, tipo: 'recta', nivel: alto }] }));
  const h = m.raycast({ x: 0, y: 150, z: 35 }, { x: 1, y: 0, z: 0 }, 2000)!;
  expect(h.distancia).toBeCloseTo(300 + 35 / Math.tan(20 * Math.PI / 180), 0); expect(h.objeto).toBeNull();
  expect(h.normal.x).toBeCloseTo(-Math.sin(20 * Math.PI / 180), 2); expect(h.normal.z).toBeCloseTo(Math.cos(20 * Math.PI / 180), 2);
  expect(m.raycast({ x: 150, y: 150, z: 100 }, { x: 0, y: 0, z: -1 }, 2000)).toMatchObject({ distancia: expect.closeTo(100, 1), normal: { x: 0, y: 0, z: 1 } });
});
it('rayos raros: sin dirección, desde adentro de una caja o bajo el suelo', () => {
  const m = crearMundo(pistaDe({ columnas: 4, filas: 1, objetos: [caja] }));
  expect(m.raycast({ x: 0, y: 150, z: 35 }, { x: 0, y: 0, z: 0 }, 2000)).toBeNull();
  expect(m.raycast({ x: 500, y: 150, z: 50 }, { x: 1, y: 0, z: 0 }, 2000)!.distancia).toBe(0);
  const conRampa = crearMundo(pistaDe({ columnas: 3, filas: 1, baldosas: [{ c: 1, r: 0, tipo: 'rampa' }] }));
  expect(conRampa.raycast({ x: 450, y: 150, z: 10 }, { x: 1, y: 0, z: 0 }, 2000)!.distancia).toBe(0); // el suelo ahí está a 54,6 mm
  const h = m.raycast({ x: 500, y: -500, z: 50 }, { x: 0, y: 1, z: 0 }, 2000)!;
  expect(h.distancia).toBeCloseTo(600); expect(Number.isNaN(h.normal.x)).toBe(false);
});
it('colisiona: huella del robot contra el obstáculo, no contra baches ni hitos', () => {
  const m = crearMundo(pistaDe({ columnas: 4, filas: 1, objetos: [caja, { tipo: 'bache', x: 200, y: 150, rot: 90 }, { tipo: 'hito', x: 900, y: 150, rot: 0, props: { numero: 1 } },
    { tipo: 'desafio', x: 300, y: 150, rot: 0, props: { nombre: 'F1', hitoSiguiente: 1 } }] }));
  expect(m.colisiona(huellaRobot(400, 150, 0, ROBOT_POR_DEFECTO))).toEqual({ objeto: m.pista.objetos[0], penetracion: 46 });
  expect(m.colisiona(huellaRobot(200, 150, 0, ROBOT_POR_DEFECTO))).toBeNull();
  expect(m.colisiona(huellaRobot(900, 150, 0, ROBOT_POR_DEFECTO))).toBeNull();
  expect(m.objetosCerca(300, 150, 210).map(o => o.tipo)).toEqual(['bache', 'obstaculo']);
  expect(m.objetosCerca(300, 150, 100).map(o => o.tipo)).toEqual(['bache']);
});
it('crearMundo reúne superficie, relieve y objetos', () => {
  const m = crearMundo(pistaDe({ columnas: 1, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'recta' }] }));
  expect(m.muestrear(150, 150)).toEqual({ r: 0, g: 0, b: 0 }); expect(m.esLinea(150, 150)).toBe(true);
  expect(m.baldosaEn(150, 150)?.tipo).toBe('recta'); expect(m.baldosaEn(400, 150)).toBeNull(); expect(m.altura(150, 150)).toBe(0);
});
```

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/unidad/objetos.test.ts`
Expected: FAIL (no existen los módulos).

- [ ] **Step 3: Implementar `geometria.ts`, `objetos.ts` y `pista.ts`** con las firmas y el algoritmo de arriba.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/unidad/objetos.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mundo/geometria.ts src/mundo/objetos.ts src/mundo/pista.ts tests/unidad/objetos.test.ts
git commit -m "Mundo de la pista: colisiones, objetos cercanos y raycast 3D"
```

---

### Task 6: Revisión de la pista según las bases

**Files:**
- Create: `src/pista/revision.ts`
- Test: `tests/unidad/revision.test.ts`

**Interfaces:**
- Consumes: `bocasDe`, `ladoEnMundo`, `aMundo`, `crearIndice`, `accionEsperada`, `alturaBaldosa` y `distanciaAPoligono`.
- Produces: `interface AvisoPista { mensaje: string; baldosas?: { c: number; r: number }[]; objeto?: number }` (`objeto` es el índice en `pista.objetos`) y `revisarPista(p: Pista): AvisoPista[]`. Avisa y no bloquea. No repite el mismo aviso para el mismo par de baldosas.

**Avisos** (los centímetros con `(mm / 10).toLocaleString('es-CL', { maximumFractionDigits: 1 })`):

| Caso | Mensaje |
|---|---|
| `cortes` con `espacio > 40` | `Los cortes de esta baldosa miden {cm} cm; las bases permiten hasta 4 cm.` |
| `rampa` con `angulo > 35` | `Esta rampa sube {angulo}°; las bases permiten hasta 35°.` |
| Obstáculo a ≤ 250 mm de un vértice de `giroL` (el punto local `(150, 150)`), medido desde el vértice a la huella del obstáculo | `El obstáculo está a {cm} cm de un giro en L; las bases piden más de 25 cm.` |
| `bache` con `largo > 300` | `Este bache mide {cm} cm; las bases permiten hasta 30 cm.` |
| Hitos ≠ 8 | `La pista tiene {n} hitos; las bases piden 8.` |
| Números de hito que no son 1…n sin repetir | `Los hitos deben estar numerados del 1 al 8, sin repetir.` |
| En un borde donde al menos una baldosa tiene boca, la altura del punto medio difiere en más de 5 mm según la fórmula de cada lado (celda vacía = 0) | `Hay un escalón de {cm} cm entre estas baldosas.` |
| Sin partida | `La pista necesita una baldosa de partida.` |
| Sin meta | `La pista necesita una baldosa de meta.` |
| `inicio` fuera de la baldosa de partida | `El robot debe empezar dentro de la baldosa de partida.` |
| La acción de una `unionT` pide un lado sin rama | `La marca pide girar a la {derecha\|izquierda}, pero esta unión en T no tiene camino a la {derecha\|izquierda}.` |
| Dos desafíos con el mismo nombre | `Hay dos desafíos llamados {nombre}.` |
| `hitoSiguiente` de un desafío fuera de `1…n + 1` | `{nombre} dice que después viene el hito {k}, pero la pista tiene {n} hitos.` |

- [ ] **Step 1: Escribir las pruebas que fallan.** Usan un helper `base(extra)` que arma una pista válida de 4 × 2: partida en (0,0), recta en (1,0), recta en (2,0), meta en (3,0), inicio en (150, 150) y 8 hitos numerados del 1 al 8 en (450, 150). Cada prueba suma `extra` a esa pista.

```ts
const mensajes = (p: Pista) => revisarPista(p).map(a => a.mensaje);
it('una pista correcta no tiene avisos', () => expect(revisarPista(base({}))).toEqual([]));
it('cortes, rampa y bache fuera de las reglas', () => {
  const p = base({ baldosas: [{ c: 1, r: 1, tipo: 'cortes', props: { espacio: 50 } }, { c: 2, r: 1, tipo: 'rampa', props: { angulo: 40 } }],
    objetos: [{ tipo: 'bache', x: 450, y: 450, rot: 0, props: { largo: 350 } }] });
  expect(mensajes(p)).toEqual(expect.arrayContaining(['Los cortes de esta baldosa miden 5 cm; las bases permiten hasta 4 cm.',
    'Esta rampa sube 40°; las bases permiten hasta 35°.', 'Este bache mide 35 cm; las bases permiten hasta 30 cm.']));
  expect(revisarPista(p).find(a => a.mensaje.startsWith('Esta rampa'))!.baldosas).toEqual([{ c: 2, r: 1 }]);
});
it('escalón al final de una rampa, pero no a sus costados', () => {
  const alto = 300 * Math.tan(20 * Math.PI / 180);
  const conRampa = (nivel: number) => base({ baldosas: [{ c: 1, r: 0, tipo: 'rampa' }, { c: 2, r: 0, tipo: 'recta', nivel }, { c: 3, r: 0, tipo: 'meta', nivel }] });
  expect(mensajes(conRampa(0))).toContain('Hay un escalón de 10,9 cm entre estas baldosas.');
  expect(mensajes(conRampa(alto)).filter(m => m.startsWith('Hay un escalón'))).toEqual([]);
});
it('obstáculo cerca de un giro en L', () => {
  const conL = (x: number) => base({ baldosas: [{ c: 1, r: 0, tipo: 'giroL' }], objetos: [{ tipo: 'obstaculo', x, y: 150, rot: 0 }] });
  expect(mensajes(conL(680))).toContain('El obstáculo está a 18 cm de un giro en L; las bases piden más de 25 cm.');
  expect(mensajes(conL(760)).some(m => m.startsWith('El obstáculo'))).toBe(false);
});
it('hitos: cantidad y numeración', () => {
  expect(mensajes(base({ quitarHito: 8 }))).toContain('La pista tiene 7 hitos; las bases piden 8.');
  expect(mensajes(base({ renumerarHito: [8, 7] }))).toContain('Los hitos deben estar numerados del 1 al 8, sin repetir.');
});
it('partida, meta e inicio', () => {
  const p = pistaDe({ columnas: 2, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'recta' }], inicio: { x: 450, y: 150, yaw: 0 } });
  expect(mensajes(p)).toEqual(expect.arrayContaining(['La pista necesita una baldosa de partida.', 'La pista necesita una baldosa de meta.']));
  expect(mensajes(base({ inicio: { x: 450, y: 150, yaw: 0 } }))).toContain('El robot debe empezar dentro de la baldosa de partida.');
});
it('desafíos: nombres repetidos y un hito siguiente que no existe', () => {
  const p = base({ objetos: [{ tipo: 'desafio', x: 600, y: 150, rot: 0, props: { nombre: 'F1', hitoSiguiente: 2 } },
    { tipo: 'desafio', x: 650, y: 150, rot: 0, props: { nombre: 'F1', hitoSiguiente: 10 } }] });
  expect(mensajes(p)).toEqual(expect.arrayContaining(['Hay dos desafíos llamados F1.', 'F1 dice que después viene el hito 10, pero la pista tiene 8 hitos.']));
  expect(mensajes(base({ objetos: [{ tipo: 'desafio', x: 1000, y: 150, rot: 0, props: { nombre: 'F4', hitoSiguiente: 9 } }] }))).toEqual([]);
});
it('unión en T: la marca pide un lado sin camino', () => {
  const p = base({ baldosas: [{ c: 1, r: 0, tipo: 'unionT', props: { rama: 'izq', marcas: { ai: false, ad: true, di: false, dd: false } } }] });
  expect(mensajes(p)).toContain('La marca pide girar a la derecha, pero esta unión en T no tiene camino a la derecha.');
});
```

(`base` reemplaza una baldosa si `extra` trae otra con la misma `c, r`, y entiende `quitarHito` y `renumerarHito: [numeroViejo, numeroNuevo]`.)

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/unidad/revision.test.ts`
Expected: FAIL (no existe `src/pista/revision`).

- [ ] **Step 3: Implementar `src/pista/revision.ts`** según la tabla de avisos.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/unidad/revision.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pista/revision.ts tests/unidad/revision.test.ts
git commit -m "Avisos de la pista según las bases FIRVI"
```

---

### Task 7: Juez: hitos, meta, tiempo, reinicios y puntaje

**Files:**
- Create: `src/juez/juez.ts`
- Test: `tests/unidad/juez.test.ts`

**Interfaces:**
- Consumes: `MundoPista` (Tarea 5), `ConfigRobot` y `huellaRobot`, `Pose`, `penetracion` y `puntoEnPoligono`, `BARRA_META`, `aMundo`, y `puntosDePartida` y `PuntoDePartida` (Tarea 1).
- Produces:

```ts
export const PUNTOS_HITO = [5, 10, 20, 20, 10, 15, 15, 20];
export type EstadoHito = 'pendiente' | 'alcanzado' | 'saltado';
export type TipoEvento = 'hito' | 'meta' | 'perdio-linea' | 'toco-obstaculo' | 'camino-equivocado' | 'reinicio' | 'fin-tiempo';
export interface EventoJuez { t: number; tipo: TipoEvento; mensaje: string; baldosa?: { c: number; r: number } }
export interface EstadoJuez { desde: string; hitos: EstadoHito[]; meta: boolean; tiempo: number | null; reinicios: number; eventos: EventoJuez[]; puntaje: number; terminado: boolean }
export interface OpcionesJuez { perdidaLineaS?: number /* 0.5 */; radioObstaculoMm?: number /* 300 */; pasoUs?: number /* 10_000 */; desde?: string /* id de un PuntoDePartida; 'partida' */ }
export class Juez {
  /** Lanza Error('No existe el punto de partida "{id}".') si `desde` no está en puntosDePartida. */
  constructor(mundo: MundoPista, robot: ConfigRobot, opciones?: OpcionesJuez);
  /** tUs: reloj del simulador actual (vuelve a 0 después de reiniciar). */
  actualizar(tUs: number, pose: Pose): void;
  /** Destinos de reinicio permitidos ahora, en el orden del recorrido. */
  puntosDeReinicio(): PuntoDePartida[];
  /** 'ultimo', 'siguiente' (el hito pendiente) o el id de un punto de puntosDeReinicio(). */
  reiniciar(destino: string): { ok: true; pose: Pose } | { ok: false; mensaje: string };
  get estado(): EstadoJuez;   // copia
}
```

**Reglas:**
- **Reloj del juez:** en cada `actualizar` suma `max(0, tUs − tPrevio)`; `reiniciar` vuelve `tPrevio` a 0. Evalúa cuando pasaron `pasoUs` desde la evaluación anterior (la primera llamada siempre evalúa). Si `terminado`, no hace nada.
- **Punto de partida (`desde`):**
  - los hitos con `numero < punto.hitoSiguiente` empiezan como `'saltado'`;
  - si `desde` no es `'partida'`, la prueba es de práctica y no tiene puntaje de tiempo.
- **Hitos:**
  - se ordenan por `numero` y `estado.hitos[i]` corresponde al i-ésimo;
  - el siguiente pendiente se alcanza cuando la huella contiene su punto (los demás no cuentan);
  - suma `PUNTOS_HITO[numero − 1] ?? 0`, con el evento `Llegaste al hito {n} (+{p}).`;
  - el hito pendiente queda "intentado" en cuanto avanza el reloj mientras es el objetivo.
- **Tiempo:**
  - empieza en la primera evaluación en que la huella ya no toca la baldosa de partida (si no hay partida, en la primera evaluación);
  - `tiempo` = reloj − inicio, o `null` si no empezó;
  - con `tiempo ≥ 300` termina, con el evento `fin-tiempo` `Se acabaron los 5 minutos.`
- **Meta:**
  - la velocidad es la distancia entre evaluaciones dividida por Δt;
  - con la huella tocando la barra de meta y velocidad < 5 mm/s, se anota `paradaDesde` en esa evaluación; si se mueve o sale de la barra, se borra;
  - con reloj − `paradaDesde` ≥ 1 s: `meta = true`, `terminado = true`, `tiempo = paradaDesde − inicio` y el evento `Llegaste a la meta y te detuviste (+15).`
- **Puntaje:**
  - Σ de los hitos alcanzados + 15 por la meta;
  - más `(300 − tiempo)/4`, solo si se cumplen tres cosas: hay meta, `desde` es `'partida'` y no hubo saltos (ni a un hito ni a una F);
  - menos 10 por reinicio;
  - menos 20 por cada cm que sobra en cada medida (`ceil((medida − 200)/10)`).
- **Reinicios:**
  - `ultimoPunto` empieza en el punto `desde`. Cambia al punto de un hito cuando se alcanza ese hito, y al destino después de cada reinicio;
  - `puntosDeReinicio()` es el tramo de `puntosDePartida` desde `ultimoPunto` hasta el punto del hito pendiente, ambos incluidos (sin hitos pendientes, hasta el final);
  - `'ultimo'` es `ultimoPunto` y `'siguiente'` es el punto del hito pendiente;
  - un destino posterior a `ultimoPunto` es un **salto**:
    - los hitos pendientes con `numero < destino.hitoSiguiente` quedan `'saltado'`;
    - se pierde el puntaje de tiempo.
  
  En los mensajes, el punto se nombra "a la partida", "al hito {n}" o "a {nombre}" (`F1`):

| Situación (se revisa en este orden) | Resultado |
|---|---|
| Prueba terminada | `La prueba ya terminó.` |
| `reinicios = 3` | `Ya usaste los 3 reinicios.` |
| `'siguiente'` sin hitos pendientes | `No quedan hitos para saltar.` |
| `id` que no existe | `No existe el punto de partida "{id}".` |
| Destino fuera de `puntosDeReinicio()` | `No puedes reiniciar en {nombre} ahora.` |
| Salto sin haber intentado el hito pendiente | `Para saltar {al punto} primero tienes que intentarlo.` |
| Volver a `ultimoPunto` | Evento `Volviste {al punto} (−10).` |
| Salto | Evento `Saltaste {al punto}: ya no hay puntaje de tiempo (−10).` |

  Si el reinicio procede: `reinicios++`, `tPrevio = 0`, `ultimoPunto = destino`, y se borra lo que depende de la pose anterior. Devuelve la pose del destino.

- [ ] **Step 1: Escribir las pruebas que fallan.**
  - **La pista J** es de 4 × 1: partida, recta, recta y meta. Tiene los hitos 1 en (450, 150) y 2 en (750, 150), el desafío `F1` en (600, 150) con `hitoSiguiente: 2`, y el inicio en (150, 150).
  - **El helper `pasar(juez, desde, hasta, x: (t) => number, paso = 0.001)`** llama a `actualizar(t·1e6, { x: x(t), y: 150, yaw: 0 })` en `t = desde + i·paso`, para `i = 0…round((hasta − desde)/paso)`.

```ts
it('cuenta los hitos en orden', () => {
  const j = new Juez(crearMundo(J), ROBOT_POR_DEFECTO);
  pasar(j, 0, 0.05, () => 750); expect(j.estado.hitos).toEqual(['pendiente', 'pendiente']);
  pasar(j, 0.05, 0.1, () => 450); expect(j.estado).toMatchObject({ hitos: ['alcanzado', 'pendiente'], puntaje: 5 });
  pasar(j, 0.1, 0.15, () => 750); expect(j.estado).toMatchObject({ hitos: ['alcanzado', 'alcanzado'], puntaje: 15 });
  expect(j.estado.eventos.map(e => e.mensaje)).toEqual(['Llegaste al hito 1 (+5).', 'Llegaste al hito 2 (+10).']);
});
it('el tiempo corre desde que la huella sale de la partida', () => {
  const j = new Juez(crearMundo(J), ROBOT_POR_DEFECTO);
  pasar(j, 0, 1, () => 150); expect(j.estado.tiempo).toBeNull();
  pasar(j, 1, 2, () => 400); expect(j.estado.tiempo).toBeCloseTo(1, 1);
});
it('la meta exige detenerse 1 s sobre la línea y suma el tiempo', () => {
  const j = new Juez(crearMundo(J), ROBOT_POR_DEFECTO);
  const x = (t: number) => 150 + 600 * Math.min(t, 1.5);
  pasar(j, 0, 2.4, x); expect(j.estado.meta).toBe(false);
  pasar(j, 2.4, 2.6, x); expect(j.estado).toMatchObject({ meta: true, terminado: true });
  expect(j.estado.tiempo).toBeCloseTo(1.15, 1); expect(j.estado.puntaje).toBeCloseTo(30 + (300 - 1.15) / 4, 1);
});
it('reinicios: volver, saltar solo lo intentado, máximo 3 y el tiempo sigue sumando', () => {
  const j = new Juez(crearMundo(J), ROBOT_POR_DEFECTO);
  expect(j.reiniciar('siguiente')).toEqual({ ok: false, mensaje: 'Para saltar al hito 1 primero tienes que intentarlo.' });
  pasar(j, 0, 1, () => 450); pasar(j, 1, 1.1, () => 520);
  expect(j.puntosDeReinicio().map(p => p.id)).toEqual(['hito-1', 'desafio-F1', 'hito-2']);
  expect(j.reiniciar('siguiente')).toEqual({ ok: true, pose: { x: 750, y: 150, yaw: 0 } });
  expect(j.estado).toMatchObject({ hitos: ['alcanzado', 'saltado'], reinicios: 1, puntaje: -5 });
  expect(j.estado.eventos.at(-1)!.mensaje).toBe('Saltaste al hito 2: ya no hay puntaje de tiempo (−10).');
  expect(j.reiniciar('siguiente')).toEqual({ ok: false, mensaje: 'No quedan hitos para saltar.' });
  const antes = j.estado.tiempo!;
  pasar(j, 0, 0.5, () => 750); expect(j.estado.tiempo).toBeCloseTo(antes + 0.5, 1);
  expect(j.reiniciar('ultimo')).toEqual({ ok: true, pose: { x: 750, y: 150, yaw: 0 } });
  expect(j.estado.eventos.at(-1)!.mensaje).toBe('Volviste al hito 2 (−10).');
  expect(j.reiniciar('ultimo').ok).toBe(true);
  expect(j.reiniciar('ultimo')).toEqual({ ok: false, mensaje: 'Ya usaste los 3 reinicios.' });
});
it('saltar una F que no se logra completar cuenta como reinicio y quita el puntaje de tiempo', () => {
  const j = new Juez(crearMundo(J), ROBOT_POR_DEFECTO);
  pasar(j, 0, 0.1, () => 450); pasar(j, 0.1, 0.2, () => 560);
  expect(j.reiniciar('desafio-F1')).toEqual({ ok: true, pose: { x: 600, y: 150, yaw: 0 } });
  expect(j.estado).toMatchObject({ hitos: ['alcanzado', 'pendiente'], reinicios: 1, puntaje: -5 });
  expect(j.estado.eventos.at(-1)!.mensaje).toBe('Saltaste a F1: ya no hay puntaje de tiempo (−10).');
  expect(j.puntosDeReinicio().map(p => p.id)).toEqual(['desafio-F1', 'hito-2']);
  expect(j.reiniciar('hito-1')).toEqual({ ok: false, mensaje: 'No puedes reiniciar en Hito 1 ahora.' });
  pasar(j, 0, 2, t => Math.min(600 + 600 * t, 1050));
  expect(j.estado).toMatchObject({ hitos: ['alcanzado', 'alcanzado'], meta: true, puntaje: 5 + 10 + 15 - 10 });
});
it('empezar desde una F o un hito: lo anterior no suma y no hay puntaje de tiempo', () => {
  const j = new Juez(crearMundo(J), ROBOT_POR_DEFECTO, { desde: 'desafio-F1' });
  expect(j.estado).toMatchObject({ desde: 'desafio-F1', hitos: ['saltado', 'pendiente'], puntaje: 0 });
  pasar(j, 0, 2, t => Math.min(600 + 600 * t, 1050));
  expect(j.estado).toMatchObject({ hitos: ['saltado', 'alcanzado'], meta: true, puntaje: 10 + 15 });
  expect(new Juez(crearMundo(J), ROBOT_POR_DEFECTO, { desde: 'hito-2' }).estado.hitos).toEqual(['saltado', 'saltado']);
  expect(() => new Juez(crearMundo(J), ROBOT_POR_DEFECTO, { desde: 'F9' })).toThrow('No existe el punto de partida "F9".');
});
it('descuenta 20 puntos por cm de más', () =>
  expect(new Juez(crearMundo(J), { ...ROBOT_POR_DEFECTO, chasis: { ...ROBOT_POR_DEFECTO.chasis, largo: 215 } }).estado.puntaje).toBe(-40));
it('se acaba a los 300 s', () => {
  const j = new Juez(crearMundo(J), ROBOT_POR_DEFECTO, { pasoUs: 100_000 });
  pasar(j, 0, 301, () => 400, 0.1);
  expect(j.estado.terminado).toBe(true); expect(j.estado.eventos.at(-1)).toMatchObject({ tipo: 'fin-tiempo', mensaje: 'Se acabaron los 5 minutos.' });
});
```

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/unidad/juez.test.ts`
Expected: FAIL (no existe `src/juez/juez`).

- [ ] **Step 3: Implementar `src/juez/juez.ts`** según las reglas. Los eventos de la Tarea 8 todavía no se generan.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/unidad/juez.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/juez/juez.ts tests/unidad/juez.test.ts
git commit -m "Juez virtual: hitos, meta, tiempo, reinicios, saltos de F y puntaje"
```

---

### Task 8: Juez: línea, obstáculo y decisiones

**Files:**
- Modify: `src/juez/juez.ts`
- Test: `tests/unidad/juez-eventos.test.ts`

**Interfaces:**
- Consumes: `MundoPista.esLinea`, `baldosaEn`, `colisiona`, `accionEsperada`, `aLocal` y `distanciaAPoligono`.
- Produces: los eventos `perdio-linea`, `toco-obstaculo` y `camino-equivocado` en `estado.eventos`. No hay cambios de API.

**Reglas** (en cada evaluación):
- **Sobre la línea:** algún punto de una grilla de 5 mm dentro de la huella (en el marco del robot, de la cola a la nariz y de un costado al otro) cumple `esLinea`.
- **Perdió la línea:**
  - si no está sobre la línea, no está "rodeando" y su centro está a ≤ `radioObstaculoMm` de la huella de algún obstáculo, pasa a "rodeando";
  - si no está rodeando, cuenta desde cuándo está fuera; al superar `perdidaLineaS`, genera un evento `Perdiste la línea.`, uno solo hasta volver a la línea;
  - al volver a la línea se borran el contador, el aviso y el "rodeando".
- **Tocó el obstáculo:** `colisiona(huella)` da un obstáculo. Genera un evento `Tocaste el obstáculo.` por cada contacto nuevo.
- **Decisiones**, con el centro del robot y `baldosaEn`:
  - al entrar a una `cruce` o `unionT`, se anota el lado de entrada: con la posición evaluada anterior en coordenadas locales, `u < 0` es oeste, `u ≥ 300` es este, `v ≥ 300` es norte y `v < 0` es sur (gana el eje que más se pasa);
  - si entró por el oeste, al salir se compara el lado de salida con el esperado: `recto → este`, `izq → norte`, `der → sur`, `vuelta → oeste`;
  - si no coincide: `Tomaste el camino equivocado en el cruce.` o `… en la unión en T.`, con `baldosa`;
  - en `cuadradoF1` entrando por el oeste, la primera evaluación con `u ≥ 150` decide el lado (`v ≥ 150` es izquierda). Si difiere de `correcto`: `Tomaste el camino equivocado en el cuadrado F1.`;
  - después de un reinicio, o al empezar desde un hito o una F, no hay posición anterior, así que la baldosa donde parte no se evalúa.

- [ ] **Step 1: Escribir las pruebas que fallan.** El helper `recorrer(juez, puntos: [t, x, y][], paso = 0.001)` interpola linealmente entre los puntos y llama a `actualizar` cada `paso`. Usa `yaw` en la dirección del movimiento: si el robot no se mueve conserva el anterior, y al principio vale 0.

```ts
const recta6 = (objetos = []) => pistaDe({ columnas: 6, filas: 1, baldosas: [0, 1, 2, 3, 4, 5].map(c => ({ c, r: 0, tipo: 'recta' })), objetos });
const tipos = (j: Juez, tipo: string) => j.estado.eventos.filter(e => e.tipo === tipo);
it('perdió la línea después de 0,5 s, una vez por salida', () => {
  const j = new Juez(crearMundo(recta6()), ROBOT_POR_DEFECTO);
  recorrer(j, [[0, 300, 150], [0.1, 300, 350], [0.5, 300, 350]]); expect(tipos(j, 'perdio-linea')).toEqual([]); // fuera desde ~0,04 s
  recorrer(j, [[0.5, 300, 350], [0.7, 300, 350]]); expect(tipos(j, 'perdio-linea')).toHaveLength(1);
  recorrer(j, [[0.7, 300, 350], [0.8, 300, 150], [0.9, 300, 350], [1.6, 300, 350]]);
  expect(tipos(j, 'perdio-linea').map(e => e.mensaje)).toEqual(['Perdiste la línea.', 'Perdiste la línea.']);
});
it('al rodear el obstáculo no pierde la línea hasta volver a ella', () => {
  const j = new Juez(crearMundo(recta6([{ tipo: 'obstaculo', x: 900, y: 150, rot: 0 }])), ROBOT_POR_DEFECTO);
  recorrer(j, [[0, 700, 150], [0.2, 800, 320], [2, 1000, 320], [2.3, 1200, 150]]); expect(tipos(j, 'perdio-linea')).toEqual([]);
  recorrer(j, [[2.3, 1200, 150], [2.4, 1500, 400], [3.2, 1500, 400]]); expect(tipos(j, 'perdio-linea')).toHaveLength(1);
});
it('tocó el obstáculo, una vez por contacto', () => {
  const j = new Juez(crearMundo(recta6([{ tipo: 'obstaculo', x: 900, y: 150, rot: 0 }])), ROBOT_POR_DEFECTO);
  recorrer(j, [[0, 700, 150], [0.2, 800, 150], [1, 800, 150]]);
  expect(tipos(j, 'toco-obstaculo').map(e => e.mensaje)).toEqual(['Tocaste el obstáculo.']);
});
const conCruce = (marcas: Partial<Marcas>) => pistaDe({ columnas: 3, filas: 3, baldosas: [{ c: 1, r: 1, tipo: 'cruce', props: { marcas: { ai: false, ad: false, di: false, dd: false, ...marcas } } }] });
it('cruce: marca a la derecha obliga a salir por el sur', () => {
  const bien = new Juez(crearMundo(conCruce({ ad: true })), ROBOT_POR_DEFECTO);
  recorrer(bien, [[0, 200, 450], [0.5, 450, 450], [1, 450, 200]]); expect(tipos(bien, 'camino-equivocado')).toEqual([]);
  const mal = new Juez(crearMundo(conCruce({ ad: true })), ROBOT_POR_DEFECTO);
  recorrer(mal, [[0, 200, 450], [0.5, 450, 450], [1, 450, 700]]);
  expect(tipos(mal, 'camino-equivocado')).toMatchObject([{ mensaje: 'Tomaste el camino equivocado en el cruce.', baldosa: { c: 1, r: 1 } }]);
  const otroLado = new Juez(crearMundo(conCruce({ ad: true })), ROBOT_POR_DEFECTO);
  recorrer(otroLado, [[0, 450, 200], [0.5, 450, 450], [1, 450, 700]]); expect(tipos(otroLado, 'camino-equivocado')).toEqual([]);
});
it('cuadrado F1: el lado correcto no genera evento y el otro sí', () => {
  const f1 = pistaDe({ columnas: 3, filas: 1, baldosas: [{ c: 1, r: 0, tipo: 'cuadradoF1', props: { correcto: 'izq' } }] });
  const arriba = new Juez(crearMundo(f1), ROBOT_POR_DEFECTO);
  recorrer(arriba, [[0, 200, 150], [0.3, 340, 150], [0.6, 400, 255], [0.9, 560, 150], [1.2, 650, 150]]);
  expect(tipos(arriba, 'camino-equivocado')).toEqual([]);
  const abajo = new Juez(crearMundo(f1), ROBOT_POR_DEFECTO);
  recorrer(abajo, [[0, 200, 150], [0.3, 340, 150], [0.6, 400, 45], [0.9, 560, 150], [1.2, 650, 150]]);
  expect(tipos(abajo, 'camino-equivocado').map(e => e.mensaje)).toEqual(['Tomaste el camino equivocado en el cuadrado F1.']);
});
```

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/unidad/juez-eventos.test.ts`
Expected: FAIL (no se generan esos eventos).

- [ ] **Step 3: Implementar las reglas** en `src/juez/juez.ts`, con `perdidaLineaS` y `radioObstaculoMm` de `OpcionesJuez`.

- [ ] **Step 4: Correr las pruebas del juez**

Run: `npx vitest run tests/unidad/juez.test.ts tests/unidad/juez-eventos.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/juez/juez.ts tests/unidad/juez-eventos.test.ts
git commit -m "Juez virtual: perdió la línea, obstáculo y camino equivocado"
```

---

### Task 9: El simulador en la pista, de punta a punta, y documentación

**Files:**
- Modify: `src/simulacion/simulador.ts` (opción `alPasoFisica`), `src/modelos/README.md`, `README.md`, `docs/superpowers/specs/2026-10-17-simulador-dynamis-design.md`
- Test: `tests/integracion/simulador.test.ts` (agregar), `tests/integracion/pista.test.ts`

**Interfaces:**
- Consumes: todo lo anterior y `Simulador`.
- Produces: `OpcionesSimulador.alPasoFisica?: (tUs: number, estado: EstadoRobot) => void`. Se llama después de cada paso de física con el tiempo de ese paso (`tFisica`), dentro de `protegido('alPasoFisica', …)`.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
// tests/integracion/simulador.test.ts
it('alPasoFisica ve cada paso de física, también dentro de un delay', async () => {
  const pasos: number[] = [];
  const sim = await crearSim('void setup() { delay(10); }\nvoid loop() {}', { alPasoFisica: t => pasos.push(t) });
  sim.ejecutar(10_000);
  expect(pasos).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(ms => ms * 1000));
});
// tests/integracion/pista.test.ts (carga el núcleo con el mismo beforeAll que simulador.test.ts)
const IR_Y_PARAR = `void setup() {
  pinMode(16, OUTPUT); pinMode(17, OUTPUT); pinMode(4, OUTPUT); pinMode(5, OUTPUT);
  digitalWrite(16, HIGH); digitalWrite(17, LOW); digitalWrite(4, HIGH); digitalWrite(5, LOW);
  analogWrite(18, 255); analogWrite(19, 255); delay(1500); analogWrite(18, 0); analogWrite(19, 0);
}
void loop() {}`;
it('un robot que avanza 90 cm y se detiene en la meta suma hito, meta y tiempo', async () => {
  const pista = pistaDe({ columnas: 4, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'partida' }, { c: 1, r: 0, tipo: 'recta' }, { c: 2, r: 0, tipo: 'recta' }, { c: 3, r: 0, tipo: 'meta' }],
    objetos: [{ tipo: 'hito', x: 450, y: 150, rot: 0, props: { numero: 1 } }] });
  const mundo = crearMundo(pista); const juez = new Juez(mundo, ROBOT_POR_DEFECTO);
  const sim = await Simulador.crear({ modulo: await compilarParaPrueba({ 'p.ino': IR_Y_PARAR }, nucleo, 'p'), mundo, poseInicial: poseInicial(pista),
    alPasoFisica: (t, e) => juez.actualizar(t, e) });
  sim.ejecutar(3_000_000);
  expect(juez.estado).toMatchObject({ hitos: ['alcanzado'], meta: true, reinicios: 0, terminado: true });
  expect(juez.estado.tiempo).toBeCloseTo(1.16, 1); expect(juez.estado.puntaje).toBeCloseTo(20 + (300 - 1.16) / 4, 1);
  expect(juez.estado.eventos.filter(e => e.tipo === 'perdio-linea')).toEqual([]);
});
it('el robot sube la rampa: z y pitch salen del mundo', async () => {
  const alto = 300 * Math.tan(20 * Math.PI / 180);
  const pista = pistaDe({ columnas: 3, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'recta' }, { c: 1, r: 0, tipo: 'rampa' }, { c: 2, r: 0, tipo: 'recta', nivel: alto }] });
  const sim = await Simulador.crear({ modulo: await compilarParaPrueba({ 'p.ino': IR_Y_PARAR }, nucleo, 'p'), mundo: crearMundo(pista), poseInicial: poseInicial(pista) });
  sim.ejecutar(500_000); // 300 mm: el centro queda en la mitad de la rampa
  expect(sim.estado.x).toBeCloseTo(450, 0); expect(sim.estado.z).toBeCloseTo(150 * Math.tan(20 * Math.PI / 180), 0);
  expect(sim.estado.pitch).toBeCloseTo(-20 * Math.PI / 180, 2);
});
```

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/integracion/simulador.test.ts tests/integracion/pista.test.ts`
Expected: FAIL. `alPasoFisica` no se llama, y por eso el juez no ve la meta. La prueba de la rampa puede pasar desde ya, porque solo depende de las Tareas 4–5: en ese caso es una prueba de integración y se deja así.

- [ ] **Step 3: Implementar `alPasoFisica`** en `Simulador.avanzar`, dentro del ciclo de pasos de física, después de actualizar `tFisica`.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/integracion/simulador.test.ts tests/integracion/pista.test.ts`
Expected: PASS.

- [ ] **Step 5: Documentación y spec.**
  - **`src/modelos/README.md`:** agregar la sección "El mundo de la pista". Explica qué devuelve cada primitiva y la convención de inclinación: `pitch < 0` con la nariz arriba y `roll > 0` con el lado izquierdo arriba, según REP-103. También que `raycast` da `objeto: null` cuando choca con el suelo, que los sensores no ven los hitos ni los puntos de desafío, y que fuera de la grilla hay fondo blanco a altura 0.
  - **`README.md`:**
    - el estado pasa a "fase 2 de 7 — pista, mundo y juez";
    - la estructura suma `pista/` y `juez/`.
  - **Spec:**
    - §9, viñeta de `muestrear`: reemplazar el `OffscreenCanvas` por la lista de figuras (decisión 1 de este plan). Las decoraciones de la rampa solo existen en pantalla;
    - §9, Convenciones: agregar la regla de inclinación (decisión 3);
    - §10.2: agregar que los ángulos del JSON van en grados, que `r` cuenta las filas desde abajo y que `tamanoBaldosa` es 300 (decisión 2);
    - §10.3: en la Unión en T, agregar `rama` (decisión 4); en el Indicador F2, "hasta 3 decisiones" (decisión 5);
    - §10.6, fila Decisiones: "se evalúa cuando el robot entra por la flecha de la baldosa" (decisión 6);
    - §10.2 y §10.3, objetos: agregar el **punto de desafío** `desafio` (`nombre`, `yaw`, `hitoSiguiente`). Marca dónde está cada F, no lo ven los sensores y es un punto de partida elegible (decisión 8);
    - §10.6, fila Reinicios: agregar "o en el punto de una F que no se logra completar, con las mismas reglas"; y una fila nueva **Empezar desde**: "partida, un hito o una F; lo anterior no suma y no hay puntaje de tiempo";
    - §20, Confirmado: agregar la decisión del usuario del 2026-10-22 (punto de partida elegible y saltos de F como reinicio).

- [ ] **Step 6: Suite completa y typecheck**

Run: `npm test && npm run typecheck`
Expected: todas las pruebas pasan y el typecheck no tiene errores.

- [ ] **Step 7: Commit**

```bash
git add src/simulacion/simulador.ts tests/integracion src/modelos/README.md README.md docs/superpowers/specs/2026-10-17-simulador-dynamis-design.md
git commit -m "El simulador recorre la pista con el juez virtual; documentación de la fase 2"
```
