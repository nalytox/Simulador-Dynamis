# Fase 5 — Construir pista y "Mi robot": plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el estudiante arme su pista FIRVI en la vista **Construir pista** (baldosas, objetos, propiedades, avisos de las bases, guardar y abrir), y que configure su robot en la ventana **"Mi robot"**, y que las dos cosas se usen en la próxima prueba.

**Architecture:**
- **Edición pura:** la edición de la pista son funciones puras sobre `Pista` en `src/pista/edicion.ts`, probadas en Node: colocar, girar, vaciar, propiedades, objetos, inicio, tamaño y la continuidad de las rampas. Lo mismo para el robot: `src/robot/archivo.ts` (leer, escribir y editar campos).
- **UI:** módulos por panel en `src/ui/`, como en la fase 4. El editor dibuja con las mismas funciones de `dibujo.ts`.
- **Conexión:** la app guarda la pista y el robot en el almacén y los pasa a la próxima prueba.

**Tech Stack:** el de la fase 4 (Vite, TypeScript, CodeMirror, fflate, Vitest y Playwright). Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-10-17-simulador-dynamis-design.md`. Esta fase cubre:
- §19, punto 5 (Construir pista y "Mi robot");
- §10.3: catálogo y paleta;
- §10.4: continuidad y validaciones en el editor;
- §10.5: editor de pista;
- §8: ventana "Mi robot";
- §12: vista Construir pista;
- §13: la pista y el robot en el almacén;
- §15: "editar la pista con una rampa".

Las pistas de ejemplo (Práctica FIRVI, Cruces con marcas, Rampa y baches) van en la fase 7, con el menú Ejemplos.

**Decisiones que toma este plan** (la Tarea 8 las lleva a la spec):
1. **Herramientas:**
   - la herramienta por defecto es **Elegir**: un clic elige una baldosa o un objeto, y arrastrar mueve un objeto o el inicio;
   - al elegir una pieza de la paleta, cada clic la coloca y elige esa baldosa;
   - `Esc` vuelve a Elegir.
2. **"Dejar vacía"** (`Supr`) quita la baldosa: la celda queda sin baldosa (fondo blanco). La pieza **Vacía** de la paleta sí pone una baldosa, que se puede invertir (cuadro negro).
3. **Rampa (continuidad, §10.4):** al colocar una rampa o cambiar su ángulo o su altura, la baldosa siguiente en la dirección de subida, si existe, queda al nivel de la parte alta (`nivel + 300 · tan(ángulo)`). Al colocar una pieza sobre una baldosa existente, se conserva su `nivel`.
4. **Baches:** "Bache recto" queda perpendicular a la línea de la baldosa donde se pone (`rot` de la baldosa + 90°) y "Bache diagonal", a 45° (`rot` + 45°).
5. **Numeración:**
   - **hito:** su número es el mayor + 1, y su `yaw`, el de la baldosa que tiene debajo;
   - **desafío:** su nombre es `F` + (cantidad de desafíos + 1), y su `hitoSiguiente`, el mayor hito + 1;
   - **al borrar** no se renumera: los números se editan en el panel, y la revisión de las bases avisa si quedan fuera de orden.
6. **Posición y giro de los objetos:**
   - se colocan donde se hace clic, ajustados a 1 cm;
   - `R` gira 90° una baldosa, un obstáculo o el `yaw` de un hito, desafío o inicio, y 45° un bache.
7. **Tamaño de la grilla:** de 2 a 16 columnas y de 2 a 12 filas. Al achicarla:
   - se quitan las baldosas y los objetos que quedan fuera, después de confirmar si hay alguno;
   - el inicio se mueve adentro si queda fuera.
8. **Cuándo se usa:** la pista y el robot editados se usan en la **próxima** prueba. Mientras corre una prueba, la vista Programar sigue mostrando su pista; se actualiza al terminar o al volver al inicio.
9. **"Mi robot":**
   - se abre con un botón de la banda (la Ayuda llega en la fase 7) y es una ventana modal;
   - los cambios se aplican al instante y se autoguardan;
   - al importar un `robot.json`, los campos que falten toman los valores del profe y se informan los campos inválidos.
10. **Pista nueva:** 8 × 6 vacía (`pistaVacia()`), después de confirmar. La pista tiene un nombre editable, que es el nombre del `.json` al guardarla.
11. **Vista Programar:** al volver a ella, los mensajes se muestran desde el final (quedó pendiente de la fase 4).

## Global Constraints

- **Lo de la fase 4 sigue:**
  - español de Chile, tuteando;
  - paleta y tipografías;
  - accesibilidad: teclado, foco visible y `prefers-reduced-motion`;
  - sin framework de UI;
  - sin `innerHTML` con texto que venga del estudiante, de un archivo o del programa.
- **Unidades y ángulos de la pista:**
  - la pista se guarda en mm y con los ángulos en **grados** (`rot` de baldosas: 0, 90, 180 o 270);
  - la conversión a radianes ocurre solo al usarla, como ya hace el código.
- **Rangos de los controles** (§10.3):
  - guion de 20 a 80 mm (por defecto 50);
  - espacio de 10 a 40 mm (por defecto 40);
  - ángulo de rampa de 5 a 35° (por defecto 20);
  - hasta 3 decisiones en el indicador F2;
  - bache con largo de hasta 300 mm y radio de hasta 6 mm;
  - obstáculo de 100 mm por lado por defecto.
- **Una sola regla de color:** el editor dibuja la pista con `dibujarPista` y `colorVisible`, igual que la vista Programar, para que lo que se ve sea lo que siente el robot.
- **Textos exactos de la spec:**
  - "Izquierda y derecha se miran desde la flecha rosada, que muestra por dónde entra el robot.";
  - "Hay un escalón de N cm entre estas baldosas" (ya lo da `revisarPista`);
  - la acción esperada: "Girar a la izquierda", "Girar a la derecha", "Dar la vuelta (180°)" o "Seguir derecho".
- **El robot sigue el contrato de §8:** `ConfigRobot` de `src/robot/config.ts`, `validarRobot` para los avisos y `ROBOT_POR_DEFECTO` para "Volver a los valores del profe".

## Review Focus

1. **Un `.json` de pista o de robot inválido o de otra cosa** (por ejemplo, un `package.json`, o una pista con baldosas fuera de la grilla): aparece un mensaje con lo que falla y no se pierde lo que estaba abierto. Pruebas en las Tareas 6 y 7.
2. **Achicar la grilla con baldosas u objetos afuera:** se pide confirmar, y si se acepta no queda nada fuera de la grilla (tampoco el inicio). Prueba en la Tarea 1 (pura) y en la Tarea 5 (confirmación).
3. **Editar la pista mientras corre una prueba:** la prueba sigue con su pista sin romperse, y la próxima usa la nueva. Prueba en la Tarea 6.
4. **Valores fuera de rango escritos a mano en un campo** (un ángulo de 90°, un pin 99, un largo negativo): el control los acota o los marca, y la pista o el robot nunca quedan con un valor que rompa el simulador. Pruebas en las Tareas 4 y 7.
5. **Usar el editor solo con teclado:** flechas para moverse por la grilla, `Enter` para colocar, `R`, `Supr` y `Esc`, con el foco siempre visible. Prueba en la Tarea 3.

---

### Task 1: Edición pura de la pista

**Files:**
- Create: `src/pista/edicion.ts`
- Test: `tests/unidad/edicion.test.ts`

**Interfaces:**
- Consumes:
  - `Pista`, `Baldosa`, `TipoBaldosa`, `ObjetoDePista` y `Rotacion` (`src/pista/tipos.ts`);
  - `normalizarPista` (para completar las propiedades por defecto);
  - `ladoEnMundo` y `celdaDe` (`src/pista/baldosas.ts`).
- Produces (todas devuelven una `Pista` nueva, sin modificar la original):
  - **Baldosas:**
    - `colocarBaldosa(p: Pista, c: number, r: number, tipo: TipoBaldosa, rot: Rotacion = 0, props?: Record<string, unknown>): Pista`: las propiedades por defecto son las de `normalizarPista`; aplica la decisión 3;
    - `girarBaldosa(p: Pista, c: number, r: number, sentido: 1 | -1): Pista`: 1 = antihorario, +90°;
    - `vaciarCelda(p: Pista, c: number, r: number): Pista`: quita la baldosa;
    - `cambiarBaldosa(p: Pista, c: number, r: number, cambios: { nivel?: number; props?: Record<string, unknown> }): Pista`: mezcla las `props` y aplica la decisión 3 si es una rampa;
    - `baldosaEn(p: Pista, c: number, r: number): Baldosa | null`.
  - **Objetos:**
    - `agregarObjeto(p: Pista, tipo: 'obstaculo' | 'bache-recto' | 'bache-diagonal' | 'hito' | 'desafio', x: number, y: number): { pista: Pista; indice: number }`: aplica las decisiones 4, 5 y 6 (ajuste a 10 mm);
    - `moverObjeto(p: Pista, i: number, x: number, y: number): Pista`;
    - `girarObjeto(p: Pista, i: number): Pista`: decisión 6;
    - `cambiarObjeto(p: Pista, i: number, cambios: Record<string, unknown>): Pista`: `x`, `y`, `rot` o claves de `props`;
    - `quitarObjeto(p: Pista, i: number): Pista`.
  - **Inicio y grilla:**
    - `moverInicio(p: Pista, x: number, y: number, yaw?: number): Pista`;
    - `redimensionar(p: Pista, columnas: number, filas: number): { pista: Pista; quitados: number }`: acota a 2–16 × 2–12 y aplica la decisión 7;
    - `subidaRampa(b: Baldosa): number`: mm que sube una rampa (`300 · tan(ángulo)`); 0 si la baldosa no es rampa.

- [ ] **Step 1: Escribir las pruebas que fallan** en `tests/unidad/edicion.test.ts`:
  - `colocar una pieza completa sus propiedades por defecto`: una rampa trae `angulo` 20, unos cortes traen `guion` 50 y `espacio` 40, y un cruce trae las marcas en `false`.
  - `colocar sobre una baldosa existente la reemplaza y conserva su nivel`.
  - `girarBaldosa suma o resta 90° y da la vuelta en 0 y 270`.
  - `vaciarCelda quita la baldosa`.
  - `una rampa ajusta el nivel de la baldosa siguiente en la dirección de subida`:
    - una rampa de 20° en (1,0) con `rot` 0 deja la recta de (2,0) en `nivel ≈ 109.19`;
    - con `rot` 90 ajusta la de (1,1);
    - cambiar el ángulo a 30° la vuelve a ajustar a `≈ 173.21`;
    - sin vecina, no pasa nada.
  - `subidaRampa(rampa de 20°) ≈ 109.19`.
  - `los baches se orientan con la línea de la baldosa`: sobre una recta con `rot` 90, el bache recto queda con `rot` 180 y el diagonal con 135.
  - `los hitos y desafíos se numeran solos`:
    - con los hitos 1 y 2, el nuevo es el 3, con el `yaw` de la baldosa;
    - el primer desafío es F1, con `hitoSiguiente` 4.
  - `agregarObjeto ajusta la posición a 1 cm`: (453, 147) queda en (450, 150).
  - `girarObjeto gira 90° un obstáculo, 45° un bache y el yaw de un hito`.
  - `redimensionar quita lo que queda fuera y mueve el inicio adentro`: de 8 × 6 a 4 × 3 con una baldosa en (5,1), un hito en (1650, 450) y el inicio en (2000, 1000):
    - `quitados` es 2;
    - el inicio queda dentro de 1200 × 900;
    - `redimensionar(p, 40, 1)` queda en 16 × 2.
  - `ninguna función cambia la pista original` (con `Object.freeze` profundo).

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/unidad/edicion.test.ts`
Expected: FAIL (no existe `edicion.ts`).

