# Simulador Dynamis — Diseño

**Fecha:** 2026-10-17
**Estado:** aprobado en conversación; pendiente de revisión escrita
**Maqueta de referencia:** [`docs/maqueta/simulador-dynamis.html`](../../maqueta/simulador-dynamis.html) (ábrela en el navegador)

---

## 1. Propósito

Simulador web para el programa **Dynamis** (Fundación Mustakis). Estudiantes de **14 años** escriben el código **Arduino real** de su robot y lo prueban sobre una pista virtual antes de subirlo al robot físico.

El robot usa:

| Componente | Función |
|---|---|
| ESP32 | Microcontrolador (Arduino core 3.x) |
| QTR-MX-8A | 8 sensores de reflectancia analógicos (siguelíneas) |
| VL53L0X | Distancia por tiempo de vuelo (I2C) |
| MPU6050 | Acelerómetro y giroscopio (I2C) |
| TCS34725 | Sensor de color (I2C) |
| Driver tipo TB6612FNG | Dos motores DC (tracción diferencial) |

### Reparto del trabajo

- **Este proyecto (lo construimos aquí):** interfaz gráfica, editor de código, compilación y ejecución del código Arduino, librerías simuladas, editor de pista, primitivas geométricas del mundo, motor de pruebas para "Ajustar parámetros", persistencia y pruebas automáticas.
- **El profesor/autor (lo implementa él):** los **modelos matemáticos** (dinámica del robot y modelo de cada sensor), el **agente de aprendizaje por refuerzo** y la **función de recompensa**. El proyecto deja *placeholders* simples marcados con `TODO` para que todo funcione de punta a punta mientras tanto.
- **Pendiente del usuario:** los **casos de la pista** (tipos de baldosa y objetos de la competencia) llegarán en un mensaje posterior. El catálogo de baldosas queda preparado para recibirlos.

### Criterios de éxito

1. Un estudiante abre la página, escribe (o abre) su proyecto Arduino, presiona **"Probar mi robot"** y ve al robot moverse en la pista según su código, con las lecturas de los sensores y los `Serial.print` en pantalla.
2. El mismo código, sin cambios, compila en el Arduino IDE para el ESP32 real.
3. Los errores de compilación se explican en español simple, marcando el archivo y la línea.
4. El profesor puede reemplazar los modelos, el agente y la recompensa editando archivos JavaScript aislados, sin tocar el resto del sistema.
5. "Ajustar parámetros" corre cientos de pruebas sin dibujar, en paralelo, y escribe los mejores valores de vuelta en el código.

---

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Ejecución del código | Se compila el **C++ real** con Clang→WebAssembly **en el navegador** (`@yowasp/clang`). Probado: un sketch con clases, `math.h`, `millis/delay/analogWrite/Serial` compila en ~4,5 s y corre con tiempo simulado. |
| Plataforma | **App web** estática (Vite + TypeScript), publicable en GitHub Pages. |
| Lenguaje de los modelos del profesor | **JavaScript** (archivos `.js` con tipos en JSDoc). |
| Pista | **Grilla de baldosas** (30 × 30 cm por defecto) + objetos libres encima. Con **rampas**. |
| Placeholders de modelos | Ideales y sin ruido, marcados con `TODO`. |
| Ajustar parámetros | El proyecto hace la ventana, el motor de pruebas y las interfaces; el profesor hace el **agente RL** y la **recompensa** (con placeholder de búsqueda aleatoria). |
| Interfaz | **No** imita al Arduino IDE: amigable para 14 años, en español, con la paleta de Dynamis. |
| Proyectos | **Carpetas con varios archivos** (`.ino`, `.h`, `.cpp`), cada uno en su pestaña. |
| Mensajes del robot | Scroll automático tipo terminal mientras se mira el final; si el usuario sube, no se le mueve la vista. |

---

## 3. Arquitectura

Tres hilos, más un grupo de workers para entrenar:

```
┌──────────────────────────── Hilo principal (UI) ────────────────────────────┐
│ Editor (CodeMirror) · Lienzo de pista · Paneles de sensores · Mensajes      │
│ Editor de pista · Ventana "Ajustar parámetros" · Agente RL (del profesor)   │
└───────┬───────────────────────────┬──────────────────────────────┬─────────┘
        │ archivos del proyecto     │ módulo .wasm + pista + robot │ módulo .wasm + valores
        ▼                           ▼                              ▼
┌────────────────┐   ┌──────────────────────────────┐   ┌─────────────────────────┐
│ Worker         │   │ Worker de simulación         │   │ Pool de workers de      │
│ compilador     │   │ (una ejecución visible)      │   │ entrenamiento (N)       │
│ Clang WASM     │   │ sketch.wasm ⇄ núcleo simulado│   │ misma simulación, sin   │
│ preprocesado   │   │ reloj virtual · física ·     │   │ ritmo de tiempo real,   │
│ Arduino        │   │ modelos del profesor · mundo │   │ registra cada prueba    │
└────────────────┘   └──────────────────────────────┘   └─────────────────────────┘
```

