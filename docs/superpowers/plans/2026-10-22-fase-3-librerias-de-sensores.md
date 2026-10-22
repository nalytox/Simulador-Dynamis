# Fase 3 — Librerías de sensores: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el código Arduino real del robot use sus librerías de siempre (QTRSensors, VL53L0X, Adafruit_MPU6050, MPU6050 de i2cdevlib, Adafruit_TCS34725, `Wire` y `String`) y que cada lectura salga de los modelos del profesor, evaluados sobre la pista de la fase 2 con el tiempo virtual que gastaría el robot real.

**Architecture:**
- **`src/nucleo/`:** reimplementaciones desde cero, compatibles con la API pública de cada librería, en C++. Guardan la configuración (rango, ganancia, presupuesto de medición), esperan con `delay`/`delayMicroseconds` lo que espera la librería real, convierten unidades físicas a lo que devuelve cada librería y saturan como el chip.
- **Cuatro imports nuevos** (`aviso`, `vl53_medir`, `mpu_leer`, `tcs_leer`) piden al simulador la magnitud física en el instante actual. El QTR no necesita import: se lee con `analogRead`, como en el robot.
- **`src/simulacion/sensores.ts`:** posición de cada sensor en el mundo (con yaw, pitch y roll del robot) y los tipos del contrato de los modelos.
- **`src/modelos/`:** cuatro placeholders nuevos (`qtr.js`, `vl53l0x.js`, `mpu6050.js`, `tcs34725.js`) con `TODO(profe)`, según la spec §9.

**Tech Stack:** Node 22, TypeScript (strict), Vitest, `@yowasp/clang` (el núcleo C++ se recompila solo en `npm test`). Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-10-17-simulador-dynamis-design.md`. Esta fase cubre §7 (librerías, `String` y `Wire`), §9 (contrato y placeholders de los modelos de sensores) y las filas de sensores de la tabla de costos de §6. La UI (tarjetas de sensores) va en la fase 4.

**Decisiones que toma este plan** (la Tarea 8 las lleva a la spec):
1. **El sensor 0 del QTR es el de la izquierda del robot** (+y): el sensor `i` está en `y = (3,5 − i) · separacion`. Con la línea a la derecha, `readLineBlack` da más de 3500.
2. **Los ángulos de `ConfigRobot` (`vl53l0x.yaw`, `vl53l0x.pitch`) van en grados**, como en el JSON de la pista.
3. **El rumbo del VL53L0X** es el del robot más el de su montaje: `yaw = estado.yaw + yawMontaje` y `pitch = estado.pitch + pitchMontaje`, sin acoplar el roll.
4. **VL53L0X en modo continuo:** la medida que se entrega se calcula con la pose del momento de la lectura, no con la del instante en que el chip la terminó. Si la lectura llega tarde, el robot pudo haberse movido un poco.
5. **Cada lectura del MPU6050 cuesta 0,4 ms** (`COSTOS_US.lecturaMpu`), sea `getEvent`, `getMotion6`, `getAcceleration` o `getRotationZ`.
6. **Offsets de i2cdevlib:** `set*AccelOffset` está en unidades del rango ±16 g (2048 LSB/g) y `set*GyroOffset` en las del rango ±1000 °/s (32,8 LSB/(°/s)). Se suman al valor crudo escalados al rango actual.
7. **QTRSensors conserva una rareza real:** su `maxValue` analógico es 1023 (pensado para Arduino AVR), así que con el ADC de 12 bits del ESP32 el mínimo de calibración arranca en 1023, igual que en el robot.
8. **Modos de lectura del QTR:** `Off`, `On`, `OnAndOff` y `Manual`. `Odd`, `Even` y `OddAndEven` se tratan como `On`, porque el QTR-MX-8A tiene un solo pin de emisores.
9. **LED del TCS34725:** si `robot.tcs34725.led` tiene un pin, el LED sigue ese pin. Si no, el LED está encendido salvo después de `setInterrupt(true)`, como en la placa típica.
10. **I2C directo** (`Wire.beginTransmission`, `write`, `endTransmission`, `requestFrom`, `read`): avisa una vez y responde como un bus sin dispositivos (`endTransmission` da 2, `requestFrom` da 0, `read` da −1).

## Global Constraints

- **Español:** nombres internos, comentarios y avisos en español; la **API pública de cada librería conserva sus nombres originales en inglés** (es el código del estudiante el que la llama).
- **Desde cero:** las librerías se escriben a partir de su API y su comportamiento documentado; no se copia código de las librerías originales.
- **Sin `<string>`, `<vector>` ni excepciones** en el núcleo (compila con `-fno-exceptions` y cada cabecera pesada alarga la compilación del estudiante). `String` usa `malloc`/`realloc`/`free`.
- **Contrato de los modelos** (spec §9), en unidades físicas y con `t` en segundos:
  - `leerQTR({ t, estado, sensores, emisoresEncendidos, mundo, ambiente, azar }) → number[8]` (ADC crudo 0–4095);
  - `leerVL53L0X({ t, estado, sensor, mundo, azar }) → mm` (≥ 8190 = sin objetivo);
  - `leerMPU6050({ t, dt, estado, estadoAnterior, montaje, mundo, azar }) → { ax, ay, az, gx, gy, gz, temp }` (m/s², rad/s, °C, en el marco del sensor);
  - `leerTCS34725({ t, estado, sensor, tiempoIntegracionMs, ganancia, ledEncendido, mundo, ambiente, azar }) → { r, g, b, c }` (cuentas crudas).
- **El núcleo convierte y satura**, los modelos no: rango del MPU a `int16`, cuentas máximas del TCS y 8190 del VL53L0X.
- **Errores de los modelos:** van con `protegido('el modelo del QTR' | 'el modelo del VL53L0X' | 'el modelo del MPU6050' | 'el modelo del TCS34725', …)` → `tipo: 'simulador'`.
- **Sin `−0`** y **sin `Math.random()`** en los modelos (usan `azar`).
- **Constantes físicas:** `g = 9.80665` m/s²; `°/s → rad/s` con `π/180`.

## Review Focus

1. **Librerías mal usadas, como lo haría un estudiante:** leer el VL53L0X sin `init()`, `readLine` sin calibrar, el QTR sin `setTypeAnalog()` o sin pines, `Wire.requestFrom` directo. Debe salir un aviso claro, nunca un cuelgue ni basura sin explicación. Pruebas en las Tareas 4 y 5.
2. **Saturación como el chip:** aceleración o giro fuera del rango del MPU, cuentas del TCS sobre el máximo, VL53L0X sin objetivo. Pruebas en las Tareas 4, 6 y 7.
3. **El tiempo avanza en cada lectura** igual que en el robot: presupuesto del VL53L0X, integración del TCS, I2C del MPU y `analogRead` del QTR. Un `while (true) { leer(); }` no congela el tiempo. Pruebas en las Tareas 2, 4, 5, 6 y 7.
4. **`String` en ciclos largos:** concatenar miles de caracteres y crear temporales en `loop()` no rompe ni se come la memoria. Prueba en la Tarea 3.
5. **Geometría de los sensores:** las posiciones siguen el yaw, pitch y roll del robot. En una rampa o girado, el QTR y el TCS leen el punto correcto. Prueba en la Tarea 1.

---

### Task 1: Contrato de los modelos, geometría de los sensores y placeholders

**Files:**
- Create: `src/simulacion/sensores.ts`, `src/modelos/qtr.js`, `src/modelos/vl53l0x.js`, `src/modelos/mpu6050.js`, `src/modelos/tcs34725.js`
- Modify: `src/robot/config.ts` (comentario: ángulos en grados)
- Test: `tests/unidad/sensores.test.ts`, `tests/unidad/modelos-sensores.test.ts`

**Interfaces:**
- Consumes: `EstadoRobot` (`src/simulacion/simulador.ts`), `ConfigRobot`, `Mundo`, `Punto3`, `Azar`, `Luz` (`src/pista/tipos.ts`), `crearMundo` y `pistaDe` (fase 2).
- Produces (en `src/simulacion/sensores.ts`):

```ts
export interface PoseSensor { x: number; y: number; z: number; yaw: number; pitch: number }
export interface Ambiente { luz: Luz }
export interface LecturaMPU { ax: number; ay: number; az: number; gx: number; gy: number; gz: number; temp: number }
export interface LecturaTCS { r: number; g: number; b: number; c: number }
export interface ModelosSensores {
  leerQTR(e: { t: number; estado: EstadoRobot; sensores: Punto3[]; emisoresEncendidos: boolean; mundo: Mundo; ambiente: Ambiente; azar: Azar }): number[];
  leerVL53L0X(e: { t: number; estado: EstadoRobot; sensor: PoseSensor; mundo: Mundo; azar: Azar }): number;
  leerMPU6050(e: { t: number; dt: number; estado: EstadoRobot; estadoAnterior: EstadoRobot; montaje: ConfigRobot['mpu6050']; mundo: Mundo; azar: Azar }): LecturaMPU;
  leerTCS34725(e: { t: number; estado: EstadoRobot; sensor: Punto3; tiempoIntegracionMs: number; ganancia: number; ledEncendido: boolean; mundo: Mundo; ambiente: Ambiente; azar: Azar }): LecturaTCS;
}
/** Punto del marco del robot en el mundo: (x, y, z) del estado + Rz(yaw)·Ry(pitch)·Rx(roll)·local. */
export function puntoEnMundo(estado: EstadoRobot, local: Punto3): Punto3;
/** Los 8 sensores del QTR; el 0 es el de la izquierda: local (qtr.x, (3,5 − i)·separacion, qtr.altura). */
export function puntosQTR(estado: EstadoRobot, robot: ConfigRobot): Punto3[];
export function poseVL53(estado: EstadoRobot, robot: ConfigRobot): PoseSensor;   // decisión 3
export function puntoTCS(estado: EstadoRobot, robot: ConfigRobot): Punto3;
export const MODELOS_POR_DEFECTO: ModelosSensores;   // los cuatro placeholders de src/modelos
```

- **Placeholders** (cada uno con `TODO(profe)` y JSDoc del contrato):
  - **`qtr.js`:** `luminancia = (0,2126·r + 0,7152·g + 0,0722·b)/255` del `mundo.muestrear` en cada sensor; ADC = `round(180 + (1 − luminancia)·3800)`. Negro da 3980 y blanco 180. Ignora los emisores.
  - **`vl53l0x.js`:** dirección `(cos p·cos y, cos p·sin y, −sin p)`. `mundo.raycast(sensor, dir, 2000)`: con impacto da `round(distancia)`; sin impacto, 8190.
  - **`mpu6050.js`:**
    - con `g = 9.80665`: `ax = −g·sin(pitch)`, `ay = g·sin(roll)·cos(pitch)`, `az = g·cos(roll)·cos(pitch)`;
    - `gx = gy = 0` y `gz = (yaw − yawAnterior)/dt`, con la diferencia llevada a `(−π, π]`;
    - `temp = 25`.
  - **`tcs34725.js`:**
    - cada canal es `round(valor/255 · 10 · ganancia · tiempoIntegracionMs)` del color en `mundo.muestrear`;
    - `c = r + g + b`;
    - ignora el LED y la luz ambiente.

- [ ] **Step 1: Escribir las pruebas que fallan.**

`tests/unidad/sensores.test.ts`:

```ts
const estado = (extra: Partial<EstadoRobot> = {}): EstadoRobot => ({ x: 100, y: 200, z: 0, yaw: 0, pitch: 0, roll: 0, ...extra });
it('puntoEnMundo gira con yaw, pitch y roll', () => {
  expect(puntoEnMundo(estado({ yaw: Math.PI / 2 }), { x: 92, y: 0, z: 0 })).toMatchObject({ x: expect.closeTo(100), y: expect.closeTo(292), z: expect.closeTo(0) });
  expect(puntoEnMundo(estado({ pitch: -20 * Math.PI / 180, z: 10 }), { x: 100, y: 0, z: 0 }).z).toBeCloseTo(10 + 100 * Math.sin(20 * Math.PI / 180));
  expect(puntoEnMundo(estado({ roll: 10 * Math.PI / 180 }), { x: 0, y: 50, z: 0 }).z).toBeCloseTo(50 * Math.sin(10 * Math.PI / 180));
});
it('el sensor 0 del QTR está a la izquierda del robot', () => {
  const s = puntosQTR(estado(), ROBOT_POR_DEFECTO);
  expect(s).toHaveLength(8);
  expect(s[0]).toMatchObject({ x: expect.closeTo(192), y: expect.closeTo(200 + 3.5 * 9.525), z: expect.closeTo(3) });
  expect(s[7].y).toBeCloseTo(200 - 3.5 * 9.525);
});
it('pose del VL53L0X y punto del TCS34725', () => {
  const robot = { ...ROBOT_POR_DEFECTO, vl53l0x: { ...ROBOT_POR_DEFECTO.vl53l0x, yaw: 90, pitch: 10 } };
  expect(poseVL53(estado({ yaw: 0.5 }), robot)).toMatchObject({ x: expect.closeTo(100 + 92 * Math.cos(0.5)), z: expect.closeTo(35), yaw: expect.closeTo(0.5 + Math.PI / 2), pitch: expect.closeTo(10 * Math.PI / 180) });
  expect(puntoTCS(estado(), ROBOT_POR_DEFECTO)).toMatchObject({ x: 140, y: 154, z: 5 });
});
```

`tests/unidad/modelos-sensores.test.ts` (con `mundo = crearMundo(pistaDe({ columnas: 2, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'recta' }], objetos: [{ tipo: 'obstaculo', x: 500, y: 150, rot: 0 }] }))`, `azar = crearAzar(1)` y `ambiente = { luz: 'normal' }`):

```ts
const quieto: EstadoRobot = { x: 150, y: 150, z: 0, yaw: 0, pitch: 0, roll: 0 };
it('QTR: negro 3980 y blanco 180', () =>
  expect(MODELOS_POR_DEFECTO.leerQTR({ t: 0, estado: quieto, sensores: [{ x: 150, y: 150, z: 3 }, { x: 150, y: 50, z: 3 }], emisoresEncendidos: true, mundo, ambiente, azar }))
    .toEqual([3980, 180]));