- [ ] **Step 3: Implementar** `src/pista/edicion.ts`. Las propiedades por defecto salen de normalizar una pista con la baldosa nueva: no se duplican los valores de `serializacion.ts`.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/unidad/edicion.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pista/edicion.ts tests/unidad/edicion.test.ts
git commit -m "Edición pura de la pista: baldosas, rampas con continuidad, objetos, inicio y tamaño"
```

---

### Task 2: La paleta y sus miniaturas

**Files:**
- Create: `src/ui/paleta.ts`
- Modify: `src/ui/dibujo.ts` (exporta `dibujarMiniatura`)
- Test: `tests/unidad/paleta.test.ts`

**Interfaces:**
- Consumes: `colocarBaldosa` y `agregarObjeto` (Tarea 1), `pistaVacia`.
- Produces:
  - **`type Pieza`** = `{ clase: 'baldosa'; nombre: string; tipo: TipoBaldosa; props?: Record<string, unknown> } | { clase: 'objeto'; nombre: string; tipo: 'obstaculo' | 'bache-recto' | 'bache-diagonal' | 'hito' | 'desafio' } | { clase: 'inicio'; nombre: 'Inicio del robot' }`.
  - **`PALETA: { grupo: string; piezas: Pieza[] }[]`**, con los grupos de §10.5, en este orden:
    1. **Líneas:** Vacía, Recta, Giro suave, Giro en L, Línea con cortes y Rampa.
    2. **Cruces y marcas de color:** Cruce sin marcas, Marca a la izquierda (`ai`), Marca a la derecha (`ad`), Marcas a ambos lados (`ai`, `ad`), Marcas en las 4 puntas, Unión en T (rama a la izquierda) y Unión en T (rama a la derecha).
    3. **Desafíos:** Indicador F2, Cuadrado F1 y Punto de desafío (F).
    4. **Partida y meta:** Partida, Meta e Inicio del robot.
    5. **Objetos:** Obstáculo de 10 cm, Bache recto, Bache diagonal e Hito.
  - **`dibujarMiniatura(canvas: HTMLCanvasElement, pieza: Pieza): void`** en `dibujo.ts`: una baldosa de 300 mm, o el objeto sobre una recta, con las mismas funciones de `dibujarPista`.
  - **`NOMBRE_TIPO: Record<TipoBaldosa, string>`**: el nombre en español de cada tipo, para el panel.

- [ ] **Step 1: Escribir las pruebas que fallan** en `tests/unidad/paleta.test.ts`:
  - `cada pieza de baldosa se puede colocar y da una pista válida`: `colocarBaldosa` sobre `pistaVacia()`, y `normalizarPista` de `escribirPista` da `ok`.
  - `los atajos de marcas dan la acción esperada`, con `accionEsperada`: izquierda da `'izq'`, derecha `'der'`, ambos lados `'vuelta'`, 4 puntas `'vuelta'` y sin marcas `'recto'`.
  - `los grupos y los nombres son los de la spec`: una lista exacta de nombres por grupo.
  - `NOMBRE_TIPO nombra todos los tipos de baldosa`.

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/unidad/paleta.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** `paleta.ts` y `dibujarMiniatura`. La miniatura usa `dibujarPista` sobre una pista de 1 × 1, con una vista que la llena (`vistaInicial` con margen 0, o una equivalente).

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/unidad/paleta.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/paleta.ts src/ui/dibujo.ts tests/unidad/paleta.test.ts
git commit -m "Paleta de piezas de la pista con miniaturas"
```

