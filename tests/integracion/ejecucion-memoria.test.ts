import { describe, it, expect, beforeAll } from 'vitest';
import { compilarParaPrueba } from '../ayuda/compilar-prueba';
import { cargarNucleoDesdeDisco } from '../../src/compilador/nucleo-node';
import type { ArchivosNucleo } from '../../src/compilador/compilar';
import { ejecutarPrueba, type Instantanea } from '../../src/simulacion/ejecucion';
import { crearControl, fijarVelocidad, pedir, type Reloj } from '../../src/simulacion/control';
import { ejecutarPruebaDeAjuste } from '../../src/ajuste/prueba';
import { recompensaDePrueba } from '../ayuda/ajuste-de-prueba';
import { ROBOT_POR_DEFECTO } from '../../src/robot/config';
import type { MemoriaNvs } from '../../src/simulacion/memoria';
import { pistaDe } from '../ayuda/pistas';

let nucleo: ArchivosNucleo;
beforeAll(async () => { nucleo = await cargarNucleoDesdeDisco(); });

const PISTA = pistaDe({ columnas: 4, filas: 1,
  baldosas: [{ c: 0, r: 0, tipo: 'partida' }, { c: 1, r: 0, tipo: 'recta' }, { c: 2, r: 0, tipo: 'recta' }, { c: 3, r: 0, tipo: 'meta' }],
  objetos: [{ tipo: 'hito', x: 450, y: 150, rot: 0, props: { numero: 1 } }] });

/** Cuenta en la memoria cuántas veces partió, y avanza 1,5 s hasta la meta. */
const CONTAR_E_IR = `#include <Preferences.h>
Preferences p;
void setup() {
  Serial.begin(115200);
  p.begin("t");
  unsigned int veces = p.getUInt("veces", 0) + 1;
  p.putUInt("veces", veces);
  Serial.printf("veces %u\\n", veces);
  pinMode(16, OUTPUT); pinMode(17, OUTPUT); pinMode(5, OUTPUT); pinMode(18, OUTPUT); ledcAttach(4, 5000, 8); ledcAttach(19, 5000, 8);
  digitalWrite(16, HIGH); digitalWrite(17, LOW); digitalWrite(5, HIGH); digitalWrite(18, LOW);
  ledcWrite(4, 255); ledcWrite(19, 255); delay(1500); ledcWrite(4, 0); ledcWrite(19, 0);
}
void loop() {}`;

const conVeces = (n: number): MemoriaNvs => ({ espacios: { t: { veces: { tipo: 'u32', bytes: [n, 0, 0, 0] } } } });

function relojQueAvanza(): Reloj {
  let t = 0;
  return { ahora: () => t++, dormir: ms => { t += ms; } };
}

async function correr(codigo: string, o: { memoria?: MemoriaNvs; alPublicar?: (i: Instantanea, todas: Instantanea[], control: Int32Array) => void } = {}) {
  const control = crearControl();
  fijarVelocidad(control, 0);
  const instantaneas: Instantanea[] = [];
  const fin = await ejecutarPrueba({
    modulo: await compilarParaPrueba({ 'p.ino': codigo }, nucleo, 'p'), pista: PISTA, robot: ROBOT_POR_DEFECTO,
    desde: 'partida', semilla: 1, control, reloj: relojQueAvanza(), memoria: o.memoria,
    publicar: i => { instantaneas.push(i); o.alPublicar?.(i, instantaneas, control); },
  });
  return { fin, instantaneas };
}

describe('la memoria del robot durante una prueba', { timeout: 120_000 }, () => {
  it('las instantáneas traen la memoria solo cuando cambia, con la última clave escrita, y el fin la trae', async () => {
    const { fin, instantaneas } = await correr(CONTAR_E_IR);
    expect(instantaneas[0].memoria).toEqual({ datos: { espacios: {} }, ultima: null });
    const conCambios = instantaneas.filter(i => i.memoria !== null);
    expect(conCambios).toHaveLength(2);
    expect(conCambios[1].memoria).toEqual({ datos: conVeces(1), ultima: { espacio: 't', clave: 'veces' } });
    expect(fin.memoria).toEqual(conVeces(1));
  });

  it('parte de la memoria que se le da, sin cambiar ese objeto', async () => {
    const inicial = conVeces(5);
    const { fin, instantaneas } = await correr(CONTAR_E_IR, { memoria: inicial });
    expect(instantaneas.map(i => i.serial).join('')).toContain('veces 6');
    expect(fin.memoria).toEqual(conVeces(6));
    expect(inicial).toEqual(conVeces(5));
  });

  it('"Volver al último hito" reinicia el programa con la memoria que ya tenía', async () => {
    const { fin, instantaneas } = await correr(CONTAR_E_IR, { alPublicar: (_i, todas, control) => { if (todas.length === 3) pedir(control, 'ultimo'); } });
    const serial = instantaneas.map(i => i.serial).join('');
    expect(serial).toContain('veces 1');
    expect(serial).toContain('veces 2');
    expect(fin.memoria).toEqual(conVeces(2));
  });

  it('si el programa falla, lo que escribió antes queda en la memoria', async () => {
    const { fin } = await correr(`#include <Preferences.h>
      Preferences p;
      void setup() { p.begin("t"); p.putUInt("veces", 9); }
      void loop() { volatile int z = 0; Serial.println(millis() / z); }`);
    expect(fin.motivo).toBe('error');
    expect(fin.memoria).toEqual(conVeces(9));
  });

  it('una prueba de Ajustar parámetros parte de una copia de la memoria y no la cambia', async () => {
    const memoria = conVeces(3);
    const modulo = await compilarParaPrueba({ 'p.ino': CONTAR_E_IR.replace('Serial.printf("veces %u\\n", veces);',
      'if (veces == 4) { ledcAttach(4, 5000, 8); } else { while (true) delay(10); }') }, nucleo, 'p');
    const r = await ejecutarPruebaDeAjuste({ modulo, pista: PISTA, robot: ROBOT_POR_DEFECTO, valores: {}, semilla: 1, duracionS: 3,
      recompensa: { ...recompensaDePrueba, debeTerminar: () => false }, memoria });
    // Con veces = 4 (leído de la copia) el robot avanza; si hubiera partido vacía, se quedaría quieto.
    expect(r.trayectoria.at(-1)!.x).toBeGreaterThan(600);
    expect(memoria).toEqual(conVeces(3));
  });
});