it('VL53L0X: distancia al obstáculo o 8190', () => {
  expect(MODELOS_POR_DEFECTO.leerVL53L0X({ t: 0, estado: quieto, sensor: { x: 242, y: 150, z: 35, yaw: 0, pitch: 0 }, mundo, azar })).toBe(208);
  expect(MODELOS_POR_DEFECTO.leerVL53L0X({ t: 0, estado: quieto, sensor: { x: 242, y: 150, z: 35, yaw: Math.PI, pitch: 0 }, mundo, azar })).toBe(8190);
});
it('MPU6050: gravedad según la inclinación y gz por el cambio de rumbo', () => {
  const enRampa = { ...quieto, pitch: -20 * Math.PI / 180, yaw: 0.01 };
  const l = MODELOS_POR_DEFECTO.leerMPU6050({ t: 0, dt: 0.001, estado: enRampa, estadoAnterior: quieto, montaje: ROBOT_POR_DEFECTO.mpu6050, mundo, azar });
  expect(l.ax).toBeCloseTo(9.80665 * Math.sin(20 * Math.PI / 180)); expect(l.ay).toBeCloseTo(0); expect(l.az).toBeCloseTo(9.80665 * Math.cos(20 * Math.PI / 180));
  expect(l.gz).toBeCloseTo(10); expect(l.temp).toBe(25);
  const vuelta = MODELOS_POR_DEFECTO.leerMPU6050({ t: 0, dt: 0.001, estado: { ...quieto, yaw: -Math.PI + 0.001 }, estadoAnterior: { ...quieto, yaw: Math.PI - 0.001 }, montaje: ROBOT_POR_DEFECTO.mpu6050, mundo, azar });
  expect(vuelta.gz).toBeCloseTo(2);
});
it('TCS34725: color escalado por ganancia e integración', () =>
  expect(MODELOS_POR_DEFECTO.leerTCS34725({ t: 0, estado: quieto, sensor: { x: 150, y: 50, z: 5 }, tiempoIntegracionMs: 24, ganancia: 4, ledEncendido: true, mundo, ambiente, azar }))
    .toEqual({ r: 960, g: 960, b: 960, c: 2880 }));
```

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/unidad/sensores.test.ts tests/unidad/modelos-sensores.test.ts`
Expected: FAIL (no existen los módulos).

