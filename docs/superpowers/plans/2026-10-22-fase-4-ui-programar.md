# Fase 4 — UI Programar: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un estudiante abra la página, vea su proyecto y la pista, presione **"Probar mi robot"** y vea al robot moverse según su código, con los mensajes del `Serial`, lo que sienten los sensores, el juez virtual y los errores explicados en español.

**Architecture:**
- **App:** Vite + TypeScript sin framework de UI. El HTML y el CSS salen de la maqueta (`docs/maqueta/simulador-dynamis.html`), y hay un módulo TS por panel en `src/ui/`.
- **Compilación:** un worker compila con `@yowasp/clang` y el `nucleo.a` precompilado. Un cliente en el hilo principal guarda en caché el último módulo y no recompila si el proyecto no cambió.
- **Simulación:** otro worker ejecuta la prueba (simulador + juez + reinicios). El hilo principal lo controla con un bloque en `SharedArrayBuffer` (pausa, velocidad, pedidos del juez y latido), porque el worker no atiende mensajes mientras corre. El worker envía instantáneas unas 60 veces por segundo.
- **Lógica pura en Node:** la lógica que no depende del navegador (ritmo, ejecución de la prueba, importar y exportar proyectos, mensajes, vista del lienzo, textos de las tarjetas, errores amigables) vive en módulos sin DOM y se prueba con Vitest en Node. El DOM se prueba de punta a punta con Playwright.

**Tech Stack:**
- **Ya está:** Node 22, TypeScript (strict), Vitest, `@yowasp/clang`.
- **Dependencias nuevas (en su versión estable actual):**
  - Vite;
  - CodeMirror 6: `codemirror`, `@codemirror/lang-cpp`, `@codemirror/state` y `@codemirror/view`;
  - `fflate`;
  - las fuentes `@fontsource/fredoka`, `@fontsource/lexend` y `@fontsource/jetbrains-mono`.
- **Dependencias nuevas de desarrollo:** `@playwright/test` y `fake-indexeddb`.

**Spec:** `docs/superpowers/specs/2026-10-17-simulador-dynamis-design.md`. Esta fase cubre:
- §19, punto 4;
- §3: worker de simulación, pausa y ritmo, y Detener;
- §5: proyecto multiarchivo, caché de compilación y errores amigables;
- §12: banda, barra de acciones, vista Programar y mensajes;
- §13: autoguardado, `.zip` y carpeta;
- §14: errores;
- §15: las pruebas de punta a punta de esta vista.

**Fuera de esta fase:**
- **Fase 5:** la vista Construir pista y la ventana "Mi robot" (decisión 1).
- **Fase 6:** Ajustar parámetros y las marcas `@ajustar` en el editor.
- **Fase 7:** Ejemplos, Ayuda, recorrido de la primera visita, PWA, service worker y GitHub Pages.

En esta fase, los botones de esas vistas se ven deshabilitados con el título "Llega pronto".

**Decisiones que toma este plan** (la Tarea 12 las lleva a la spec):
1. **"Mi robot" va en la fase 5**, junto con Construir pista, porque las dos son editores del mundo. Mientras tanto se usa `ROBOT_POR_DEFECTO`.
2. **Las tarjetas muestran lo que miden los sensores en ese instante**, aunque el programa no los lea. Los modelos se evalúan con un azar propio de la vista, así lo que se muestra no cambia lo que lee el programa y la prueba sigue siendo reproducible.
3. **Un reinicio del juez** ("Volver al último hito" o "Saltar al siguiente hito") reinicia el programa desde `setup()` en el punto elegido, como cuando se reinicia el robot real. El juez sigue con su puntaje y su reloj.
4. **Pedidos al worker:** la pausa, la velocidad y los reinicios van por el bloque de control compartido, porque el worker no atiende mensajes mientras corre. Detener y Volver al inicio terminan el worker (`worker.terminate()`).
5. **Latido:** el worker sube un contador en cada punto de sincronización y en cada tramo de espera (máximo 50 ms por tramo). Así un `delay(5000)` a velocidad ×1 no dispara el aviso de "ciclo sin fin".
6. **Pista de práctica provisional:** un recorrido corto con partida, 2 giros suaves, 2 hitos y meta. La "Práctica FIRVI" completa, con 8 hitos, llega en la fase 7.
7. **Error de enlace `undefined symbol: X`** (por ejemplo, escribir `Loop` en vez de `loop`) se explica con "Falta la función `X`. ¿Está bien escrito su nombre?".
8. **Los avisos del simulador** (cableado, `Serial` sin `begin`, librerías mal usadas) aparecen en "Mensajes del robot" como líneas del sistema.
9. **Eventos del juez:**
   - un hito o la meta muestran el aviso de logro amarillo;
   - los demás eventos ("perdió la línea", "camino equivocado", "tocó el obstáculo", reinicios) aparecen como un aviso breve;
   - la tarjeta del juez muestra los últimos 3.
10. **Velocidad:** 5 pasos, ×0,25, ×0,5, ×1, ×2 y ×4 (×1 por defecto). La velocidad "máxima" del bloque de control queda para Ajustar parámetros.
11. **Descargar el proyecto:** el `.zip` lleva una carpeta con el nombre del `.ino` principal, porque el Arduino IDE lo exige.
12. **Partir desde:** la tarjeta del juez tiene un selector con los puntos de `puntosDePartida(pista)` (Partida, hitos y F), como lo pidió el usuario en la fase 2.

## Global Constraints

- **Idioma:** todo en español de Chile, tuteando. Los textos que la spec fija se copian tal cual.
- **Sin framework de UI:** un módulo TS por panel en `src/ui/`. La lógica sin DOM va en módulos aparte, probados en Node.
- **Paleta** (tokens CSS de la maqueta):
  - `--azul #0B0F98`, `--celeste #65C7F7`, `--hielo #DDF4FF`, `--nube #F4FAFF`, `--sol #FFD166`, `--rosa #FF9FAD`;
  - texto en `#12164A`;
  - el celeste nunca es color de texto sobre blanco.
- **Tipografías autoalojadas:** Fredoka (títulos), Lexend (texto) y JetBrains Mono (código).
- **Accesibilidad:**
  - todo se usa con teclado y el foco siempre se ve;
  - los objetivos táctiles miden al menos 40 px;
  - se respeta `prefers-reduced-motion`;
  - el objetivo son pantallas de 1024 px o más, y en pantallas angostas las columnas se apilan.
- **Aislamiento:** `SharedArrayBuffer` requiere `Cross-Origin-Opener-Policy: same-origin` y `Cross-Origin-Embedder-Policy: require-corp`, en `vite dev` y en `vite preview`.
- **Mensajes del robot:** se agregan una vez por cuadro (`requestAnimationFrame`) y se guardan las últimas **500** líneas.
- **Detener** siempre termina el worker.
- **"Ciclo sin fin":** con más de 2 s reales sin latido mientras corre, aparece exactamente: "Tu programa parece atrapado en un ciclo sin fin. ¿Falta un `delay` o leer un sensor dentro del `while`?", con el botón Detener.
- **Determinismo:** nada de lo que la UI muestra consume el azar del programa ni el de los modelos.
- **Tipos en los workers:** el `tsconfig` usa la lib `DOM`. Los workers usan `self as unknown as AmbitoTrabajador` (definido en `src/ui/ambito.ts`: `postMessage(m: unknown, t?: Transferable[])` y `onmessage`), no la lib `webworker`.
- **Ganchos de prueba:** cuando la página se sirve con `vite` en modo desarrollo (`import.meta.env.DEV`), expone `window.__pruebas` para Playwright. No existe en `vite build`.

## Review Focus

1. **Un `Serial.println` en `loop()` sin `delay`** inunda los mensajes. La página debe seguir respondiendo (un clic funciona en menos de 1 s) y la consola nunca pasa de 500 líneas. Prueba en la Tarea 12.
2. **Clics rápidos:** dos clics seguidos en "Probar mi robot", o Detener mientras compila. Nunca deben quedar dos simulaciones corriendo, y un resultado de compilación viejo no debe arrancar una prueba. Prueba en la Tarea 12.
3. **Abrir una carpeta con basura:** `.git/`, imágenes, archivos de más de 1 MB o sin ningún `.ino`. Solo se importan los archivos de código, se informa lo ignorado, y sin `.ino` aparece un mensaje y lo abierto no se pierde. Prueba en la Tarea 7.
4. **IndexedDB no disponible** (ventana privada o cuota llena): la app funciona igual sin autoguardado. Prueba en la Tarea 7.
5. **El compilador no se descarga** (sin red): aparece un mensaje claro y el botón "Reintentar", que vuelve a intentarlo. Prueba en la Tarea 12.

---

### Task 1: La app web: Vite, página, tema y aislamiento

**Files:**
- Create:
  - `vite.config.ts`, `index.html`, `playwright.config.ts`;
  - `src/main.ts`, `src/vite-env.d.ts`;
  - `src/ui/tema.css`, `src/ui/aplicacion.ts`, `src/ui/ambito.ts`.
- Modify: `package.json` (dependencias y scripts), `tsconfig.json` (`types: ["node", "vite/client"]`; incluir `vite.config.ts` y `playwright.config.ts`).
- Test: `tests/e2e/app.spec.ts`.

