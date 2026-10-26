/** Tiempo virtual (µs) que consume cada llamada del programa. */
export const COSTOS_US = {
  millis: 1, micros: 1, pinMode: 1, digitalWrite: 1, digitalRead: 1,
  analogRead: 10, analogWrite: 2, ledcWrite: 2, serialAvailable: 1, llamadaLoop: 1, yield: 1,
  /** Una lectura del MPU6050 por I2C (14 bytes a 400 kHz), en cualquier función de lectura. */
  lecturaMpu: 400,
  /** Un byte por I2C a 400 kHz (8 bits y el ACK), en el I2C directo: la dirección cuenta como un byte. */
  i2cByte: 22.5,
  /** Un aviso de una librería mal usada: así un ciclo que la llama sin parar no congela el tiempo. */
  aviso: 1,
} as const;

/** Búfer de transmisión del UART del ESP32. */
export const BUFER_SERIAL_BYTES = 128;

/** Microsegundos por carácter: 10 bits (inicio, 8 datos, parada) a la velocidad dada. */
export function usPorCaracter(baudios: number): number {
  return 10e6 / baudios;
}
