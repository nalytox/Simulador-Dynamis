# Modelos del simulador (los implementa el profesor)

Esta carpeta contiene los **modelos matemáticos** del robot. El resto del simulador (compilación,
núcleo Arduino, reloj virtual, pines, interfaz) no necesita cambios para reemplazarlos.

Cada archivo trae un *placeholder* ideal marcado con `TODO(profe)`, para que todo funcione
de punta a punta mientras tanto.

## Convenciones

- **Unidades:** milímetros, segundos y radianes.
- **Marco del mundo:** origen en la esquina inferior izquierda de la pista. `x` hacia la
  derecha, `y` hacia arriba y `z` hacia arriba. `yaw` es antihorario desde `+x`.
- **Marco del robot** (REP-103): `x` hacia adelante, `y` hacia la izquierda y `z` hacia arriba.
  El origen está en el centro del eje de las ruedas.
- **Aleatoriedad:** usa siempre el `azar` que recibe tu función, nunca `Math.random()`.
  Ese `azar` tiene la semilla de la ejecución, así una prueba se puede repetir exactamente.

## `dinamica.js`

```js
export function estadoInicial(pose, robot, mundo) → estado
export function pasoDinamica(estado, motores, dt, mundo, robot, azar) → nuevo estado
```

| Parámetro | Qué es |
|---|---|
| `pose` | `{ x, y, yaw }`: la posición inicial en el mundo. |
| `estado` | `{ x, y, z, yaw, pitch, roll, ... }`. Puedes agregar tus propios campos (velocidades, corrientes…). Los seis primeros son obligatorios. |
| `motores` | `{ izq: { duty, modo }, der: { duty, modo } }`. `duty` va de −1 a 1 (negativo = hacia atrás). `modo` es `'avance'`, `'retroceso'`, `'freno'` (IN1 = IN2 = 1) o `'libre'` (IN1 = IN2 = 0, o STBY en LOW). Sale de los pines del driver TB6612. |
| `dt` | Paso de tiempo en segundos (0,001 por defecto). |
| `mundo` | Primitivas geométricas: `altura(x, y)`, `inclinacion(x, y, yaw)`, `colisiona(poligono)`, `muestrear(x, y)`, `raycast(...)` y `objetosCerca(...)`. Ver `src/mundo/tipos.ts`. |
| `robot` | Configuración del robot (medidas, montaje de sensores, pines). Ver `src/robot/config.ts`. `huellaRobot(x, y, yaw, robot)` da el contorno del chasis. |
| `azar` | `() => número en [0, 1)` con la semilla de la ejecución. |

**El placeholder actual:**
- cinemática diferencial ideal con `vMaxMmS` de `parametros.js`;
- `z`, `pitch` y `roll` salen del mundo;
- si el robot choca, no avanza.

## El mundo de la pista

El `mundo` que reciben tus modelos sale de la pista FIRVI (ver `src/mundo/pista.ts`). Todo es
analítico, sin imágenes:

| Primitiva | Qué devuelve |
|---|---|
| `muestrear(x, y)` | `{ r, g, b }` de 0 a 255: fondo blanco, cinta negra (al revés en baldosas invertidas) y marcas de color. Fuera de la pista, blanco. |
| `altura(x, y)` | mm: nivel de la baldosa, subida de la rampa y baches (medio cilindro). Fuera de la pista, 0. |
| `inclinacion(x, y, yaw)` | `{ pitch, roll }` en rad para un robot con ese rumbo. |
| `raycast(origen, dir, max)` | `{ distancia, objeto, normal }` o `null`. Ve los obstáculos y el suelo (por ejemplo, la subida de una rampa); `objeto` es `null` si choca con el suelo. |
| `colisiona(poligono)` | `{ objeto, penetracion }` si la huella toca un obstáculo, o `null`. |
| `objetosCerca(x, y, radio)` | Obstáculos y baches a menos de `radio` mm, del más cercano al más lejano. |