- [ ] **Step 3: Implementar `sensores.ts` y los cuatro placeholders**, con las firmas y fórmulas de arriba. En `config.ts`, documentar que `vl53l0x.yaw/pitch` van en grados.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/unidad/sensores.test.ts tests/unidad/modelos-sensores.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/simulacion/sensores.ts src/modelos src/robot/config.ts tests/unidad/sensores.test.ts tests/unidad/modelos-sensores.test.ts
git commit -m "Contrato de los modelos de sensores, geometría de los sensores y placeholders"
```

---

### Task 2: El simulador entrega las lecturas de los sensores

**Files:**
- Modify: `src/nucleo/include/dynamis_host.h`, `src/simulacion/puente.ts`, `src/simulacion/simulador.ts`, `src/simulacion/costos.ts`, `tests/ayuda/anfitrion-falso.ts`
- Create: `tests/ayuda/correr-sketch.ts`
- Test: `tests/integracion/sensores.test.ts`

**Interfaces:**
- Consumes: todo lo de la Tarea 1; `crearMundo`, `poseInicial` y `pistaDe` (fase 2).
- Produces:
  - En `dynamis_host.h`:

```c
DYN_IMPORTAR("aviso") void dyn_aviso(const char* texto, size_t largo);
DYN_IMPORTAR("vl53_medir") uint16_t dyn_vl53_medir(void);
/** ax ay az (m/s²), gx gy gz (rad/s), temp (°C), en el marco del sensor. Cuesta COSTOS_US.lecturaMpu. */
DYN_IMPORTAR("mpu_leer") void dyn_mpu_leer(float* datos7);
DYN_IMPORTAR("tcs_leer") void dyn_tcs_leer(uint32_t integracion_us, uint32_t ganancia, int led, uint16_t* rgbc);
static inline void dynAvisar(const char* texto) { dyn_aviso(texto, strlen(texto)); }
```

  - En `Anfitrion`: `aviso(texto: string): void`, `vl53Medir(): number`, `mpuLeer(): number[]` (7 valores) y `tcsLeer(integracionUs: number, ganancia: number, led: boolean): number[]` (4 valores). El puente escribe los resultados en la memoria del wasm: 7 `Float32` en `datos7`, y 4 `Uint16` acotados a `[0, 65535]` y redondeados en `rgbc`.
  - En `OpcionesSimulador`: `modelos?: Partial<ModelosSensores>` y `ambiente?: Ambiente` (por defecto `{ luz: 'normal' }`).
  - En `COSTOS_US`: `lecturaMpu: 400`.
  - En `tests/ayuda/correr-sketch.ts`: `correrSketch(codigo: string, o?: { pista?: Pista; robot?: ConfigRobot; modelos?: Partial<ModelosSensores>; pose?: Pose; duracionUs?: number }): Promise<{ sim: Simulador; texto: string; resultado: ResultadoEjecucion }>`. Carga el núcleo una sola vez y compila `{ 'p.ino': codigo }`. Usa por defecto una pista de 6 × 1 rectas con el inicio en (150, 150, 0), la pose de `poseInicial(pista)` y `duracionUs = 100_000`. Ejecuta y devuelve `{ sim, texto: sim.tomarSerial(), resultado }`, donde `resultado` es lo que devolvió `ejecutar`.

- **Comportamiento del simulador:**
  - **`analogRead`, sin `lectorAnalogico`:**
    - en un pin de `robot.qtr.pines[i]`, da `leerQTR(...)[i]` con `t` en segundos y `sensores = puntosQTR`;
    - `emisoresEncendidos` es `true` si `robot.qtr.emisor === null`, o si el nivel de ese pin es mayor que 0,5;
    - en cualquier otro pin da 0;
    - `lectorAnalogico`, si se pasa, sigue teniendo prioridad.
  - **`vl53Medir`:** `leerVL53L0X` con `poseVL53`, redondeado y acotado a `[0, 8190]`.
  - **`mpuLeer`:**
    - primero avanza `COSTOS_US.lecturaMpu`;
    - luego llama a `leerMPU6050`, con `dt = dtFisicaUs/1e6` y `estadoAnterior` = el estado antes del último paso de física (al principio, el inicial).
  - **`tcsLeer`:**
    - si `robot.tcs34725.led` tiene un pin, el LED sigue el nivel de ese pin; si no, usa `led`;
    - pasa `tiempoIntegracionMs = integracionUs/1000`.
  - **`aviso`:** se agrega a `sim.avisos` sin repetir.

- [ ] **Step 1: Escribir las pruebas que fallan** (`tests/integracion/sensores.test.ts`, con `timeout: 120_000`):

```ts
const SERIAL = 'Serial.begin(115200);';
const PINES_QTR = 'const int P[8] = {36, 39, 34, 35, 32, 33, 25, 26};\n';
it('analogRead de los pines del QTR sale del modelo del QTR', async () => {
  const { texto } = await correrSketch(`${PINES_QTR}void setup() { ${SERIAL} for (int i = 0; i < 8; i++) { Serial.print(analogRead(P[i])); Serial.print(' '); } }\nvoid loop() {}`);
  expect(texto).toBe('180 180 180 3980 3980 180 180 180 ');
});
it('vl53_medir, mpu_leer, tcs_leer y aviso; la lectura del MPU cuesta 0,4 ms', async () => {
  const pista = pistaDe({ columnas: 4, filas: 1, baldosas: [0, 1, 2, 3].map(c => ({ c, r: 0, tipo: 'recta' })), objetos: [{ tipo: 'obstaculo', x: 600, y: 150, rot: 0 }] });
  const { texto, sim } = await correrSketch(`void setup() { ${SERIAL}
    Serial.println(dyn_vl53_medir());
    float d[7]; unsigned long t0 = micros(); dyn_mpu_leer(d); unsigned long t1 = micros();
    Serial.printf("%.2f %.2f %.2f %.2f %lu\\n", d[0], d[2], d[5], d[6], t1 - t0);
    uint16_t c[4]; dyn_tcs_leer(24000, 1, 1, c); Serial.printf("%u %u %u %u\\n", c[0], c[1], c[2], c[3]);
    dyn_aviso("hola", 4); }\nvoid loop() {}`, { pista });
  expect(texto).toBe('308\r\n0.00 9.81 0.00 25.00 401\n240 240 240 720\n');
  expect(sim.avisos).toContain('hola');
});
it('el LED del TCS sigue al pin configurado', async () => {
  const llamadas: boolean[] = [];
  const leerTCS34725 = (e: { ledEncendido: boolean }) => { llamadas.push(e.ledEncendido); return { r: 0, g: 0, b: 0, c: 0 }; };
  const robot = { ...ROBOT_POR_DEFECTO, tcs34725: { ...ROBOT_POR_DEFECTO.tcs34725, led: 27 } };
  await correrSketch('void setup() { uint16_t c[4]; pinMode(27, OUTPUT); digitalWrite(27, HIGH); dyn_tcs_leer(2400, 1, 0, c); digitalWrite(27, LOW); dyn_tcs_leer(2400, 1, 1, c); }\nvoid loop() {}', { robot, modelos: { leerTCS34725 } });
  expect(llamadas).toEqual([true, false]);
});
it('un modelo de sensor que falla es un error del simulador', async () => {
  const { resultado } = await correrSketch('void setup() { analogRead(36); }\nvoid loop() {}', { modelos: { leerQTR: () => { throw new Error('sin datos'); } } });
  expect(resultado.error).toMatchObject({ tipo: 'simulador', tecnico: expect.stringContaining('modelo del QTR') });
});
```

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/integracion/sensores.test.ts`
Expected: FAIL (el núcleo no declara `dyn_vl53_medir`, y `analogRead` da 0).

