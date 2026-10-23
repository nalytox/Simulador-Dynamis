import { describe, it, expect } from 'vitest';
import { compilarParaPrueba } from '../ayuda/compilar-prueba';
import { cargarNucleoDesdeDisco } from '../../src/compilador/nucleo-node';
import { ejecutarPrueba } from '../../src/simulacion/ejecucion';
import { crearControl, fijarVelocidad } from '../../src/simulacion/control';
import { PROYECTO_INICIAL, PISTA_INICIAL } from '../../src/ejemplos';
import { bocasDe } from '../../src/pista/catalogo';
import { crearIndice, ladoEnMundo } from '../../src/pista/baldosas';
import type { Lado } from '../../src/pista/tipos';
import { ROBOT_POR_DEFECTO } from '../../src/robot/config';

const PASO: Record<Lado, [number, number]> = { este: [1, 0], oeste: [-1, 0], norte: [0, 1], sur: [0, -1] };
const OPUESTO: Record<Lado, Lado> = { este: 'oeste', oeste: 'este', norte: 'sur', sur: 'norte' };

describe('ejemplo inicial', { timeout: 180_000 }, () => {
  it('la pista de práctica está conectada de la partida a la meta', () => {
    const indice = crearIndice(PISTA_INICIAL);
    let actual = PISTA_INICIAL.baldosas.find(b => b.tipo === 'partida')!;
    let entrada: Lado = 'oeste';
    const recorrido: string[] = [actual.tipo];
    for (let i = 0; i < 20 && actual.tipo !== 'meta'; i++) {
      const salidas = bocasDe(actual).map(l => ladoEnMundo(actual, l)).filter(l => l !== entrada);
      expect(salidas).toHaveLength(1);
      const [dc, dr] = PASO[salidas[0]];
      const vecina = indice(actual.c + dc, actual.r + dr);
      expect(vecina, `nada al ${salidas[0]} de (${actual.c}, ${actual.r})`).not.toBeNull();
      entrada = OPUESTO[salidas[0]];
      expect(bocasDe(vecina!).map(l => ladoEnMundo(vecina!, l))).toContain(entrada);
      actual = vecina!;
      recorrido.push(actual.tipo);
    }
    expect(recorrido.at(-1)).toBe('meta');
  });

  it('el ejemplo inicial completa la pista de práctica', async () => {
    const modulo = await compilarParaPrueba(PROYECTO_INICIAL.archivos, await cargarNucleoDesdeDisco(), PROYECTO_INICIAL.nombre);
    const control = crearControl();
    fijarVelocidad(control, 0);
    const fin = await ejecutarPrueba({ modulo, pista: PISTA_INICIAL, robot: ROBOT_POR_DEFECTO, desde: 'partida', semilla: 1, control, publicar: () => {} });
    expect(fin).toMatchObject({ motivo: 'terminado', juez: { hitos: ['alcanzado', 'alcanzado'], meta: true } });
  });
});
