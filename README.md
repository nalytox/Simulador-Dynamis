# Simulador Dynamis

Simulador web del robot de **Dynamis** (Fundación Mustakis) para estudiantes de 14 a 16 años.
Los estudiantes escriben el código **Arduino real** del robot (ESP32, QTR-MX-8A, VL53L0X, MPU6050 y
TCS34725) y lo prueban en una pista virtual que sigue las bases de Rescue Line FIRVI 2026, antes de
subirlo al robot físico.

> **Estado: fase 7 de 7 — lista para usar en clases.**
> - **Programar:** el editor con pestañas, abrir una carpeta o un `.zip`, descargar el proyecto y
>   autoguardado; **"Probar mi robot"** compila en el navegador y muestra al robot en la pista, con
>   pausa, velocidad, "Volver al inicio" y el aviso de ciclo sin fin; los mensajes del `Serial`, lo
>   que miden los sensores, el juez virtual y los errores explicados en español.
> - **Construir pista:** las piezas de las bases (líneas, cortes, cruces con marcas, rampas, F1 y F2,
>   partida y meta, obstáculos, baches e hitos), sus propiedades, la "Revisión de las bases", y
>   guardar o abrir la pista como `.json`.
> - **"Mi robot":** las medidas, la posición de los sensores y los pines del robot, con un dibujo y
>   avisos. Se exporta e importa como `robot.json`.
> - **"Ajustar parámetros":** entrena los valores marcados con `@ajustar` en el código, con varias
>   pruebas a la vez, el gráfico de recompensa y "Usar estos valores". **El agente de aprendizaje y la
>   recompensa los programa el profe** (ver más abajo).
> - **"Ejemplos":** 9 proyectos (mover los motores, leer la línea, seguidores de línea, cortes, marcas
>   de color, rampa, obstáculo y giroscopio) y 3 pistas (Práctica FIRVI, Cruces con marcas, y Rampa y
>   baches).
> - **"Ayuda":** una guía de cada sensor con un programa que se puede copiar, "Conexiones de mi
>   robot", cómo se puntúa en las bases y el recorrido de la primera visita.
> - **Se publica en GitHub Pages**, se puede **instalar** y funciona **sin internet** después de
>   probar el robot una vez.

## Para estudiantes

1. Abre `https://<usuario>.github.io/Simulador-Dynamis/` en Chrome o Edge (también en Chromebooks).
   No hay que instalar nada ni crear una cuenta.
2. La app abre con el seguidor de línea y la pista de práctica: presiona **"Probar mi robot"**. La
   primera vez descarga su compilador ("Preparando tu laboratorio"); después queda guardado.
3. **Todo se guarda solo** en el navegador. "Descargar mi proyecto" entrega un `.zip` que se abre
   directo en el Arduino IDE para subirlo al robot.
4. **"Instalar en este computador"** (en la banda, si el navegador lo permite) deja un ícono en el
   escritorio. Después de probar el robot una vez, el simulador funciona **sin internet**, por
   ejemplo en el lugar de la competencia.
5. En **"Ejemplos"** hay proyectos para cada sensor y pistas para probarlos, y en **"Ayuda"**, cómo se
   usa cada sensor, cómo está conectado el robot y cómo se puntúa.

## Para el profe: paso a paso

1. **Preparar el computador:** instala [Node.js 22](https://nodejs.org) y [Git](https://git-scm.com). Después:
   ```sh
   git clone https://github.com/<usuario>/Simulador-Dynamis.git
   cd Simulador-Dynamis
   npm install
   npm run dev
   ```
   El simulador se abre en `http://localhost:5173` y se recarga solo al guardar un archivo.
2. **Modelos matemáticos:** la dinámica del robot y cada sensor están en
   [`src/modelos/`](src/modelos/README.md). Cada archivo trae un placeholder ideal con `TODO(profe)`.
3. **Agente y recompensa:** están en [`src/ajuste/`](src/ajuste/README.md), sin rellenar: cada
   función lanza `FaltaImplementar` con un `TODO(profe)`. Ese README explica el contrato.
4. **Probar los cambios:** `npm test` (unidad e integración), `npm run e2e` (la app en Chromium) y
   `npm run e2e:produccion` (la versión publicada, sin internet incluido).
5. **Publicar en GitHub Pages:**
   - la primera vez, en GitHub: **Settings → Pages → Source: "GitHub Actions"**;
   - después, cada *push* a la rama `main` corre las pruebas, construye la app y la publica sola
     (workflow `.github/workflows/publicar.yml`). También se puede correr a mano desde la pestaña
     **Actions**;
   - la dirección queda en `https://<usuario>.github.io/Simulador-Dynamis/`.
6. **Agregar un ejemplo:** crea la carpeta `src/ejemplos/proyectos/<id>/` con `<id>.ino` (y
   `pines.h` si lo usa) y agrega su ficha (nombre, descripción y pista) en la tabla `FICHAS` de
   `src/ejemplos/index.ts`. Las pistas de ejemplo están en `src/ejemplos/pistas/`.

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
| `npm run e2e:produccion` | Construye la app y prueba la versión publicada: sin cabeceras COOP/COEP, instalable y sin internet. |
| `npm run nucleo` | Compila el núcleo Arduino simulado a `generado/nucleo.a` (`-- --forzar` para rehacerlo). |
| `npm run medir` | Mide los tiempos de compilación y de simulación. |
| `npm run typecheck` | Revisa los tipos de TypeScript. |

## Estructura

```
index.html      la página (las vistas Programar y Construir pista, y las ventanas Mi robot, Ajustar,
                Ejemplos y Ayuda)
public/         el manifiesto de la app instalable y sus íconos
src/
  main.ts       punto de entrada de la app
  ui/           paneles de la interfaz: editor, mensajes, lienzo, tarjetas, juez, acciones, el editor
                de pista con su paleta y su panel, las ventanas y el recorrido de la primera visita
  ejemplos/     proyectos (proyectos/<id>/) y pistas de ejemplo, y con qué abre la app
  ayuda/        las guías de los sensores, "Conexiones de mi robot" y el puntaje de las bases
  pwa/          el service worker (COOP/COEP y caché sin internet), su registro e "Instalar"
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
  ajuste/       motor de pruebas de Ajustar parámetros; ← agente y recompensa del profesor
  modelos/      ← modelos matemáticos del profesor (dinámica y sensores)
scripts/        construcción del núcleo, plugin del service worker, íconos y revisión de dist/
.github/        workflow que publica en GitHub Pages
tests/          unidad/, integracion/, medicion/, e2e/ y e2e-produccion/ (Playwright)
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
- [Plan de la fase 7](docs/superpowers/plans/2026-10-23-fase-7-ejemplos-ayuda-despliegue.md)
- [Maqueta de la interfaz](docs/maqueta/simulador-dynamis.html) (ábrela en el navegador)
