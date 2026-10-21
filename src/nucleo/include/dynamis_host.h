// dynamis_host.h — funciones que el simulador le entrega al programa (imports "dynamis").
// Es el contrato entre el núcleo Arduino simulado y src/simulacion/puente.ts.
#pragma once
#include <stdint.h>
#include <stddef.h>

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
DYN_IMPORTAR("azar_u32") uint32_t dyn_azar_u32(void);

#ifdef __cplusplus
}
#endif