**Interfaces:**
- Produces:
  - **`iniciarAplicacion(raiz: Document): Promise<void>`** en `src/ui/aplicacion.ts`. Las tareas siguientes le agregan paneles.
  - **Ids del DOM, los de la maqueta:**
    - banda: `tab-programar`, `tab-pista`, `btn-ejemplos`, `btn-ayuda`;
    - acciones: `btn-probar`, `txt-probar`, `btn-pausa`, `txt-pausa`, `btn-inicio`, `btn-ajustar`, `estado`, `txt-estado`, `vel`, `vel-out`;
    - Mi programa: `chip-carpeta`, `btn-carpeta`, `in-carpeta`, `pestanas`, `editor`, `burbuja`, `burbuja-titulo`, `btn-ir-linea`;
    - mensajes: `consola`, `pildora-nuevos`, `btn-limpiar`, `logro`, `txt-logro`;
    - pista: `lienzo-sim`, `chip-tiempo`;
    - juez: `hitos`, `juez-pts`, `juez-rein`, `juez-tiempo`, `btn-ultimo-hito`;
    - tarjetas: `qtr`, `qtr-num`, `qtr-pos`, `qtr-pos-num`, `tof-val`, `tof-bar`, `color-muestra`, `color-nombre`, `color-rgbc`, `aguja`, `mpu-rumbo`, `mpu-sub`, `m-izq`, `m-der`, `m-izq-n`, `m-der-n`.
  - **Ids nuevos:** `btn-saltar-hito`, `sel-desde`, `btn-zip`, `in-zip`, `btn-descargar`, `btn-guardar-carpeta`, `aviso-global`.
  - **Scripts de `package.json`:**
    - `"dev": "npm run nucleo && vite"`;
    - `"build": "npm run nucleo && vite build"`;
    - `"preview": "vite preview"`;
    - `"e2e": "playwright test"`.

- [ ] **Step 1: Instalar las dependencias** de la sección Tech Stack (`npm install …` y `npm install -D @playwright/test fake-indexeddb`).

Run: `npm ls vite vitest`
Expected: sin errores de dependencias. Si Vitest exige otra versión mayor de Vite, instala la que pida.

- [ ] **Step 2: Escribir la prueba de punta a punta que falla** en `tests/e2e/app.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('la página carga aislada, con la banda y la vista Programar', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#tab-programar')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#btn-probar')).toHaveText(/Probar mi robot/);
  await expect(page.locator('#tab-pista')).toBeDisabled();
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
  await expect(page.locator('#aviso-global')).toBeHidden();
});

test('sin aislamiento de origen cruzado explica qué hacer', async ({ page }) => {
  await page.route('/', async ruta => {
    const respuesta = await ruta.fetch();
    const cabeceras = { ...respuesta.headers() };
    delete cabeceras['cross-origin-opener-policy'];
    delete cabeceras['cross-origin-embedder-policy'];
    await ruta.fulfill({ response: respuesta, headers: cabeceras });
  });
  await page.goto('/');
  await expect(page.locator('#aviso-global')).toContainText('recarga la página o usa Chrome, Edge o Firefox recientes');
});
```

- **`playwright.config.ts`:**
  - `testDir: 'tests/e2e'`, un solo proyecto Chromium y `timeout: 180_000`;
  - `webServer: { command: 'npm run dev -- --port 5179 --strictPort', url: 'http://localhost:5179', reuseExistingServer: !process.env.CI, timeout: 180_000 }`;
  - `use.baseURL` en ese puerto;
  - `launchOptions.executablePath` igual a `/opt/pw-browsers/chromium` si ese archivo existe (`existsSync`), y sin definir en otro caso.

- [ ] **Step 3: Correrla y verla fallar**

Run: `npx playwright test tests/e2e/app.spec.ts`
Expected: FAIL (no hay `index.html` ni configuración de Vite).

- [ ] **Step 4: Implementar.**
  - **`vite.config.ts`:**
    - cabeceras COOP y COEP en `server` y en `preview`;
    - `optimizeDeps.exclude: ['@yowasp/clang']`, porque su paquete busca sus `.wasm` junto a sí mismo con `import.meta.url`;
    - `worker.format: 'es'` y `build.target: 'es2022'`, porque `@yowasp/clang` usa `await` en el nivel superior;
    - `base: './'`.
  - **`index.html`:**
    - la banda y la vista Programar de la maqueta, con sus ids;
    - `tab-pista`, `btn-ejemplos`, `btn-ayuda` y `btn-ajustar` deshabilitados, con `title="Llega pronto"`;
    - los botones nuevos: `btn-saltar-hito` "Saltar al siguiente hito"; `sel-desde` (etiqueta "Partir desde"); `btn-zip` "Abrir .zip" con `in-zip` (`accept=".zip"`, oculto); `btn-descargar` "Descargar mi proyecto"; y `btn-guardar-carpeta` "Guardar en la carpeta" (oculto hasta abrir una carpeta con `showDirectoryPicker`);
    - `aviso-global`, un aviso de página completa, oculto.
  - **`src/ui/tema.css`:** el `<style>` de la maqueta, sin el enlace a Google Fonts.
  - **`src/main.ts`:** importa las fuentes (`@fontsource/fredoka/{500,600,700}.css`, `@fontsource/lexend/{400,500,600}.css`, `@fontsource/jetbrains-mono/{400,600}.css`) y `tema.css`, y llama a `iniciarAplicacion(document)`.
  - **`iniciarAplicacion`:** si `crossOriginIsolated` es falso, muestra en `aviso-global` "Para usar el simulador, recarga la página o usa Chrome, Edge o Firefox recientes." y no sigue.

- [ ] **Step 5: Correr las pruebas, el typecheck y el build**

Run: `npx playwright test tests/e2e/app.spec.ts && npm run typecheck && npm run build`
Expected: 2 passed; typecheck sin errores; `dist/` generado.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts playwright.config.ts index.html src/main.ts src/vite-env.d.ts src/ui tests/e2e
git commit -m "App web con Vite: página de la maqueta, tema, fuentes y aislamiento de origen cruzado"
```

---

### Task 2: El compilador en el navegador

**Files:**
- Create: `src/compilador/nucleo-web.ts`, `src/compilador/trabajador.ts`, `src/compilador/cliente.ts`.
- Modify: `src/main.ts` (gancho `__pruebas.compilador` en desarrollo).
- Test: `tests/unidad/cliente-compilador.test.ts`, `tests/e2e/compilador.spec.ts`.

**Interfaces:**
- Consumes: `compilar(p, nucleo)`, `prepararCompilador(alProgresar)` y `ArchivosNucleo` (`src/compilador/compilar.ts`).
- Produces:
  - **`cargarNucleoWeb(): Promise<ArchivosNucleo>`** en `nucleo-web.ts`:
    - las cabeceras salen de `import.meta.glob('../nucleo/include/**/*', { query: '?raw', import: 'default', eager: true })`, con la ruta relativa a `include/`;
    - la biblioteca sale de un `fetch` de `../../generado/nucleo.a?url`.
  - **Protocolo del worker (`trabajador.ts`):**
    - entrada: `{ tipo: 'preparar' }` | `{ tipo: 'compilar'; id: number; proyecto: Proyecto }`;
    - salida: `{ tipo: 'progreso'; hecho: number; total: number }` | `{ tipo: 'preparado' }` | `{ tipo: 'error-preparar'; mensaje: string }` | `{ tipo: 'compilado'; id: number; resultado: ResultadoCompilacion }` (los bytes del wasm se transfieren).
  - **`firmaProyecto(p: Proyecto): string`:** igual para dos proyectos con los mismos archivos y contenidos, en cualquier orden.
  - **`class ClienteCompilador`:**
    - `constructor(crearTrabajador?: () => Worker)`;
    - `preparar(alProgresar: (hecho: number, total: number) => void): Promise<void>`: rechaza con el mensaje si falla, y otra llamada vuelve a intentarlo;
    - `compilar(p: Proyecto): Promise<CompilacionWeb>`;
    - `type CompilacionWeb = { ok: true; modulo: WebAssembly.Module; diagnosticos: Diagnostico[] } | { ok: false; diagnosticos: Diagnostico[] }`.
    - Guarda en caché el último resultado `ok`: si la firma no cambió, lo devuelve sin hablar con el worker.
    - Las respuestas se emparejan por `id`.

- [ ] **Step 1: Escribir las pruebas que fallan.**
  - **`tests/unidad/cliente-compilador.test.ts`**, con un `Worker` falso: un objeto con `postMessage`, que responde por `onmessage`, y `terminate`. Los bytes que devuelve son un módulo wasm mínimo válido (`new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])`).
    - `firmaProyecto no depende del orden de los archivos y cambia con el contenido`.
    - `compilar dos veces el mismo proyecto habla una sola vez con el trabajador`.
    - `un proyecto distinto vuelve a compilar; un resultado con errores no queda en caché`.
    - `preparar reenvía el progreso y rechaza con el mensaje si la descarga falla; la segunda llamada reintenta`.
  - **`tests/e2e/compilador.spec.ts`:**

```ts
test('compila en el navegador: un sketch válido da un módulo y uno con error da el diagnóstico', async ({ page }) => {
  await page.goto('/');
  const r = await page.evaluate(async () => {
    const c = (window as any).__pruebas.compilador;
    const bueno = await c.compilar({ nombre: 'p', archivos: { 'p.ino': 'void setup() {}\nvoid loop() {}\n' } });
    const malo = await c.compilar({ nombre: 'p', archivos: { 'p.ino': 'void setup() {\n  int x = 1\n}\nvoid loop() {}\n' } });
    return { bueno: bueno.ok, malo: malo.ok, d: malo.diagnosticos[0] };
  });
  expect(r).toMatchObject({ bueno: true, malo: false, d: { archivo: 'p.ino', linea: 2, severidad: 'error' } });
});
```

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/unidad/cliente-compilador.test.ts; npx playwright test tests/e2e/compilador.spec.ts`
Expected: FAIL (no existe `cliente.ts`; no hay gancho `__pruebas`).