---

### Task 3: La vista Construir pista: grilla, colocar, elegir, girar y vaciar

**Files:**
- Create: `src/ui/vistas.ts`, `src/ui/editor-pista.ts`
- Modify: `index.html` (la sección `vista-pista` de la maqueta; `tab-pista` habilitada), `src/ui/aplicacion.ts`, `src/ui/tema.css`
- Test: `tests/e2e/pista.spec.ts`

**Interfaces:**
- Consumes: la Tarea 1 entera, `PALETA` y `dibujarMiniatura` (Tarea 2), `dibujarPista`, `vistaInicial` y `aMundoDesde`.
- Produces:
  - **`crearVistas(raiz: Document, eventos: { alCambiar(vista: 'programar' | 'pista'): void }): void`** (`vistas.ts`):
    - las pestañas `tab-programar` y `tab-pista` (`role="tab"`, con flechas), que muestran la sección que corresponde;
    - al volver a Programar, la consola baja al final (decisión 11).
  - **`crearEditorPista(raiz: Document, eventos: { alCambiar(p: Pista): void; alElegir(sel: Seleccion | null): void }): EditorPista`** (`editor-pista.ts`):
    - `interface EditorPista { mostrar(p: Pista): void; pista(): Pista; seleccion(): Seleccion | null; elegir(sel: Seleccion | null): void; herramienta(): Pieza | null }`;
    - `type Seleccion = { clase: 'baldosa'; c: number; r: number } | { clase: 'objeto'; indice: number } | { clase: 'inicio' }`.
  - **Comportamiento:**
    - la paleta (`paleta-baldosas`) se arma con botones `.pieza` (`aria-pressed`), cada uno con su miniatura y su nombre; `chip-herr` dice `Pieza: <nombre>` o `Elegir`;
    - el lienzo `lienzo-editor` dibuja con `dibujarPista` y encima:
      - la celda elegida con un borde azul;
      - la flecha rosada de entrada en la baldosa elegida (y en la del cursor);
      - las baldosas con avisos de `revisarPista`, con un borde rosado;
      - la pieza bajo el cursor, semitransparente, antes de colocarla;
    - un clic aplica la herramienta (decisión 1); `R`, `Supr` y `Esc` según las decisiones 1, 2 y 6;
    - con el lienzo enfocado, las flechas mueven una celda "con foco" (dibujada con un borde punteado) y `Enter` aplica la herramienta en ella.
  - **En desarrollo:** `__pruebas.editorPista = { pista(): Pista; seleccion(): Seleccion | null; aPantalla(x: number, y: number): { x: number; y: number } }`. `aPantalla` lleva mm del mundo a CSS px relativos al lienzo, para hacer clic. El centro de la celda (c, r) es `((c + 0.5) · 300, (r + 0.5) · 300)`.

