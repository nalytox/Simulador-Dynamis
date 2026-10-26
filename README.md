# Simulador Dynamis

Simulador web del robot de **Dynamis** (Fundación Mustakis) para estudiantes de 14 a 16 años.
Los estudiantes escriben el código **Arduino real** del robot (ESP32, QTR-MX-8A, VL53L0X, MPU6050 y
TCS34725) y lo prueban en una pista virtual que sigue las bases de Rescue Line FIRVI 2026, antes de
subirlo al robot físico.

## Qué incluye

- **Programar:** editor con pestañas; abrir una carpeta o un `.zip`, descargar el proyecto y
  autoguardado. **"Probar mi robot"** compila en el navegador y muestra al robot en la pista, con
  pausa, velocidad y "Volver al inicio". Muestra los mensajes del `Serial`, lo que miden los
  sensores, el juez virtual y los errores de compilación explicados en español.
- **Construir pista:** las piezas de las bases (líneas, cortes, cruces con marcas, rampas, F1 y F2,
  partida y meta, obstáculos, baches e hitos), sus propiedades, una revisión según las bases, y
  guardar o abrir la pista como `.json`.
- **Mi robot:** las medidas, la posición de los sensores y los pines del robot, con un dibujo y
  avisos. Se exporta e importa como `robot.json`.
- **Ajustar parámetros:** prueba muchas veces los valores marcados con `@ajustar` en el código, con
  varias pruebas a la vez, un gráfico de recompensa y "Usar estos valores".
- **Ejemplos:** proyectos para cada sensor (motores, línea, seguidores, cortes, marcas de color,
  rampa, obstáculo y giroscopio) y tres pistas.
- **Ayuda:** una guía de cada sensor con un programa para copiar, las conexiones del robot, cómo se
  puntúa según las bases y un recorrido para la primera visita.
- **Funciona en el navegador:** se publica en GitHub Pages, se puede instalar y funciona sin
  internet después de probar el robot una vez.

## Uso

1. Abre la dirección publicada (`https://<usuario>.github.io/Simulador-Dynamis/`) en Chrome o Edge
   (también en Chromebooks). No hay que instalar nada ni crear una cuenta.
2. La app abre con un seguidor de línea y la pista de práctica: presiona **"Probar mi robot"**. La
   primera vez descarga el compilador; después queda guardado.
3. **Todo se guarda solo** en el navegador. "Descargar mi proyecto" entrega un `.zip` que se abre
   en el Arduino IDE para subirlo al robot.
4. **"Instalar en este computador"** deja un ícono en el escritorio, si el navegador lo permite.

## Librerías soportadas

El núcleo Arduino del ESP32 y las librerías de los sensores están reimplementados en
[`src/nucleo/`](src/nucleo/), compatibles con la API pública de cada librería:

- Arduino / ESP32 core 3.x: pines, tiempo, `Serial`, `String`, `Wire` y `Wire1`;
- `QTRSensors` de Pololu (v4);
- `Adafruit_VL53L0X`;
- `MPU6050_light` (de rfetick);
- `Adafruit_TCS34725`, con uno o dos sensores, también detrás de un multiplexor TCA9548A (se
  configura en "Mi robot" y se usa por I2C directo, como en el robot real).

## Ajustar parámetros

Un valor del código se marca con un comentario `@ajustar` en la misma línea. En el ESP32 es solo un
comentario; en el simulador, cada prueba le da un valor distinto sin recompilar:

```cpp
const float KP = 0.025;  // cuánto corrige · @ajustar siguelineas 0..0.1
int velocidad = 100;     // @ajustar siguelineas 50..200
#define KD 0.6           // @ajustar siguelineas
```

- Vale en variables numéricas con un número como valor inicial, y en `#define NOMBRE número`, en
  cualquier archivo del proyecto.
- El grupo (`siguelineas`, `giroscopio`, `distancia`, `posicion` u otro nombre) ordena las tarjetas
  de la ventana. El rango `min..max` es opcional: si no está, se usa de 0 a 4 veces el valor.

El agente de aprendizaje por refuerzo (`src/ajuste/agente.js`) y la recompensa
(`src/ajuste/recompensa.js`) no están implementados: cada función lanza `FaltaImplementar`. Su
contrato está en [`src/ajuste/README.md`](src/ajuste/README.md).

## Modelos de los sensores y del robot