- **Worker compilador:** carga Clang una vez y lo deja en caché. Preprocesa el proyecto como el Arduino IDE (§5), compila a `wasm32` y enlaza contra el núcleo simulado **precompilado** (`nucleo.a`, generado al construir la app) para que cada compilación solo procese el código del estudiante. Devuelve un `WebAssembly.Module` o una lista de diagnósticos.
- **Worker de simulación:** instancia el módulo, ejecuta `setup()` y luego `loop()` en bucle. Cada llamada del sketch al núcleo (leer un sensor, escribir un pin, `delay`, `millis`) es un **punto de sincronización** donde avanza el reloj virtual y, con él, la física (§6). Envía instantáneas a la UI ~60 veces por segundo.
- **Pool de entrenamiento:** `N = clamp(hardwareConcurrency − 1, 1, 8)` workers. Cada uno ejecuta pruebas completas sin pausa ni dibujo (§11).
- **Detener** siempre termina el worker (`worker.terminate()`), así un `while(1){}` sin llamadas al núcleo nunca congela la página.

### Pausa y ritmo de tiempo real

El worker de simulación lee un bloque de control en `SharedArrayBuffer` (estado: corriendo/pausa; velocidad ×0,25…×4 o "máxima"). En cada punto de sincronización compara el tiempo virtual con el real × velocidad y, si va adelantado, espera con `Atomics.wait`. La pausa también es un `Atomics.wait`, hasta que cambia el estado.

`SharedArrayBuffer` requiere aislamiento de origen cruzado (`COOP: same-origin`, `COEP: require-corp`). Vite lo configura en desarrollo. En GitHub Pages se usa `coi-serviceworker`. Si el navegador no queda aislado, la UI muestra un mensaje claro en vez de fallar en silencio.

---

## 4. Tecnología y estructura de carpetas

- **Vite + TypeScript** para la app; **sin framework de UI** (módulos TS por panel).
- **CodeMirror 6** (`@codemirror/lang-cpp`) con un tema propio en la paleta.
- **`@yowasp/clang`** (Clang/LLD a WebAssembly; ~105 MB sin comprimir, se descarga una vez y queda en caché).
- **`fflate`** para importar y exportar `.zip`.
- **Vitest** (unidades e integración) y **Playwright** (extremo a extremo; Chromium ya está instalado en el entorno).

```
index.html
vite.config.ts                 # cabeceras COOP/COEP en desarrollo
public/coi-serviceworker.js
scripts/construir-nucleo.mjs   # compila src/nucleo/*.cpp → nucleo.a con @yowasp/clang en Node
src/
  main.ts
  ui/                          # banda, acciones, editor, pestañas, mensajes, paneles, editor de pista,
                               # ventana de ajuste, avisos, tema.css
  proyecto/                    # modelo de proyecto multiarchivo, importar/exportar, autoguardado
  compilador/                  # worker, preprocesador Arduino, prototipos, @ajustar, errores amigables
  nucleo/                      # C++ del núcleo simulado: Arduino.h, Wire.h, VL53L0X.h, QTRSensors.h,
                               # Adafruit_MPU6050.h, Adafruit_Sensor.h, MPU6050.h, Adafruit_TCS34725.h, WString…
  simulacion/                  # worker, reloj virtual, puente (imports del wasm), pines → motores,
                               # bucle de física, instantáneas
  mundo/                       # muestrear, altura, inclinacion, raycast 3D, colisiones
  pista/                       # modelo, catálogo de baldosas y objetos, dibujo, serialización
  robot/                       # configuración del robot (dimensiones, montaje de sensores, pines), dibujo
  ajuste/                      # motor de pruebas, pool de workers, registro de pruebas
    agente.js                  # ← PROFESOR (placeholder: búsqueda aleatoria)
    recompensa.js              # ← PROFESOR (placeholder simple)
  modelos/                     # ← PROFESOR
    README.md                  # contrato de cada función, unidades y convenciones
    dinamica.js
    vl53l0x.js
    qtr.js
    mpu6050.js
    tcs34725.js
    parametros.js              # constantes físicas del robot que usen los modelos
  ejemplos/                    # proyectos de ejemplo (carpetas con .ino y .h)
tests/
  unidad/  integracion/  e2e/
docs/
```

---

## 5. Proyecto de código y preprocesado Arduino

### Proyecto multiarchivo

- Un proyecto es una **carpeta** con archivos `.ino`, `.h`, `.hpp`, `.c` y `.cpp`, incluida la subcarpeta `src/` (como en Arduino).
- Cada archivo es una **pestaña**. La principal es el `.ino` con el nombre de la carpeta, o si no existe, el primer `.ino`. Va primero y las demás siguen en orden alfabético.
- **Abrir:** botón "Abrir carpeta" (`<input webkitdirectory>`), **arrastrar la carpeta** sobre el editor, o abrir un `.zip`.
- **Guardar:** en Chrome/Edge, si la carpeta se abrió con `showDirectoryPicker`, se puede guardar de vuelta en la misma carpeta. En cualquier navegador se puede **descargar como `.zip`**.
- **Editar:** crear (botón **+**), renombrar y borrar archivos.
- **Autoguardado** del proyecto completo en IndexedDB.

### Preprocesado (igual que Arduino IDE)

