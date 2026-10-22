// dynamis_host.h — funciones que el simulador le entrega al programa (imports "dynamis").
// Es el contrato entre el núcleo Arduino simulado y src/simulacion/puente.ts.
#pragma once
#include <stdint.h>
#include <stddef.h>
#include <string.h>

#define DYN_IMPORTAR(nombre) __attribute__((import_module("dynamis"), import_name(nombre)))

#ifdef __cplusplus
extern "C" {
#endif

DYN_IMPORTAR("millis") uint32_t dyn_millis(void);
DYN_IMPORTAR("micros") uint32_t dyn_micros(void);
DYN_IMPORTAR("delay") void dyn_delay(uint32_t ms);
DYN_IMPORTAR("delay_us") void dyn_delay_us(uint32_t us);
DYN_IMPORTAR("yield") void dyn_yield(void);
DYN_IMPORTAR("pin_mode") void dyn_pin_mode(uint8_t pin, uint8_t modo);
DYN_IMPORTAR("digital_write") void dyn_digital_write(uint8_t pin, uint8_t valor);
DYN_IMPORTAR("digital_read") int dyn_digital_read(uint8_t pin);
DYN_IMPORTAR("analog_read") uint16_t dyn_analog_read(uint8_t pin);
DYN_IMPORTAR("analog_read_resolution") void dyn_analog_read_resolution(uint8_t bits);
DYN_IMPORTAR("analog_write") void dyn_analog_write(uint8_t pin, int valor);
DYN_IMPORTAR("analog_write_resolution") void dyn_analog_write_resolution(uint8_t pin, uint8_t bits);
DYN_IMPORTAR("ledc_attach") int dyn_ledc_attach(uint8_t pin, uint32_t freq, uint8_t bits);
DYN_IMPORTAR("ledc_write") int dyn_ledc_write(uint8_t pin, uint32_t duty);
DYN_IMPORTAR("ledc_detach") int dyn_ledc_detach(uint8_t pin);
DYN_IMPORTAR("serial_begin") void dyn_serial_begin(uint32_t baudios);
DYN_IMPORTAR("serial_write") void dyn_serial_write(const uint8_t* datos, size_t largo);
DYN_IMPORTAR("serial_available") int dyn_serial_available(void);

// Sensores: el simulador entrega la magnitud física en el instante actual; las librerías del
// núcleo esperan lo que espera la librería real y convierten unidades.
DYN_IMPORTAR("aviso") void dyn_aviso(const char* texto, size_t largo);
/** mm, acotado a 8190 (sin objetivo). */
DYN_IMPORTAR("vl53_medir") uint16_t dyn_vl53_medir(void);
/** ax ay az (m/s²), gx gy gz (rad/s), temp (°C), en el marco del sensor. Cuesta COSTOS_US.lecturaMpu. */
DYN_IMPORTAR("mpu_leer") void dyn_mpu_leer(float* datos7);
/** Cuentas crudas r, g, b, c; led: 1 si el LED de la placa está encendido. */
DYN_IMPORTAR("tcs_leer") void dyn_tcs_leer(uint32_t integracion_us, uint32_t ganancia, int led, uint16_t* rgbc);

static inline void dynAvisar(const char* texto) { dyn_aviso(texto, strlen(texto)); }
DYN_IMPORTAR("azar_u32") uint32_t dyn_azar_u32(void);

#ifdef __cplusplus
}
#endif