La dinámica del robot y la lectura de cada sensor están en [`src/modelos/`](src/modelos/README.md).
Hoy son aproximaciones ideales, marcadas con `TODO(profe)`. Se pueden reemplazar sin cambiar el
resto del simulador; ese README explica las firmas, las unidades y los marcos de referencia.

## Desarrollo

Requisitos: [Node.js 22](https://nodejs.org) o más reciente y [Git](https://git-scm.com).

```sh
git clone https://github.com/<usuario>/Simulador-Dynamis.git
cd Simulador-Dynamis
npm install
npm run dev
```

El simulador se abre en `http://localhost:5173` y se recarga al guardar un archivo.

| Comando | Qué hace |
|---|---|
| `npm install` | Instala las dependencias (incluye Clang/LLVM compilado a WebAssembly, ~100 MB). |
| `npm run dev` | Abre el simulador en `http://localhost:5173` (construye el núcleo si cambió). |
| `npm run build` | Genera la app estática en `dist/`, con el compilador y el núcleo. |
| `npm run preview` | Sirve `dist/` para probarla como quedará publicada. |
| `npm test` | Pruebas de unidad e integración. Antes, construye el núcleo si cambió. |
| `npm run e2e` | Pruebas de punta a punta en Chromium con Playwright (levanta `npm run dev`). |
| `npm run e2e:produccion` | Construye la app y prueba la versión publicada: sin cabeceras COOP/COEP, instalable y sin internet. |
| `npm run nucleo` | Compila el núcleo Arduino simulado a `generado/nucleo.a` (`-- --forzar` para rehacerlo). |
| `npm run medir` | Mide los tiempos de compilación y de simulación. |
| `npm run typecheck` | Revisa los tipos de TypeScript. |

### Agregar un ejemplo

Crea la carpeta `src/ejemplos/proyectos/<id>/` con `<id>.ino` (y `pines.h` si lo usa) y agrega su
ficha (nombre, descripción y pista) en la tabla `FICHAS` de `src/ejemplos/index.ts`. Las pistas de
ejemplo están en `src/ejemplos/pistas/`.

### Publicar en GitHub Pages

1. En GitHub: **Settings → Pages → Build and deployment → Source: "GitHub Actions"** (lo hace
   quien administra el repositorio).
2. Cada *push* a `main` corre las pruebas, construye la app y la publica
   (`.github/workflows/publicar.yml`). También se puede correr a mano desde **Actions**.

Si el paso `publicar` falla con `HttpError: Not Found`, Pages no está activado con Source "GitHub
Actions": actívalo y usa **Re-run failed jobs** en la ejecución que falló.

## Estructura

```
index.html      la página: las vistas Programar y Construir pista, y las ventanas Mi robot, Ajustar,
                Ejemplos y Ayuda
public/         el manifiesto de la app instalable y sus íconos
src/
  main.ts       punto de entrada de la app
  ui/           la interfaz: editor, mensajes, lienzo, tarjetas, juez, acciones, el editor de pista,
                las ventanas y el recorrido de la primera visita
  ejemplos/     proyectos y pistas de ejemplo, y con qué abre la app
  ayuda/        las guías de los sensores, las conexiones del robot y el puntaje de las bases
  pwa/          el service worker (COOP/COEP y caché sin internet), su registro e "Instalar"
  proyecto/     proyecto de varios archivos: abrir (carpeta, .zip, arrastre), descargar y autoguardado
  compilador/   preprocesado como el Arduino IDE, Clang en un worker, diagnósticos y errores explicados
  nucleo/       el core Arduino del ESP32 simulado y las librerías de los sensores, en C++
  simulacion/   puente wasm ↔ simulador, reloj virtual, pines, motores, sensores, bus I2C y el worker
                de la prueba
  robot/        configuración del robot (medidas, sensores, pines), validaciones y robot.json
  pista/        modelo de la pista FIRVI (JSON), catálogo de piezas, edición y revisión según las bases
  mundo/        lo que leen los modelos: color del suelo, relieve, colisiones y raycast 3D
  juez/         juez virtual: hitos, meta, tiempo, reinicios y eventos
  ajuste/       motor de pruebas de Ajustar parámetros, y el agente y la recompensa
  modelos/      modelos matemáticos de la dinámica y de los sensores
scripts/        construcción del núcleo, plugin del service worker, íconos y revisión de dist/
.github/        workflows de GitHub Actions
tests/          unidad/, integracion/, medicion/, e2e/ y e2e-produccion/ (Playwright)
```