- [ ] **Step 3: Implementar** `nucleo-web.ts`, `trabajador.ts` y `cliente.ts`.
  - El cliente crea el worker con `new Worker(new URL('./trabajador.ts', import.meta.url), { type: 'module' })`.
  - El cliente convierte los bytes en módulo con `WebAssembly.compile`.
  - En desarrollo, `main.ts` expone `window.__pruebas = { compilador: new ClienteCompilador() }`.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/unidad/cliente-compilador.test.ts && npx playwright test tests/e2e/compilador.spec.ts && npm run typecheck`
Expected: PASS. Si `@yowasp/clang` no carga en el worker, resuélvelo en `vite.config.ts` y deja un Ruling en el ledger. Este es el riesgo principal de la fase.

- [ ] **Step 5: Commit**

```bash
git add src/compilador src/main.ts tests/unidad/cliente-compilador.test.ts tests/e2e/compilador.spec.ts vite.config.ts
git commit -m "El compilador corre en un worker del navegador, con caché del último módulo"
```

---

### Task 3: Errores amigables

**Files:**
- Create: `src/compilador/amigables.ts`.
- Modify: `src/simulacion/errores.ts` (pila del profesor).
- Test: `tests/unidad/amigables.test.ts`, `tests/unidad/errores.test.ts` (crear si no existe).

**Interfaces:**
- Consumes: `Diagnostico` (`diagnosticos.ts`), `ErrorSimulador` y `clasificarErrorEjecucion` (`errores.ts`).
- Produces:
  - `interface MensajeAmigable { titulo: string; mensaje: string; archivo: string | null; linea: number | null; tecnico: string }`;
  - `LIBRERIAS_DISPONIBLES = ['Wire.h', 'QTRSensors.h', 'VL53L0X.h', 'Adafruit_MPU6050.h', 'MPU6050.h', 'Adafruit_TCS34725.h']`;
  - `traducirDiagnostico(d: Diagnostico, rutasProyecto: string[]): MensajeAmigable`;
  - `primerError(ds: Diagnostico[], rutasProyecto: string[]): MensajeAmigable | null`: el primero con severidad `error`.

**Reglas:**
- **Archivo:** `archivo` es el del diagnóstico solo si está en `rutasProyecto`; si no, `null` (un error dentro de una cabecera del núcleo no es una pestaña).
- **Título:** `Ups, revisa la línea ${linea} de ${archivo}` si hay archivo y línea; si no, `Ups, hay un problema en tu programa`.
- **Técnico:** `tecnico` = `mensaje` + `\n` + `detalle` del diagnóstico.
- **Mensajes según el patrón** del mensaje de Clang o de wasm-ld (los de la spec §5, más la decisión 7):

| Patrón | Mensaje |
|---|---|
| `expected ';'` | ``Falta un punto y coma `;` al final. En C++ cada instrucción termina con `;`.`` |
| `use of undeclared identifier 'X'` | ``No conozco `X`. ¿Está bien escrito? ¿Lo declaraste antes de usarlo?`` |
| `'X' file not found` | ``No encontramos `X`. Las librerías disponibles son: `` + `LIBRERIAS_DISPONIBLES.join(', ')` + `.` |
| `expected '}'` o `extraneous closing brace` | ``Las llaves `{ }` no están parejas.`` |
| `no matching function for call to 'X'` o `no matching member function for call to 'X'` | `` `X` no recibe esos datos. Revisa cuántos y de qué tipo son.`` |
| `redefinition of 'X'` | `` `X` está definido dos veces.`` |
| `cannot initialize`, `no viable conversion` o `incompatible type` | `Estás guardando un dato de un tipo en una variable de otro tipo.` |
| `undefined symbol: X` | ``Falta la función `X`. ¿Está bien escrito su nombre?`` |
| (otro) | `El compilador encontró un problema que no sé explicar. Mira el mensaje técnico.` |

- [ ] **Step 1: Escribir las pruebas que fallan.**
  - **`tests/unidad/amigables.test.ts`:**
    - un caso por fila de la tabla, con un `Diagnostico` armado a mano, comparando `mensaje` con el texto exacto;
    - `el título nombra la línea y el archivo del proyecto`;
    - `un error en una cabecera del núcleo no tiene archivo ni línea de pestaña`;
    - `primerError salta las advertencias`.
  - **`tests/unidad/errores.test.ts`:** `un error del modelo del profe guarda su pila en el técnico`.

```ts
const causa = new Error('falló');
const e = clasificarErrorEjecucion(new ErrorSimulador('el modelo del QTR', causa));
expect(e.tipo).toBe('simulador');
expect(e.tecnico).toContain('Error en el modelo del QTR: falló');
expect(e.tecnico).toContain(causa.stack!.split('\n')[1].trim());
```

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/unidad/amigables.test.ts tests/unidad/errores.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar.**
  - `amigables.ts`, con la tabla como un arreglo de `[RegExp, (m: RegExpMatchArray) => string]`.
  - En `clasificarErrorEjecucion`, para `ErrorSimulador` con una causa `Error`, `tecnico` = `e.message` + `\n` + la pila de la causa.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/unidad/amigables.test.ts tests/unidad/errores.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/compilador/amigables.ts src/simulacion/errores.ts tests/unidad/amigables.test.ts tests/unidad/errores.test.ts
git commit -m "Errores de compilación explicados en español; la pila del modelo del profe queda en el mensaje técnico"
```

---

### Task 4: Bloque de control y ritmo de tiempo real

**Files:**
- Create: `src/simulacion/control.ts`.
- Test: `tests/unidad/control.test.ts`.

**Interfaces:**
- Produces:
  - **Índices y valores:**
    - `IDX = { estado: 0, velocidad: 1, pedido: 2, latido: 3 } as const`;
    - `CORRIENDO = 0`, `PAUSA = 1`;
    - `type Pedido = 'ultimo' | 'siguiente'`.
  - **Hilo principal:**
    - `crearControl(): Int32Array`: un `Int32Array` sobre un `SharedArrayBuffer` de 4 enteros, con velocidad 100;
    - `pausar(c: Int32Array, enPausa: boolean): void`: escribe y despierta con `Atomics.notify`;
    - `fijarVelocidad(c: Int32Array, centesimas: number): void`: 0 = máxima;
    - `pedir(c: Int32Array, p: Pedido): void`: 1 = último, 2 = siguiente.
  - **Worker:** `tomarPedido(c: Int32Array): Pedido | null` (con `Atomics.exchange`, así cada pedido sale una vez).
  - **`interface Reloj { ahora(): number; dormir(ms: number): void }`.** Por defecto, `ahora` = `performance.now()` y `dormir` = `Atomics.wait(c, IDX.estado, Atomics.load(c, IDX.estado), ms)`, que despierta antes si cambia la pausa.
  - **`class Ritmo`:**
    - `constructor(control: Int32Array, reloj?: Reloj)`;
    - `esperar(tUs: number): void`: se llama en cada punto de sincronización con el tiempo virtual.

**Algoritmo de `esperar`:**

```
latido++
mientras estado = PAUSA: dormir(50); latido++;  al salir: rebasar
v = velocidad / 100; si v = 0: rebasar y salir
si v cambió desde la última llamada: rebasar
objetivo = base + (tUs / 1000) / v
si ahora − objetivo > 250: rebasar                 (va atrasada: no correr a ráfagas)
mientras objetivo − ahora > 1 y estado = CORRIENDO: dormir(min(objetivo − ahora, 50)); latido++
rebasar = base := ahora − (tUs / 1000) / v
```