- [ ] **Step 3: Implementar** los imports, el puente, el anfitrión del `Simulador` y el helper de prueba. Actualizar `anfitrion-falso.ts` con los cuatro métodos nuevos.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/integracion/sensores.test.ts tests/integracion/puente.test.ts tests/integracion/simulador.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/nucleo/include/dynamis_host.h src/simulacion tests/ayuda tests/integracion/sensores.test.ts
git commit -m "El simulador entrega las lecturas de los sensores al núcleo"
```

---

### Task 3: `String` (subconjunto de WString)

**Files:**
- Create: `src/nucleo/include/WString.h`, `src/nucleo/src/WString.cpp`
- Modify: `src/nucleo/include/Arduino.h` (incluir `WString.h` en la parte C++, antes de `Print.h`), `src/nucleo/include/Print.h` y `src/nucleo/src/Print.cpp` (`print`/`println(const String&)`)
- Test: `tests/integracion/string.test.ts`

**Interfaces:**
- Produces, la clase `String` con esta API pública:
  - **Constructores:** `String(const char* = "")`, `String(const String&)`, `String(String&&)`, `String(const __FlashStringHelper*)`, `String(char)`.
  - **Números:** `String(unsigned char, unsigned char base = 10)`, `String(int, unsigned char base = 10)`, `String(unsigned int, …)`, `String(long, …)`, `String(unsigned long, …)`, `String(float, unsigned char decimales = 2)` y `String(double, unsigned char decimales = 2)`.
  - **Asignación y concatenación:** `operator=` (copia y movimiento), `concat(...)` y `operator+=` para `String`, `const char*`, `char`, `int`, `unsigned`, `long`, `unsigned long`, `float` y `double`.
  - **`operator+` libre** para `String + {String, const char*, char, int, unsigned, long, unsigned long, float, double}` y `const char* + String`.
  - **Consulta:** `length()`, `c_str()`, `charAt(i)`, `operator[](i)`, `indexOf(char|const String&, unsigned int desde = 0)` y `substring(desde)`/`substring(desde, hasta)`.
  - **Conversión y comparación:** `toInt()` (con `atol`), `toFloat()` (con `atof`), `operator==` y `operator!=` con `String` y `const char*`.
- Los números se formatean como el core del ESP32: base 10 con `%d`/`%u`/`%ld`/`%lu`, otras bases con `itoa`/`ltoa`/`utoa`/`ultoa`, y decimales con `dtostrf(valor, decimales + 2, decimales, …)`.
- Si `malloc`/`realloc` falla, la cadena queda vacía y las operaciones devuelven `false`, como en Arduino.

- [ ] **Step 1: Escribir las pruebas que fallan** (`tests/integracion/string.test.ts`, con `correrSketch`):

```ts
it('String: construcción, concatenación y conversiones', async () => {
  const { texto } = await correrSketch(`void setup() { Serial.begin(115200);
    String a = "Hola"; String b = String(42); String c = a + " " + b + '!';
    Serial.println(c); Serial.println(c.length()); Serial.println(String(3.14159, 3)); Serial.println(String(255, HEX));
    Serial.println(String("12.5").toFloat() * 2); Serial.println(String("  42").toInt() + 1);
    Serial.println(c.indexOf('4')); Serial.println(c.substring(5, 7)); Serial.println(c == "Hola 42!");
    String d; for (int i = 0; i < 3; i++) d += i; Serial.println(d);
    Serial.println(String(F("flash"))); Serial.println(c.c_str()); Serial.println(c.charAt(1)); }\nvoid loop() {}`);
  expect(texto).toBe(['Hola 42!', '8', '3.142', 'ff', '25.00', '43', '5', '42', '1', '012', 'flash', 'Hola 42!', 'o', ''].join('\r\n'));
});
it('String en ciclos largos no rompe ni se come la memoria', async () => {
  const { texto, resultado } = await correrSketch(`String largo;
    void setup() { Serial.begin(115200); for (int i = 0; i < 2000; i++) largo += 'x'; Serial.println(largo.length()); }
    void loop() { String t = String(millis()) + " ms"; if (t.length() == 0) Serial.println("vacío"); }`, { duracionUs: 200_000 });
  expect(texto).toBe('2000\r\n'); expect(resultado.motivo).toBe('tiempo');
});
```

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/integracion/string.test.ts`
Expected: FAIL (`String` no está declarado).

- [ ] **Step 3: Implementar `WString.h`/`WString.cpp`** y `print`/`println(const String&)`. `Print.h` declara `class String;` y las dos sobrecargas; `Print.cpp` incluye `WString.h`.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/integracion/string.test.ts tests/integracion/nucleo.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/nucleo tests/integracion/string.test.ts
git commit -m "String compatible con Arduino en el núcleo simulado"
```

---

### Task 4: `Wire` y el VL53L0X de Pololu

**Files:**
- Create: `src/nucleo/include/Wire.h`, `src/nucleo/src/Wire.cpp`, `src/nucleo/include/VL53L0X.h`, `src/nucleo/src/VL53L0X.cpp`
- Test: `tests/integracion/vl53l0x.test.ts`

**Interfaces:**
- Consumes: `dyn_vl53_medir`, `dynAvisar`, `delayMicroseconds` y `micros`.
- **`Wire.h`:**
  - `class TwoWire` con `begin()`, `begin(int sda, int scl, uint32_t frecuencia = 0)`, `setClock(uint32_t)`, `beginTransmission(uint8_t)`, `write(uint8_t)`, `endTransmission(bool = true)`, `requestFrom(uint8_t, uint8_t)`, `available()` y `read()`;
  - `extern TwoWire Wire;`
  - `begin` y `setClock` no hacen nada. El resto avisa una vez (decisión 10) con: `El simulador no tiene un bus I2C directo: usa las librerías de los sensores en vez de Wire.beginTransmission o Wire.requestFrom.`
- **`VL53L0X.h`:**
  - `class VL53L0X` con:
    - `enum vcselPeriodType { VcselPeriodPreRange, VcselPeriodFinalRange };`
    - `bool init(bool io_2v8 = true)`;
    - `setAddress(uint8_t)` y `getAddress()` (por defecto `0x29`);
    - `setTimeout(uint16_t)`, `getTimeout()` y `timeoutOccurred()`;
    - `startContinuous(uint32_t period_ms = 0)` y `stopContinuous()`;
    - `readRangeContinuousMillimeters()` y `readRangeSingleMillimeters()`;
    - `setMeasurementTimingBudget(uint32_t)` (falso bajo 20000 µs) y `getMeasurementTimingBudget()`;
    - `setSignalRateLimit(float)`, `getSignalRateLimit()` y `setVcselPulsePeriod(vcselPeriodType, uint8_t)`, que se aceptan y no tienen efecto.
  - El presupuesto por defecto es 33000 µs.
- **Lecturas:**
  - `readRangeSingleMillimeters`: `delayMicroseconds(presupuesto)` y después `dyn_vl53_medir()`.
  - Sin `init()`: devuelve 65535, `timeoutOccurred()` da `true` y avisa `Llama a init() del VL53L0X antes de leerlo.`
  - `timeoutOccurred()` se reinicia al consultarlo, como en la librería.
- **Modo continuo** (decisión 4):

```
startContinuous(p): periodo = max(p·1000, presupuesto); proxima = micros() + periodo
readRangeContinuousMillimeters():
  ahora = micros()
  si ahora < proxima: delayMicroseconds(proxima − ahora)
  si no: proxima += periodo · floor((ahora − proxima) / periodo)   // la última medida ya terminada
  medida = dyn_vl53_medir(); proxima += periodo; return medida
```

- [ ] **Step 1: Escribir las pruebas que fallan** (pista de 4 × 1 rectas con un obstáculo en (600, 150): el sensor queda a 308 mm de la cara):

```ts
const CON_OBSTACULO = pistaDe({ columnas: 4, filas: 1, baldosas: [0, 1, 2, 3].map(c => ({ c, r: 0, tipo: 'recta' })), objetos: [{ tipo: 'obstaculo', x: 600, y: 150, rot: 0 }] });
const INICIO = '#include <Wire.h>\n#include <VL53L0X.h>\nVL53L0X sensor;\n';
it('lectura única: distancia, 33 ms de presupuesto y presupuesto configurable', async () => {
  const { texto } = await correrSketch(`${INICIO}void setup() { Serial.begin(115200); Wire.begin(); sensor.setTimeout(500); Serial.println(sensor.init());
    unsigned long t0 = millis(); Serial.println(sensor.readRangeSingleMillimeters()); Serial.println(millis() - t0);
    Serial.println(sensor.setMeasurementTimingBudget(10000)); Serial.println(sensor.setMeasurementTimingBudget(200000)); Serial.println(sensor.getMeasurementTimingBudget());
    t0 = millis(); sensor.readRangeSingleMillimeters(); Serial.println(millis() - t0); Serial.println(sensor.getAddress(), HEX); sensor.setAddress(0x30); Serial.println(sensor.getAddress(), HEX); }\nvoid loop() {}`,
    { pista: CON_OBSTACULO, duracionUs: 500_000 });
  expect(texto).toBe(['1', '308', '33', '0', '1', '200000', '200', '29', '30', ''].join('\r\n'));
});
it('modo continuo: una medida por período', async () => {
  const { texto } = await correrSketch(`${INICIO}void setup() { Serial.begin(115200); sensor.init(); sensor.startContinuous(100);
    for (int i = 0; i < 3; i++) { sensor.readRangeContinuousMillimeters(); Serial.println((millis() + 50) / 100); } }\nvoid loop() {}`,
    { pista: CON_OBSTACULO, duracionUs: 500_000 });
  expect(texto).toBe('1\r\n2\r\n3\r\n');
});
it('sin objetivo da 8190; sin init da 65535 con aviso; Wire directo avisa', async () => {
  const { texto, sim } = await correrSketch(`${INICIO}VL53L0X otro;\nvoid setup() { Serial.begin(115200); sensor.init(); Serial.println(sensor.readRangeSingleMillimeters());
    Serial.println(otro.readRangeSingleMillimeters()); Serial.println(otro.timeoutOccurred()); Serial.println(otro.timeoutOccurred());
    Wire.beginTransmission(0x29); Serial.println(Wire.endTransmission()); Serial.println(Wire.requestFrom(0x29, 2)); }\nvoid loop() {}`, { duracionUs: 300_000 });
  expect(texto).toBe(['8190', '65535', '1', '0', '2', '0', ''].join('\r\n'));
  expect(sim.avisos).toEqual(expect.arrayContaining(['Llama a init() del VL53L0X antes de leerlo.',
    'El simulador no tiene un bus I2C directo: usa las librerías de los sensores en vez de Wire.beginTransmission o Wire.requestFrom.']));
});
```

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/integracion/vl53l0x.test.ts`
Expected: FAIL (`VL53L0X.h` no existe).