**Signos de la inclinación** (regla de la mano derecha, REP-103): `pitch` es **negativo** cuando la
nariz sube (subir una rampa de 20° da `pitch ≈ −0,349`) y `roll` es positivo cuando el lado
izquierdo queda más alto.

Los sensores no ven los hitos ni los puntos de desafío (F): solo sirven para el juez y para elegir
desde dónde parte el robot.

## Modelos de sensores

Los cuatro modelos entregan **magnitudes físicas**. El núcleo (las librerías en C++ de
`src/nucleo/`) las convierte a lo que devuelve cada librería según su configuración (rango,
ganancia, tiempo de integración) y satura como el chip. Tu modelo no necesita saber qué librería
usa el estudiante.

Todos reciben:
- `t`: el tiempo virtual en **segundos**;
- `estado`: el estado del robot en ese instante;
- `mundo`;
- `azar`.

Se llaman cuando el programa lee el sensor, con el estado de ese instante.

**Montaje de los sensores** (`ConfigRobot`, en `src/robot/config.ts`):
- **El sensor 0 del QTR es el de la izquierda del robot** (+y). El sensor `i` está en
  `(qtr.x, (3,5 − i) · separacion, qtr.altura)` del marco del robot. Con la línea a la derecha,
  `readLineBlack` da más de 3500.
- **Los ángulos de `ConfigRobot` van en grados** (`vl53l0x.yaw` y `vl53l0x.pitch`), como en el
  JSON de la pista. Tu modelo los recibe ya convertidos a radianes.
- **El rumbo del VL53L0X** es el del robot más el de su montaje: `yaw = estado.yaw + yawMontaje` y
  `pitch = estado.pitch + pitchMontaje`, sin acoplar el roll.
- La posición de cada sensor en el mundo se calcula con `Rz(yaw) · Ry(pitch) · Rx(roll)` del robot
  (ver `src/simulacion/sensores.ts`).

### `qtr.js`

```js
export function leerQTR({ t, estado, sensores, emisoresEncendidos, mundo, ambiente, azar }) → number[8]
```

| Parámetro | Unidad | Qué es |
|---|---|---|
| `sensores` | mm | 8 × `{ x, y, z }`: la posición de cada sensor en el mundo. El 0 es el de la izquierda. |
| `emisoresEncendidos` | — | `true` si el robot no tiene pin de emisores (`robot.qtr.emisor = null`) o si ese pin está en HIGH. |
| `ambiente` | — | `{ luz: 'normal' \| 'fuerte' \| 'tenue' }`, elegido en la pista. |
| **devuelve** | cuentas | El ADC crudo de 12 bits (0–4095) de cada sensor: más alto es más oscuro. |

- **Placeholder:** `ADC = 180 + (1 − luminancia) · 3800`, con la luminancia del color del suelo bajo
  cada sensor. No usa los emisores, la luz ambiente, la altura ni el ruido.
- **Qué hace el núcleo:** `analogRead(pin)` del pin de cada sensor llama a tu modelo, redondea,
  acota a 0–4095 y escala a la resolución de `analogReadResolution`. Cada `analogRead` cuesta 10 µs.
  `QTRSensors` está construida sobre `analogRead`, igual que en el robot.

### `vl53l0x.js`

```js
export function leerVL53L0X({ t, estado, sensor, mundo, azar }) → number
```

| Parámetro | Unidad | Qué es |
|---|---|---|
| `sensor` | mm y rad | `{ x, y, z, yaw, pitch }`: la posición y el rumbo del sensor en el mundo. `pitch > 0` apunta hacia abajo (REP-103). |
| **devuelve** | mm | La distancia medida. 8190 o más significa "sin objetivo". |

- **Placeholder:** el rayo central del sensor contra `mundo.raycast`, con un alcance de 2000 mm. Sin
  el cono de 25°, sin ruido y sin la reflectividad del objeto.
