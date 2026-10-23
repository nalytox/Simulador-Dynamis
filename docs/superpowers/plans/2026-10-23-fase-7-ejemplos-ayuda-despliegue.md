# Fase 7: Ejemplos, ayuda y despliegue — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar el simulador listo para usar en clases:
- las ventanas **Ejemplos** (9 proyectos y 3 pistas) y **Ayuda**;
- el recorrido de la primera visita;
- la app publicada en GitHub Pages, instalable y usable sin internet después de la primera carga.

**Architecture:**
- Los ejemplos son carpetas Arduino reales (`src/ejemplos/proyectos/<id>/`) y pistas `.json`, reunidos en un catálogo (`src/ejemplos/index.ts`). Cada proyecto se prueba en Node, en su pista, con el juez.
- La Ayuda y el recorrido son módulos de UI como las ventanas de las fases 5 y 6. Sus textos dinámicos (conexiones, puntaje) salen de funciones puras.
- Un solo service worker, generado al construir por un plugin de Vite, hace dos cosas:
  - agrega COOP/COEP (técnica de `coi-serviceworker`);
  - guarda la app en caché, y el compilador la primera vez que se usa.
- Un workflow de GitHub Actions construye y publica `dist/`.

**Tech Stack:** Vite 8 + TypeScript estricto, Vitest, Playwright (Chromium en `/opt/pw-browsers/chromium`), GitHub Actions (`actions/upload-pages-artifact`, `actions/deploy-pages`).

**Spec:** `docs/superpowers/specs/2026-10-17-simulador-dynamis-design.md`:
- §12: Ejemplos, Ayuda, Primera visita y accesibilidad;
- §13: caché del service worker;
- §14: descarga del compilador y aislamiento;
- §15: pruebas extremo a extremo;
- §16: uso y despliegue;
- §7: nota del I2C;
- §8: "Conexiones de mi robot";
- §19, punto 7.

Maqueta: `docs/maqueta/simulador-dynamis.html`.

**Decisiones que toma este plan** (la Tarea 8 las lleva a la spec):

1. **Proyectos de ejemplo.** Son 9: el del comienzo ("Seguidor de línea") más los 8 de §12.

   | id | Nombre | Se prueba en |
   |---|---|---|
   | `seguidor` | Seguidor de línea | Práctica FIRVI |
   | `mover-motores` | Mover los motores | Práctica FIRVI |
   | `leer-linea` | Leer la línea | Práctica FIRVI |
   | `seguidor-pid` | Seguidor de línea con PID | Práctica FIRVI |
   | `leer-giroscopio` | Leer el giroscopio | Práctica FIRVI |
   | `cruzar-cortes` | Cruzar cortes | Cruces con marcas |
   | `marcas-color` | Leer marcas de color en cruces | Cruces con marcas |
   | `subir-rampa` | Subir la rampa | Rampa y baches |
   | `esquivar-obstaculo` | Esquivar el obstáculo | Rampa y baches |

   - Cada uno es una carpeta `src/ejemplos/proyectos/<id>/` con `<id>.ino` y un `pines.h` igual al del seguidor, porque el Arduino IDE exige que la carpeta se llame como el `.ino`.
   - Los comentarios y los mensajes del `Serial` van en español.
   - Solo usan la API de §7: compilan sin cambios en el Arduino IDE para el ESP32.
   - `seguidor` se queda en `src/ejemplos/seguidor/`, porque las pruebas de las fases 4 a 6 lo usan.
2. **Pistas de ejemplo.** Las tres son de 8 × 6 baldosas.
   - **`practica` → "Práctica FIRVI":** la pista actual. Solo cambia su nombre (antes "Práctica") y conserva sus 2 hitos.
   - **`cruces` → "Cruces con marcas":** partida, un cruce sin marcas, una línea con cortes, un cruce con marca a la izquierda, uno con marca a la derecha y la meta, con 8 hitos.
   - **`rampa` → "Rampa y baches":** partida, rampa de subida y de bajada, al menos 2 baches, el obstáculo (F4) y la meta, con 8 hitos.

   Las dos nuevas no dan ningún aviso en `revisarPista`. Ninguna exige dar la vuelta (180°).
3. **Ventana "Ejemplos":**
   - es un `<dialog>` modal con dos listas, "Proyectos" y "Pistas";
   - cada tarjeta muestra el nombre y la descripción, y un botón "Abrir";
   - la tarjeta de un proyecto dice "Se prueba en la pista «X»" y tiene un botón "Abrir esa pista";
   - abrir pide confirmar con las reglas que ya existen (proyecto: `puedeReemplazar` de `programa.ts`; pista: la de `archivo-pista.ts`);
   - después cierra la ventana y muestra Programar;
   - una pista abierta mientras corre una prueba sigue la regla de §12: va al editor, y a Programar al volver al inicio.
4. **Ventana "Ayuda".** Es un `<dialog>` con 4 pestañas:
   - **Sensores:** una guía por sensor (QTR, VL53L0X, TCS34725, MPU6050 con Adafruit, MPU6050 con i2cdevlib, motores TB6612). Cada guía trae un **programa completo que compila**, con un botón "Copiar". El aviso de la dirección I2C repetida (`0x29`) va en las guías del VL53L0X y del TCS34725.
   - **Conexiones de mi robot:** se genera desde el robot de "Mi robot" cada vez que se abre la Ayuda. Trae el botón "Cambiar en Mi robot".
   - **Las bases:**
     - qué hace cada pieza, en una tabla estática;
     - cómo se puntúa: la lista sale de las constantes del juez, que se exportan.
   - **Primeros pasos:** "Ver el recorrido de nuevo", cómo usar el simulador sin internet y el botón "Instalar en este computador" si se puede.
5. **Recorrido de la primera visita:**
   - 4 pasos con la mascota y los textos exactos de §12: "Este es tu código" (`#editor`), "Presiona aquí para probar" (`#btn-probar`), "Aquí ves lo que siente tu robot" (`.sensores`) y "Aquí construyes la pista" (`#tab-pista`);
   - un bocadillo junto a cada elemento, que queda resaltado;
   - botones "Saltar" y "Siguiente" (el último es "¡Listo!"); `Esc` = Saltar;
   - el foco entra al bocadillo y, al cerrarlo, vuelve a `#btn-probar`.
   - Se recuerda en `localStorage['dynamis.recorrido'] = 'visto'`: es una comodidad del navegador, no un dato del trabajo (§13). Si `localStorage` falla, se muestra y no se rompe nada.
   - Solo aparece si la app arrancó (con aislamiento).
   - Las pruebas e2e parten con `storageState` que ya lo marca como visto.