- [ ] **Step 1: Escribir las pruebas que fallan** en `tests/unidad/control.test.ts`, con un `Reloj` falso (`ahora` devuelve `t`; `dormir(ms)` suma `ms` a `t` y puede ejecutar una acción, como quitar la pausa en el tercer sueño):
  - `a ×1, 100 ms virtuales esperan 100 ms reales`: `esperar(0)` y después `esperar(100_000)`; el reloj avanzó entre 99 y 101 ms.
  - `a ×2 espera la mitad y a máxima no espera`.
  - `cambiar la velocidad a mitad de camino no produce un salto`: de ×1 a ×4 en t = 1 s; la espera hasta t = 1,4 s es de unos 100 ms.
  - `en pausa espera hasta que se siga y al seguir no se apura`: después de la pausa, el siguiente `esperar` no devuelve sin esperar el tiempo atrasado.
  - `si va atrasada más de 250 ms se pone al día sin ráfagas`.
  - `el latido sube en cada espera, también en pausa`.
  - `tomarPedido entrega cada pedido una sola vez`.

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/unidad/control.test.ts`
Expected: FAIL (no existe `control.ts`).

- [ ] **Step 3: Implementar** `control.ts` según lo de arriba.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/unidad/control.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/simulacion/control.ts tests/unidad/control.test.ts
git commit -m "Bloque de control compartido: pausa, velocidad, pedidos del juez, latido y ritmo de tiempo real"
```

---

### Task 5: La prueba completa en Node: simulador, juez, reinicios e instantáneas

**Files:**
- Create:
  - `src/simulacion/ejecucion.ts`;
  - `src/ejemplos/seguidor/seguidor.ino`, `src/ejemplos/seguidor/pines.h`;
  - `src/ejemplos/pistas/practica.json`;
  - `src/ejemplos/index.ts`.
- Modify: `src/simulacion/simulador.ts`.
- Test: `tests/integracion/ejecucion.test.ts`, `tests/integracion/ejemplo.test.ts`.

**Interfaces:**
- Consumes: `Ritmo`, `tomarPedido` y `Reloj` (Tarea 4); `Juez` y `EstadoJuez`; `puntosDePartida`; `crearMundo`; `crearAzar`.
- Produces:
  - **En `simulador.ts`:**
    - `ResultadoEjecucion.motivo` pasa a ser `'tiempo' | 'error' | 'detenido'`;
    - `detener(): void`: termina la corrida en el punto de sincronización actual, con motivo `'detenido'`. Sirve llamarla desde `alAvanzar`;
    - `interface LecturasVista { qtr: number[]; distanciaMm: number; color: LecturaTCS; mpu: LecturaMPU }`;
    - `medirParaVista(azar: Azar): LecturasVista`: evalúa los 4 modelos en el estado actual con ese azar, no con el de los modelos (decisión 2):
      - el QTR con los emisores según su pin;
      - el VL53L0X acotado a 0–8190;
      - el TCS con 24 ms y ganancia 4, y el LED según su pin o encendido;
      - el MPU con el `dt` y el estado anterior.
  - **En `ejecucion.ts`:**
    - `interface Instantanea { reinicio: number; t: number; estado: { x: number; y: number; z: number; yaw: number; pitch: number; roll: number }; motores: Motores; sensores: LecturasVista; juez: EstadoJuez; serial: string; avisos: string[]; mensaje: string | null }`:
      - `t` está en segundos de la corrida actual;
      - `serial` y `avisos` traen solo lo nuevo desde la instantánea anterior;
      - `mensaje` es la respuesta a un pedido rechazado.
    - `interface FinEjecucion { motivo: 'terminado' | 'error'; error?: ErrorEjecucion; juez: EstadoJuez }`;
    - `interface OpcionesPrueba { modulo: WebAssembly.Module; pista: Pista; robot: ConfigRobot; desde: string; semilla: number; control: Int32Array; publicar: (i: Instantanea) => void; reloj?: Reloj; intervaloMs?: number }` (`intervaloMs` vale 16 por defecto);
    - `ejecutarPrueba(o: OpcionesPrueba): Promise<FinEjecucion>`.
  - **`src/ejemplos/index.ts`:**
    - `PROYECTO_INICIAL: Proyecto`, con `nombre: 'seguidor'` y los dos archivos importados con `?raw`;
    - `PISTA_INICIAL: Pista` (`practica.json` pasado por `normalizarPista`).

**Flujo de `ejecutarPrueba`:**
1. Crea el mundo y `new Juez(mundo, robot, { desde })`. La primera pose es la del punto `desde` de `puntosDePartida`.
2. Por cada corrida crea un `Simulador` con:
   - `alPasoFisica` → `juez.actualizar`;
   - `alAvanzar`, que en cada punto de sincronización:
     - llama a `ritmo.esperar(sim.tiempoUs)`;
     - toma el pedido: con `juez.reiniciar(pedido)`, si da `ok`, guarda la pose y llama a `sim.detener()`; si no, deja su `mensaje` para la próxima instantánea;
     - publica una instantánea si pasaron `intervaloMs` desde la anterior (con `reloj.ahora`), con `sensores` de `sim.medirParaVista(azarVista)`, donde `azarVista` es `crearAzar(semilla ^ 0x5bd1e995)`;
     - si `juez.estado.terminado`, llama a `sim.detener()`.
3. La corrida se ejecuta con `ejecutar(Infinity)`.
4. Al terminar la corrida, siempre publica una instantánea final. Después:
   - **detenida con una pose de reinicio:** sube `reinicio` y vuelve al paso 2;
   - **detenida porque el juez terminó:** devuelve `terminado`;
   - **`error`:** devuelve el error.

**Ejemplos:**
- **`pines.h`:**

```cpp
// Pines del robot Dynamis: así está cableado el robot.
#pragma once
const uint8_t PIN_PWM_IZQ = 18, PIN_IN1_IZQ = 16, PIN_IN2_IZQ = 17;
const uint8_t PIN_PWM_DER = 19, PIN_IN1_DER = 4, PIN_IN2_DER = 5;
const uint8_t PINES_QTR[8] = {36, 39, 34, 35, 32, 33, 25, 26};
```

- **`seguidor.ino`:**
  - el seguidor de `tests/integracion/seguidor.test.ts` (calibra girando y después hace control P), con los nombres de `pines.h` y comentarios para estudiantes;
  - las constantes `VELOCIDAD = 100` y `KP = 0.025`;
  - imprime "Calibrando...", "¡Listo! A seguir la línea." y la posición de la línea cada 200 ms (`millis()`);
  - cuando 6 o más valores calibrados pasan de 600 (la barra de la meta), avanza un poco, se detiene, imprime "¡Llegué a la meta!" y espera para siempre (`while (true) delay(1000);`).
  - Si no completa la pista, ajusta solo `VELOCIDAD`, `KP` o cuánto avanza en la meta, y deja un Ruling.
- **`practica.json`:** 8 × 6, luz normal.
  - Recorrido: partida (0,1) → rectas (1,1) y (2,1) → giro suave (3,1) hacia el norte → recta vertical (3,2) → giro suave (3,3) hacia el este → rectas (4,3) y (5,3) → meta (6,3).
  - Hito 1 en el centro de (2,1) con yaw 0. Hito 2 en el centro de (3,2) con yaw 90.
  - Inicio en el centro de la partida, con yaw 0.
  - Las `rot` son las que dejan conectadas las bocas; la prueba lo verifica.

- [ ] **Step 1: Escribir las pruebas que fallan.**
  - **`tests/integracion/ejecucion.test.ts`:**
    - compila con `compilarParaPrueba`;
    - usa velocidad 0 en el control y un reloj falso en que `ahora` sube 1 ms por llamada;
    - la pista es la de 4 × 1 de `tests/integracion/pista.test.ts` (partida, recta, recta, meta, con el hito 1 en (450, 150)), y el sketch, `IR_Y_PARAR` de ese archivo con `Serial.begin(115200); Serial.println("setup");` al inicio de `setup()`.
    - Casos:
      - `publica instantáneas con el Serial nuevo y termina cuando el juez termina`: la concatenación de los `serial` es `'setup\r\n'`, `fin.motivo` es `'terminado'` y `fin.juez.meta` es `true`.
      - `"Volver al último hito" reinicia el programa desde setup en la partida y descuenta 10`: pide `'ultimo'` en la quinta instantánea. Hay 2 líneas `setup`, `fin.juez.reinicios` es 1, y la primera instantánea con `reinicio: 1` tiene `estado.x` a menos de 5 mm de 150.
      - `un pedido rechazado llega como mensaje y la prueba sigue`: pide `'ultimo'` 4 veces, cada una en la instantánea siguiente a un reinicio. Alguna instantánea tiene `mensaje: 'Ya usaste los 3 reinicios.'` y la prueba termina con la meta.
      - `un error del programa termina la prueba con su error`: `void loop() { volatile int z = 0; Serial.println(1 / z); }` termina con `fin.error.tipo` igual a `'division-por-cero'`.
      - `detener() termina la corrida con motivo detenido`: un `Simulador` cuyo `alAvanzar` llama a `detener()` cuando `tiempoUs` llega a 10 000.
      - `medirParaVista no cambia lo que lee el programa`: un sketch que imprime `analogRead(36)` 5 veces, con un modelo QTR ruidoso (`e.azar()`). La salida es igual con y sin llamar a `sim.medirParaVista(crearAzar(7))` en `alAvanzar`.
  - **`tests/integracion/ejemplo.test.ts`:**
    - `la pista de práctica está conectada de la partida a la meta`: recorre las baldosas desde la partida por `bocasDe` y `ladoEnMundo`. Cada boca de salida tiene una baldosa vecina con la boca opuesta, y se llega a la meta.
    - `el ejemplo inicial completa la pista de práctica`: `ejecutarPrueba` con `PROYECTO_INICIAL` compilado, `PISTA_INICIAL`, `ROBOT_POR_DEFECTO`, `desde: 'partida'` y velocidad máxima. Termina con `motivo: 'terminado'`, `hitos: ['alcanzado', 'alcanzado']` y `meta: true`.

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/integracion/ejecucion.test.ts tests/integracion/ejemplo.test.ts`
Expected: FAIL (no existen `ejecucion.ts`, `detener` ni los ejemplos).

- [ ] **Step 3: Implementar** los cambios del simulador, `ejecucion.ts` y los ejemplos.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/integracion/ejecucion.test.ts tests/integracion/ejemplo.test.ts tests/integracion/simulador.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/simulacion src/ejemplos tests/integracion/ejecucion.test.ts tests/integracion/ejemplo.test.ts
git commit -m "La prueba completa: simulador, juez, reinicios desde setup e instantáneas; ejemplo y pista iniciales"
```

