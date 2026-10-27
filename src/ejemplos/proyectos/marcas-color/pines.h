// Pines de la placa Dynamis V2: así está cableado el robot.
#pragma once
const uint8_t PIN_PWM_IZQ = 4, PIN_IN1_IZQ = 16, PIN_IN2_IZQ = 17;
const uint8_t PIN_PWM_DER = 19, PIN_IN1_DER = 5, PIN_IN2_DER = 18;
const uint8_t PINES_QTR[8] = {36, 39, 34, 35, 32, 33, 25, 26};
const uint8_t PIN_LEDON_QTR = 27;  // enciende los emisores del QTRX-MD-08A
// Multiplexor TCA9548A (0x70): canal 0 el TCS34725 izquierdo, 1 el derecho y 2 el VL53L0X.
const uint8_t DIRECCION_MUX = 0x70;
const uint8_t CANAL_COLOR_IZQ = 0, CANAL_COLOR_DER = 1, CANAL_LASER = 2;