6. **Service worker:** `sw.js`, uno solo.
   - Lo genera al construir un plugin de Vite desde `src/pwa/servicio.ts`, con la lista de archivos del build y una versión.
   - **Cómo pide cada cosa:**
     - las navegaciones: primero la red y, si falla, la caché;
     - un GET del mismo origen: primero la caché y, si no está, la red, y lo guarda;
     - el compilador (`llvm*.wasm`, `llvm-resources*.tar`, `nucleo*.a`) no se guarda al instalar, sino cuando se usa por primera vez.
   - Toda respuesta lleva `Cross-Origin-Opener-Policy: same-origin` y `Cross-Origin-Embedder-Policy: require-corp`.
   - Al activarse, borra de la caché lo que no está en la lista nueva (el compilador sobrevive si su nombre no cambió) y toma control de las páginas.
   - Solo se registra en producción.
7. **Aislamiento al arrancar** (`src/pwa/registrar.ts`):
   - **Con aislamiento:** en producción, igual registra el service worker (para la caché).
   - **Sin aislamiento, con service worker disponible y sin haber recargado:** lo registra, marca `sessionStorage['dynamis.recargado']` y recarga una vez cuando el worker controla la página.
   - **Si no:** muestra el aviso que ya existe (`SIN_AISLAMIENTO`).
8. **PWA:**
   - `public/manifest.webmanifest`: `name` "Simulador Dynamis", `short_name` "Dynamis", `lang` "es-CL", `start_url` "./", `scope` "./", `display` "standalone", `theme_color` "#0B0F98", `background_color` "#F4FAFF";
   - íconos PNG de 192 y 512, y uno de 512 `maskable`, hechos desde la mascota con `scripts/iconos.mjs` y guardados en el repo; favicon SVG.
   - **Botón "Instalar en este computador"** (`#btn-instalar`, en la banda):
     - está oculto hasta `beforeinstallprompt`;
     - al hacer clic llama a `prompt()`;
     - si se acepta, se oculta y prepara el compilador, para que quede en caché y funcione sin internet.
9. **Sin internet y sin compilador guardado:** si `preparar` falla con `navigator.onLine === false`, la burbuja dice:
   - título: "Falta internet para la primera vez";
   - mensaje: "La primera vez el simulador descarga su compilador. Conéctate a internet y presiona Reintentar; después funciona sin conexión.".
10. **Despliegue:** `.github/workflows/publicar.yml` corre al hacer *push* a `main` o con `workflow_dispatch`:
    - Node 22, `npm ci`, `npm run typecheck`, `npm test`, `npm run build`;
    - `node scripts/revisar-dist.mjs dist`: ningún archivo de 100 MB o más, y existen `sw.js`, `manifest.webmanifest` e `index.html`;
    - `actions/upload-pages-artifact` y `actions/deploy-pages`.
11. **E2E de la versión publicada:**
    - `playwright.produccion.config.ts` y `npm run e2e:produccion`;
    - `scripts/servir-dist.mjs` sirve `dist/` en `/Simulador-Dynamis/` **sin** COOP/COEP (como GitHub Pages), en el puerto 5180.
12. **Sin dependencias nuevas de npm.** El service worker se escribe a mano, sin `vite-plugin-pwa`.

## Global Constraints

- Todo el texto de la UI va en español de Chile, tuteando, para estudiantes de 14 a 16 años (§12).
- Paleta de §12: `--azul #0B0F98`, `--celeste #65C7F7`, `--hielo #DDF4FF`, `--nube #F4FAFF`, `--sol #FFD166`, `--rosa #FF9FAD`. La tinta del texto es `#12164A`; el celeste nunca es color de texto sobre blanco.
- Tipografías autoalojadas: Fredoka (títulos), Lexend (texto), JetBrains Mono (código).
- Todo se usa con teclado y el foco siempre se ve. Los objetivos táctiles miden al menos 40 px. Se respeta `prefers-reduced-motion`.
- El objetivo son notebooks y Chromebooks (≥ 1024 px). En pantallas angostas las columnas se apilan.
- El código de los ejemplos y de la Ayuda compila sin cambios en el Arduino IDE para el ESP32 (criterio de éxito 2): solo la API de §7.
- Ningún archivo de `dist/` llega a 100 MB (límite de GitHub Pages, §16).
- El texto de un estudiante o de un archivo nunca se inserta con `innerHTML`.

## Review Focus

1. **Abrir un ejemplo sobre un trabajo cambiado:** con el proyecto o la pista editados, abrir un ejemplo pide confirmar, y "Cancelar" deja todo como estaba. Pruebas e2e en la Tarea 4.
2. **Una versión nueva llega a los estudiantes:** el service worker no puede servir para siempre un `index.html` viejo, y no debe volver a descargar el compilador si no cambió. Pruebas unitarias en la Tarea 7: "una navegación usa la red primero" y "sobrantes conserva el compilador vigente".
3. **Sin internet antes de haber probado nunca:** un mensaje claro que dice que la primera vez se necesita internet, con "Reintentar", sin quedarse cargando. E2E de producción en la Tarea 7.
4. **El recorrido en una pantalla de 1024 × 640 y con teclado:** el bocadillo queda entero dentro de la ventana, `Esc` lo cierra y el foco entra y sale bien. E2E en la Tarea 5.
5. **La Ayuda coincide con el robot:**
   - cada programa de las guías compila y corre sin avisos de cableado con el robot por defecto (integración, Tarea 6);
   - "Conexiones de mi robot" muestra un pin cambiado en "Mi robot" (e2e, Tarea 6).

---

### Task 1: Pistas de ejemplo y catálogo

**Files:**
- Create:
  - `src/ejemplos/pistas/cruces.json`
  - `src/ejemplos/pistas/rampa.json`
  - `tests/ayuda/recorrido.ts`
  - `tests/unidad/ejemplos.test.ts`