- [ ] **Step 1: Escribir las pruebas de punta a punta que fallan** en `tests/e2e/pista.spec.ts`:
  - `la pestaña Construir pista muestra la paleta y la pista; volver a Programar muestra los mensajes al final`.
  - `elegir Recta y hacer clic en una celda la coloca y la elige`:
    - con la pieza "Recta" y un clic en la celda (5, 4), `__pruebas.editorPista.pista()` tiene una recta en (5, 4);
    - `seleccion()` es `{ clase: 'baldosa', c: 5, r: 4 }`.
  - `R gira la baldosa elegida y Supr la deja vacía`: después de R la recta tiene `rot` 90, y después de Supr la celda no tiene baldosa.
  - `Esc vuelve a Elegir y un clic elige sin colocar`.
  - `con el teclado: flechas, Enter, R y Supr`: enfocar el lienzo, elegir "Giro suave", `ArrowRight` dos veces y `Enter` coloca un giro suave en la celda con foco, y el foco sigue en el lienzo.
  - En `tests/e2e/app.spec.ts`, la línea que espera `#tab-pista` deshabilitada pasa a `toBeEnabled()`.

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx playwright test tests/e2e/pista.spec.ts`
Expected: FAIL (la pestaña está deshabilitada).

- [ ] **Step 3: Implementar.**
  - `vistas.ts` y `editor-pista.ts`.
  - La sección de la maqueta va en `index.html`, con el panel de la derecha vacío por ahora (lo llena la Tarea 4).
  - `aplicacion.ts` crea el editor con la pista actual, y cada `alCambiar` actualiza la pista de la app (la Tarea 6 la guarda y la usa).

- [ ] **Step 4: Correr las pruebas**

Run: `npx playwright test tests/e2e/pista.spec.ts tests/e2e/app.spec.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html src/ui tests/e2e/pista.spec.ts tests/e2e/app.spec.ts
git commit -m "Vista Construir pista: paleta, grilla, colocar, elegir, girar y vaciar, también con teclado"
```

---

### Task 4: El panel de la baldosa o el objeto elegido, y la revisión de las bases

**Files:**
- Create: `src/ui/panel-pista.ts`, `src/ui/textos-pista.ts`
- Modify: `src/ui/aplicacion.ts`, `index.html` (la lista de avisos `avisos-pista`)
- Test: `tests/unidad/textos-pista.test.ts`, `tests/e2e/panel-pista.spec.ts`

**Interfaces:**
- Consumes: `cambiarBaldosa`, `girarBaldosa`, `vaciarCelda`, `cambiarObjeto`, `girarObjeto`, `quitarObjeto`, `moverInicio` y `subidaRampa` (Tarea 1); `Seleccion` (Tarea 3); `accionEsperada`, `revisarPista` y `NOMBRE_TIPO`.
- Produces:
  - **`textos-pista.ts`** (sin DOM):
    - `textoAccion(a: Accion): string`: `izq` da "Girar a la izquierda", `der` "Girar a la derecha", `vuelta` "Dar la vuelta (180°)" y `recto` "Seguir derecho";
    - `textoPosicion(b: Baldosa): string`: `Columna ${c + 1}, fila ${r + 1} · ${rot}°`;
    - `textoSubida(mm: number): string`: `sube 10,9 cm` (una decimal, con coma);
    - `textoAltura(mm: number): string`: `10,9 cm`.
  - **`crearPanelPista(raiz: Document, eventos: { alCambiar(p: Pista): void; alElegir(sel: Seleccion | null): void }): { mostrar(p: Pista, sel: Seleccion | null): void }`** (`panel-pista.ts`). El panel "Baldosa elegida" (o "Objeto elegido", o "Inicio del robot") de la maqueta:
    - **Baldosa:**
      - tipo (`NOMBRE_TIPO`), posición y altura (un control numérico en cm, de 0 a 50);
      - girar a la izquierda o a la derecha, y "Dejar vacía";
      - "Línea blanca sobre fondo negro" (`invertida`);
      - según el tipo:
        - **cruce y unión en T:** las 4 casillas de marcas con sus etiquetas de la maqueta, la nota de la flecha rosada y "El robot debe: <acción>"; en la unión en T, además, la rama;
        - **rampa:** el ángulo (5–35°) y "sube N cm";
        - **cortes:** espacio (10–40 mm) y largo de cada trazo (20–80 mm);
        - **indicador F2:** de 1 a 3 selectores Izquierda/Derecha, con "Agregar decisión" y "Quitar";
        - **cuadrado F1:** el camino correcto.
    - **Objeto:** sus propiedades:
      - obstáculo: ancho, largo y alto en cm;
      - bache: largo hasta 30 cm, radio hasta 6 mm, y los botones "Recto" y "Diagonal";
      - hito: número y dirección;
      - desafío: nombre, dirección e hito siguiente;
      - y "Quitar".
    - **Inicio:** la dirección (0, 90, 180 o 270).
    - Los controles numéricos se acotan a su rango al aplicar (Review Focus 4).
  - **La lista "Revisión de las bases"** (`avisos-pista`) muestra los `revisarPista(p)`. Un clic en un aviso elige su objeto, si tiene, o su primera baldosa.

- [ ] **Step 1: Escribir las pruebas que fallan.**
  - **`tests/unidad/textos-pista.test.ts`:** `textoAccion` con las 4 acciones, `textoPosicion`, y `textoSubida(109.19)` = `'sube 10,9 cm'`.
  - **`tests/e2e/panel-pista.spec.ts`:**
    - `el panel muestra la baldosa elegida`: una recta colocada en (5, 4) muestra "Recta" y "Columna 6, fila 5 · 0°".
    - `una rampa muestra "sube 10,9 cm" y ajusta la altura de la baldosa siguiente`:
      - coloca una recta en (3,2) y una rampa en (2,2); el panel dice "sube 10,9 cm";
      - al elegir (3,2), su altura es 10,9 cm;
      - con el ángulo en 30°, el panel dice "sube 17,3 cm".
    - `las marcas de un cruce cambian la acción esperada`: con "Antes del cruce, a la izquierda" el panel dice "El robot debe: Girar a la izquierda"; con las dos de antes, "Dar la vuelta (180°)".
    - `un escalón aparece en la revisión de las bases`: dos rectas vecinas, con la altura de una en 5 cm, dan "Hay un escalón de 5 cm entre estas baldosas.".
    - `un ángulo escrito a mano fuera de rango se acota`: escribir 90 en el ángulo de la rampa deja 35.
    - `invertir colores pinta la baldosa negra en el editor`: un píxel del fondo de la baldosa es oscuro.

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/unidad/textos-pista.test.ts; npx playwright test tests/e2e/panel-pista.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** `textos-pista.ts` y `panel-pista.ts`, y conectarlos con el editor en `aplicacion.ts`.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/unidad/textos-pista.test.ts && npx playwright test tests/e2e/panel-pista.spec.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui index.html tests/unidad/textos-pista.test.ts tests/e2e/panel-pista.spec.ts
git commit -m "Panel de la baldosa u objeto elegido y la revisión de las bases en el editor"
```