1. Todos los `.ino` se **concatenan** en una sola unidad: el principal primero y el resto en orden alfabético. Se insertan directivas `#line N "archivo.ino"` para que los errores apunten al archivo y la línea correctos.
2. Se agrega `#include <Arduino.h>` al inicio de esa unidad. Los `.cpp` se compilan por separado y **no** lo reciben automáticamente, igual que en Arduino.
3. Se **generan prototipos** de las funciones definidas en los `.ino`, para poder llamar una función definida más abajo. Un escáner léxico liviano (que respeta comentarios, cadenas y profundidad de llaves) encuentra las definiciones a nivel superior. Los prototipos se insertan antes de la primera definición de función y omiten los valores por defecto.
4. Se transforman las marcas **`@ajustar`** (§11.1).
5. Opciones de compilación: `--target=wasm32-wasip1 -O1 -fno-exceptions -std=gnu++17`. Se activan advertencias útiles, pero solo se muestran los errores salvo que el usuario abra "Ver detalles".

Si el proyecto no cambió desde la última compilación, se reutiliza el módulo ya compilado.

### Errores amigables

Cada diagnóstico de Clang se traduce con una tabla de patrones a un mensaje en español para 14 años. La mascota lo muestra en una burbuja, el editor salta a la pestaña y línea del error, y la línea queda marcada. El texto técnico original queda disponible en "Ver mensaje técnico".

| Patrón de Clang | Mensaje |
|---|---|
| `expected ';'` | Falta un punto y coma `;` al final. En C++ cada instrucción termina con `;`. |
| `use of undeclared identifier 'X'` | No conozco `X`. ¿Está bien escrito? ¿Lo declaraste antes de usarlo? |
| `'X' file not found` | No encontramos `X`. Las librerías disponibles son: … |
| `expected '}'` / `extraneous closing brace` | Las llaves `{ }` no están parejas. |
| `no matching function for call to 'X'` | `X` no recibe esos datos. Revisa cuántos y de qué tipo son. |
| `redefinition of 'X'` | `X` está definido dos veces. |
| `cannot initialize … with …` / conversión | Estás guardando un dato de un tipo en una variable de otro tipo. |
| (sin patrón) | Mensaje genérico + el texto técnico. |

Errores durante la ejecución:

| Problema | Mensaje |
|---|---|
| Trap de WASM: división entera por cero | "Dividiste por cero" |
| Trap de WASM: acceso fuera de memoria | "Usaste una posición de un arreglo que no existe" |
| Trap de WASM: desbordamiento de pila | "Una función se llama a sí misma sin parar" |
| Más de 2 s reales sin ningún punto de sincronización | "Tu programa parece atrapado en un ciclo sin fin. ¿Falta un `delay` o leer un sensor dentro del `while`?" (con botón Detener) |

---

## 6. Ejecución y tiempo virtual

- **Reloj virtual** en microsegundos (entero de 64 bits). La física avanza a paso fijo `dt` (1 ms por defecto, configurable).
- Cuando una llamada del sketch hace avanzar el reloj hasta `T`, se ejecutan los pasos de física pendientes hasta `T` y recién entonces se calcula la lectura del sensor con el estado de ese instante.
- **Costo de tiempo de cada llamada.** Los valores por defecto están en una tabla editable (`simulacion/costos.ts`):

| Llamada | Costo virtual |
|---|---|
| `millis()`, `micros()` | 1 µs (evita que `while (millis() - t < 100) {}` quede congelado) |
| `digitalWrite`, `digitalRead`, `pinMode` | 1 µs |
| `analogRead` | 10 µs |
| `analogWrite`, `ledcWrite` | 2 µs |
| Lectura I2C (MPU6050, 14 bytes a 400 kHz) | ~0,4 ms |
| `VL53L0X::readRangeSingleMillimeters` | presupuesto de medición (33 ms por defecto) |
| `VL53L0X::readRangeContinuousMillimeters` | espera hasta la siguiente medición del período configurado |
| `Adafruit_TCS34725::getRawData` | espera el tiempo de integración (como la librería real) |
| `Serial.print*` | 10 bits por carácter a la velocidad configurada, solo si se llena el búfer de 128 bytes |
| `delay(ms)` / `delayMicroseconds(us)` | exactamente lo pedido |

- **Determinismo:** cada ejecución tiene una **semilla**. Los modelos reciben un generador aleatorio con esa semilla (`ctx.azar()`), así una prueba se puede repetir exactamente (por ejemplo, "Ver esta prueba en la pista").
- **Instantáneas a la UI** (~60 Hz): pose, motores, lecturas, eventos y mensajes de `Serial` acumulados desde la instantánea anterior.

---

## 7. Núcleo simulado (API soportada en la v1)

Son reimplementaciones **compatibles con la API pública** de cada librería, escritas desde cero en `src/nucleo/`. Llaman al simulador mediante *imports* de WebAssembly.