- [ ] **Step 3: Implementar** `Wire` y `VL53L0X` según lo de arriba.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/integracion/vl53l0x.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/nucleo tests/integracion/vl53l0x.test.ts
git commit -m "Wire y VL53L0X de Pololu en el núcleo simulado"
```

---

### Task 5: QTRSensors de Pololu (v4)

**Files:**
- Create: `src/nucleo/include/QTRSensors.h`, `src/nucleo/src/QTRSensors.cpp`
- Test: `tests/integracion/qtr.test.ts`

**Interfaces:**
- Consumes: `analogRead`, `digitalWrite`, `pinMode`, `delayMicroseconds` y `dynAvisar`.
- **Tipos:**
  - `enum class QTRType : uint8_t { Undefined, RC, Analog };`
  - `enum class QTRReadMode : uint8_t { Off, On, OnAndOff, Odd, Even, OddAndEven, Manual };`
  - `const uint8_t QTRNoEmitterPin = 255;`
  - `const uint8_t QTRMaxSensors = 31;`
- **`class QTRSensors`:**
  - **Configuración:** `setTypeAnalog()`, `setSensorPins(const uint8_t* pins, uint8_t count)`, `setSamplesPerSensor(uint8_t)` (por defecto 4, máximo 64) y `setEmitterPin(uint8_t)` (hace `pinMode(pin, OUTPUT)`).
  - **Emisores:** `emittersOn()` y `emittersOff()`.
  - **Calibración:** `calibrate(QTRReadMode = On)`, `resetCalibration()` y `struct CalibrationData { bool initialized; uint16_t* minimum; uint16_t* maximum; } calibrationOn, calibrationOff;`.
  - **Lectura:** `read(uint16_t*, QTRReadMode = On)`, `readCalibrated(uint16_t*, QTRReadMode = On)`, `readLineBlack(uint16_t*, QTRReadMode = On)` y `readLineWhite(uint16_t*, QTRReadMode = On)`.
- **Comportamiento** (decisiones 7 y 8):
  - **`read`:**
    - suma `samplesPerSensor` lecturas de `analogRead` por sensor y deja `(suma + muestras/2)/muestras`;
    - con `On` hace `emittersOn` → leer → `emittersOff`; con `Off`, `emittersOff` → leer;
    - con `OnAndOff` deja `on + 1023 − off`; con `Manual` lee sin tocar los emisores.
  - **Emisores:** con pin de emisores y cambio de estado, `emittersOn` espera 300 µs y `emittersOff` 1200 µs. Sin pin no hacen nada.
  - **`calibrate`:**
    - inicializa (si hace falta) `minimum` en 1023 y `maximum` en 0;
    - hace 10 lecturas y anota por sensor el máximo y el mínimo de esas 10;
    - `maximum = max(maximum, mínimo de las 10)` y `minimum = min(minimum, máximo de las 10)`.
  - **`readCalibrated`:** `(valor − min)·1000/(max − min)`, acotado a 0…1000 (0 si `max = min`). Sin calibrar avisa `Calibra el QTR con calibrate() antes de usar readCalibrated o readLine.` y no cambia los valores.
  - **`readLine`:**
    - con cada valor (`1000 − valor` en `readLineWhite`): hay línea si alguno supera 200;
    - promedio ponderado de los que superan 50: `Σ valor·1000·i / Σ valor`;
    - sin línea, devuelve 0 o `(count − 1)·1000` según la última posición sea menor o mayor que la mitad.
  - **Faltan configuración:** sin `setTypeAnalog()` avisa `Llama a setTypeAnalog() del QTR antes de leerlo.`; sin pines, `Llama a setSensorPins() del QTR antes de leerlo.` En ambos casos `read` no cambia los valores.

- [ ] **Step 1: Escribir las pruebas que fallan** (con la pista de rectas por defecto):

```ts
const INICIO = '#include <QTRSensors.h>\nQTRSensors qtr;\nconst uint8_t PINES[8] = {36, 39, 34, 35, 32, 33, 25, 26};\nuint16_t v[8];\n';
const imprimir = 'for (int i = 0; i < 8; i++) { Serial.print(v[i]); Serial.print(i < 7 ? " " : "\\n"); }';
it('read promedia analogRead; calibrate deja la rareza del 1023', async () => {
  const { texto } = await correrSketch(`${INICIO}void setup() { Serial.begin(115200); qtr.setTypeAnalog(); qtr.setSensorPins(PINES, 8); qtr.read(v); ${imprimir}
    qtr.calibrate(); Serial.printf("%u %u %u %u\\n", qtr.calibrationOn.minimum[0], qtr.calibrationOn.maximum[0], qtr.calibrationOn.minimum[3], qtr.calibrationOn.maximum[3]); }\nvoid loop() {}`);
  expect(texto).toBe('180 180 180 3980 3980 180 180 180\n180 180 1023 3980\n');
});
it('readLineBlack: 3500 centrado, 4500 con la línea a la derecha, y recuerda el último lado', async () => {
  const sketch = (y: number) => correrSketch(`${INICIO}void setup() { Serial.begin(115200); qtr.setTypeAnalog(); qtr.setSensorPins(PINES, 8); qtr.calibrate();
    for (int i = 0; i < 8; i++) { qtr.calibrationOn.minimum[i] = 180; qtr.calibrationOn.maximum[i] = 3980; }
    Serial.println(qtr.readLineBlack(v)); }\nvoid loop() {}`, { pose: { x: 150, y, yaw: 0 } });
  expect((await sketch(150)).texto).toBe('3500\r\n');
  expect((await sketch(160)).texto).toBe('4500\r\n');
  expect((await sketch(260)).texto).toBe('0\r\n');
});
it('emisores: on y off esperan 300 y 1200 µs; usar la librería sin configurarla avisa', async () => {
  const robot = { ...ROBOT_POR_DEFECTO, qtr: { ...ROBOT_POR_DEFECTO.qtr, emisor: 27 } };
  const { texto } = await correrSketch(`${INICIO}void setup() { Serial.begin(115200); qtr.setTypeAnalog(); qtr.setSensorPins(PINES, 8); qtr.setEmitterPin(27);
    unsigned long t0 = micros(); qtr.read(v); unsigned long t1 = micros(); Serial.println(t1 - t0 >= 1800 && t1 - t0 < 1900); }\nvoid loop() {}`, { robot });
  expect(texto).toBe('1\r\n');
  const { sim } = await correrSketch(`${INICIO}QTRSensors otro;\nvoid setup() { otro.read(v); qtr.setTypeAnalog(); qtr.read(v); qtr.setSensorPins(PINES, 8); qtr.readLineBlack(v); }\nvoid loop() {}`);
  expect(sim.avisos).toEqual(expect.arrayContaining(['Llama a setTypeAnalog() del QTR antes de leerlo.', 'Llama a setSensorPins() del QTR antes de leerlo.',
    'Calibra el QTR con calibrate() antes de usar readCalibrated o readLine.']));
});
```

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/integracion/qtr.test.ts`
Expected: FAIL (`QTRSensors.h` no existe).

