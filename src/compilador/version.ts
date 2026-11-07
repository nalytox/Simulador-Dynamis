/**
 * La versión del core Arduino-ESP32 con que se compila. Cambia la API del PWM (LEDC): en la 3.x se
 * maneja por pin (ledcAttach, ledcWrite(pin, …)); en la 2.0.14, por canal (ledcSetup, ledcAttachPin,
 * ledcWrite(canal, …)). Cada versión solo conoce su propia API, como en el robot.
 */
export type VersionEsp32 = '3.x' | '2.0.14';

export const VERSIONES_ESP32: readonly VersionEsp32[] = ['3.x', '2.0.14'];
export const VERSION_POR_DEFECTO: VersionEsp32 = '3.x';

export const esVersionEsp32 = (v: unknown): v is VersionEsp32 => VERSIONES_ESP32.includes(v as VersionEsp32);

/** Lo que ven las cabeceras del núcleo (Arduino.h y esp_arduino_version.h) para elegir la API. */
export const definicionDe = (v: VersionEsp32): string => `-DDYN_ESP32_CORE=${v === '2.0.14' ? 2 : 3}`;