- Modify:
  - `src/ejemplos/pistas/practica.json`: `nombre` pasa a "Práctica FIRVI";
  - `src/ejemplos/index.ts`;
  - `tests/e2e/ajustar.spec.ts:33`: espera "Práctica FIRVI".

**Interfaces:**
- Produces, en `src/ejemplos/index.ts`:
  - `export type IdPista = 'practica' | 'cruces' | 'rampa'`
  - `export interface EjemploPista { id: IdPista; nombre: string; descripcion: string; pista: Pista }`
  - `export interface EjemploProyecto { id: string; nombre: string; descripcion: string; pista: IdPista; proyecto: Proyecto }`
  - `export const PISTAS_DE_EJEMPLO: EjemploPista[]`, en el orden practica, cruces, rampa.
  - `export const PROYECTOS_DE_EJEMPLO: EjemploProyecto[]`:
    - en esta tarea, solo `seguidor`;
    - las Tareas 2 y 3 agregan los suyos con una ficha `{ id, nombre, descripcion, pista }` en la tabla `FICHAS` del mismo archivo;
    - las carpetas se leen con `import.meta.glob('./proyectos/*/*', { query: '?raw', import: 'default', eager: true })`;
    - el `nombre` del `Proyecto` es el id.
  - `PROYECTO_INICIAL` y `PISTA_INICIAL` siguen igual: el seguidor y `practica`.
- Produces, en `tests/ayuda/recorrido.ts`: `recorridoEsperado(p: Pista): Baldosa[]`.
  - Sigue la línea desde la partida. En cada cruce o unión toma la salida de `accionEsperada`; lanza un error si una salida no existe o si da más de 100 pasos.
  - Usa `crearIndice`, `bocasDe` y `ladoEnMundo` como `tests/integracion/ejemplo.test.ts`.

- [ ] **Step 1: Escribir las pruebas que fallan** en `tests/unidad/ejemplos.test.ts`:
  - `hay tres pistas de ejemplo con los nombres de la spec`: `PISTAS_DE_EJEMPLO.map(p => [p.id, p.pista.nombre])` es `[['practica', 'Práctica FIRVI'], ['cruces', 'Cruces con marcas'], ['rampa', 'Rampa y baches']]`, y las tres son de 8 × 6.
  - `las pistas nuevas cumplen las bases`: `revisarPista` de `cruces` y de `rampa` es `[]`, y cada una tiene 8 hitos numerados del 1 al 8.
  - `Cruces con marcas tiene lo que promete`:
    - el `recorridoEsperado` termina en `meta`;
    - pasa por un cruce con acción `recto`, una baldosa `gap` (línea con cortes), un cruce con acción `izq` y uno con acción `der`;
    - ninguna acción es `vuelta`.
  - `Rampa y baches tiene lo que promete`:
    - el `recorridoEsperado` termina en `meta` y pasa por al menos una rampa que sube y una que baja;
    - hay al menos 2 objetos `bache` y 1 `obstaculo`.
  - `el catálogo de proyectos empieza con el seguidor del comienzo`: `PROYECTOS_DE_EJEMPLO[0]` es `{ id: 'seguidor', pista: 'practica' }` y su `proyecto` es igual a `PROYECTO_INICIAL`. Toda ficha apunta a un id de pista que existe.
- [ ] **Step 2: Correrlas y verlas fallar**

  Run: `npx vitest run tests/unidad/ejemplos.test.ts`
  Expected: FAIL (`PISTAS_DE_EJEMPLO` no existe).
- [ ] **Step 3: Diseñar las dos pistas** con el editor (`npm run dev` → Construir pista → Guardar) o a mano, y escribir el catálogo.

  Las mismas pruebas, más la de la Tarea 3, dicen si las pistas sirven. Las descripciones para la ventana son estas:
  - practica: "La pista para empezar: rectas, curvas suaves y la meta."
  - cruces: "Cruces con marcas de color y una línea cortada."
  - rampa: "Una rampa para subir y bajar, baches y el obstáculo."
- [ ] **Step 4: Correr las pruebas y verlas pasar**

  Run: `npx vitest run tests/unidad/ejemplos.test.ts tests/integracion/ejemplo.test.ts`
  Expected: PASS.
- [ ] **Step 5: Commit**: "Pistas de ejemplo (Cruces con marcas, Rampa y baches) y catálogo de ejemplos".

### Task 2: Proyectos de ejemplo en la pista de práctica

**Files:**
- Create:
  - `src/ejemplos/proyectos/{mover-motores,leer-linea,seguidor-pid,leer-giroscopio}/` (`<id>.ino` + `pines.h`)
  - `tests/ayuda/correr-ejemplo.ts`
  - `tests/integracion/ejemplos.test.ts`
- Modify: `src/ejemplos/index.ts` (fichas).

**Interfaces:**
- Consumes: `PROYECTOS_DE_EJEMPLO` y `PISTAS_DE_EJEMPLO` (Tarea 1).
- Produces, en `tests/ayuda/correr-ejemplo.ts`:
  - `correrEjemplo(id: string, o?: { segundos?: number }): Promise<{ fin: FinEjecucion; serial: string; avisos: string[]; estados: Instantanea['estado'][]; eventos: TipoEvento[] }>`, con `yaw` y `pitch` en radianes, como en las instantáneas;
  - compila el proyecto con `compilarParaPrueba` y corre `ejecutarPrueba` en su pista, desde `'partida'`, a toda velocidad (`fijarVelocidad(control, 0)`) y con la semilla 1;
  - si hay `segundos`, pide `'detener'` cuando una instantánea pasa de ese tiempo;
  - `estados` son los de cada instantánea, y `eventos` los tipos de `fin.juez.eventos`.

Fichas:

| id | descripcion | Marcas `@ajustar` |
|---|---|---|
| `mover-motores` | "Avanza, gira y retrocede: así se mueven los motores." | — |
| `leer-linea` | "Calibra el sensor de línea y muestra dónde ve la línea." | — |
| `seguidor-pid` | "Sigue la línea con un control PID: P, I y D." | `KP`, `KI`, `KD` y `VELOCIDAD`, en `siguelineas` |
| `leer-giroscopio` | "Gira 90° midiendo el giro con el MPU6050." | — |