---

### Task 6: El worker de simulación y su cliente

**Files:**
- Create: `src/simulacion/trabajador.ts`, `src/simulacion/cliente.ts`.
- Test: `tests/unidad/cliente-simulacion.test.ts`.

**Interfaces:**
- Consumes: `ejecutarPrueba`, `Instantanea` y `FinEjecucion` (Tarea 5); `crearControl`, `pausar`, `fijarVelocidad`, `pedir` e `IDX` (Tarea 4).
- Produces:
  - **Protocolo del worker:**
    - entrada: `{ tipo: 'iniciar'; modulo: WebAssembly.Module; pista: Pista; robot: ConfigRobot; desde: string; semilla: number; control: SharedArrayBuffer }`;
    - salida: `{ tipo: 'instantanea'; datos: Instantanea }` | `{ tipo: 'fin'; datos: FinEjecucion }`.
    - Una excepción no atrapada sale como `fin` con `motivo: 'error'` y un error de tipo `'simulador'`.
  - **`interface EventosSimulacion { alInstantanea(i: Instantanea): void; alTerminar(f: FinEjecucion): void; alAtascarse(): void }`.**
  - **`class ClienteSimulacion`:**
    - `constructor(eventos: EventosSimulacion, crearTrabajador?: () => Worker)`;
    - `iniciar(o: { modulo: WebAssembly.Module; pista: Pista; robot: ConfigRobot; desde: string; semilla: number; velocidad: number }): void`: si ya corría, primero hace `detener()`;
    - `pausar(): void`, `seguir(): void`, `fijarVelocidad(centesimas: number): void` y `pedir(p: Pedido): void`;
    - `detener(): void`: `terminate()` y apaga el vigilante;
    - `get corriendo(): boolean` y `get enPausa(): boolean`.
  - **Vigilante:**
    - revisa el latido cada 500 ms (`setInterval`) mientras corre y no está en pausa;
    - si no cambió en 2000 ms, llama a `alAtascarse()` una sola vez por prueba.

- [ ] **Step 1: Escribir las pruebas que fallan** en `tests/unidad/cliente-simulacion.test.ts`, con un `Worker` falso que guarda lo enviado y `vi.useFakeTimers()`:
  - `iniciar envía el módulo, la pista, el robot, desde y el bloque de control`.
  - `pausar, seguir, velocidad y pedidos escriben en el bloque de control`.
  - `si el latido no cambia en 2 s mientras corre avisa que se atascó, una sola vez`.
  - `en pausa no avisa, y si el latido cambia tampoco`.
  - `detener termina el trabajador y no vuelve a avisar`.
  - `reenvía instantáneas y el fin; después del fin ya no corre`.
  - `iniciar dos veces termina el primer trabajador`.

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/unidad/cliente-simulacion.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar.**
  - `trabajador.ts` es un adaptador delgado: arma `new Int32Array(control)` y llama a `ejecutarPrueba` con `publicar` = `postMessage`.
  - `cliente.ts` crea el worker con `new Worker(new URL('./trabajador.ts', import.meta.url), { type: 'module' })`.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/unidad/cliente-simulacion.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/simulacion/trabajador.ts src/simulacion/cliente.ts tests/unidad/cliente-simulacion.test.ts
git commit -m "Worker de simulación y cliente con vigilante de ciclo sin fin"
```

---

### Task 7: Abrir, guardar y autoguardar proyectos

**Files:**
- Create: `src/proyecto/importar.ts`, `src/proyecto/exportar.ts`, `src/proyecto/almacen.ts`.
- Test: `tests/unidad/importar.test.ts`, `tests/unidad/exportar.test.ts`, `tests/unidad/almacen.test.ts`.

**Interfaces:**
- Consumes: `Proyecto`, `tipoDeArchivo` y `archivoPrincipal` (`src/proyecto/proyecto.ts`).
- Produces:
  - **`importar.ts`:**
    - `interface ArchivoLeido { ruta: string; bytes: Uint8Array }`;
    - `type ResultadoImportacion = { ok: true; proyecto: Proyecto; ignorados: string[] } | { ok: false; mensaje: string }`;
    - `proyectoDesdeArchivos(archivos: ArchivoLeido[]): ResultadoImportacion`;
    - `leerZip(bytes: Uint8Array): ArchivoLeido[]` (con `fflate.unzipSync`, sin directorios);
    - `leerInput(lista: FileList): Promise<ArchivoLeido[]>` (con `webkitRelativePath`, o `name` si viene vacío);
    - `leerArrastre(items: DataTransferItemList): Promise<ArchivoLeido[]>` (con `webkitGetAsEntry`, de forma recursiva);
    - `leerCarpeta(dir: FileSystemDirectoryHandle): Promise<ArchivoLeido[]>`.
  - **`exportar.ts`:**
    - `proyectoAZip(p: Proyecto): Uint8Array`;
    - `nombreZip(p: Proyecto): string`;
    - `guardarEnCarpeta(dir: FileSystemDirectoryHandle, p: Proyecto): Promise<void>`.
  - **`almacen.ts`:**
    - `interface Preferencias { velocidad: number; archivoAbierto?: string }`;
    - `interface DatosGuardados { proyecto: Proyecto; pista: Pista; preferencias: Preferencias }`;
    - `interface Almacen { leer<K extends keyof DatosGuardados>(clave: K): Promise<DatosGuardados[K] | undefined>; guardar<K extends keyof DatosGuardados>(clave: K, valor: DatosGuardados[K]): Promise<void> }`;
    - `abrirAlmacen(fabrica?: IDBFactory): Promise<Almacen | null>`: la base es `simulador-dynamis` y el almacén `datos`; da `null` si IndexedDB no está o falla;
    - `conRetardo<A extends unknown[]>(f: (...a: A) => void, ms?: number): (...a: A) => void`, que espera 500 ms por defecto.

**Reglas de `proyectoDesdeArchivos`:**
- **Carpeta raíz:** si todas las rutas comparten la primera carpeta, esa es el `nombre` y se quita de las rutas. Si no, el nombre es el del primer `.ino` de la raíz, sin la extensión.
- **Qué se ignora** (y se agrega a `ignorados`):
  - rutas con una carpeta que empieza con `.`, o que se llama `node_modules` o `build`;
  - archivos con `tipoDeArchivo` igual a `'otro'`;
  - archivos de más de 1 MB.
- **Texto:** se decodifica como UTF-8 y se quita la BOM.
- **Sin `.ino` en la raíz:** `{ ok: false, mensaje: 'No encontramos un archivo .ino en la carpeta. Un proyecto de Arduino necesita uno.' }`.

**Exportar:**
- `proyectoAZip` pone los archivos dentro de la carpeta `<principal sin .ino>/`, y `nombreZip` da `<principal sin .ino>.zip` (decisión 11).
- `guardarEnCarpeta` escribe cada archivo (crea las subcarpetas) y no borra nada más.

- [ ] **Step 1: Escribir las pruebas que fallan.**
  - **`importar.test.ts`:**
    - `toma el nombre de la carpeta y quita la carpeta de las rutas`: `seguidor/seguidor.ino` y `seguidor/src/util.cpp` dan el nombre `seguidor` y las rutas `seguidor.ino` y `src/util.cpp`.
    - `ignora .git, imágenes y archivos de más de 1 MB, y los informa`.
    - `sin .ino en la raíz da el mensaje y no un proyecto`.
    - `quita la BOM`.
    - `leerZip y proyectoAZip son inversos`.
    - `leerArrastre recorre carpetas anidadas`: con entradas falsas `{ isFile, isDirectory, name, fullPath, file(cb), createReader() }`.
  - **`exportar.test.ts`:**
    - `el zip lleva la carpeta con el nombre del .ino principal`.
    - `guardarEnCarpeta escribe los archivos y crea src/`: con un `FileSystemDirectoryHandle` falso en memoria, con `getDirectoryHandle({ create })`, `getFileHandle({ create })` y `createWritable()`.
  - **`almacen.test.ts`:**
    - con `import 'fake-indexeddb/auto'`, `guarda y lee el proyecto, la pista y las preferencias`;
    - `sin IndexedDB, abrirAlmacen da null`: con una fábrica cuyo `open` lanza;
    - `conRetardo junta varias llamadas en una`: con `vi.useFakeTimers()`.

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/unidad/importar.test.ts tests/unidad/exportar.test.ts tests/unidad/almacen.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** los tres módulos.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/unidad/importar.test.ts tests/unidad/exportar.test.ts tests/unidad/almacen.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/proyecto tests/unidad/importar.test.ts tests/unidad/exportar.test.ts tests/unidad/almacen.test.ts
git commit -m "Abrir carpeta, .zip y arrastre; descargar .zip, guardar en la carpeta y autoguardado"
```