- [ ] **Step 3: Implementar** `QTRSensors` según lo de arriba. Los arreglos de calibración se piden con `malloc` al inicializarse y se liberan en `resetCalibration` y en `setSensorPins`.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/integracion/qtr.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/nucleo tests/integracion/qtr.test.ts
git commit -m "QTRSensors de Pololu (v4) sobre analogRead"
```

---

### Task 6: MPU6050: Adafruit_MPU6050 e i2cdevlib

**Files:**
- Create: `src/nucleo/include/Adafruit_Sensor.h`, `src/nucleo/include/Adafruit_MPU6050.h`, `src/nucleo/src/Adafruit_MPU6050.cpp`, `src/nucleo/include/I2Cdev.h`, `src/nucleo/include/MPU6050.h`, `src/nucleo/src/MPU6050.cpp`, `src/nucleo/include/dynamis_mpu.h`, `src/nucleo/src/dynamis_mpu.cpp`
- Test: `tests/integracion/mpu6050.test.ts`

**Interfaces:**
- Consumes: `dyn_mpu_leer`.
- **`dynamis_mpu.h`**, un MPU simulado común a las dos librerías:
  - `struct MpuCrudo { int16_t ax, ay, az, gx, gy, gz, temp; };`
  - `MpuCrudo dynLeerMpu(uint8_t rangoAcel, uint8_t rangoGiro, const int16_t offsets[6]);`
  - Lee las magnitudes físicas y cuantiza como el chip:
    - acelerómetro: `crudo = clamp(round(a/9.80665 · LSBg), −32768, 32767) + offset·LSBg/2048`, con LSBg = 16384, 8192, 4096 o 2048 según el rango 0…3;
    - giroscopio: `crudo = clamp(round(g·180/π · LSBdps)) + offset·LSBdps/32.8`, con LSBdps = 131, 65.5, 32.8 o 16.4;
    - temperatura: `round((T − 36.53)·340)`;
    - el resultado final se acota a `int16`.
- **`Adafruit_Sensor.h`:**
  - `typedef struct { union { float v[3]; struct { float x, y, z; }; struct { float roll, pitch, heading; }; }; int8_t status; uint8_t reserved[3]; } sensors_vec_t;`
  - `typedef struct { int32_t version; int32_t sensor_id; int32_t type; int32_t reserved0; int32_t timestamp; union { float data[4]; sensors_vec_t acceleration; sensors_vec_t gyro; float temperature; }; } sensors_event_t;`
  - Las constantes `SENSORS_GRAVITY_STANDARD` (9.80665F) y `SENSORS_DPS_TO_RADS` (0.017453293F).
- **`Adafruit_MPU6050.h`:**
  - los enums `mpu6050_accel_range_t { MPU6050_RANGE_2_G = 0, MPU6050_RANGE_4_G, MPU6050_RANGE_8_G, MPU6050_RANGE_16_G }`, `mpu6050_gyro_range_t { MPU6050_RANGE_250_DEG = 0, …_500_DEG, …_1000_DEG, …_2000_DEG }` y `mpu6050_bandwidth_t { MPU6050_BAND_260_HZ = 0, …_184_HZ, …_94_HZ, …_44_HZ, …_21_HZ, …_10_HZ, …_5_HZ }`;
  - `MPU6050_I2CADDR_DEFAULT 0x68`;
  - `class Adafruit_MPU6050` con `bool begin(uint8_t = MPU6050_I2CADDR_DEFAULT, TwoWire* = &Wire, int32_t = 0)`, `set/getAccelerometerRange`, `set/getGyroRange`, `set/getFilterBandwidth` y `bool getEvent(sensors_event_t* a, sensors_event_t* g, sensors_event_t* temp)`.
  - `begin` deja ±2 g, ±500 °/s y 260 Hz.
  - `getEvent` convierte lo cuantizado: `crudo/LSBg·9.80665`, `crudo/LSBdps·π/180` y `crudo/340 + 36.53`.
- **`MPU6050.h` (i2cdevlib)**, con `#include "I2Cdev.h"`, que es una cabecera vacía para compatibilidad:
  - las constantes `MPU6050_ACCEL_FS_2 0x00 … _16 0x03` y `MPU6050_GYRO_FS_250 0x00 … _2000 0x03`;
  - `class MPU6050 { MPU6050(uint8_t address = 0x68); … }`, con:
    - `initialize()`, que deja ±2 g y ±250 °/s;
    - `testConnection()`, que da `true`;
    - `getMotion6(int16_t*×6)`, `getAcceleration(int16_t*×3)` y `getRotation(int16_t*×3)`;
    - `int16_t getRotationX()`, `getRotationY()` y `getRotationZ()`;
    - `setFullScaleAccelRange(uint8_t)` y `setFullScaleGyroRange(uint8_t)`;
    - `set{X,Y,Z}AccelOffset(int16_t)` y `set{X,Y,Z}GyroOffset(int16_t)` (decisión 6).

- [ ] **Step 1: Escribir las pruebas que fallan**:

```ts
const GIRAR = 'pinMode(16, OUTPUT); pinMode(17, OUTPUT); pinMode(4, OUTPUT); pinMode(5, OUTPUT); digitalWrite(16, LOW); digitalWrite(17, HIGH); digitalWrite(4, HIGH); digitalWrite(5, LOW); analogWrite(18, 255); analogWrite(19, 255); delay(100);';
it('Adafruit: plano, rampa y temperatura, cuantizados como el chip; 0,4 ms por lectura', async () => {
  const ada = '#include <Adafruit_MPU6050.h>\nAdafruit_MPU6050 mpu;\nsensors_event_t a, g, t;\n';
  const plano = await correrSketch(`${ada}void setup() { Serial.begin(115200); Serial.println(mpu.begin()); unsigned long t0 = micros(); mpu.getEvent(&a, &g, &t); unsigned long t1 = micros();
    Serial.printf("%.2f %.2f %.2f %.2f %lu\\n", a.acceleration.x, a.acceleration.z, g.gyro.z, t.temperature, t1 - t0); }\nvoid loop() {}`);
  expect(plano.texto).toBe('1\r\n0.00 9.81 0.00 25.00 401\n');
  const alto = 300 * Math.tan(20 * Math.PI / 180);
  const pista = pistaDe({ columnas: 3, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'recta' }, { c: 1, r: 0, tipo: 'rampa' }, { c: 2, r: 0, tipo: 'recta', nivel: alto }] });
  const rampa = await correrSketch(`${ada}void setup() { Serial.begin(115200); mpu.begin(); mpu.getEvent(&a, &g, &t); Serial.printf("%.2f %.2f\\n", a.acceleration.x, a.acceleration.z); }\nvoid loop() {}`,
    { pista, pose: { x: 450, y: 150, yaw: 0 } });
  expect(rampa.texto).toBe('3.35 9.22\n');
});
it('Adafruit: giro dentro del rango por defecto y saturación con un rango menor', async () => {
  const { texto } = await correrSketch(`#include <Adafruit_MPU6050.h>\nAdafruit_MPU6050 mpu;\nsensors_event_t a, g, t;\nvoid setup() { Serial.begin(115200); mpu.begin(); ${GIRAR}
    mpu.getEvent(&a, &g, &t); Serial.printf("%.2f\\n", g.gyro.z); mpu.setGyroRange(MPU6050_RANGE_250_DEG); mpu.getEvent(&a, &g, &t); Serial.printf("%.2f %d\\n", g.gyro.z, mpu.getGyroRange()); }\nvoid loop() {}`);
  expect(texto).toBe('8.57\n4.37 0\n');
});
it('i2cdevlib: valores crudos según el rango, saturación y offsets', async () => {
  const { texto } = await correrSketch(`#include <Wire.h>\n#include "I2Cdev.h"\n#include "MPU6050.h"\nMPU6050 mpu;\nint16_t ax, ay, az, gx, gy, gz;\nvoid setup() { Serial.begin(115200); Wire.begin(); mpu.initialize(); Serial.println(mpu.testConnection());
    mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz); Serial.printf("%d %d %d %d\\n", ax, ay, az, gz);
    mpu.setZAccelOffset(1024); mpu.getAcceleration(&ax, &ay, &az); Serial.println(az); ${GIRAR}
    Serial.println(mpu.getRotationZ()); mpu.setFullScaleGyroRange(MPU6050_GYRO_FS_1000); Serial.println(mpu.getRotationZ()); }\nvoid loop() {}`);
  expect(texto).toBe(`1\r\n0 0 16384 0\n24576\r\n32767\r\n${Math.round(1200 / 140 * 180 / Math.PI * 32.8)}\r\n`);
});
```

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/integracion/mpu6050.test.ts`
Expected: FAIL (no existen las cabeceras).

- [ ] **Step 3: Implementar** el MPU simulado común y las dos librerías según lo de arriba.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/integracion/mpu6050.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/nucleo tests/integracion/mpu6050.test.ts
git commit -m "MPU6050: Adafruit_MPU6050 e i2cdevlib sobre un MPU simulado común"
```

---

### Task 7: Adafruit_TCS34725

