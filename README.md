# Simulador Dynamis

Simulador web del robot de **Dynamis** (Fundación Mustakis) para estudiantes de 14 a 16 años.
Los estudiantes escriben el código **Arduino real** del robot (ESP32, QTR-MX-8A, VL53L0X, MPU6050 y
TCS34725) y lo prueban en una pista virtual que sigue las bases de Rescue Line FIRVI 2026, antes de
subirlo al robot físico.

> **Estado: fase 2 de 7 — pista, mundo y juez.** Todavía no hay interfaz. El simulador ya compila
> proyectos Arduino de varios archivos a WebAssembly y los ejecuta con tiempo virtual sobre una
> pista FIRVI descrita en JSON (rectas, giros, cortes, cruces con marcas de color, rampas, baches,
> F1, F2 y obstáculo), y un juez virtual le pone puntaje a cada prueba como lo dicen las bases.
> Las fases siguientes se describen en la
> [spec](docs/superpowers/specs/2026-10-17-simulador-dynamis-design.md#19-fases-sugeridas-para-el-plan).

## Requisitos

- Node.js 22 o más reciente.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm install` | Instala las dependencias (incluye Clang/LLVM compilado a WebAssembly, ~100 MB). |
| `npm test` | Corre las pruebas de unidad e integración. Antes, construye el núcleo si cambió. |
| `npm run nucleo` | Compila el núcleo Arduino simulado a `generado/nucleo.a` (`-- --forzar` para rehacerlo). |
| `npm run medir` | Mide los tiempos de compilación y de simulación. |
| `npm run typecheck` | Revisa los tipos de TypeScript. |

## Estructura

```
src/
  proyecto/     modelo de proyecto de varios archivos (.ino, .h, .cpp, .c)
  compilador/   preprocesado como el Arduino IDE, llamada a Clang y diagnósticos
  nucleo/       el Arduino core del ESP32 simulado, en C++ (Arduino.h, Serial, pines, tiempo)
  simulacion/   puente wasm ↔ simulador, reloj virtual, pines, driver de motores y Simulador
  robot/        configuración del robot (medidas, sensores, pines) y validaciones
  pista/        modelo de la pista FIRVI (JSON), catálogo de piezas, puntos de partida y avisos de las bases
  mundo/        el mundo que leen los modelos: color del suelo, relieve, colisiones y raycast 3D
  juez/         juez virtual: hitos, meta, tiempo, reinicios, saltos de F y eventos
  modelos/      ← modelos matemáticos del profesor (dinámica; sensores en la fase 3)
scripts/        construcción del núcleo
tests/          unidad/, integracion/, medicion/
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
- [Maqueta de la interfaz](docs/maqueta/simulador-dynamis.html) (ábrela en el navegador)