- [ ] **Step 1: Escribir las pruebas que fallan** en `tests/integracion/ejemplos.test.ts`, con un `describe` de timeout 300 s:
  - `cada ejemplo compila sin errores`: recorre todo `PROYECTOS_DE_EJEMPLO` con `compilar` y espera `ok: true`. En las Tareas 2 y 3 esta prueba crece sola.
  - `Mover los motores avanza, gira y retrocede`:
    - con `correrEjemplo('mover-motores', { segundos: 8 })`, el robot avanza al menos 100 mm en x antes de girar;
    - su `yaw` cambia al menos 60°;
    - el `serial` contiene "Adelante", "Giro" y "Atrás";
    - `avisos` está vacío.
  - `Leer la línea muestra la posición`: con 5 s, el `serial` tiene al menos 5 líneas que calzan con `/^Línea en \d+/m`, y `avisos` está vacío.
  - `el seguidor PID termina la pista de práctica`: `fin.juez` tiene los 2 hitos alcanzados y `meta: true`, y no hay eventos `perdio-linea`.
  - `Leer el giroscopio gira 90°`: con 8 s, el `yaw` final menos el inicial está a ±10° de 90° (en el sentido que el programa anuncia), y el `serial` contiene "Giré 90".
- [ ] **Step 2: Correrlas y verlas fallar**

  Run: `npx vitest run tests/integracion/ejemplos.test.ts`
  Expected: FAIL (las carpetas no existen).
- [ ] **Step 3: Escribir los 4 proyectos y sus fichas.**
  - Cada uno es corto y está comentado para estudiantes, con el estilo de `src/ejemplos/seguidor/seguidor.ino`.
  - `leer-giroscopio` usa `Adafruit_MPU6050` e integra `g.gyro.z` para medir el giro.
- [ ] **Step 4: Correr las pruebas y verlas pasar**

  Run: `npx vitest run tests/integracion/ejemplos.test.ts tests/unidad/ejemplos.test.ts`
  Expected: PASS.
- [ ] **Step 5: Commit**: "Ejemplos: mover los motores, leer la línea, seguidor PID y giroscopio".

### Task 3: Proyectos de ejemplo de cruces, cortes, rampa y obstáculo

**Files:**
- Create: `src/ejemplos/proyectos/{cruzar-cortes,marcas-color,subir-rampa,esquivar-obstaculo}/`
- Modify:
  - `src/ejemplos/index.ts` (fichas);
  - `tests/integracion/ejemplos.test.ts`.

**Interfaces:**
- Consumes: `correrEjemplo` (Tarea 2) y las pistas `cruces` y `rampa` (Tarea 1).

Fichas:

| id | descripcion |
|---|---|
| `cruzar-cortes` | "Sigue la línea aunque tenga cortes: si la pierde, sigue derecho un poco." |
| `marcas-color` | "Lee las marcas verdes antes de cada cruce y gira hacia donde indican." |
| `subir-rampa` | "Mide la inclinación con el MPU6050 y acelera para subir la rampa." |
| `esquivar-obstaculo` | "Ve el obstáculo con el sensor de distancia y lo rodea sin tocarlo." |

- [ ] **Step 1: Escribir las pruebas que fallan** en `tests/integracion/ejemplos.test.ts`:
  - `Cruzar cortes pasa la línea cortada`: en Cruces con marcas, el hito que está justo después de la baldosa `gap` queda alcanzado. Ese número se busca en la pista con el `recorridoEsperado`, no se escribe fijo.
  - `Leer marcas de color termina la pista de cruces`: `fin.juez` tiene los 8 hitos y la meta, sin eventos `camino-equivocado` ni `perdio-linea`.
  - `Subir la rampa sube y baja`:
    - en Rampa y baches, queda alcanzado el hito que está justo después de la rampa de bajada;
    - el `serial` contiene "Subiendo";
    - algún estado tiene `pitch` de al menos 10° en valor absoluto.
  - `Esquivar el obstáculo lo rodea sin tocarlo`: en Rampa y baches, los 8 hitos y la meta quedan alcanzados, sin evento `toco-obstaculo`.
- [ ] **Step 2: Correrlas y verlas fallar**

  Run: `npx vitest run tests/integracion/ejemplos.test.ts`
  Expected: FAIL.
- [ ] **Step 3: Escribir los 4 proyectos y sus fichas.**
  - `marcas-color` puede usar el QTR (las marcas verdes dan lecturas intermedias) y el TCS34725 para confirmar el verde.
  - Si un ejemplo no alcanza su prueba con las pistas de la Tarea 1, se puede ajustar la pista: las pruebas de la Tarea 1 siguen mandando.
- [ ] **Step 4: Correr las pruebas y verlas pasar**

  Run: `npx vitest run tests/integracion/ejemplos.test.ts tests/unidad/ejemplos.test.ts`
  Expected: PASS.
- [ ] **Step 5: Commit**: "Ejemplos: cruzar cortes, marcas de color, subir la rampa y esquivar el obstáculo".

### Task 4: La ventana "Ejemplos"

**Files:**
- Create:
  - `src/ui/ejemplos.ts`
  - `tests/e2e/ejemplos.spec.ts`
- Modify:
  - `index.html`: habilitar `#btn-ejemplos` con `aria-haspopup="dialog"` y agregar `<dialog class="ventana ventana-ejemplos" id="ventana-ejemplos" aria-labelledby="ej-titulo">`;
  - `src/ui/tema.css`;
  - `src/ui/programa.ts`;
  - `src/ui/archivo-pista.ts`;
  - `src/ui/aplicacion.ts`.

**Interfaces:**
- Consumes: `PROYECTOS_DE_EJEMPLO` y `PISTAS_DE_EJEMPLO` (Tarea 1).
- Produces:
  - `PanelPrograma.abrirEjemplo(p: Proyecto): Promise<boolean>`: pregunta con `puedeReemplazar`, y si se confirma, `abrirProyecto(p)`. Devuelve si lo abrió.
  - `crearArchivoPista(...)` ahora devuelve `{ abrirEjemplo(p: Pista): Promise<boolean> }`, con su propio `puedeReemplazar`.
  - `crearVentanaEjemplos(raiz: Document, eventos: { abrirProyecto(p: Proyecto): Promise<boolean>; abrirPista(p: Pista): Promise<boolean>; alAbrir(): void }): { abrir(): void }`:
    - `alAbrir` se llama después de abrir algo (la app muestra Programar);
    - las tarjetas tienen los ids `ej-proyecto-<id>` y `ej-pista-<id>`, y sus botones `.ej-abrir` y `.ej-abrir-pista`;
    - se cierra con `#ej-cerrar` ("Volver") o con `Esc`, y el foco vuelve a `#btn-ejemplos`.