---

### Task 5: Objetos, inicio y tamaño de la grilla en el editor

**Files:**
- Modify: `src/ui/editor-pista.ts`, `src/ui/panel-pista.ts`, `index.html` (columnas, filas y el nombre de la pista)
- Test: `tests/e2e/objetos-pista.spec.ts`

**Interfaces:**
- Consumes: `agregarObjeto`, `moverObjeto`, `moverInicio` y `redimensionar` (Tarea 1); `confirmar` (`src/ui/dialogo.ts`).
- Produces:
  - **Objetos:** con una pieza de objeto, un clic agrega el objeto, lo elige y vuelve a la herramienta Elegir.
  - **Elegir un objeto:**
    - un clic dentro de su huella (o a menos de 40 mm de un hito, un desafío o el inicio) lo elige;
    - si se superponen, gana el último dibujado.
  - **Arrastrar** un objeto o el inicio los mueve (ajustados a 1 cm).
  - **Inicio:** con la pieza "Inicio del robot", un clic mueve el inicio, con el `yaw` de la baldosa que tiene debajo.
  - **Controles de la pista** en la cabecera de "Mi pista": `pista-nombre` (texto), `pista-columnas` (2–16) y `pista-filas` (2–12). El chip de tamaño dice `N × M baldosas`.
  - **Achicar:** si `redimensionar` quitaría algo, primero se confirma: "Al achicar la pista se quitan N piezas que quedan fuera. ¿Seguir?".

