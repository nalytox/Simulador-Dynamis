import { bocasDe, salidaEsperada } from '../../src/pista/catalogo';
import { crearIndice, ladoEnMundo } from '../../src/pista/baldosas';
import type { Baldosa, Lado, Pista } from '../../src/pista/tipos';

const PASO: Record<Lado, [number, number]> = { este: [1, 0], oeste: [-1, 0], norte: [0, 1], sur: [0, -1] };
const OPUESTO: Record<Lado, Lado> = { este: 'oeste', oeste: 'este', norte: 'sur', sur: 'norte' };
const LADOS: Lado[] = ['oeste', 'este', 'norte', 'sur'];
const MAXIMO_PASOS = 100;

/** El borde local de la baldosa que queda en el borde `lado` del mundo. */
const ladoLocal = (b: Baldosa, lado: Lado): Lado => LADOS.find(l => ladoEnMundo(b, l) === lado)!;

/**
 * Las baldosas por donde pasa el robot que hace lo esperado: sigue la línea desde la partida y, en
 * cada cruce o unión, sale por donde lo indican las marcas. Lanza un error si el camino se corta.
 */
export function recorridoEsperado(p: Pista): Baldosa[] {
  const indice = crearIndice(p);
  let actual = p.baldosas.find(b => b.tipo === 'partida');
  if (!actual) throw new Error('La pista no tiene partida.');
  let entrada: Lado = ladoEnMundo(actual, 'oeste');
  const recorrido = [actual];
  for (let i = 0; actual.tipo !== 'meta'; i++) {
    if (i >= MAXIMO_PASOS) throw new Error(`Más de ${MAXIMO_PASOS} baldosas sin llegar a la meta.`);
    const local = ladoLocal(actual, entrada);
    const salidaLocal = actual.tipo === 'cruce' || actual.tipo === 'unionT'
      ? salidaEsperada(actual, local)
      : (() => {
        const otras = bocasDe(actual).filter(l => l !== local);
        if (otras.length !== 1) throw new Error(`En (${actual.c}, ${actual.r}) hay ${otras.length} salidas.`);
        return otras[0];
      })();
    if (!salidaLocal) throw new Error(`El cruce en (${actual.c}, ${actual.r}) no tiene la salida esperada.`);
    const salida = ladoEnMundo(actual, salidaLocal);
    const [dc, dr] = PASO[salida];
    const vecina = indice(actual.c + dc, actual.r + dr);
    if (!vecina) throw new Error(`Nada al ${salida} de (${actual.c}, ${actual.r}).`);
    entrada = OPUESTO[salida];
    if (!bocasDe(vecina).map(l => ladoEnMundo(vecina, l)).includes(entrada)) {
      throw new Error(`(${vecina.c}, ${vecina.r}) no tiene línea por el ${entrada}.`);
    }
    actual = vecina;
    recorrido.push(actual);
  }
  return recorrido;
}

/** Por qué borde local entró el robot a cada baldosa del recorrido. */
export function entradasDe(recorrido: Baldosa[]): Lado[] {
  return recorrido.map((b, i) => {
    if (i === 0) return 'oeste';
    const previa = recorrido[i - 1];
    const lado = b.c > previa.c ? 'oeste' : b.c < previa.c ? 'este' : b.r > previa.r ? 'sur' : 'norte';
    return ladoLocal(b, lado);
  });
}