- [ ] **Step 1: Escribir las pruebas e2e que fallan** en `tests/e2e/ejemplos.spec.ts`:
  - `Ejemplos abre un proyecto y Probar mi robot lo corre`:
    - Ejemplos → "Mover los motores" → Abrir;
    - la ventana se cierra y la pestaña activa es `mover-motores.ino`;
    - Probar → "El robot está corriendo", el robot se mueve (`__pruebas.robot().x` cambia) y `#consola` contiene "Adelante";
    - la última línea de la consola está visible (`toBeInViewport`).
  - `con el proyecto cambiado pide confirmar y Cancelar lo deja como estaba`: escribir en el editor, abrir un ejemplo y Cancelar; el texto escrito sigue ahí y la pestaña sigue siendo `seguidor.ino`.
  - `Ejemplos abre una pista y la de la prueba no cambia mientras corre`:
    - Probar, y con el robot corriendo abrir "Cruces con marcas";
    - `#chip-pista` no cambia mientras corre;
    - después de "Volver al inicio", el juez muestra 8 hitos (`#hitos .hito` cuenta 9, con la meta).
  - `la tarjeta de un proyecto abre su pista`: "Leer marcas de color en cruces" → "Abrir esa pista"; al abrir "Ajustar parámetros", `#aj-pista` dice "Cruces con marcas".
  - `Esc cierra la ventana y el foco vuelve a Ejemplos`.
- [ ] **Step 2: Correrlas y verlas fallar**

  Run: `npx playwright test tests/e2e/ejemplos.spec.ts`
  Expected: FAIL (`#btn-ejemplos` deshabilitado).
- [ ] **Step 3: Implementar.** Tarjetas con `createElement` y `textContent`, y el estilo de las ventanas de las fases 5 y 6. Las pistas llevan una miniatura con `dibujarPista` en un `<canvas>` de 160 × 120.
- [ ] **Step 4: Correr las pruebas y verlas pasar**

  Run: `npx playwright test tests/e2e/ejemplos.spec.ts tests/e2e/archivo-pista.spec.ts tests/e2e/revision.spec.ts`
  Expected: PASS.
- [ ] **Step 5: Commit**: "Ventana Ejemplos: abrir proyectos y pistas de ejemplo".

### Task 5: El recorrido de la primera visita

**Files:**
- Create:
  - `src/ui/recorrido.ts`
  - `tests/e2e/estado-inicial.json`
  - `tests/e2e/recorrido.spec.ts`
- Modify:
  - `index.html` (`<div class="recorrido" id="recorrido" role="dialog" aria-modal="false" aria-labelledby="rec-texto" hidden>` con la mascota, `#rec-texto`, `#rec-paso` "1 de 4", `#rec-saltar` y `#rec-siguiente`);
  - `src/ui/tema.css`;
  - `src/ui/aplicacion.ts`;
  - `playwright.config.ts` (`use.storageState: 'tests/e2e/estado-inicial.json'`).

**Interfaces:**
- Produces:
  - `crearRecorrido(raiz: Document, almacen?: Pick<Storage, 'getItem' | 'setItem'>): { mostrar(): void; mostrarSiEsPrimeraVez(): void }`, en `src/ui/recorrido.ts`;
  - `export const PASOS_RECORRIDO: { selector: string; texto: string }[]`, con los 4 pasos de la decisión 5;
  - la Tarea 6 llama a `mostrar()` desde la Ayuda.
- `estado-inicial.json` es `{ "cookies": [], "origins": [{ "origin": "http://localhost:5179", "localStorage": [{ "name": "dynamis.recorrido", "value": "visto" }] }] }`.

- [ ] **Step 1: Escribir las pruebas e2e que fallan** en `tests/e2e/recorrido.spec.ts`, con `test.use({ storageState: { cookies: [], origins: [] } })`:
  - `la primera visita muestra los 4 pasos y no vuelve a aparecer`:
    - `#rec-texto` muestra "Este es tu código";
    - Siguiente → "Presiona aquí para probar";
    - Siguiente → "Aquí ves lo que siente tu robot";
    - Siguiente → "Aquí construyes la pista", y el botón dice "¡Listo!";
    - al hacer clic se oculta;
    - después de `page.reload()` y de que `#btn-probar` esté habilitado, `#recorrido` sigue oculto.
  - `Saltar y Esc terminan el recorrido`: Saltar lo oculta. En un contexto nuevo, `Esc` lo oculta y el foco queda en `#btn-probar`.
  - `en 1024 × 640 el bocadillo entra completo en la ventana`: en cada paso, el `boundingBox` de `#recorrido` cabe dentro de 1024 × 640.
  - `el foco entra al bocadillo`: al aparecer, el elemento con foco es `#rec-siguiente`.
- [ ] **Step 2: Correrlas y verlas fallar**

  Run: `npx playwright test tests/e2e/recorrido.spec.ts`
  Expected: FAIL.
- [ ] **Step 3: Implementar.**
  - El bocadillo se coloca junto al elemento: abajo si cabe; si no, arriba; y se acota a la ventana.
  - El elemento queda resaltado con `.recorrido-foco` (un anillo `--sol`).
  - Se recalcula al cambiar el tamaño de la ventana.
  - Con `prefers-reduced-motion` no hay transición.
- [ ] **Step 4: Correr las pruebas y verlas pasar**

  Run: `npx playwright test tests/e2e/recorrido.spec.ts tests/e2e/app.spec.ts tests/e2e/probar.spec.ts`
  Expected: PASS. Con `estado-inicial.json`, las pruebas que ya existían no ven el recorrido.
- [ ] **Step 5: Commit**: "Recorrido de la primera visita".

### Task 6: La ventana "Ayuda"