- [ ] **Step 1: Escribir las pruebas de punta a punta que fallan** en `tests/e2e/objetos-pista.spec.ts`:
  - `poner dos hitos los numera 1 y 2`.
  - `arrastrar el inicio lo mueve a la celda soltada`: arrastrar desde `aPantalla(inicio)` hasta el centro de la celda (2, 3) deja el inicio ahí, ±10 mm.
  - `un bache recto sobre una recta vertical queda perpendicular`: `rot` 180.
  - `achicar la grilla con piezas afuera pide confirmar`:
    - con Cancelar, sigue 8 × 6;
    - con Seguir, queda 4 × 3, sin baldosas afuera, y el chip dice "4 × 3 baldosas".
  - `el nombre de la pista se edita`.

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx playwright test tests/e2e/objetos-pista.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** lo de arriba en `editor-pista.ts` y `panel-pista.ts`.

- [ ] **Step 4: Correr las pruebas**

Run: `npx playwright test tests/e2e/objetos-pista.spec.ts tests/e2e/pista.spec.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui index.html tests/e2e/objetos-pista.spec.ts
git commit -m "Editor de pista: objetos, arrastrar el inicio, tamaño y nombre de la pista"
```

---

### Task 6: Guardar, abrir y pista nueva; la pista editada en Programar

**Files:**
- Modify: `src/ui/aplicacion.ts`, `src/ui/editor-pista.ts`, `index.html` (`in-pista`, un input de archivo `.json` oculto)
- Test: `tests/e2e/archivo-pista.spec.ts`