**Files:**
- Create: `src/nucleo/include/Adafruit_TCS34725.h`, `src/nucleo/src/Adafruit_TCS34725.cpp`
- Test: `tests/integracion/tcs34725.test.ts`

**Interfaces:**
- Consumes: `dyn_tcs_leer` y `delay`.
- **`Adafruit_TCS34725.h`:**
  - **Tiempos de integración:** las constantes `TCS34725_INTEGRATIONTIME_{2_4MS 0xFF, 24MS 0xF6, 50MS 0xEB, 60MS 0xE7, 101MS 0xD6, 120MS 0xCE, 154MS 0xC0, 180MS 0xB5, 199MS 0xAD, 240MS 0x9C, 300MS 0x83, 360MS 0x6A, 401MS 0x59, 420MS 0x51, 480MS 0x38, 499MS 0x30, 540MS 0x1F, 600MS 0x00}`.
  - **Ganancia:** `enum tcs34725Gain_t { TCS34725_GAIN_1X = 0, TCS34725_GAIN_4X, TCS34725_GAIN_16X, TCS34725_GAIN_60X }` (factores 1, 4, 16 y 60).
  - **`class Adafruit_TCS34725`:**
    - `Adafruit_TCS34725(uint8_t it = TCS34725_INTEGRATIONTIME_2_4MS, tcs34725Gain_t gain = TCS34725_GAIN_1X)`;
    - `bool begin(uint8_t addr = 0x29, TwoWire* = &Wire)`, `setIntegrationTime(uint8_t)` y `setGain(tcs34725Gain_t)`;
    - `getRawData(uint16_t* r, g, b, c)`, `getRawDataOneShot(…)` y `getRGB(float* r, g, b)`;
    - `uint16_t calculateColorTemperature_dn40(r, g, b, c)` y `uint16_t calculateLux(r, g, b)`;
    - `setInterrupt(bool)`.
- **Comportamiento:**
  - **Integración:** `ciclos = 256 − atime`; `tiempoIntegracionMs = ciclos · 2.4`; cuentas máximas `min(65535, 1024·ciclos)`.
  - **`begin`:** espera `3 + ciclos·12/5 + 1` ms (encendido y una integración, en aritmética entera).
  - **`getRawData`:** lee con `dyn_tcs_leer(ciclos·2400, factor, led, rgbc)`, acota a las cuentas máximas y después espera `ciclos·12/5 + 1` ms, como la librería. `getRawDataOneShot` hace lo mismo.
  - **LED** (decisión 9): `led = !interrupcion`.
  - **`getRGB`:** `canal/c·255`, o 0 si `c = 0`.
  - **`calculateColorTemperature_dn40`:**

```
si c = 0 → 0
sat = ciclos > 63 ? 65535 : 1024·ciclos;  si ciclos ≤ 63: sat −= sat/4
si c ≥ sat → 0
ir = r + g + b > c ? (r + g + b − c)/2 : 0
r2 = r − ir; b2 = b − ir; si r2 = 0 → 0
return 3810·b2/r2 + 1391        (aritmética entera de 32 bits)
```

  - **`calculateLux`:** `(uint16_t)(−0.32466·r + 1.57837·g − 0.73191·b)`.

- [ ] **Step 1: Escribir las pruebas que fallan**:

```ts
const INICIO = '#include <Wire.h>\n#include <Adafruit_TCS34725.h>\n';
it('por defecto: 2,4 ms y 1x sobre blanco; getRawData espera la integración', async () => {
  const { texto } = await correrSketch(`${INICIO}Adafruit_TCS34725 tcs;\nuint16_t r, g, b, c;\nvoid setup() { Serial.begin(115200); Serial.println(tcs.begin());
    unsigned long t0 = millis(); tcs.getRawData(&r, &g, &b, &c); Serial.printf("%u %u %u %u %lu\\n", r, g, b, c, millis() - t0); }\nvoid loop() {}`);
  expect(texto).toBe('1\r\n24 24 24 72 3\n');
});
it('50 ms y 4x: getRGB, temperatura de color y lux', async () => {
  const { texto } = await correrSketch(`${INICIO}Adafruit_TCS34725 tcs(TCS34725_INTEGRATIONTIME_50MS, TCS34725_GAIN_4X);\nuint16_t r, g, b, c; float fr, fg, fb;\nvoid setup() { Serial.begin(115200); tcs.begin();
    tcs.getRawData(&r, &g, &b, &c); tcs.getRGB(&fr, &fg, &fb);
    Serial.printf("%u %u %.2f %u %u\\n", r, c, fr, tcs.calculateColorTemperature_dn40(r, g, b, c), tcs.calculateLux(r, g, b)); }\nvoid loop() {}`);
  expect(texto).toBe('2016 6048 85.00 5201 1051\n');
});
it('satura en las cuentas máximas; sobre una marca verde lee verde; setInterrupt apaga el LED', async () => {
  const sat = await correrSketch(`${INICIO}Adafruit_TCS34725 tcs(TCS34725_INTEGRATIONTIME_154MS, TCS34725_GAIN_60X);\nuint16_t r, g, b, c;\nvoid setup() { Serial.begin(115200); tcs.begin(); tcs.getRawData(&r, &g, &b, &c); Serial.printf("%u %u\\n", r, c); }\nvoid loop() {}`,
    { duracionUs: 1_000_000 });
  expect(sat.texto).toBe('65535 65535\n');
  const cruce = pistaDe({ columnas: 1, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'cruce', props: { marcas: { ai: false, ad: true, di: false, dd: false } } }] });
  const verde = await correrSketch(`${INICIO}Adafruit_TCS34725 tcs;\nuint16_t r, g, b, c;\nvoid setup() { Serial.begin(115200); tcs.begin(); tcs.getRawData(&r, &g, &b, &c); Serial.printf("%u %u %u %u\\n", r, g, b, c); }\nvoid loop() {}`,
    { pista: cruce, pose: { x: 88, y: 174, yaw: 0 } });
  expect(verde.texto).toBe('0 16 8 24\n');
  const leds: boolean[] = [];
  await correrSketch(`${INICIO}Adafruit_TCS34725 tcs;\nuint16_t r, g, b, c;\nvoid setup() { tcs.begin(); tcs.getRawData(&r, &g, &b, &c); tcs.setInterrupt(true); tcs.getRawData(&r, &g, &b, &c); }\nvoid loop() {}`,
    { modelos: { leerTCS34725: e => { leds.push(e.ledEncendido); return { r: 0, g: 0, b: 0, c: 0 }; } } });
  expect(leds.slice(-2)).toEqual([true, false]);
});
```

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/integracion/tcs34725.test.ts`
Expected: FAIL (`Adafruit_TCS34725.h` no existe).

- [ ] **Step 3: Implementar** `Adafruit_TCS34725` según lo de arriba.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run tests/integracion/tcs34725.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/nucleo tests/integracion/tcs34725.test.ts
git commit -m "Adafruit_TCS34725 en el núcleo simulado"
```

---

### Task 8: Un seguidor de línea de punta a punta, y documentación

**Files:**
- Test: `tests/integracion/seguidor.test.ts`
- Modify: `src/modelos/README.md`, `README.md`, `docs/superpowers/specs/2026-10-17-simulador-dynamis-design.md`

**Interfaces:**
- Consumes: todo lo anterior.

- [ ] **Step 1: Escribir la prueba de punta a punta.**
  - **El sketch:** un seguidor con QTRSensors y un control P. Primero calibra girando sobre su eje, a la izquierda 150 ms, a la derecha 300 ms y a la izquierda 150 ms, con `qtr.calibrate()` en cada vuelta. Después sigue la línea 3 s.
  - **El escenario:** parte 20 mm a la izquierda de una línea recta.
  - **Lo que se espera:** termina centrado y avanzó.

```ts
const SEGUIDOR = `#include <QTRSensors.h>
QTRSensors qtr; const uint8_t PINES[8] = {36, 39, 34, 35, 32, 33, 25, 26}; uint16_t v[8];
void motores(int izq, int der) {
  digitalWrite(16, izq >= 0); digitalWrite(17, izq < 0); digitalWrite(4, der >= 0); digitalWrite(5, der < 0);
  analogWrite(18, constrain(abs(izq), 0, 255)); analogWrite(19, constrain(abs(der), 0, 255));
}
void girarCalibrando(int sentido, unsigned long ms) { unsigned long t0 = millis(); motores(-128 * sentido, 128 * sentido); while (millis() - t0 < ms) qtr.calibrate(); }
void setup() {
  pinMode(16, OUTPUT); pinMode(17, OUTPUT); pinMode(4, OUTPUT); pinMode(5, OUTPUT);
  qtr.setTypeAnalog(); qtr.setSensorPins(PINES, 8);
  girarCalibrando(1, 150); girarCalibrando(-1, 300); girarCalibrando(1, 150); motores(0, 0);
}
void loop() { int error = (int)qtr.readLineBlack(v) - 3500; motores(100 + error / 80, 100 - error / 80); }`;
it('un seguidor de línea con QTRSensors y control P vuelve a la línea y avanza', async () => {
  const { sim, resultado } = await correrSketch(SEGUIDOR, { pose: { x: 150, y: 170, yaw: 0 }, duracionUs: 3_600_000 });
  expect(resultado.motivo).toBe('tiempo');
  expect(Math.abs(sim.estado.y - 150)).toBeLessThan(10);
  expect(sim.estado.x).toBeGreaterThan(600);
});
```