**Arduino / ESP32 core 3.x**
- **Pines:** `pinMode`, `digitalWrite`, `digitalRead`, `analogRead` (12 bits, `analogReadResolution`), `analogWrite` (8 bits por defecto, `analogWriteResolution`), `ledcAttach(pin, freq, res)`, `ledcWrite(pin, duty)`, `ledcDetach`.
- **Tiempo:** `millis`, `micros`, `delay`, `delayMicroseconds`, `yield`.
- **Utilidades:** `random`, `randomSeed`, `map`, `constrain`, `min`, `max`, `abs`, `sq`, constantes `HIGH/LOW/INPUT/OUTPUT/INPUT_PULLUP`.
- **`Serial`:** `begin`, `print`, `println`, `printf`, `write`, `flush`. `available()` y `read()` devuelven 0 y -1 (no hay entrada desde la UI en la v1).
- **`String`** (subconjunto de `WString`): construcción desde números, concatenación, `length`, `toInt`, `toFloat`, `indexOf`, `substring`, `c_str`.
- **`Wire`:** `begin([sda, scl])` y `setClock` no hacen nada. Los dispositivos se simulan a nivel de librería. El acceso directo a registros (`beginTransmission`/`requestFrom`) no está soportado en la v1 y produce un aviso claro.

**Pololu `VL53L0X`:** `init`, `setTimeout`, `getTimeout`, `timeoutOccurred`, `setAddress`, `getAddress`, `startContinuous(period)`, `stopContinuous`, `readRangeContinuousMillimeters`, `readRangeSingleMillimeters`, `setMeasurementTimingBudget`, `getMeasurementTimingBudget`, `setSignalRateLimit` y `setVcselPulsePeriod` (estas dos se aceptan y no tienen efecto en la v1).

**Pololu `QTRSensors` (v4)**
- `setTypeAnalog`, `setSensorPins`, `setEmitterPin`, `setSamplesPerSensor`, `emittersOn/Off`, `read`, `calibrate`, `resetCalibration`, `readCalibrated`, `readLineBlack`, `readLineWhite`, y los miembros `calibrationOn.minimum/maximum`.
- Está construida sobre `analogRead` de los pines simulados, así que leer el QTR con `analogRead` directo también funciona.

**Adafruit `Adafruit_MPU6050`** (+ `Adafruit_Sensor`): `begin`, `setAccelerometerRange`, `getAccelerometerRange`, `setGyroRange`, `getGyroRange`, `setFilterBandwidth`, `getEvent(&a, &g, &temp)` con `sensors_event_t`. Unidades: m/s² y rad/s.

**i2cdevlib / Electronic Cats `MPU6050`:** `initialize`, `testConnection`, `getMotion6`, `getAcceleration`, `getRotation`, `getRotationX/Y/Z`, `setFullScaleAccelRange`, `setFullScaleGyroRange` y `set{X,Y,Z}{Accel,Gyro}Offset`. Devuelven `int16` escalados según el rango (por ejemplo ±2 g → 16384 LSB/g, ±250 °/s → 131 LSB/(°/s)).

**Adafruit `Adafruit_TCS34725`:** constructor `(tiempoIntegración, ganancia)`, `begin`, `setIntegrationTime`, `setGain`, `getRawData`, `getRawDataOneShot`, `getRGB`, `calculateColorTemperature_dn40`, `calculateLux`, `setInterrupt` (que controla el LED en la placa típica).

**Conversión de unidades (la hace el núcleo, no los modelos):** los modelos entregan magnitudes físicas (§9) y el núcleo las convierte a lo que devuelve cada librería según su configuración (rango, ganancia, resolución).

**Nota de hardware real:** el VL53L0X y el TCS34725 usan la misma dirección I2C por defecto (`0x29`). El simulador no emula ese choque, pero la ayuda advierte que en el robot real hay que cambiar la dirección del VL53L0X (`setAddress` con XSHUT) o usar un multiplexor.

---

## 8. Robot

La configuración (`src/robot/config.ts`) describe el **robot físico de Dynamis**. Es la "verdad" del cableado: el código del estudiante debe coincidir con ella, igual que en la realidad.

```ts
{
  chasis:   { largo: 156, ancho: 132, alto: 60 },               // mm
  ruedas:   { diametro: 42, trocha: 140, x: 0 },
  motores:  { driver: 'TB6612',
              izq: { pwm: 18, in1: 16, in2: 17 },
              der: { pwm: 19, in1: 4,  in2: 5 },
              stby: null },
  qtr:      { pines: [36, 39, 34, 35, 32, 33, 25, 26], emisor: null,
              x: 92, separacion: 9.525, altura: 3 },
  vl53l0x:  { x: 92, y: 0, z: 35, yaw: 0, pitch: 0 },
  tcs34725: { x: 40, y: -46, z: 5, led: null },
  mpu6050:  { x: 0, y: 0, z: 40, orientacion: 'z-arriba-x-adelante' },
}
```

- **Pines → motores (driver TB6612):**
  - IN1/IN2 dan el sentido: `10` avanza, `01` retrocede, `11` freno, `00` libre.
  - El ciclo de trabajo del PWM (`analogWrite` o `ledcWrite`, normalizado según la resolución) da la magnitud.
  - Si se define `stby` y está en `LOW`, los motores se apagan.
  - Resultado: `motores = { izq: { duty: −1…1, modo: 'avance'|'retroceso'|'freno'|'libre' }, der: {…} }`.
- **Avisos amigables de cableado:** si el código escribe en un pin que en el robot no está conectado a nada, o lee el QTR en otro pin, la UI avisa ("El pin 23 no está conectado a nada en tu robot").
- La ayuda incluye una tarjeta **"Conexiones de mi robot"**, generada desde esta configuración.