---

### Task 8: El editor con pestañas

**Files:**
- Create: `src/ui/editor.ts`, `src/ui/pestanas.ts`, `src/ui/archivos.ts`.
- Modify: `src/ui/aplicacion.ts`.
- Test: `tests/unidad/archivos.test.ts`, `tests/e2e/editor.spec.ts`, `tests/e2e/proyectos/mi-robot/mi-robot.ino`, `tests/e2e/proyectos/mi-robot/pines.h`.

**Interfaces:**
- Consumes: la Tarea 7 entera, `ordenarArchivos` y `PROYECTO_INICIAL`.
- Produces:
  - **`archivos.ts`** (sin DOM):
    - `validarNombreArchivo(p: Proyecto, nombre: string, actual?: string): string | null`;
    - `puedeBorrar(p: Proyecto, ruta: string): string | null`.
  - **`editor.ts`:**
    - `crearEditor(contenedor: HTMLElement, alCambiar: (texto: string) => void): EditorCodigo`;
    - `interface EditorCodigo { mostrar(texto: string): void; texto(): string; marcarLinea(linea: number | null): void; irALinea(linea: number): void; enfocar(): void }`;
    - tiene un tema propio con la paleta, resaltado C++ (`@codemirror/lang-cpp`) y la línea con error marcada (clase `linea-error`, que se borra al editar).
  - **`pestanas.ts`:** `crearPestanas(contenedor: HTMLElement, eventos: { alElegir(ruta: string): void; alCrear(): void; alRenombrar(ruta: string): void; alBorrar(ruta: string): void }): { pintar(rutas: string[], activa: string): void }`.
    - Las pestañas son `role="tab"`, con flechas izquierda y derecha.
    - Cada una tiene un botón "⋯" con las opciones Renombrar y Borrar, en un `<dialog>`.
    - El botón **+** crea un archivo.
  - **Mensajes de `validarNombreArchivo`:**
    - vacío: `Escribe un nombre para el archivo.`;
    - extensión: `El archivo debe terminar en .ino, .h, .hpp, .c o .cpp.`;
    - caracteres fuera de `[A-Za-z0-9_\-./]`, `..` o una `/` al inicio: `Usa solo letras sin tilde, números, guiones y puntos.`;
    - repetido: `Ya existe un archivo con ese nombre.`.
  - **`puedeBorrar`:** con el único `.ino`, da `Tu proyecto necesita al menos un archivo .ino.`.

**En `aplicacion.ts`:**
- **Al iniciar:** carga el proyecto, la pista y las preferencias del almacén. Si no hay nada guardado, usa `PROYECTO_INICIAL` y `PISTA_INICIAL`.
- **Mientras se edita:** autoguarda con `conRetardo`. `chip-carpeta` muestra `Carpeta: <nombre>`.
- **Abrir:**
  - "Abrir carpeta" usa `showDirectoryPicker` si existe (y muestra `btn-guardar-carpeta`); si no, `in-carpeta`.
  - Arrastrar una carpeta sobre el editor también la abre, y "Abrir .zip" usa `in-zip`.
  - Una importación fallida muestra su mensaje en la burbuja y no cambia el proyecto abierto. Una exitosa con ignorados lo dice en "Mensajes del robot".
- **"Descargar mi proyecto":** descarga `proyectoAZip` con `nombreZip`.
- **Sin almacén:** si `abrirAlmacen` da `null`, la app sigue, y en "Mensajes del robot" aparece una línea del sistema: "No se pudo activar el guardado automático en este navegador: descarga tu proyecto para no perderlo."

- [ ] **Step 1: Escribir las pruebas que fallan.**
  - **`archivos.test.ts`:** un caso por cada mensaje de `validarNombreArchivo` y de `puedeBorrar`, y `renombrar un archivo con su mismo nombre es válido`.
  - **`tests/e2e/editor.spec.ts`:**
    - `abre con el seguidor: pestañas seguidor.ino y pines.h, y el código en el editor`.
    - `editar, recargar y el cambio sigue ahí`: escribe `// hola` en `seguidor.ino`, espera 1 s y recarga.
    - `+ crea util.h, que queda como pestaña; un nombre inválido muestra el mensaje`.
    - `abrir una carpeta con pines.h la muestra en pestañas`: `setInputFiles('#in-carpeta', 'tests/e2e/proyectos/mi-robot')`. Las pestañas son `mi-robot.ino` y `pines.h`, y `chip-carpeta` muestra `Carpeta: mi-robot`.
  - **Fixture:** `mi-robot.ino` incluye `"pines.h"`, mueve los motores con sus constantes e imprime "hola".

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/unidad/archivos.test.ts; npx playwright test tests/e2e/editor.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** `archivos.ts`, `editor.ts` y `pestanas.ts`, y conectarlos en `aplicacion.ts`.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/unidad/archivos.test.ts && npx playwright test tests/e2e/editor.spec.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui tests/unidad/archivos.test.ts tests/e2e/editor.spec.ts tests/e2e/proyectos
git commit -m "Editor con pestañas: crear, renombrar y borrar archivos, abrir carpeta, .zip y arrastre, y autoguardado"
```

---

### Task 9: Mensajes del robot

**Files:**
- Create: `src/ui/bitacora.ts`, `src/ui/consola.ts`.
- Modify: `src/ui/aplicacion.ts` (en desarrollo, `__pruebas.mensajes(t, texto)`).
- Test: `tests/unidad/bitacora.test.ts`, `tests/e2e/consola.spec.ts`.

**Interfaces:**
- Produces:
  - **`bitacora.ts`** (sin DOM):
    - `interface LineaConsola { t: number; texto: string; tipo: 'serial' | 'sistema' }`;
    - `class Bitacora`:
      - `constructor(maximo = 500)`;
      - `agregarSerial(t: number, texto: string): void`: corta en `\n` y quita el `\r`. Una línea sin terminar queda abierta y la siguiente escritura la continúa. Su `t` es el de cuando empezó;
      - `agregarSistema(t: number, texto: string): void`;
      - `get lineas(): LineaConsola[]`: las cerradas, las últimas `maximo`;
      - `get abierta(): LineaConsola | null`;
      - `limpiar(): void`;
      - `get version(): number`: sube con cada cambio, así la consola redibuja solo una vez por cuadro.
    - `formatoTiempo(t: number): string` da `"12,3 s"` (una decimal, con coma).
  - **`consola.ts`:** `crearConsola(caja: HTMLElement, pildora: HTMLElement, botonLimpiar: HTMLElement, bitacora: Bitacora): { refrescar(): void }`.
    - Redibuja en `requestAnimationFrame` solo si cambió `version`.
    - Está "pegada al final" si `scrollTop + clientHeight >= scrollHeight − 4`. Si lo está, baja al final; si no, muestra `pildora-nuevos`, y su clic baja al final.
    - Las líneas del sistema llevan la clase `sistema`.
    - Al volver a la vista Programar, se muestra lo último.

- [ ] **Step 1: Escribir las pruebas que fallan.**
  - **`bitacora.test.ts`:**
    - `corta en líneas y quita \r`;
    - `una línea sin terminar sigue con la próxima escritura y conserva su tiempo`;
    - `guarda solo las últimas 500`;
    - `limpiar borra todo, también la abierta`;
    - `formatoTiempo usa una decimal con coma`.
  - **`tests/e2e/consola.spec.ts`:**
    - `los mensajes nuevos empujan hacia arriba mientras se mira el final`: 300 líneas con `__pruebas.mensajes`; la última es visible.
    - `si el usuario sube, la vista no se mueve y aparece "Mensajes nuevos ↓"; su clic vuelve al final`.
    - `Limpiar borra los mensajes`.

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/unidad/bitacora.test.ts; npx playwright test tests/e2e/consola.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** `bitacora.ts` y `consola.ts`, y conectarlos en `aplicacion.ts`.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/unidad/bitacora.test.ts && npx playwright test tests/e2e/consola.spec.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui tests/unidad/bitacora.test.ts tests/e2e/consola.spec.ts
git commit -m "Mensajes del robot: scroll pegado al final, 500 líneas y un dibujo por cuadro"
```

---

### Task 10: El lienzo de la pista

**Files:**
- Create: `src/ui/vista.ts`, `src/ui/lienzo.ts`, `src/ui/dibujo.ts`.
- Modify:
  - `src/mundo/superficie.ts` (exporta `colorVisible`);
  - `src/ui/aplicacion.ts` (en desarrollo, `__pruebas.lienzo`).
- Test: `tests/unidad/vista.test.ts`, `tests/unidad/superficie.test.ts`, `tests/e2e/lienzo.spec.ts`.

