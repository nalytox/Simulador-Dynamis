# Ajustar parámetros: el agente y la recompensa (los implementa el profesor)

"Ajustar parámetros" prueba muchas veces el programa del estudiante en la pista, cada vez con otros
valores de los números que marcó con `@ajustar`, y busca los que funcionan mejor (spec §11).

Este proyecto implementa todo lo demás:
- las marcas `@ajustar`;
- el motor de pruebas, con los workers, el registro y el aviso de ciclo sin fin;
- la ventana, el gráfico, "Ver esta prueba en la pista" y "Usar estos valores".

**Faltan dos piezas, y son del profesor:**

| Archivo | Qué es | Dónde corre |
|---|---|---|
| `agente.js` | El agente de aprendizaje por refuerzo: decide qué valores probar y aprende de cada resultado. | En el hilo principal de la página. |
| `recompensa.js` | Cuánto vale cada prueba (`calcularRecompensa`) y cuándo cortarla antes de tiempo (`debeTerminar`). | En el worker de cada prueba: sin `window`, `document` ni `localStorage`. |

Los dos archivos traen el contrato y un `TODO(profe)`. Mientras no estén programados, cada función
lanza `FaltaImplementar` (de `contrato.ts`). La ventana lo detecta y le explica al estudiante qué
falta, por ejemplo: "Para entrenar falta que tu profe programe el agente (src/ajuste/agente.js).". El
resto de la app funciona igual.

Los tipos están en [`contrato.ts`](contrato.ts).

## Cómo corre un entrenamiento

1. **Inicio:** el estudiante elige qué valores ajustar y su rango, cuántas pruebas hacer, cuánto
   dura cada una y cuántos robots practican a la vez. Aprieta "Empezar a entrenar".
2. **Compilación:** el proyecto se compila **una vez**. El mismo programa va a cada worker.
3. **Agente:** se llama `crearAgente({ parametros, presupuesto })`.
4. **Pruebas:** mientras queden pruebas, se le piden valores con `proponer()`. Hay tantas pruebas
   en curso como robots practicando a la vez, así que `proponer()` puede llamarse varias veces antes
   de recibir el primer resultado.
5. **Cada prueba** es una instancia nueva del programa:
   - con los valores propuestos;
   - en la partida de la pista;
   - con una semilla nueva;
   - sin ritmo de tiempo real;
   - hasta la duración elegida, hasta que `debeTerminar` diga que pare, o hasta que el juez la dé
     por terminada.
6. **Resultado:** al terminar, el worker llama a `calcularRecompensa(registro)`. El agente recibe
   `aprender(valores, recompensa, resumen)`.
7. **La ventana** dibuja cada recompensa y guarda la mejor prueba, con sus valores y su semilla,
   para "Ver esta prueba en la pista" y "Usar estos valores".

## `agente.js`

```js
export function crearAgente({ parametros, presupuesto }) → { proponer(), aprender(valores, recompensa, resumen) }
```

| Parámetro | Qué es |
|---|---|
| `parametros` | Los valores que el estudiante eligió ajustar: `[{ id, grupo, nombre, valor, entero, min, max }]`. `id` es `grupo.nombre` (por ejemplo, `siguelineas.kp`). `valor` es el que tiene hoy en el código; `entero`, si es un entero (un `int`, o un `#define` sin decimales); `min` y `max`, el rango de búsqueda que muestra la ventana (`min < max`). |
| `presupuesto` | Cuántas pruebas se harán en total (de 10 a 2000). |
| `proponer()` | Devuelve `{ [id]: número }` para una prueba nueva. |
| `aprender(valores, recompensa, resumen)` | Los valores con que se hizo una prueba, su recompensa y su resumen (abajo). Los resultados llegan en el orden en que terminan las pruebas, que no es siempre el orden de `proponer()`. |

**Qué hace el motor con lo que propones:**
- solo usa los ids de `parametros`; los que sobran se ignoran;
- acota cada valor a `[min, max]`;
- redondea los valores de los parámetros `entero`;
- un valor que falta, o que no es un número finito, toma el valor del código.

Los valores que el estudiante no eligió ajustar quedan como están en su código.

**Para enteros:** la prueba corre con el valor redondeado, el mismo que reciben `aprender` y el
registro, y el mismo que "Usar estos valores" escribe en el código.

## `recompensa.js`

```js
export function calcularRecompensa(registro) → number
export function debeTerminar(paso, mundo) → false | string
```

`debeTerminar` devuelve `false` (o nada) para seguir, y un texto con el motivo para terminar.