**Files:**
- Create:
  - `src/ayuda/guias.ts`
  - `src/ayuda/conexiones.ts`
  - `src/ayuda/bases.ts`
  - `src/ui/ayuda.ts`
  - `tests/unidad/ayuda.test.ts`
  - `tests/integracion/guias.test.ts`
  - `tests/e2e/ayuda.spec.ts`
- Modify:
  - `src/juez/juez.ts`: exportar `PUNTOS_META`, `TIEMPO_LIMITE_S`, `MAXIMO_REINICIOS`, `DESCUENTO_REINICIO` y `DESCUENTO_POR_CM`;
  - `src/ui/juez.ts`: usar `PUNTOS_META` y `MAXIMO_REINICIOS` exportados en vez de sus copias;
  - `index.html`: habilitar `#btn-ayuda`; agregar `<dialog class="ventana ventana-ayuda" id="ventana-ayuda">` con un `role="tablist"` de 4 pestañas `#ay-tab-{sensores,conexiones,bases,inicio}` y sus paneles `#ay-{sensores,conexiones,bases,inicio}`, con la tabla estática de piezas en `#ay-bases`;
  - `src/ui/tema.css`;
  - `src/ui/aplicacion.ts`.

**Interfaces:**
- Consumes: `crearRecorrido().mostrar` (Tarea 5) y `ventanaRobot.abrir` (fase 5).
- Produces:
  - **`GUIAS: GuiaSensor[]`**, con `interface GuiaSensor { id: 'qtr' | 'vl53l0x' | 'tcs34725' | 'mpu6050' | 'mpu6050-i2cdevlib' | 'motores'; titulo: string; libreria: string; explicacion: string[]; programa: string; aviso?: string }`:
    - `programa` es un sketch completo que imprime lo que lee;
    - `aviso` (en `vl53l0x` y `tcs34725`) es "El VL53L0X y el TCS34725 usan la misma dirección I2C (0x29). El simulador no lo nota, pero en el robot real hay que cambiar la dirección del VL53L0X con setAddress (apagando el otro con XSHUT) o usar un multiplexor I2C.".
  - **`conexionesDe(robot: ConfigRobot): { grupo: string; filas: { que: string; pin: string }[] }[]`**. Los grupos, en orden:
    - "Motor izquierdo" (PWM, IN1, IN2);
    - "Motor derecho" (PWM, IN1, IN2);
    - "Driver" (STBY, o "sin conectar");
    - "Sensor de línea" (S1 a S8, "S1 = izquierda", y emisores o "siempre encendidos");
    - "Bus I2C": SDA 21, SCL 22, VL53L0X "0x29", TCS34725 "0x29 ⚠", MPU6050 "0x68", y el LED del TCS (pin, o "encendido, salvo con setInterrupt(true)").
  - **`puntaje(): { regla: string; puntos: string }[]`**, desde `PUNTOS_HITO` y las constantes del juez:
    - "Hitos 1 a 8" → "5, 10, 20, 20, 10, 15, 15 y 20";
    - "Meta (detenido sobre la línea)" → "15";
    - "Tiempo (solo si llega a la meta)" → "(300 − segundos) ÷ 4";
    - "Cada reinicio (máximo 3)" → "−10";
    - "Robot más grande que 20 × 20 × 20 cm" → "−20 por cada cm de más".
  - **`crearVentanaAyuda(raiz: Document, eventos: { robot(): ConfigRobot; abrirMiRobot(): void; verRecorrido(): void }): { abrir(pestana?: 'sensores' | 'conexiones' | 'bases' | 'inicio'): void; mostrarInstalar(alInstalar: (() => void) | null): void }`**. La Tarea 7 usa `mostrarInstalar`.

- [ ] **Step 1: Escribir las pruebas que fallan.**
  - **`tests/unidad/ayuda.test.ts`:**
    - `conexionesDe con el robot por defecto`: lo de arriba con los pines de `ROBOT_POR_DEFECTO` (por ejemplo, la fila `{ que: 'PWM', pin: '18' }` del motor izquierdo, y `{ que: 'S1 (izquierda)', pin: '36' }`);
    - `un pin opcional vacío dice sin conectar`;
    - `puntaje sale de las constantes del juez`: las 5 filas exactas de arriba;
    - `las guías cubren los sensores de la spec`: los 6 ids, en orden;
    - `el aviso I2C está en el VL53L0X y el TCS34725`.
  - **`tests/integracion/guias.test.ts`:** `cada guía compila y corre sin avisos de cableado`. Para cada guía, con `correrSketch(programa, { duracionUs: 2_000_000 })`:
    - el `texto` no está vacío;
    - `sim.avisos` está vacío.
  - **`tests/e2e/ayuda.spec.ts`:**
    - `Ayuda muestra la guía de cada sensor y copia el programa`: con permisos de portapapeles, "Copiar" de la guía del QTR deja en el portapapeles un texto que contiene `#include <QTRSensors.h>`;
    - `el aviso I2C aparece en la guía del sensor de distancia`;
    - `Conexiones de mi robot sigue a Mi robot`:
      - la fila PWM del motor izquierdo dice 18;
      - "Cambiar en Mi robot" abre `#ventana-robot`;
      - cambiar ese pin a 23 y cerrar;
      - al abrir la Ayuda en Conexiones, dice 23.
    - `Las bases muestran el puntaje`: contiene "(300 − segundos) ÷ 4";
    - `Ver el recorrido de nuevo lo muestra`: `#rec-texto` = "Este es tu código";
    - `las pestañas se usan con las flechas y Esc cierra`.
- [ ] **Step 2: Correrlas y verlas fallar**

  Run: `npx vitest run tests/unidad/ayuda.test.ts tests/integracion/guias.test.ts && npx playwright test tests/e2e/ayuda.spec.ts`
  Expected: FAIL.
- [ ] **Step 3: Implementar.**
  - Las pestañas siguen el patrón de `src/ui/vistas.ts`.
  - Los programas van en `<pre>` con `textContent`.
  - "Copiar" usa `navigator.clipboard.writeText` y cambia su texto a "¡Copiado!" por 2 s.
  - La tabla de piezas de "Las bases" (estática en `index.html`) resume §10.3 en el lenguaje de los estudiantes. Tiene una fila por pieza: Recta, Giro suave, Giro en L, Línea con cortes, Cruce + y Unión en T (con la tabla de marcas), Rampa, Indicador F2, Cuadrado F1, Partida, Meta, Obstáculo, Bache e Hito.