**Interfaces:**
- Consumes:
  - `figurasDe` (`catalogo.ts`) y `aMundo` (`baldosas.ts`);
  - `crearRelieve` (`relieve.ts`), `huellaRobot` (`config.ts`) y `puntosQTR`, `poseVL53` y `puntoTCS` (`sensores.ts`);
  - `Instantanea` (Tarea 5).
- Produces:
  - **`superficie.ts`:** `colorVisible(b: Baldosa, f: Figura | null): string` (hex). Es la misma regla que ya usa `color(x, y)`, que pasa a usarla:
    - fondo o cinta según `invertida`;
    - una figura de rol `linea`, al revés;
    - una marca, de su color o del de la cinta.
  - **`vista.ts`** (sin DOM):
    - `interface Vista { escala: number; x0: number; y0: number }`, con la escala en px por mm;
    - `vistaInicial(anchoPx: number, altoPx: number, columnas: number, filas: number): Vista`: toda la pista centrada, con 16 px de margen;
    - `aPantalla(v: Vista, x: number, y: number): { px: number; py: number }`, con `y` invertida;
    - `aMundoDesde(v: Vista, px: number, py: number): { x: number; y: number }`;
    - `acercar(v: Vista, factor: number, px: number, py: number, minima: number): Vista`: deja fijo el punto bajo el cursor, con la escala entre `minima` y `minima · 8`;
    - `desplazar(v: Vista, dx: number, dy: number): Vista`.
  - **`dibujo.ts`:**
    - `dibujarPista(ctx: CanvasRenderingContext2D, v: Vista, pista: Pista): void`:
      - cada baldosa con sus figuras, en su marco local y con `colorVisible`;
      - la rejilla suave;
      - las rampas con un degradado y una flecha hacia arriba, solo en pantalla;
      - los obstáculos, los baches, los hitos (círculo amarillo con su número), los desafíos (etiqueta con su nombre) y la flecha de inicio.
    - `dibujarRobot(ctx: CanvasRenderingContext2D, v: Vista, i: Instantanea | null, pose: Pose, robot: ConfigRobot, rastro: { x: number; y: number }[]): void`:
      - el rastro, en celeste;
      - la huella con cara, como en la maqueta, agrandada por `1 + min(z, 200) / 400`;
      - el rayo del VL53L0X hasta `min(distanciaMm, 2000)`;
      - los 8 puntos del QTR, en amarillo si su lectura pasa de 2000;
      - el punto del TCS, con el color que lee.
  - **`lienzo.ts`:** `crearLienzo(canvas: HTMLCanvasElement, robot: ConfigRobot): { mostrarPista(p: Pista): void; mostrarInstantanea(i: Instantanea): void; reiniciar(pose: Pose): void }`.
    - Ajusta el tamaño al contenedor con `devicePixelRatio`.
    - La rueda del mouse acerca y aleja, y arrastrar desplaza.
    - El rastro guarda hasta 4000 puntos y se corta en cada `reinicio`.
    - Dibuja con `requestAnimationFrame`.

- [ ] **Step 1: Escribir las pruebas que fallan.**
  - **`vista.test.ts`:**
    - `vistaInicial muestra toda la pista con margen`: 8 × 6 en 1000 × 600 px; las esquinas caen dentro de [16, 984] × [16, 584].
    - `aPantalla y aMundoDesde son inversas`.
    - `acercar deja fijo el punto bajo el cursor y respeta los límites`.
  - **`superficie.test.ts`:** agregar `colorVisible da lo mismo que color(x, y) en una baldosa normal, en una invertida y en una marca`.
  - **`tests/e2e/lienzo.spec.ts`:**
    - `lo que se ve es lo que siente el robot`: lee píxeles del lienzo con `__pruebas.lienzo.aPantalla`. En el centro de la línea de la recta (450, 450) es oscuro (r + g + b < 150). A 60 mm de ella, en (450, 510), es claro (r + g + b > 600).
    - `la rueda del mouse acerca la vista`: la escala de `__pruebas.lienzo.vista()` aumenta.

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/unidad/vista.test.ts tests/unidad/superficie.test.ts; npx playwright test tests/e2e/lienzo.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** `colorVisible`, `vista.ts`, `dibujo.ts` y `lienzo.ts`.
  - `aplicacion.ts` muestra la pista y el robot en el punto de partida al cargar.
  - En desarrollo, `__pruebas.lienzo` expone `{ aPantalla(x, y), vista() }`.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/unidad/vista.test.ts tests/unidad/superficie.test.ts && npx playwright test tests/e2e/lienzo.spec.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui src/mundo/superficie.ts tests/unidad/vista.test.ts tests/unidad/superficie.test.ts tests/e2e/lienzo.spec.ts
git commit -m "Lienzo de la pista: las mismas figuras que siente el robot, rampas, objetos, robot, rastro y zoom"
```

---

### Task 11: Lo que siente el robot y el juez virtual

**Files:**
- Create: `src/ui/lecturas.ts`, `src/ui/tarjetas.ts`, `src/ui/juez.ts`.
- Modify: `src/ui/aplicacion.ts`.
- Test: `tests/unidad/lecturas.test.ts`, `tests/e2e/tarjetas.spec.ts`.

**Interfaces:**
- Consumes: `Instantanea` y `LecturasVista` (Tarea 5), `EstadoJuez` y `puntosDePartida`.
- Produces:
  - **`lecturas.ts`** (sin DOM):
    - `posicionLinea(qtr: number[]): number | null`:
      - `v_i = round(min(qtr_i, 4095) / 4095 · 1000)`;
      - promedio de `v_i · 1000 · i` sobre los `v_i > 50`;
      - `null` si ningún `v_i` pasa de 200 (los umbrales de `QTRSensors`).
    - `nombreColor(c: LecturaTCS): string`:
      - `'Negro'` si `c < 300`;
      - `'Blanco'` si `(max − min) / max < 0,2` y `c > 1500`;
      - `'Gris'` si `(max − min) / max < 0,2` y `c ≤ 1500`;
      - si no, el canal dominante: `'Rojo'`, `'Verde'` o `'Azul'`.
    - `colorMuestra(c: LecturaTCS): string`: el hex de `round(canal / max(r, g, b, 1) · 255)`. Con `c < 300` da `#000000`.
    - `rumboGrados(yaw: number): number`: entero de 0 a 359.
    - `textoInclinacion(pitch: number): string`, con `g = round(−pitch · 180 / π)`:
      - `|g| < 2`: `'Plano'`;
      - `g > 0`: `'Inclinación ${g}°, subiendo'`;
      - `g < 0`: `'Inclinación ${−g}°, bajando'`.
    - `porcentajeMotor(m: EstadoMotor): number`: de −100 a 100. En freno o libre da 0, en retroceso es negativo, y nunca −0.
    - `textoDistancia(mm: number): string`: `'Sin objetivo'` desde 8190; si no, `'${mm} mm'`.
    - `textoTiempoRestante(tiempo: number | null): string`: `'Quedan 5:00'` con `null`; si no, `'Quedan m:ss'` de `300 − tiempo`, sin bajar de 0.
  - **`tarjetas.ts`:** `crearTarjetas(raiz: Document): { mostrar(l: LecturasVista | null, e: Instantanea['estado'] | null, m: Motores | null): void }`.
    - Las 5 tarjetas de la maqueta. Con `null` muestran "—".
    - "¿Cómo lo uso?" despliega el `<pre>` de ejemplo de cada una.
  - **`juez.ts`:** `crearTarjetaJuez(raiz: Document, eventos: { alPedir(p: Pedido): void; alElegirDesde(id: string): void }): { mostrarPista(p: Pista): void; mostrar(e: EstadoJuez | null): void; habilitar(corriendo: boolean): void; desde(): string }`. Muestra:
    - un círculo por hito de la pista y la meta, amarillos al alcanzarlos;
    - `juez-pts`, `juez-rein` como `"${n} de 3"`, `juez-tiempo` y los últimos 3 eventos;
    - `sel-desde`, con los puntos de partida;
    - `btn-ultimo-hito` y `btn-saltar-hito`, habilitados solo mientras corre y quedan reinicios.