- [ ] **Step 2: Correrla.**

Run: `npx vitest run tests/integracion/seguidor.test.ts`
Expected: PASS. Si no converge, ajustar solo la ganancia (`error / 80`) o los tiempos de la calibración del sketch de prueba, y dejarlo en el ledger como Ruling. No se cambia el núcleo para que pase.

- [ ] **Step 3: Documentación y spec.**
  - **`src/modelos/README.md`:** una sección por modelo de sensor (`qtr.js`, `vl53l0x.js`, `mpu6050.js`, `tcs34725.js`), con:
    - la firma y la tabla de parámetros con unidades;
    - el marco de cada sensor;
    - lo que hace el placeholder;
    - qué convierte el núcleo (int16 del MPU, cuentas máximas del TCS, 8190 del VL53L0X).
    
    Agregar también:
    - las decisiones 1, 2 y 3 (sensor 0 del QTR a la izquierda, ángulos de `ConfigRobot` en grados y rumbo del VL53L0X);
    - un párrafo para el estudiante: el QTR se puede leer con `analogRead` directo.
  - **`README.md`:**
    - el estado pasa a "fase 3 de 7 — librerías de sensores";
    - la lista de librerías soportadas, con un enlace a la spec §7.
  - **Spec:**
    - §7: las decisiones 4, 5, 6, 7, 8, 9 y 10;
    - §6, tabla de costos: "Lectura del MPU6050: 0,4 ms (`COSTOS_US.lecturaMpu`), en cualquier función de lectura";
    - §9: `t` en segundos, la convención del sensor 0 del QTR y los ángulos de `ConfigRobot` en grados.

- [ ] **Step 4: Suite completa y typecheck**

Run: `npm test && npm run typecheck`
Expected: todas las pruebas pasan y el typecheck no tiene errores.

- [ ] **Step 5: Commit**

```bash
git add tests/integracion/seguidor.test.ts src/modelos/README.md README.md docs/superpowers/specs/2026-10-17-simulador-dynamis-design.md
git commit -m "Seguidor de línea de punta a punta con QTRSensors; documentación de la fase 3"
```

---

### Task 9: Juez: las marcas se evalúan desde el lado por donde entra el robot (pedido del usuario)

El usuario pidió (2026-10-22) que el juez también evalúe una unión en T a la que el robot llega por su rama. La regla física de las marcas lo cubre para cualquier entrada: el robot mira las marcas que quedan **antes** del cruce desde su lado de entrada. Las marcas son las mismas de siempre (`ai`, `ad`, `di` y `dd` en el marco de la flecha). El cuadrado F1 se sigue evaluando solo entrando por la flecha.

**Files:**
- Modify: `src/pista/catalogo.ts`, `src/juez/juez.ts`, `docs/superpowers/specs/2026-10-17-simulador-dynamis-design.md` (§10.6 fila Decisiones, §20)
- Test: `tests/unidad/catalogo.test.ts`, `tests/unidad/juez-eventos.test.ts`

**Interfaces:**
- Produces: `salidaEsperada(b: Baldosa, entrada: Lado): Lado | null` en `catalogo.ts`.
  - **Entrada por el oeste (la flecha):** usa `accionEsperada(b)`, que respeta `props.accion`.
  - **Otras entradas:** deduce la acción de las marcas de antes del cruce: izquierda y derecha dan `vuelta`, solo izquierda da `izq`, solo derecha da `der`, ninguna da `recto`.
  - **Sin salida esperada:** devuelve `null` si la pieza no es `cruce` ni `unionT`, o si la salida esperada no tiene boca (por ejemplo, seguir derecho al llegar por la rama de una T).
- El juez compara la salida con `salidaEsperada(baldosa, entrada)` para cualquier entrada, y no juzga cuando da `null`.

**Marcas que quedan antes del cruce y salida esperada**, según la entrada:

| Entrada | Antes, a la izquierda | Antes, a la derecha | recto | izq | der | vuelta |
|---|---|---|---|---|---|---|
| oeste | `ai` | `ad` | este | norte | sur | oeste |
| sur | `ad` | `dd` | norte | oeste | este | sur |
| este | `dd` | `di` | oeste | sur | norte | este |
| norte | `di` | `ai` | sur | este | oeste | norte |

- [ ] **Step 1: Escribir las pruebas que fallan.**

```ts
// catalogo.test.ts
const cruce = (marcas: Partial<Marcas>) => pistaDe({ columnas: 1, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'cruce', props: { marcas: { ai: false, ad: false, di: false, dd: false, ...marcas } } }] }).baldosas[0];
it.each([
  ['oeste', { ad: true }, 'sur'], ['sur', { ad: true }, 'oeste'], ['este', { dd: true }, 'sur'],
  ['norte', { di: true }, 'este'], ['sur', {}, 'norte'], ['norte', { ai: true, di: true }, 'norte'],
] as const)('cruce entrando por %s con %o: sale por %s', (entrada, marcas, salida) => expect(salidaEsperada(cruce(marcas), entrada)).toBe(salida));
it('T por la rama: la marca de antes indica el giro; sin marca no hay salida posible', () => {
  const t = (marcas: Partial<Marcas>) => pistaDe({ columnas: 1, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'unionT', props: { rama: 'izq', marcas: { ai: false, ad: false, di: false, dd: false, ...marcas } } }] }).baldosas[0];
  expect(salidaEsperada(t({ di: true }), 'norte')).toBe('este');
  expect(salidaEsperada(t({ ai: true }), 'norte')).toBe('oeste');
  expect(salidaEsperada(t({}), 'norte')).toBeNull();
});
// juez-eventos.test.ts — reemplaza la parte `otroLado` de la prueba del cruce:
//   entrando por el sur con la marca `ad` (antes, a la izquierda) hay que salir por el oeste; salir por el norte es un error.
it('unión en T por la rama: la marca decide hacia dónde girar', () => {
  const conT = pistaDe({ columnas: 3, filas: 3, baldosas: [{ c: 1, r: 1, tipo: 'unionT', props: { rama: 'izq', marcas: { ai: false, ad: false, di: true, dd: false } } }] });
  const bien = new Juez(crearMundo(conT), ROBOT_POR_DEFECTO);
  recorrer(bien, [[0, 450, 700], [0.5, 450, 450], [1, 700, 450]]); expect(tipos(bien, 'camino-equivocado')).toEqual([]);
  const mal = new Juez(crearMundo(conT), ROBOT_POR_DEFECTO);
  recorrer(mal, [[0, 450, 700], [0.5, 450, 450], [1, 200, 450]]);
  expect(tipos(mal, 'camino-equivocado').map(e => e.mensaje)).toEqual(['Tomaste el camino equivocado en la unión en T.']);
});
```

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/unidad/catalogo.test.ts tests/unidad/juez-eventos.test.ts`
Expected: FAIL (`salidaEsperada` no existe, y el juez no evalúa otras entradas).

- [ ] **Step 3: Implementar `salidaEsperada` y usarla en el juez.**
  - En la spec, §10.6, fila Decisiones, cambiar "Se evalúa cuando el robot entra por la flecha de la baldosa" por: "Las marcas se leen desde el lado por donde entra el robot (las que quedan antes del cruce). El cuadrado F1 se evalúa entrando por la flecha."
  - En §20, agregar la confirmación del usuario.

- [ ] **Step 4: Correr las pruebas del juez y del catálogo**

Run: `npx vitest run tests/unidad/catalogo.test.ts tests/unidad/juez-eventos.test.ts tests/unidad/juez.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pista/catalogo.ts src/juez/juez.ts tests/unidad docs/superpowers/specs/2026-10-17-simulador-dynamis-design.md
git commit -m "Juez: las marcas de cruces y uniones en T se evalúan desde cualquier entrada"
```