---

## 9. Mundo y contrato de los modelos del profesor

### Convenciones

- **Unidades:** mm, s, rad (la UI muestra grados).
- **Marco del mundo:** origen en la esquina inferior izquierda de la pista; `x` hacia la derecha, `y` hacia arriba, `z` hacia arriba; `yaw` antihorario desde `+x`. La pantalla invierte `y` al dibujar.
- **Marco del robot:** `x` hacia adelante, `y` hacia la izquierda, `z` hacia arriba (convención REP-103).

### Primitivas del mundo (las implementa este proyecto)

```ts
mundo.muestrear(x, y)            → { r, g, b }                    // color 0–255 de la superficie
mundo.altura(x, y)               → mm                              // relieve (rampas, plataformas)
mundo.inclinacion(x, y, yaw)     → { pitch, roll }                 // rad, del suelo bajo ese punto y rumbo
mundo.raycast(origen, dir, max)  → { distancia, objeto, normal } | null   // 3D: objetos con altura + suelo
mundo.colisiona(poligono2D)      → { objeto, penetracion } | null  // huella del robot vs objetos
mundo.objetosCerca(x, y, radio)  → Objeto[]
```

- **`muestrear`** lee un mapa de superficie a 1 px = 1 mm, dibujado en un `OffscreenCanvas` con **las mismas funciones** que dibujan la pista en pantalla: lo que se ve es lo que siente el robot. El relieve de las rampas (degradado y flechas) **solo** se dibuja en pantalla, no en ese mapa.
- **`altura`** e **`inclinacion`** son analíticas: salen del relieve de cada tipo de baldosa (§10), no de un raster.
- **`raycast`** recorre el rayo contra los objetos (huella extruida hasta su altura) y contra el suelo (marcha de 2 mm sobre el mapa de alturas). Así el VL53L0X puede "ver" la subida de una rampa.

### Contrato de los modelos (`src/modelos/`, JavaScript)

```js
// dinamica.js
export function estadoInicial(pose, robot, mundo) → Estado
export function pasoDinamica(estado, motores, dt, mundo, robot, azar) → Estado
//   Estado: { x, y, z, yaw, pitch, roll, ...camposLibres }   (el profesor puede agregar v, w, etc.)
//   motores: { izq: { duty, modo }, der: { duty, modo } }

// qtr.js
export function leerQTR({ t, estado, sensores /* 8 × {x,y,z} en el mundo */, emisoresEncendidos, mundo, azar })
  → number[8]                         // ADC crudo 0–4095

// vl53l0x.js
export function leerVL53L0X({ t, estado, sensor /* {x,y,z,yaw,pitch} en el mundo */, mundo, azar })
  → number                            // mm; ≥ 8190 = sin objetivo

// mpu6050.js
export function leerMPU6050({ t, dt, estado, estadoAnterior, montaje, mundo, azar })
  → { ax, ay, az /* m/s² */, gx, gy, gz /* rad/s */, temp /* °C */ }   // en el marco del sensor

// tcs34725.js
export function leerTCS34725({ t, estado, sensor, tiempoIntegracionMs, ganancia, ledEncendido, mundo, azar })
  → { r, g, b, c }                    // cuentas crudas 0–65535
```

**Placeholders ideales (con `TODO`):**
- Dinámica: cinemática diferencial (`v = (izq+der)/2 · vMax`, `ω = (der−izq) · vMax / trocha`). La altura y la inclinación salen del mundo. Ante una colisión, el robot no avanza.
- QTR: `ADC = 180 + (1 − luminancia) · 3800`.
- VL53L0X: distancia directa del `raycast`.
- MPU6050: gravedad proyectada según la inclinación, más `gz = Δyaw/dt`.
- TCS34725: color muestreado, escalado por la ganancia y el tiempo de integración.

`src/modelos/README.md` documenta cada firma, las unidades, los marcos y un ejemplo.

---

## 10. Pista

### Modelo (JSON)

```json
{
  "version": 1,
  "nombre": "Mi pista",
  "tamanoBaldosa": 300,
  "columnas": 6, "filas": 4,
  "baldosas": [ { "c": 0, "r": 0, "tipo": "curva", "rot": 0, "nivel": 0, "props": {} } ],
  "objetos":  [ { "tipo": "obstaculo", "x": 1738, "y": 1050, "rot": 0, "props": { "ancho": 80, "largo": 80, "alto": 150 } } ],
  "inicio":   { "x": 300, "y": 1050, "yaw": 0 }
}
```

- `rot` toma los valores 0, 90, 180 o 270.
- `nivel` es la altura base de la baldosa en mm. Permite plataformas elevadas a las que se llega por rampas.

### Catálogo extensible

Cada tipo de baldosa es un módulo registrado en `src/pista/catalogo/`:

```ts
interface TipoBaldosa {
  id: string; nombre: string; categoria: string;
  dibujar(ctx, props): void;                         // superficie en coordenadas locales 0…T, sin rotar
  alturaLocal?(u, v, props): number;                 // relieve sobre el nivel (rampa: alto · u / T)
  dibujarRelieve?(ctx, props): void;                 // solo pantalla (degradado + flechas de subida)
  propiedades?: DescriptorPropiedad[];               // editables en el panel (por ejemplo, alto de la rampa)
}
```