**Interfaces:**
- Consumes: `escribirPista`, `leerPista` y `pistaVacia`; el almacén (`guardar('pista')`); `ClienteSimulacion.corriendo`.
- Produces:
  - **Botones:**
    - **Guardar pista** (`btn-guardar`): descarga `<nombre de la pista>.json` con `escribirPista`;
    - **Abrir pista** (`btn-abrir` → `in-pista`): `leerPista`. Si falla, `error-pista` (un `role="alert"` sobre la pista, en `index.html`) dice "No pudimos abrir esa pista", con los errores, y la pista no cambia;
    - **Pista nueva** (`btn-nueva`): confirma "¿Empezar una pista nueva? Si no guardaste la actual, se va a perder." y deja `pistaVacia()`.
  - **Autoguardado:** cada cambio de la pista se autoguarda (`conRetardo`).
  - **En Programar** (decisión 8): si no corre una prueba, se actualizan al tiro el lienzo, el selector "Partir desde" y los hitos del juez; si corre, se actualizan al terminar o al volver al inicio. La próxima prueba usa la pista nueva.

- [ ] **Step 1: Escribir las pruebas de punta a punta que fallan** en `tests/e2e/archivo-pista.spec.ts`:
  - `Guardar pista descarga el JSON de la pista`: `page.waitForEvent('download')`. El archivo, pasado por `leerPista`, es igual a `__pruebas.editorPista.pista()`.
  - `Abrir una pista válida la carga; una inválida avisa y no cambia nada`:
    - un `.json` con una baldosa fuera de la grilla da el mensaje con "queda fuera de la grilla", y la pista sigue igual;
    - con un `package.json`, también avisa.
  - `Pista nueva pide confirmar`.
  - `la pista se autoguarda`: recargar mantiene un cambio.
  - `la pista editada se ve en Programar y la usa la próxima prueba`:
    - agrega un tercer hito en el editor; en Programar, el juez muestra 3 hitos y la meta, y "Partir desde" ofrece "Hito 3";
    - con una prueba corriendo, un cambio de la pista no la detiene, y el lienzo cambia al volver al inicio.

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx playwright test tests/e2e/archivo-pista.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** lo de arriba.

- [ ] **Step 4: Correr las pruebas**

Run: `npx playwright test tests/e2e/archivo-pista.spec.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui index.html tests/e2e/archivo-pista.spec.ts
git commit -m "Guardar, abrir y pista nueva; la pista editada se usa en Programar"
```

---

### Task 7: El robot como archivo: leer, escribir y editar campos

**Files:**
- Create: `src/robot/archivo.ts`
- Test: `tests/unidad/robot-archivo.test.ts`

**Interfaces:**
- Consumes: `ConfigRobot`, `ROBOT_POR_DEFECTO` y `validarRobot` (`src/robot/config.ts`).
- Produces:
  - **`type ResultadoRobot = { ok: true; robot: ConfigRobot; avisos: string[] } | { ok: false; errores: string[] }`.**
  - **`normalizarRobot(datos: unknown): ResultadoRobot`:**
    - mezcla con `ROBOT_POR_DEFECTO`: lo que falta toma el valor del profe y se informa en `avisos` ("Faltaba chasis.alto: se usó el valor del profe.");
    - un campo con un tipo equivocado es un error ("chasis.largo debe ser un número.");
    - un pin debe ser entero, o `null` donde se permite (`stby`, `qtr.emisor`, `tcs34725.led`);
    - `qtr.pines` debe ser una lista de enteros;
    - los números deben ser finitos y las medidas, positivas;
    - si `datos` no es un objeto: "El archivo no es un robot válido.".
  - **`leerRobot(texto: string): ResultadoRobot`** y **`escribirRobot(r: ConfigRobot): string`** (JSON con sangría 2).
  - **`CAMPOS_ROBOT: CampoRobot[]`**, con `interface CampoRobot { ruta: string; grupo: 'Medidas' | 'Sensores' | 'Pines'; etiqueta: string; unidad: 'mm' | '°' | 'pin' | null; tipo: 'numero' | 'pin' | 'pin-opcional' | 'si-no'; min?: number; max?: number }`. Una entrada por campo editable de `ConfigRobot`: chasis, ruedas, la posición de cada sensor, los pines de los motores (con `invertir`), `stby`, los 8 pines del QTR (`qtr.pines.0` a `qtr.pines.7`), `qtr.emisor` y `tcs34725.led`.
  - **`leerCampo(r: ConfigRobot, ruta: string): number | boolean | null`** y **`conCampo(r: ConfigRobot, ruta: string, valor: number | boolean | null): ConfigRobot`**: copia, con el valor acotado a `min`/`max`.