- [ ] **Step 4: Correr las pruebas y verlas pasar**

  Run: `npx vitest run tests/unidad/ayuda.test.ts tests/integracion/guias.test.ts && npx playwright test tests/e2e/ayuda.spec.ts tests/e2e/tarjetas.spec.ts tests/e2e/mi-robot.spec.ts`
  Expected: PASS.
- [ ] **Step 5: Commit**: "Ventana Ayuda: guías de los sensores, conexiones de mi robot y las bases".

### Task 7: Service worker, aislamiento, uso sin internet e instalación

**Files:**
- Create:
  - `src/pwa/cache.ts` (funciones puras);
  - `src/pwa/servicio.ts` (el service worker; solo importa `./cache`);
  - `src/pwa/registrar.ts`;
  - `src/pwa/instalar.ts`;
  - `scripts/plugin-pwa.ts`;
  - `scripts/iconos.mjs`;
  - `scripts/servir-dist.mjs`;
  - `public/manifest.webmanifest`;
  - `public/iconos/{mascota.svg,icono-192.png,icono-512.png,icono-512-maskable.png}`;
  - `playwright.produccion.config.ts`;
  - `tests/unidad/pwa.test.ts`;
  - `tests/e2e-produccion/publicada.spec.ts`;
  - `tests/e2e-produccion/estado-inicial.json` (origen `http://localhost:5180`).
- Modify:
  - `vite.config.ts`: `plugins: [pluginPwa()]`;
  - `index.html`: `<link rel="manifest">`, `<link rel="icon" href="iconos/mascota.svg">`, `<meta name="theme-color" content="#0B0F98">`, y en la banda `#btn-instalar` con `hidden`;
  - `src/main.ts`;
  - `src/ui/aplicacion.ts`: el mensaje de la decisión 9 y el botón Instalar;
  - `package.json`: `"e2e:produccion": "playwright test -c playwright.produccion.config.ts"`.

**Interfaces:**
- Produces, en `src/pwa/cache.ts`:
  - `esDelCompilador(ruta: string): boolean`: `/(^|\/)(llvm[^/]*\.wasm|llvm-resources[^/]*\.tar|nucleo[^/]*\.a)$/`;
  - `paraPrecachear(archivos: string[]): string[]`: sin los del compilador, más `'./'`;
  - `sobrantes(enCache: string[], vigentes: string[]): string[]`: lo que está en caché y no en la lista vigente;
  - `estrategia(p: { url: URL; origen: string; metodo: string; modo: RequestMode }): 'red-primero' | 'cache-primero' | 'red'`;
  - `conAislamiento(h: Headers): Headers`: una copia con COOP `same-origin` y COEP `require-corp`.
- Produces, en `src/pwa/registrar.ts`:
  - `prepararAislamiento(e: { aislado: boolean; produccion: boolean; sw?: Pick<ServiceWorkerContainer, 'register' | 'controller' | 'ready'>; sesion: Pick<Storage, 'getItem' | 'setItem'>; recargar(): void }): Promise<'listo' | 'recargando' | 'sin-aislamiento'>`;
  - `src/main.ts` lo llama antes de `iniciarAplicacion`, y con `'recargando'` no arranca la app.
- Produces, en `src/pwa/instalar.ts`: `escucharInstalacion(ventana: Window, alPoder: (instalar: (() => Promise<boolean>) | null) => void): void`. Avisa con una función cuando llega `beforeinstallprompt`, y con `null` después de `appinstalled`.
- Produces, en `scripts/plugin-pwa.ts`: `pluginPwa(): Plugin`.
  - En `buildStart` emite `src/pwa/servicio.ts` como chunk con `fileName: 'sw.js'`.
  - En `generateBundle` reemplaza `"__ARCHIVOS__"` por el JSON de todos los archivos del bundle (salvo `sw.js`), más `manifest.webmanifest` y `iconos/*`. También reemplaza `"__VERSION__"` por un hash de esa lista.

- [ ] **Step 1: Escribir las pruebas que fallan.**
  - **`tests/unidad/pwa.test.ts`:**
    - `esDelCompilador reconoce LLVM, sus recursos y el núcleo`: `assets/llvm.core-CL0Hro1L.wasm`, `assets/llvm-resources-Dw9lbSQw.tar` y `assets/nucleo-DRZKWi8t.a` dan true; `assets/index-CGc4rjVo.js` da false.
    - `paraPrecachear deja afuera el compilador`.
    - `sobrantes conserva el compilador vigente`: `sobrantes(['assets/llvm.core-A.wasm', 'assets/index-viejo.js'], ['assets/llvm.core-A.wasm', 'assets/index-nuevo.js'])` es `['assets/index-viejo.js']`.
    - `una navegación usa la red primero`: `modo: 'navigate'` da `'red-primero'`. Un GET del mismo origen da `'cache-primero'`. Un POST o un origen distinto dan `'red'`.
    - `conAislamiento agrega COOP y COEP sin perder las otras cabeceras`.
    - `prepararAislamiento`, con dobles:
      - aislado y en producción: registra y da `'listo'`;
      - aislado en desarrollo: no registra;
      - sin aislamiento y sin service worker: `'sin-aislamiento'`;
      - sin aislamiento la primera vez: registra, marca la sesión, recarga y da `'recargando'`;
      - sin aislamiento después de recargar: `'sin-aislamiento'`, sin otra recarga.
    - `el manifiesto tiene lo que pide la instalación`: leer `public/manifest.webmanifest` y comprobar los campos de la decisión 8. Los tres PNG existen y miden lo que dicen (ancho y alto leídos del IHDR).
  - **`tests/e2e-produccion/publicada.spec.ts`** (con `playwright.produccion.config.ts`: `baseURL: 'http://localhost:5180/Simulador-Dynamis/'`, `webServer: 'npm run build && node scripts/servir-dist.mjs dist 5180'`, timeout de 600 s):
    - `sin las cabeceras, la app se aísla sola y Probar mi robot funciona`:
      - `page.goto('./')`;
      - con `expect.poll`, `crossOriginIsolated` llega a true después de la recarga automática;
      - `#aviso-global` está oculto;
      - Probar → "El robot está corriendo" (timeout de 240 s por el compilador), y el robot se mueve.
    - `después de probar una vez, funciona sin internet`:
      - lo mismo, y después `context.setOffline(true)` y `page.reload()`;
      - la app arranca aislada;
      - Probar → corriendo.
    - `sin internet y sin haber probado nunca, pide internet para la primera vez`:
      - un contexto nuevo con `page.goto`, esperando a que el service worker controle la página;
      - `setOffline(true)` → Probar;
      - la burbuja muestra "Falta internet para la primera vez" y el botón "Reintentar";
      - el estado no se queda en "Preparando…".
    - `el manifiesto y los íconos se publican`: `request.get('manifest.webmanifest')` da 200 con `name` "Simulador Dynamis", y cada ícono da 200.
    - `el botón Instalar aparece con beforeinstallprompt`:
      - despachar un `Event('beforeinstallprompt')` con `prompt()` y `userChoice` que resuelve `{ outcome: 'accepted' }`;
      - `#btn-instalar` se ve;
      - al hacer clic, se oculta.