Los objetos libres siguen el mismo patrón (`dibujar`, `huella`, `alto`, `propiedades`).

**Catálogo inicial de ejemplo** (se reemplaza o amplía con los casos del usuario):
- **Baldosas:** vacía, recta, curva, cruce, unión en T, rampa (sube 10 cm por defecto, editable).
- **Objetos:** obstáculo (caja), marca verde, inicio del robot.

### Editor de pista

- **Paleta** de piezas con miniaturas: eliges una y haces clic en la grilla.
- **Baldosa elegida:** girar a la izquierda o derecha (también con `R`), dejar vacía (`Supr`) y editar sus propiedades.
- **Tamaño de la grilla** ajustable. La **posición de inicio** del robot se arrastra.
- **Guardar y abrir** la pista como `.json`, y autoguardado en IndexedDB.

**Limitación conocida:** la pista es un mapa de alturas sobre un plano 2D. Sirve para rampas y plataformas, pero no para puentes ni túneles.

---

## 11. Ajustar parámetros (aprendizaje por refuerzo)

### 11.1 Marcas `@ajustar` en el código

```cpp
float kp = 0.08;  // @ajustar siguelineas
float ki = 0;     // @ajustar siguelineas 0..0.01
#define KD 0.6    // @ajustar siguelineas
```

- **En el ESP32 real** es un comentario, así que el código no cambia.
- **En el simulador,** el preprocesador reemplaza el inicializador por `__dyn_ajustable("siguelineas", "kp", 0.08)`. En un `#define` el valor se reemplaza por `(__dyn_ajustable(...))`. Los números de línea se mantienen. Cada prueba fija sus valores antes de instanciar el módulo, **sin recompilar**.
- Las marcas pueden estar en **cualquier archivo** del proyecto (por ejemplo `config.h`).
- Un `constexpr` marcado genera un aviso: no puede leerse en tiempo de ejecución.
- **Grupos con nombre e ícono amigables:** `siguelineas`, `giroscopio`, `distancia` y `posicion`. Cualquier otro nombre aparece como "grupo propio".
- El rango opcional `min..max` de la marca es el valor inicial del rango de búsqueda en la ventana.
- **"Usar estos valores"** reescribe los números en los archivos y líneas correspondientes, abre esa pestaña y resalta las líneas cambiadas.

### 11.2 Motor de pruebas (lo implementa este proyecto)

- El proyecto se compila **una vez**. El `WebAssembly.Module` se envía a los N workers.
- **Cada prueba:**
  1. Crea una instancia nueva del módulo, con memoria y variables globales limpias.
  2. Fija los valores propuestos y reinicia el robot en el inicio de la pista con una semilla nueva.
  3. Ejecuta `setup()` y luego `loop()` sin ritmo de tiempo real, hasta la duración máxima o hasta que `debeTerminar` lo indique.
- **Registro de la prueba:** cada 10 ms (configurable) guarda `t`, estado, lecturas y motores, más los eventos (`colision`, `fueraDePista`, `cicloSinFin`, error de ejecución) y la semilla.
- **La recompensa se calcula en el worker,** y al hilo principal solo vuelven `{ valores, recompensa, resumen, trayectoria (diezmada), semilla }`.
- **"Ver esta prueba en la pista"** repite la prueba en la vista normal, con los mismos valores y la misma semilla.

### 11.3 Contrato del profesor (`src/ajuste/`)

```js
// agente.js  (corre en el hilo principal)
export function crearAgente({ parametros /* [{ id, grupo, nombre, valor, min, max }] */, presupuesto /* nº de pruebas */ })
  → {
      proponer(): { [id]: number },                        // puede llamarse varias veces antes de recibir resultados
      aprender(valores, recompensa, resumen): void,
    }

// recompensa.js  (corre en los workers)
export function calcularRecompensa(registro) → number
export function debeTerminar(paso /* { t, estado, lecturas, motores, eventos } */, mundo) → false | string  // motivo
```

**Placeholders:**
- **Agente:** búsqueda aleatoria. 25 % de las veces explora uniformemente el rango; el resto perturba el mejor resultado con ruido gaussiano (σ = 10 % del rango).
- **Recompensa:** premia la distancia recorrida mientras el QTR ve la línea, y penaliza salir de la pista o chocar.

### 11.4 Ventana (interfaz para estudiantes)

- **¿Qué quieres ajustar?:** tarjetas por grupo con cada parámetro, un interruptor para ajustarlo o no, su valor actual, una explicación simple ("Qué tan fuerte corrige", "Frena los zigzags") y su rango de búsqueda. Los grupos que no están en el código muestran cómo marcarlos.
- **Entrenamiento:**
  - Configuración: número de pruebas, duración de cada prueba, robots practicando a la vez y pista.
  - Botón "Empezar a entrenar" o "Detener entrenamiento", y barra de progreso.
  - Gráfico de recompensa por prueba: puntos `#2C93D3`, línea "mejor hasta ahora" `#4049D8` y récords en `#FFD166`. Este par de azules pasó el validador de color. Lleva leyenda y tooltip.