- [ ] **Step 1: Escribir las pruebas que fallan.**
  - **`lecturas.test.ts`:**
    - `posicionLinea`: los 8 sensores en 180 salvo el 3 y el 4 en 3980 da 3500; todos en 180 da `null`; solo el 0 en 3980 da 0.
    - `nombreColor y colorMuestra` con las lecturas del placeholder a 24 ms y ganancia 4:
      - blanco `{960, 960, 960, 2880}`: `'Blanco'` y `#ffffff`;
      - cinta `{0, 0, 0, 0}`: `'Negro'` y `#000000`;
      - marca verde `{0, 625, 305, 930}`: `'Verde'`.
    - `textoInclinacion(−0.349)` es `'Inclinación 20°, subiendo'`; `textoInclinacion(0.01)` es `'Plano'`.
    - `rumboGrados(−π/2)` es 270.
    - `porcentajeMotor` en avance 0,5 da 50; en retroceso 0,5 da −50; con freno da 0 y `Object.is(…, -0)` es falso.
    - `textoDistancia(8190)` es `'Sin objetivo'`.
    - `textoTiempoRestante(null)` es `'Quedan 5:00'`; con 61,5 da `'Quedan 3:58'`; con 400 da `'Quedan 0:00'`.
  - **`tests/e2e/tarjetas.spec.ts`:**
    - `antes de probar, las tarjetas muestran — y el juez muestra 2 hitos, la meta, "Quedan 5:00" y "0 de 3"`.
    - `Partir desde ofrece Partida, Hito 1 y Hito 2`.
    - `¿Cómo lo uso? muestra el código de ejemplo del QTR`.

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/unidad/lecturas.test.ts; npx playwright test tests/e2e/tarjetas.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** `lecturas.ts`, `tarjetas.ts` y `juez.ts`, y conectarlos en `aplicacion.ts` (estado inicial).

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/unidad/lecturas.test.ts && npx playwright test tests/e2e/tarjetas.spec.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui tests/unidad/lecturas.test.ts tests/e2e/tarjetas.spec.ts
git commit -m "Tarjetas de sensores y del juez virtual, con el punto de partida elegible"
```

---

### Task 12: "Probar mi robot" de punta a punta, y documentación

**Files:**
- Create: `src/ui/acciones.ts`, `src/ui/burbuja.ts`, `src/ui/avisos.ts`.
- Modify: `src/ui/aplicacion.ts`, `README.md`, `docs/superpowers/specs/2026-10-17-simulador-dynamis-design.md`.
- Test: `tests/e2e/probar.spec.ts`.

**Interfaces:**
- Consumes: todo lo anterior.
- Produces:
  - **`acciones.ts`:**
    - `type EstadoApp = 'listo' | 'preparando' | 'compilando' | 'corriendo' | 'pausa' | 'terminado' | 'detenido' | 'error'`;
    - `textoEstado(e: EstadoApp, progreso?: number): string`;
    - `crearAcciones(raiz: Document, eventos: { alProbar(): void; alDetener(): void; alPausar(): void; alSeguir(): void; alInicio(): void; alVelocidad(centesimas: number): void }): { mostrar(e: EstadoApp, progreso?: number): void; fijarVelocidad(centesimas: number): void }`.
  - **`burbuja.ts`:** `crearBurbuja(raiz: Document, eventos: { alIrALinea(archivo: string, linea: number): void }): { mostrar(m: MensajeAmigable | ErrorEjecucion | { titulo: string; mensaje: string; boton?: { texto: string; alClic(): void } }): void; ocultar(): void }`. Tiene "Ver mensaje técnico", que despliega `tecnico`.
  - **`avisos.ts`:** `crearAvisos(raiz: Document): { logro(texto: string): void; aviso(texto: string): void }`. Los avisos desaparecen a los 4 s; con `prefers-reduced-motion`, sin animación.

**Textos de `textoEstado`:**

| Estado | Texto |
|---|---|
| listo | `Listo para probar` |
| preparando | `Preparando tu laboratorio, solo la primera vez… ${progreso} %` |
| compilando | `Revisando tu programa…` |
| corriendo | `El robot está corriendo` |
| pausa | `En pausa` |
| terminado | `Terminó la prueba` |
| detenido | `Detenido` |
| error | `Hay que revisar algo` |

**Flujo en `aplicacion.ts`:**
- **"Probar mi robot"** (en los estados listo, terminado, detenido y error):
  - prepara el compilador si hace falta, con la barra de progreso;
  - compila;
  - con un error, muestra `primerError` en la burbuja, salta a esa pestaña y línea, la marca, y pasa a `error`;
  - si compila, inicia el `ClienteSimulacion` con la pista abierta (la guardada o `PISTA_INICIAL`), `ROBOT_POR_DEFECTO`, el `desde` del selector, una semilla de `crypto.getRandomValues` y la velocidad elegida.
  - Mientras está en preparando, compilando, corriendo o pausa, el mismo botón dice **"Detener"**.
  - Detener durante la compilación descarta ese resultado: cada clic tiene un número, y un resultado de un clic viejo se ignora.
- **Cada instantánea:**
  - lienzo, tarjetas y juez;
  - `chip-tiempo` con `t = ${formatoTiempo(t)}`;
  - el `serial` va a la bitácora y los `avisos`, como líneas del sistema;
  - los eventos nuevos del juez van a los avisos (decisión 9), y el `mensaje` de un pedido rechazado, a `aviso`.
- **Fin:**
  - `terminado` muestra "¡Terminaste la prueba con N puntos!" como logro;
  - `error` muestra el `ErrorEjecucion` en la burbuja (para `tipo: 'simulador'`, el técnico tiene la pila del profe).
- **`alAtascarse`:** la burbuja con el texto de "ciclo sin fin" de las Global Constraints y el botón "Detener".
- **Falla de preparación:** la burbuja con "No pudimos preparar el compilador. Revisa tu conexión a internet." y el botón "Reintentar", que vuelve a preparar.
- **Volver al inicio:** detiene, vuelve el robot al punto de partida elegido, borra el rastro, deja el juez en su estado inicial y no borra los mensajes.
- **Pausa/Seguir:** cambia el texto del botón (`txt-pausa`).
- **Velocidad:** `vel` va de 0 a 4 ↦ [25, 50, 100, 200, 400]; `vel-out` muestra ×0,25, ×0,5, ×1, ×2 o ×4. Se guarda en las preferencias.
- **Editar el código durante una prueba** no la cambia; el próximo "Probar" recompila.

- [ ] **Step 1: Escribir las pruebas de punta a punta que fallan** en `tests/e2e/probar.spec.ts`. Cada prueba parte con el almacenamiento limpio, así abre con el ejemplo.
  - `Probar mi robot compila, el robot se mueve y llegan los mensajes`:
    - el estado pasa a "El robot está corriendo" y el botón dice "Detener";
    - antes de 20 s, `chip-tiempo` pasa de `t = 0,0 s`;
    - la consola contiene "Calibrando...";
    - la `x` del robot (`__pruebas.robot()`) cambia.
  - `un error de sintaxis muestra la burbuja con archivo y línea, y el editor salta ahí`:
    - borra el `;` de una línea conocida de `seguidor.ino` y prueba;
    - la burbuja dice `Ups, revisa la línea N de seguidor.ino` y "Falta un punto y coma";
    - la línea N tiene la clase `linea-error`.
  - `abrir una carpeta con pines.h y probarla funciona`: el fixture de la Tarea 8; la consola dice "hola".
  - `"Volver al último hito" descuenta 10 y reinicia desde setup`:
    - después de "Calibrando...", clic en `btn-ultimo-hito`;
    - `juez-rein` dice `1 de 3`;
    - "Calibrando..." aparece 2 veces en la consola.
  - `pausa congela el tiempo y Seguir lo retoma`.
  - `un while(true){} sin delay muestra el aviso de ciclo sin fin y Detener lo para`:
    - sketch `void setup() {} void loop() { while (true) {} }`;
    - aparece el texto exacto antes de 6 s, y su "Detener" deja el estado en "Detenido".
  - `un Serial.println en loop sin delay no congela la página`:
    - sketch `void setup() { Serial.begin(115200); } void loop() { Serial.println(millis()); }`;
    - después de 3 s, un clic en Pausa responde en menos de 1 s, y la consola tiene 500 líneas o menos.
  - `dos clics seguidos en Probar dejan una sola prueba corriendo`:
    - doble clic: el estado termina en "Detenido" o "El robot está corriendo", nunca dos simulaciones;
    - `__pruebas.trabajadoresVivos()` ≤ 1.
  - `sin compilador muestra Reintentar`:
    - `page.route('**/llvm.core.wasm', r => r.abort())` → aparece "No pudimos preparar el compilador";
    - se quita la ruta, y "Reintentar" llega a "El robot está corriendo".
  - En desarrollo, `__pruebas` agrega `robot(): { x: number; y: number } | null` y `trabajadoresVivos(): number`.

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx playwright test tests/e2e/probar.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** `acciones.ts`, `burbuja.ts` y `avisos.ts`, y el flujo en `aplicacion.ts`.

- [ ] **Step 4: Correr todas las pruebas**

Run: `npm test && npx playwright test && npm run typecheck && npm run build`
Expected: todas pasan; el build genera `dist/`.

- [ ] **Step 5: Documentación.**
  - **`README.md`:**
    - el estado pasa a "fase 4 de 7 — la interfaz para programar";
    - los comandos `npm run dev`, `npm run build`, `npm run preview` y `npm run e2e`;
    - el enlace al plan de la fase 4.
  - **Spec:**
    - §19: "Mi robot" pasa a la fase 5 (decisión 1);
    - §12: las decisiones 2, 8, 9, 10 y 12;
    - §3: las decisiones 3, 4 y 5;
    - §5: la fila de `undefined symbol` (decisión 7);
    - §13: la decisión 11.

- [ ] **Step 6: Commit**

```bash
git add src/ui tests/e2e/probar.spec.ts README.md docs/superpowers/specs/2026-10-17-simulador-dynamis-design.md
git commit -m "Probar mi robot de punta a punta: estados, pausa, velocidad, reinicios, errores y vigilante; documentación de la fase 4"
```
