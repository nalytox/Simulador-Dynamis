# Simulador Dynamis

Simulador web del robot de **Dynamis** (Fundación Mustakis) para estudiantes de 14 a 16 años.
Los estudiantes escriben el código **Arduino real** del robot (ESP32, QTR-MX-8A, VL53L0X, MPU6050 y
TCS34725) y lo prueban en una pista virtual que sigue las bases de Rescue Line FIRVI 2026, antes de
subirlo al robot físico.

> **Estado: fase 6 de 7 — ajustar parámetros.** Se abre en el navegador con `npm run dev`:
> - **Programar:** el editor con pestañas, abrir una carpeta o un `.zip`, descargar el proyecto y
>   autoguardado; **"Probar mi robot"** compila en el navegador y muestra al robot en la pista, con
>   pausa, velocidad, "Volver al inicio" y el aviso de ciclo sin fin; los mensajes del `Serial`, lo
>   que miden los sensores, el juez virtual y los errores explicados en español.
> - **Construir pista:** una paleta con las piezas de las bases (líneas, cruces con marcas, rampas,
>   F1 y F2, partida y meta, obstáculos, baches e hitos), colocar, girar y quitar con el mouse o el
>   teclado, las propiedades de cada pieza, el tamaño de la grilla, la "Revisión de las bases", y
>   guardar o abrir la pista como `.json`. La pista se guarda sola y se usa en la próxima prueba.
> - **"Mi robot":** las medidas, la posición de los sensores y los pines del robot, con un dibujo
>   desde arriba y avisos (pines repetidos, sensores fuera del chasis, robot más grande que las
>   bases). Se exporta e importa como `robot.json`.
> - **"Ajustar parámetros":** los valores marcados con `@ajustar` en el código, qué ajustar y en qué
>   rango, varias pruebas a la vez en workers sin recompilar, el gráfico de recompensa por prueba, el
>   mejor resultado con su recorrido, "Ver esta prueba en la pista" y "Usar estos valores" (reescribe
>   los números en el código; se deshace con `Ctrl+Z`). **El agente de aprendizaje y la recompensa
>   los programa el profe:** sus archivos están creados con el contrato, sin rellenar, y mientras
>   tanto la ventana explica qué falta.
>
> Faltan los ejemplos, la ayuda y la publicación en GitHub Pages (fase 7). Las fases se describen en
> la [spec](docs/superpowers/specs/2026-10-17-simulador-dynamis-design.md#19-fases-sugeridas-para-el-plan).

## Ajustar parámetros

Se marca un valor del código con un comentario `@ajustar` en la misma línea. En el ESP32 es solo un
comentario; en el simulador, cada prueba del entrenamiento le da un valor distinto sin recompilar:

```cpp
const float KP = 0.025;  // cuánto corrige · @ajustar siguelineas 0..0.1
int velocidad = 100;     // @ajustar siguelineas 50..200
#define KD 0.6           // @ajustar siguelineas
```

- Vale en variables numéricas con un número como valor inicial, y en `#define NOMBRE número`, en
  cualquier archivo del proyecto. Un `constexpr` marcado da un aviso.
- El grupo (`siguelineas`, `giroscopio`, `distancia`, `posicion` u otro nombre) ordena las tarjetas
  de la ventana. El rango `min..max` es opcional: si no está, se usa de 0 a 4 veces el valor.

**Para el profe:** el agente de aprendizaje por refuerzo (`src/ajuste/agente.js`) y la recompensa
(`src/ajuste/recompensa.js`) están sin rellenar: cada función lanza `FaltaImplementar` con un
`TODO(profe)`. El contrato, qué recibe cada función, cuándo se llama y en qué hilo corre está en
[`src/ajuste/README.md`](src/ajuste/README.md).

## Librerías soportadas

Son reimplementaciones compatibles con la API pública de cada librería (el detalle está en la
[spec, §7](docs/superpowers/specs/2026-10-17-simulador-dynamis-design.md#7-núcleo-simulado-api-soportada-en-la-v1)):

- Arduino / ESP32 core 3.x: pines, tiempo, `Serial`, `String` y `Wire`;
- `QTRSensors` de Pololu (v4);
- `VL53L0X` de Pololu;
- `Adafruit_MPU6050` (con `Adafruit_Sensor`);
- `MPU6050` de i2cdevlib (con `I2Cdev.h`);
- `Adafruit_TCS34725`.

## Requisitos

- Node.js 22 o más reciente.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm install` | Instala las dependencias (incluye Clang/LLVM compilado a WebAssembly, ~100 MB). |
| `npm run dev` | Abre el simulador en `http://localhost:5173` (construye el núcleo si cambió). |
| `npm run build` | Genera la app estática en `dist/`, con el compilador y el núcleo. |
| `npm run preview` | Sirve `dist/` para probarla como quedará publicada. |
| `npm test` | Corre las pruebas de unidad e integración. Antes, construye el núcleo si cambió. |
| `npm run e2e` | Corre las pruebas de punta a punta en Chromium con Playwright (levanta `npm run dev`). |
| `npm run nucleo` | Compila el núcleo Arduino simulado a `generado/nucleo.a` (`-- --forzar` para rehacerlo). |
| `npm run medir` | Mide los tiempos de compilación y de simulación. |
| `npm run typecheck` | Revisa los tipos de TypeScript. |

## Estructura

```
index.html      la página (las vistas Programar y Construir pista, y la ventana Mi robot)
src/
  main.ts       punto de entrada de la app
  ui/           paneles de la interfaz: editor, mensajes, lienzo, tarjetas, juez, acciones, el editor
                de pista con su paleta y su panel, y la ventana Mi robot
  ejemplos/     el proyecto y la pista con que abre la app
  proyecto/     proyecto de varios archivos, abrir (carpeta, .zip, arrastre), descargar y autoguardado
  compilador/   preprocesado como el Arduino IDE, Clang en un worker, diagnósticos y errores amigables
  nucleo/       el Arduino core del ESP32 simulado y las librerías de sensores, en C++
  simulacion/   puente wasm ↔ simulador, reloj virtual, pines, motores, sensores, el worker de la prueba
                y el bloque de control (pausa, velocidad y reinicios)
  robot/        configuración del robot (medidas, sensores, pines), validaciones y robot.json
  pista/        modelo de la pista FIRVI (JSON), catálogo de piezas, edición, puntos de partida y avisos
                de las bases
  mundo/        el mundo que leen los modelos: color del suelo, relieve, colisiones y raycast 3D
  juez/         juez virtual: hitos, meta, tiempo, reinicios, saltos de F y eventos
  modelos/      ← modelos matemáticos del profesor (dinámica y sensores)
scripts/        construcción del núcleo
tests/          unidad/, integracion/, medicion/, e2e/ (Playwright)
docs/           spec, planes y maqueta de la interfaz
```

## Para el profesor: los modelos

Los modelos matemáticos están en [`src/modelos/`](src/modelos/README.md). Cada archivo trae un
placeholder ideal marcado con `TODO(profe)`; al reemplazarlo, el resto del simulador no cambia.
El README de esa carpeta explica las firmas, las unidades y los marcos de referencia.

## Mediciones

`npm run medir` el 2026-10-21, en un contenedor Linux con 4 núcleos Intel Xeon a 2,8 GHz y
Node 22. El proyecto de prueba es un seguidor de línea con PID en 3 archivos.

| Medición | Resultado |
|---|---|
| Primera compilación (incluye cargar LLVM) | 3,2 s |
| Compilación en caliente (mediana de 5) | 1,6 s |
| Tamaño del `.wasm` | 36,5 KB |
| Simular 10 s del robot (sin ritmo de tiempo real) | 26 ms |

La mayor parte de la compilación en caliente se va en las cabeceras estándar de C++ que incluye
`Arduino.h` (`<algorithm>` y `<cmath>`, igual que el core real del ESP32). Para la fase 4 conviene
evaluar una cabecera precompilada. Falta medir en un Chromebook escolar dentro del navegador.

## Documentos

- [Spec del diseño](docs/superpowers/specs/2026-10-17-simulador-dynamis-design.md)
- [Plan de la fase 1](docs/superpowers/plans/2026-10-21-fase-1-base-de-ejecucion.md)
- [Plan de la fase 2](docs/superpowers/plans/2026-10-22-fase-2-pista-mundo-juez.md)
- [Plan de la fase 3](docs/superpowers/plans/2026-10-22-fase-3-librerias-de-sensores.md)
- [Plan de la fase 4](docs/superpowers/plans/2026-10-22-fase-4-ui-programar.md)
- [Plan de la fase 5](docs/superpowers/plans/2026-10-22-fase-5-construir-pista-y-mi-robot.md)
- [Plan de la fase 6](docs/superpowers/plans/2026-10-22-fase-6-ajustar-parametros.md)
- [Maqueta de la interfaz](docs/maqueta/simulador-dynamis.html) (ábrela en el navegador)
