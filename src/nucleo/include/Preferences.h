// Preferences.h — librería Preferences de arduino-esp32 (igual en 3.x y en 2.0.14), escrita desde cero.
// Guarda pares clave-valor en la NVS, la memoria de la flash que sobrevive a apagar el robot. En el
// simulador, la memoria vive en src/simulacion/memoria.ts y se ve en la tarjeta «Memoria del robot».
#pragma once

#include "Arduino.h"

typedef enum {
  PT_I8, PT_U8, PT_I16, PT_U16, PT_I32, PT_U32, PT_I64, PT_U64, PT_STR, PT_BLOB, PT_INVALID
} PreferenceType;

class Preferences {
public:
  Preferences() {}
  ~Preferences() { end(); }

  /** Abre el espacio de nombres `name` (hasta 15 letras). En solo lectura falla si todavía no existe. */
  bool begin(const char* name, bool readOnly = false, const char* partition_label = NULL);
  void end();

  bool clear();
  bool remove(const char* key);

  size_t putChar(const char* key, int8_t value);
  size_t putUChar(const char* key, uint8_t value);
  size_t putShort(const char* key, int16_t value);
  size_t putUShort(const char* key, uint16_t value);
  size_t putInt(const char* key, int32_t value);
  size_t putUInt(const char* key, uint32_t value);
  size_t putLong(const char* key, int32_t value);
  size_t putULong(const char* key, uint32_t value);
  size_t putLong64(const char* key, int64_t value);
  size_t putULong64(const char* key, uint64_t value);
  size_t putFloat(const char* key, float value);
  size_t putDouble(const char* key, double value);
  size_t putBool(const char* key, bool value);
  size_t putString(const char* key, const char* value);
  size_t putString(const char* key, String value);
  size_t putBytes(const char* key, const void* value, size_t len);

  bool isKey(const char* key);
  PreferenceType getType(const char* key);

  int8_t getChar(const char* key, int8_t defaultValue = 0);
  uint8_t getUChar(const char* key, uint8_t defaultValue = 0);
  int16_t getShort(const char* key, int16_t defaultValue = 0);
  uint16_t getUShort(const char* key, uint16_t defaultValue = 0);
  int32_t getInt(const char* key, int32_t defaultValue = 0);
  uint32_t getUInt(const char* key, uint32_t defaultValue = 0);
  int32_t getLong(const char* key, int32_t defaultValue = 0);
  uint32_t getULong(const char* key, uint32_t defaultValue = 0);
  int64_t getLong64(const char* key, int64_t defaultValue = 0);
  uint64_t getULong64(const char* key, uint64_t defaultValue = 0);
  float getFloat(const char* key, float defaultValue = NAN);
  double getDouble(const char* key, double defaultValue = NAN);
  bool getBool(const char* key, bool defaultValue = false);
  size_t getString(const char* key, char* value, size_t maxLen);
  String getString(const char* key, String defaultValue = String());
  size_t getBytesLength(const char* key);
  size_t getBytes(const char* key, void* buf, size_t maxLen);

  /** Cuántas entradas de 32 bytes quedan libres en la memoria. */
  size_t freeEntries();

private:
  bool abierta() const;
  size_t poner(const char* key, PreferenceType tipo, const void* datos, size_t largo);
  /** Lee un valor de exactamente `largo` bytes de ese tipo; false si no existe o es de otro tipo. */
  bool leer(const char* key, PreferenceType tipo, void* datos, size_t largo);

  char espacio[16] = {0};
  bool iniciada = false;
};