- [ ] **Step 1: Escribir las pruebas que fallan** en `tests/unidad/robot-archivo.test.ts`:
  - `escribirRobot y leerRobot son inversos`.
  - `un robot incompleto se completa con los valores del profe y lo informa`.
  - `tipos equivocados y pines no enteros son errores`.
  - `un archivo que no es un robot`: con `'[1,2]'` y con `'{"name":"x"}'`, el segundo con sus avisos de campos faltantes.
  - `cada campo de CAMPOS_ROBOT existe en ROBOT_POR_DEFECTO` (`leerCampo` no da `undefined`).
  - `conCampo cambia una copia y acota al rango`: `conCampo(r, 'qtr.pines.3', 99)` queda en el máximo de pin, 39; `r` no cambia.
  - `validarRobot sigue avisando un pin repetido después de conCampo`.

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/unidad/robot-archivo.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** `src/robot/archivo.ts`.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/unidad/robot-archivo.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/robot/archivo.ts tests/unidad/robot-archivo.test.ts
git commit -m "El robot como archivo: leer y escribir robot.json, y editar sus campos"
```

---

### Task 8: La ventana "Mi robot", el robot en la prueba, y documentación

**Files:**
- Create: `src/ui/mi-robot.ts`
- Modify:
  - `index.html` (botón `btn-mi-robot` en la banda; `in-robot`, un input `.json` oculto);
  - `src/ui/aplicacion.ts`, `src/ui/lienzo.ts` (`cambiarRobot`), `src/ui/tema.css`;
  - `src/proyecto/almacen.ts` (`DatosGuardados.robot: ConfigRobot`);
  - `README.md` y la spec.
- Test: `tests/e2e/mi-robot.spec.ts`

**Interfaces:**
- Consumes: la Tarea 7 entera, `validarRobot`, `dibujarRobot` y `ROBOT_POR_DEFECTO`.
- Produces:
  - **`crearVentanaRobot(raiz: Document, eventos: { robot(): ConfigRobot; alCambiar(r: ConfigRobot): void }): { abrir(): void }`.** Un `<dialog>` modal "Mi robot" con:
    - **Campos:** los `CAMPOS_ROBOT` agrupados en Medidas, Sensores y Pines, con su etiqueta y unidad. Un pin opcional vacío es `null` ("sin conectar").
    - **Dibujo:** el robot visto desde arriba, que se actualiza en cada cambio (`dibujarRobot` sobre un lienzo de la ventana, centrado y a escala), más un punto para el MPU6050.
    - **Avisos:** los de `validarRobot`, junto al campo de cada uno (`aria-invalid` y el texto debajo) y en una lista arriba.
    - **Botones:** "Exportar robot.json", "Importar robot.json", "Volver a los valores del profe" (con confirmación) y "Listo".
    - Un `robot.json` inválido muestra sus errores en la ventana y no cambia nada. Uno con avisos se carga y los muestra.
  - **`Lienzo.cambiarRobot(r: ConfigRobot): void`.**
  - **`aplicacion.ts`:**
    - lee y guarda `robot` en el almacén;
    - lo pasa a `ClienteSimulacion.iniciar` y al lienzo (decisión 8);
    - `ROBOT_POR_DEFECTO` deja de estar fijo en la app.

- [ ] **Step 1: Escribir las pruebas de punta a punta que fallan** en `tests/e2e/mi-robot.spec.ts`:
  - `Mi robot abre la ventana con los valores del profe`: la trocha dice 140.
  - `un pin repetido muestra el aviso junto al campo`: el pin 2 del QTR en 36 da "El pin 36 está usado dos veces.".
  - `los cambios se guardan y se usan`:
    - con la trocha en 120, se cierra y se recarga, y la ventana sigue diciendo 120;
    - **"Probar mi robot"** corre con ese robot: con el pin PWM izquierdo en 23, el seguidor del ejemplo (que escribe en el 18) no mueve la rueda izquierda: la tarjeta de motores dice 0% a la izquierda.
  - `Exportar e importar robot.json`:
    - la descarga, pasada por `leerRobot`, coincide;
    - importar un archivo con `"chasis": "grande"` muestra el error y no cambia nada.
  - `Volver a los valores del profe restaura todo`.
  - `editar la pista con una rampa y probar` (§15): una rampa en el editor, y "Probar mi robot" corre sin errores sobre esa pista.

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx playwright test tests/e2e/mi-robot.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** `mi-robot.ts`, `cambiarRobot` y la conexión en `aplicacion.ts`.

- [ ] **Step 4: Correr todas las pruebas**

Run: `npm test && npx playwright test && npm run typecheck && npm run build`
Expected: todas pasan; el build genera `dist/`.

- [ ] **Step 5: Documentación.**
  - **`README.md`:**
    - el estado pasa a "fase 5 de 7 — construir la pista y configurar el robot";
    - lo que se puede hacer en Construir pista y en Mi robot;
    - el enlace al plan de la fase 5.
  - **Spec:**
    - §10.5: las decisiones 1, 2, 4, 5, 6, 7 y 10;
    - §10.4: la decisión 3;
    - §8: la decisión 9;
    - §12: las decisiones 8 y 11.

- [ ] **Step 6: Commit**

```bash
git add src index.html tests/e2e/mi-robot.spec.ts README.md docs/superpowers/specs/2026-10-17-simulador-dynamis-design.md
git commit -m "Ventana Mi robot: medidas, sensores y pines con dibujo y avisos; el robot en la prueba; documentación de la fase 5"
```