- **Mejor resultado:** recompensa, comparación de los valores actuales con los mejores, recorrido de esa prueba, "Ver esta prueba en la pista" y "Usar estos valores".

---

## 12. Interfaz

Referencia visual: la maqueta en `docs/maqueta/`. Todo en **español (Chile)**, tuteando, para estudiantes de 14 años.

### Paleta (tokens CSS)

| Token | Color | Uso |
|---|---|---|
| `--azul` | `#0B0F98` | Identidad, banda de navegación, botones principales |
| `--celeste` | `#65C7F7` | Elementos interactivos, ilustraciones y gráficos |
| `--hielo` | `#DDF4FF` | Tarjetas, paneles y áreas destacadas |
| `--nube` | `#F4FAFF` | Fondo general |
| `--sol` | `#FFD166` | Premios, estrellas, logros y avisos positivos |
| `--rosa` | `#FF9FAD` | Detalles, mascota y elementos decorativos |

- Los textos van en tinta azul oscura (`#12164A`). El celeste nunca se usa como color de texto sobre blanco, porque no tiene suficiente contraste.
- **Tipografías:** Fredoka (títulos), Lexend (texto, pensada para lectura fácil) y JetBrains Mono (código). Se autoalojan para que funcionen sin conexión.

### Vistas

- **Banda superior:** logo con la mascota, pestañas *Programar* y *Construir pista*, y los botones *Ejemplos* y *Ayuda*.
- **Barra de acciones:** **"Probar mi robot"** (compila y ejecuta en un paso; mientras corre se convierte en "Detener"), Pausa/Seguir, Volver al inicio, **Ajustar parámetros**, estado en palabras ("El robot está corriendo") y velocidad Lento–Rápido (×0,25 a ×4).
- **Programar:**
  - **Mi programa:** pestañas de archivos, "Abrir carpeta", **+** para crear archivos, y el editor con resaltado y marcas `@ajustar` destacadas.
  - **Mensajes del robot:** el monitor serie.
  - **Pista:** el robot con cara; el rayo del VL53L0X; los puntos del QTR que se encienden en amarillo al ver línea; el camino recorrido; las rampas con degradado y flechas, y el robot que se agranda un poco al subir. Tiene zoom y desplazamiento.
  - **Lo que siente el robot:** tarjetas del QTR (8 barras, valores y posición de la línea), la distancia, el color (muestra y nombre), giro e inclinación (brújula y "Inclinación 18°, subiendo") y los motores (−100 a 100 %). Cada tarjeta tiene **"¿Cómo lo uso?"** con el código de ejemplo.
- **Construir pista:** paleta de piezas, la pista, el panel "Baldosa elegida", y los botones Guardar, Abrir y Pista nueva.
- **Ajustar parámetros:** ventana superpuesta (§11.4).
- **Ejemplos:** proyectos listos para abrir: mover motores, leer la línea, seguidor de línea con PID, esquivar obstáculos, leer color y leer el giroscopio.
- **Ayuda:** guía de cada sensor con fragmentos de código, "Conexiones de mi robot" y el aviso de la dirección I2C repetida.

### Mensajes del robot

- **Scroll pegado al final:** si el usuario está mirando el final, cada mensaje nuevo aparece abajo y empuja el resto hacia arriba.
- Si el usuario **sube** para leer, la vista no se mueve y aparece **"Mensajes nuevos ↓"** para volver al final.
- Al volver a la vista *Programar*, se muestra lo último.
- Se agregan los mensajes **una vez por cuadro** (`requestAnimationFrame`) y se guardan los últimos **500**, para que un `Serial.println` dentro de `loop()` no congele la página.
- Cada línea muestra el tiempo simulado. El botón **Limpiar** borra todo.

### Accesibilidad y formato

- Todo se puede usar con teclado y el foco siempre es visible. Los objetivos táctiles miden al menos 40 px. Se respeta `prefers-reduced-motion`.
- El objetivo principal son notebooks y Chromebooks (≥ 1024 px). En pantallas angostas las columnas se apilan.

---

## 13. Persistencia

| Qué | Dónde |
|---|---|
| Proyecto (todos los archivos), pista, preferencias (vista, velocidad) | IndexedDB, autoguardado |
| Proyecto | `.zip` (descarga y carga), carpeta (abrir y, en Chromium, guardar de vuelta) |
| Pista | `.json` (descarga y carga) |
| Compilador | Cache Storage (se descarga una sola vez) |

---

## 14. Manejo de errores

- Errores de compilación y de ejecución: ver §5.
- **Descarga del compilador:** muestra una barra de progreso ("Preparando el compilador, solo la primera vez"). Si falla, hay un mensaje claro y el botón "Reintentar".
- **Navegador sin aislamiento de origen cruzado:** explica que hay que recargar o usar Chrome, Edge o Firefox recientes.
- **Modelos o agente del profesor que lanzan excepciones:** la simulación se detiene con un mensaje para el profesor (archivo y pila) y otro amigable para el estudiante ("Algo falló en el simulador, avisa a tu profe").
- **Pista o proyecto inválidos al importar:** se valida el esquema y se informa qué falta, sin perder lo que ya estaba abierto.