### `registro` (lo que recibe `calcularRecompensa`)

| Campo | Qué es |
|---|---|
| `valores` | Los valores con que se hizo la prueba, por id (ya acotados). |
| `semilla` | La semilla de la prueba. Con la misma semilla y los mismos valores, la prueba se repite exactamente. |
| `duracionS` | La duración máxima elegida, en segundos. |
| `pasos` | Un `paso` cada 10 ms de tiempo virtual (abajo). Vacío si la prueba no corrió. |
| `juez` | El juez virtual al final de la prueba: `{ hitos, meta, tiempo, reinicios, eventos, puntaje, terminado }` (ver spec §10.6). `null` si no corrió. |
| `fin` | `{ motivo, detalle }`. Ver la tabla de abajo. |

**Valores de `fin.motivo`:**

| Motivo | Cuándo |
|---|---|
| `'tiempo'` | Se acabó la duración. |
| `'termino'` | Lo pidió `debeTerminar`; `detalle` es el texto que devolvió. |
| `'juez'` | El juez dio la prueba por terminada: llegó a la meta o se acabaron los 5 minutos de las bases. |
| `'error'` | El programa del estudiante tuvo un error de ejecución; `detalle` es el mensaje. |
| `'ciclo-sin-fin'` | El programa se quedó en un ciclo sin avanzar el tiempo (por ejemplo, `while (true) {}`). La prueba se cortó sin pasos, y `calcularRecompensa` se llama en el hilo principal. |

### `paso` (cada elemento de `registro.pasos`, y lo que recibe `debeTerminar`)

| Campo | Unidad | Qué es |
|---|---|---|
| `t` | s | El tiempo virtual. |
| `estado` | mm y rad | `{ x, y, z, yaw, pitch, roll }` del robot en el mundo (ver `src/modelos/README.md`). |
| `lecturas` | — | Lo que miden los sensores en ese instante: `{ qtr: number[8] (ADC 0–4095), distanciaMm, color: { r, g, b, c }, mpu: { ax, ay, az, gx, gy, gz, temp } }`. Es lo mismo que muestran las tarjetas de la vista Programar, no lo que leyó el programa. |
| `motores` | — | `{ izq: { duty, modo }, der: { duty, modo } }`, con `duty` de −1 a 1. |
| `eventos` | — | Lo que pasó desde el paso anterior (abajo). |

**Eventos posibles en `paso.eventos`:**
- los del juez: `'hito'`, `'meta'`, `'perdio-linea'`, `'toco-obstaculo'`, `'camino-equivocado'` y
  `'fin-tiempo'`;
- `'colision'`: la huella del robot toca un obstáculo;
- `'fuera-de-pista'`: el centro del robot salió de la grilla.

`mundo` tiene las primitivas de la pista: `muestrear`, `altura`, `inclinacion`, `raycast`,
`colisiona` y `objetosCerca` (ver `src/modelos/README.md`).

### El `resumen` que recibe el agente

`{ motivo, detalle, t, puntaje, hitos, meta }`:
- `motivo` y `detalle` son los de `registro.fin`;
- `t`: los segundos que duró la prueba;
- `puntaje`: el del juez, o 0 si no corrió;
- `hitos`: cuántos hitos alcanzó;
- `meta`: si llegó a la meta.

## Errores

- **`FaltaImplementar`:** el entrenamiento se detiene y la ventana explica qué falta.
- **Otra excepción** (del agente o de la recompensa), **o una recompensa que no es un número
  finito:** el entrenamiento se detiene.
  - El estudiante ve "Algo falló en el simulador, avisa a tu profe.".
  - En "Ver detalle técnico" aparecen el archivo y la pila.
- **Un error de ejecución del programa del estudiante** (por ejemplo, una división por cero) no es un
  error tuyo: esa prueba termina con `fin.motivo = 'error'`, se llama a `calcularRecompensa` igual y
  el entrenamiento sigue.

## Para probar tu código

- **Determinismo:** usa la `semilla` del registro si necesitas azar en la recompensa. En el agente
  puedes usar `Math.random()`, porque no forma parte de la prueba.
- **Pruebas automáticas:** `tests/ayuda/ajuste-de-prueba.ts` tiene un agente y una recompensa
  mínimos que solo sirven para las pruebas automáticas del motor. Muestran la forma del contrato,
  no un buen agente.
- **Con Vitest:** puedes escribir pruebas como `tests/unidad/entrenamiento.test.ts` y
  `tests/integracion/prueba-ajuste.test.ts`, que corren el motor en Node sin navegador.