- **Qué hace el núcleo:**
  - redondea y acota el resultado a 0–8190;
  - `readRangeSingleMillimeters` espera el presupuesto de medición (33 ms por defecto) y después
    llama a tu modelo;
  - en modo continuo la medida se calcula con la pose del momento de la lectura.

### `mpu6050.js`

```js
export function leerMPU6050({ t, dt, estado, estadoAnterior, montaje, mundo, azar })
  → { ax, ay, az, gx, gy, gz, temp }
```

| Parámetro | Unidad | Qué es |
|---|---|---|
| `dt` | s | El tiempo entre `estadoAnterior` y `estado` (un paso de física). |
| `estadoAnterior` | — | El estado del paso de física anterior, para derivar velocidades. |
| `montaje` | mm | `robot.mpu6050`: `{ x, y, z, orientacion }`. Con `'z-arriba-x-adelante'` el marco del sensor coincide con el del robot. |
| **devuelve** | m/s², rad/s, °C | La aceleración, la velocidad angular y la temperatura, en el marco del sensor. |

El acelerómetro mide la fuerza específica: en reposo sobre el piso da `az = +9,81`.

- **Placeholder:** solo la gravedad, proyectada según `pitch` y `roll`, y `gz = Δyaw / dt`. Sin
  aceleración lineal, vibraciones, sesgo ni ruido. La temperatura es 25 °C.
- **Qué hace el núcleo:**
  - **Cuantiza a `int16` como el chip, según el rango elegido.** Acelerómetro: 16384, 8192, 4096 o
    2048 LSB/g. Giroscopio: 131, 65,5, 32,8 o 16,4 LSB/(°/s). Satura en ±32767.
  - **Temperatura:** `crudo = (T − 36,53) · 340`.
  - **Adafruit_MPU6050** convierte lo cuantizado de vuelta a m/s² y rad/s.
  - **i2cdevlib** entrega los valores crudos, con los offsets sumados.
  - **Tiempo:** cada lectura (`getEvent`, `getMotion6`, `getRotationZ`…) cuesta 0,4 ms.

### `tcs34725.js`

```js
export function leerTCS34725({ t, estado, sensor, tiempoIntegracionMs, ganancia, ledEncendido, mundo, ambiente, azar })
  → { r, g, b, c }
```

| Parámetro | Unidad | Qué es |
|---|---|---|
| `sensor` | mm | `{ x, y, z }`: la posición del sensor en el mundo. |
| `tiempoIntegracionMs` | ms | De 2,4 a 614,4: `(256 − ATIME) · 2,4`. |
| `ganancia` | — | El factor del amplificador: 1, 4, 16 o 60. |
| `ledEncendido` | — | Si `robot.tcs34725.led` tiene un pin, el LED sigue a ese pin. Si no, está encendido salvo después de `setInterrupt(true)`, como en la placa típica. |
| `ambiente` | — | `{ luz: 'normal' \| 'fuerte' \| 'tenue' }`. |
| **devuelve** | cuentas | Las cuentas crudas de los canales rojo, verde, azul y claro. |

- **Placeholder:**
  - cada canal es `color / 255 · 10 · ganancia · tiempoIntegracionMs`, con el color del suelo bajo
    el sensor;
  - `c = r + g + b`;
  - no usa el LED, la luz ambiente, la altura ni el ruido.
- **Qué hace el núcleo:**
  - acota cada canal a 0–65535 y al máximo del chip, `min(65535, 1024 · (256 − ATIME))`;
  - `getRawData` espera el tiempo de integración, como la librería real.

### Para el estudiante: el QTR con `analogRead`

El QTR-MX-8A es analógico: cada sensor es un pin del ADC. Además de usar `QTRSensors`, el
estudiante puede leerlo con `analogRead(36)`, `analogRead(39)`, etc. Recibe el mismo valor que vería
en el robot (0–4095, más alto es más oscuro) y lo puede calibrar a mano.
