#include "Preferences.h"

#include <string.h>
#include "dynamis_host.h"

namespace {
const char* SIN_BEGIN = "Llama a begin() de Preferences antes de usar la memoria.";
}

bool Preferences::begin(const char* name, bool readOnly, const char* partition_label) {
  (void)partition_label;
  if (iniciada) return false;  // como la librería real: primero end()
  if (name == NULL || !dyn_nvs_abrir(name, readOnly ? 1 : 0)) return false;
  strncpy(espacio, name, sizeof(espacio) - 1);
  espacio[sizeof(espacio) - 1] = 0;
  iniciada = true;
  return true;
}

void Preferences::end() { iniciada = false; }

bool Preferences::abierta() const {
  if (!iniciada) dynAvisar(SIN_BEGIN);
  return iniciada;
}

bool Preferences::clear() { return abierta() && dyn_nvs_vaciar(espacio) != 0; }

bool Preferences::remove(const char* key) { return abierta() && key != NULL && dyn_nvs_quitar(espacio, key) != 0; }

size_t Preferences::poner(const char* key, PreferenceType tipo, const void* datos, size_t largo) {
  if (!abierta() || key == NULL) return 0;
  return dyn_nvs_poner(espacio, key, tipo, datos, largo);
}

size_t Preferences::putChar(const char* key, int8_t value) { return poner(key, PT_I8, &value, sizeof(value)); }
size_t Preferences::putUChar(const char* key, uint8_t value) { return poner(key, PT_U8, &value, sizeof(value)); }
size_t Preferences::putShort(const char* key, int16_t value) { return poner(key, PT_I16, &value, sizeof(value)); }
size_t Preferences::putUShort(const char* key, uint16_t value) { return poner(key, PT_U16, &value, sizeof(value)); }
size_t Preferences::putInt(const char* key, int32_t value) { return poner(key, PT_I32, &value, sizeof(value)); }
size_t Preferences::putUInt(const char* key, uint32_t value) { return poner(key, PT_U32, &value, sizeof(value)); }
// En el ESP32 un long mide 32 bits: la librería real lo guarda como int.
size_t Preferences::putLong(const char* key, int32_t value) { return poner(key, PT_I32, &value, sizeof(value)); }
size_t Preferences::putULong(const char* key, uint32_t value) { return poner(key, PT_U32, &value, sizeof(value)); }
size_t Preferences::putLong64(const char* key, int64_t value) { return poner(key, PT_I64, &value, sizeof(value)); }
size_t Preferences::putULong64(const char* key, uint64_t value) { return poner(key, PT_U64, &value, sizeof(value)); }
// Como en la librería real, los decimales se guardan como bloques de bytes.
size_t Preferences::putFloat(const char* key, float value) { return poner(key, PT_BLOB, &value, sizeof(value)); }
size_t Preferences::putDouble(const char* key, double value) { return poner(key, PT_BLOB, &value, sizeof(value)); }
size_t Preferences::putBool(const char* key, bool value) { return putUChar(key, value ? 1 : 0); }
size_t Preferences::putString(const char* key, const char* value) {
  if (value == NULL) return 0;
  return poner(key, PT_STR, value, strlen(value));
}
size_t Preferences::putString(const char* key, String value) { return putString(key, value.c_str()); }
size_t Preferences::putBytes(const char* key, const void* value, size_t len) {
  if (value == NULL || len == 0) return 0;
  return poner(key, PT_BLOB, value, len);
}

bool Preferences::isKey(const char* key) { return getType(key) != PT_INVALID; }

PreferenceType Preferences::getType(const char* key) {
  if (!abierta() || key == NULL) return PT_INVALID;
  return (PreferenceType)dyn_nvs_tipo(espacio, key);
}

bool Preferences::leer(const char* key, PreferenceType tipo, void* datos, size_t largo) {
  if (!abierta() || key == NULL) return false;
  if (dyn_nvs_largo(espacio, key, tipo) != (int)largo) return false;
  return dyn_nvs_leer(espacio, key, datos, largo) == largo;
}

#define LEER_O(tipo_c, pt)                    \
  tipo_c valor;                               \
  return leer(key, pt, &valor, sizeof(valor)) ? valor : defaultValue;

int8_t Preferences::getChar(const char* key, int8_t defaultValue) { LEER_O(int8_t, PT_I8) }
uint8_t Preferences::getUChar(const char* key, uint8_t defaultValue) { LEER_O(uint8_t, PT_U8) }
int16_t Preferences::getShort(const char* key, int16_t defaultValue) { LEER_O(int16_t, PT_I16) }
uint16_t Preferences::getUShort(const char* key, uint16_t defaultValue) { LEER_O(uint16_t, PT_U16) }
int32_t Preferences::getInt(const char* key, int32_t defaultValue) { LEER_O(int32_t, PT_I32) }
uint32_t Preferences::getUInt(const char* key, uint32_t defaultValue) { LEER_O(uint32_t, PT_U32) }
int32_t Preferences::getLong(const char* key, int32_t defaultValue) { LEER_O(int32_t, PT_I32) }
uint32_t Preferences::getULong(const char* key, uint32_t defaultValue) { LEER_O(uint32_t, PT_U32) }
int64_t Preferences::getLong64(const char* key, int64_t defaultValue) { LEER_O(int64_t, PT_I64) }
uint64_t Preferences::getULong64(const char* key, uint64_t defaultValue) { LEER_O(uint64_t, PT_U64) }
float Preferences::getFloat(const char* key, float defaultValue) { LEER_O(float, PT_BLOB) }
double Preferences::getDouble(const char* key, double defaultValue) { LEER_O(double, PT_BLOB) }
bool Preferences::getBool(const char* key, bool defaultValue) { return getUChar(key, defaultValue ? 1 : 0) == 1; }

size_t Preferences::getString(const char* key, char* value, size_t maxLen) {
  if (!abierta() || key == NULL) return 0;
  int largo = dyn_nvs_largo(espacio, key, PT_STR);
  // Como en la NVS real, el largo incluye el 0 del final y no cabe si el búfer es más chico.
  if (largo < 0 || value == NULL || (size_t)largo + 1 > maxLen) return 0;
  dyn_nvs_leer(espacio, key, value, (size_t)largo);
  value[largo] = 0;
  return (size_t)largo + 1;
}

String Preferences::getString(const char* key, String defaultValue) {
  if (!abierta() || key == NULL) return defaultValue;
  int largo = dyn_nvs_largo(espacio, key, PT_STR);
  if (largo < 0) return defaultValue;
  char* texto = new char[largo + 1];
  dyn_nvs_leer(espacio, key, texto, (size_t)largo);
  texto[largo] = 0;
  String resultado(texto);
  delete[] texto;
  return resultado;
}

size_t Preferences::getBytesLength(const char* key) {
  if (!abierta() || key == NULL) return 0;
  int largo = dyn_nvs_largo(espacio, key, PT_BLOB);
  return largo < 0 ? 0 : (size_t)largo;
}

size_t Preferences::getBytes(const char* key, void* buf, size_t maxLen) {
  size_t largo = getBytesLength(key);
  // La NVS real no copia nada si el búfer es más chico que el bloque guardado.
  if (largo == 0 || buf == NULL || largo > maxLen) return 0;
  return dyn_nvs_leer(espacio, key, buf, largo);
}

size_t Preferences::freeEntries() { return dyn_nvs_libres(); }