---

## 15. Pruebas

- **Unidad (Vitest):**
  - preprocesador: concatenación de `.ino`, `#line`, prototipos y `@ajustar` en variables, `#define` y `.h`;
  - traducción de errores;
  - pines → motores;
  - reloj virtual y agenda de pasos de física;
  - primitivas del mundo (`muestrear`, `altura` en rampas rotadas, `inclinacion`, `raycast` contra cajas y rampas);
  - serialización de la pista;
  - placeholders del agente y la recompensa.
- **Integración (Vitest + Node):**
  - compilar proyectos de ejemplo reales con `@yowasp/clang` y ejecutarlos con el simulador sin navegador;
  - comprobar que un sketch que avanza mueve al robot, que `Serial` llega, que el QTR responde a la línea, que `@ajustar` cambia el comportamiento sin recompilar y que un error de sintaxis produce el mensaje amigable con archivo y línea correctos.
- **Extremo a extremo (Playwright):**
  - abrir la app, cargar un ejemplo, "Probar mi robot" y verificar que el robot se mueve y que los mensajes hacen scroll;
  - el error de ejemplo;
  - abrir una carpeta con `pines.h`;
  - editar la pista con una rampa;
  - "Ajustar parámetros" con pocas pruebas y "Usar estos valores".

---

## 16. Despliegue

- `npm run build` genera `dist/` estático, que incluye el compilador, `nucleo.a` y las cabeceras.
- GitHub Pages lo publica (workflow de GitHub Actions) con `coi-serviceworker` para el aislamiento de origen cruzado.
- El archivo más grande (`llvm.core.wasm`, ~75 MB) queda bajo el límite de 100 MB por archivo de GitHub Pages.

---

## 17. Fuera de alcance en la v1

- Acceso I2C a nivel de registros (`Wire.beginTransmission`/`requestFrom` directo) y emulación del choque de direcciones `0x29`.
- DMP del MPU6050 (MotionApps).
- WiFi, Bluetooth, tareas de FreeRTOS (`xTaskCreate`), interrupciones (`attachInterrupt`), EEPROM/Preferences y entrada por `Serial` desde la UI.
- Puentes y túneles en la pista; vista 3D; varios robots a la vez.

---

## 18. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Descarga del compilador (~30–100 MB) en redes escolares lentas | Cache Storage tras la primera vez; barra de progreso; opción de servir los archivos desde el mismo sitio comprimidos. |
| Compilación lenta o falta de memoria en Chromebooks modestos | `nucleo.a` precompilado; reutilizar el módulo si no hubo cambios; medirlo temprano (primera tarea del plan) con un sketch real en hardware modesto. |
| Rendimiento de "Ajustar parámetros" | Pruebas sin dibujo y sin ritmo de tiempo real; recompensa calculada en el worker; registro diezmado. |
| Fidelidad de las librerías simuladas | Pruebas de integración por librería con los ejemplos oficiales de cada una adaptados al robot. |
| Navegadores sin `SharedArrayBuffer` | `coi-serviceworker`; mensaje claro si aun así no está disponible. |

---

## 19. Fases sugeridas para el plan

El alcance es grande. Se sugiere implementarlo en fases que dejen algo usable al final de cada una:

1. **Base de ejecución sin UI:**
   - medir la compilación con `@yowasp/clang`;
   - preprocesador (multiarchivo, prototipos, `#line`);
   - núcleo mínimo (pines, tiempo, `Serial`) y `nucleo.a`;
   - reloj virtual, pines → motores y placeholder de dinámica.
   
   Prueba: un sketch que avanza mueve al robot, en Node.
2. **Pista y mundo:** modelo de pista, catálogo inicial, mapa de superficie, `altura`/`inclinacion`/`raycast`/`colisiona` y rampas.
3. **Librerías de sensores:** QTRSensors, VL53L0X, MPU6050 (Adafruit e i2cdevlib) y TCS34725, con sus placeholders de modelo.
4. **UI Programar:**
   - editor con pestañas;
   - abrir carpeta, `.zip` y autoguardado;
   - "Probar mi robot", pausa y velocidad;
   - lienzo, tarjetas de sensores y mensajes con scroll;
   - errores amigables.
5. **UI Construir pista:** editor de baldosas y objetos, propiedades, guardar y abrir.
6. **Ajustar parámetros:** `@ajustar`, pool de workers, registro, contratos del agente y la recompensa, ventana y "Usar estos valores".
7. **Ejemplos, ayuda, despliegue** en GitHub Pages y pruebas extremo a extremo.

Los casos de la pista del usuario se integran en la fase 2 o 5, según cuándo lleguen.

---

## 20. Pendientes que dependen del usuario

1. **Casos de la pista** (tipos de baldosa y objetos de la competencia, con medidas): llegan en el próximo mensaje y se agregan al catálogo (§10).
2. Qué sensor alimenta el PID de **"posición"** (el grupo funciona igual con cualquier variable marcada; solo cambia el nombre y el ícono que se muestran).
3. Confirmar el cableado real del robot de Dynamis para `src/robot/config.ts` (pines, medidas y montaje de los sensores). Los valores de §8 son provisionales.