- [ ] **Step 2: Correrlas y verlas fallar**

  Run: `npx vitest run tests/unidad/pwa.test.ts && npm run e2e:produccion`
  Expected: FAIL (los módulos y el script no existen).
- [ ] **Step 3: Implementar.**
  - **`servicio.ts`:**
    - `install`: precachea `paraPrecachear(ARCHIVOS)` y llama a `skipWaiting()`;
    - `activate`: borra `sobrantes(...)` de la caché `dynamis` y llama a `clients.claim()`;
    - `fetch`: según `estrategia`, y toda respuesta pasa por `conAislamiento`.
  - **`servir-dist.mjs`:** solo `node:http` y `node:fs`, con los tipos MIME de `.wasm`, `.webmanifest`, `.tar`, `.a`, `.js`, `.css`, `.woff2`, `.png` y `.svg`, y 404 para lo demás.
  - **`iconos.mjs`:** renderiza la mascota de `index.html` con el Chromium de Playwright en 192 y 512, y en 512 `maskable` (con margen y fondo `#F4FAFF`). Se corre una vez y los PNG quedan en el repo.
- [ ] **Step 4: Correr las pruebas y verlas pasar**

  Run: `npx vitest run tests/unidad/pwa.test.ts && npm run e2e:produccion && npx playwright test tests/e2e/app.spec.ts`
  Expected: PASS.
- [ ] **Step 5: Commit**: "Service worker: aislamiento, caché sin internet e instalar en este computador".

### Task 8: Publicar en GitHub Pages y documentación

**Files:**
- Create:
  - `.github/workflows/publicar.yml`
  - `scripts/revisar-dist.mjs`
  - `tests/unidad/despliegue.test.ts`
- Modify:
  - `README.md`
  - `docs/superpowers/specs/2026-10-17-simulador-dynamis-design.md`

**Interfaces:**
- Produces: `revisarDist(dir: string): string[]`, exportada desde `scripts/revisar-dist.mjs`.
  - Devuelve los problemas, en español: un archivo de 100 MB o más (con su nombre y tamaño), o la falta de `index.html`, `sw.js` o `manifest.webmanifest`.
  - Ejecutado como script, imprime los problemas y sale con 1 si hay alguno.

- [ ] **Step 1: Escribir las pruebas que fallan** en `tests/unidad/despliegue.test.ts`:
  - `revisarDist acepta un dist completo`: un directorio temporal con los 3 archivos da `[]`.
  - `revisarDist avisa un archivo de 100 MB y lo que falta`:
    - crear un archivo disperso de 100 MB con `fs.truncateSync`;
    - el resultado menciona su nombre;
    - quitar `sw.js` da "Falta sw.js".
  - `el workflow publica en Pages al hacer push a main`. El texto de `.github/workflows/publicar.yml` contiene:
    - `branches: [main]`, `workflow_dispatch`, `node-version: 22`;
    - `npm ci`, `npm test`, `npm run build`, `node scripts/revisar-dist.mjs dist`;
    - `actions/upload-pages-artifact`, `path: dist`, `actions/deploy-pages`;
    - `pages: write` e `id-token: write`.
- [ ] **Step 2: Correrlas y verlas fallar**

  Run: `npx vitest run tests/unidad/despliegue.test.ts`
  Expected: FAIL.
- [ ] **Step 3: Implementar el workflow y `revisar-dist.mjs`.**
- [ ] **Step 4: Documentación.**
  - **`README.md`:**
    - estado "fase 7 de 7";
    - **para estudiantes:** abrir el link, "Instalar en este computador", sin internet después de la primera prueba, Ejemplos y Ayuda;
    - **para el profe, paso a paso:**
      - `npm install` y `npm run dev`;
      - editar `src/modelos/` y `src/ajuste/`;
      - las pruebas (`npm test`, `npm run e2e`, `npm run e2e:produccion`);
      - publicar: activar Pages en Settings → Pages → Source: "GitHub Actions" la primera vez; después, cada *push* a `main` publica;
      - la dirección `https://<usuario>.github.io/Simulador-Dynamis/`;
      - cómo agregar un ejemplo (carpeta + ficha);
    - el enlace al plan.
  - **Spec:**
    - §12 y §16: las decisiones 1 a 12;
    - §4: los archivos nuevos (`src/ejemplos/proyectos/`, `src/ayuda/`, `src/pwa/`, `scripts/`, `.github/workflows/publicar.yml`); `public/coi-serviceworker.js` se reemplaza por `sw.js` generado;
    - §15: el e2e de producción;
    - §19: la fase 7 hecha.
- [ ] **Step 5: Correr todo**

  Run: `npm test && npx playwright test && npm run e2e:produccion && npm run typecheck && npm run build && node scripts/revisar-dist.mjs dist`
  Expected: todo pasa.
- [ ] **Step 6: Commit**: "Publicar en GitHub Pages; documentación de la fase 7". Si el *push* del workflow lo rechaza el permiso `workflow` del token, el resto se sube sin ese archivo, y se deja anotado y avisado al usuario.
