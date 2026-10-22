/** Tiempo virtual (µs) que consume cada llamada del programa (spec §6). */
export const COSTOS_US = {
  millis: 1, micros: 1, pinMode: 1, digitalWrite: 1, digitalRead: 1,
  analogRead: 10, analogWrite: 2, ledcWrite: 2, serialAvailable: 1, llamadaLoop: 1, yield: 1,
  /** Una lectura del MPU6050 por I2C (14 bytes a 400 kHz), en cualquier función de lectura. */
  lecturaMpu: 400,
} as const;

/** Búfer de transmisión del UART del ESP32. */
export const BUFER_SERIAL_BYTES = 128;

/** Microsegundos por carácter: 10 bits (inicio, 8 datos, parada) a la velocidad dada. */
export function usPorCaracter(baudios: number): number {
  return 10e6 / baudios;
}
