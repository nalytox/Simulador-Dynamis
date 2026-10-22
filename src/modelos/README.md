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

Los modelos del QTR-MX-8A, VL53L0X, MPU6050 y TCS34725 llegan en la fase 3, con sus firmas
según la spec (§9).
