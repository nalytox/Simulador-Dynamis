import { construirNucleo } from '../scripts/construir-nucleo.mjs';

/** globalSetup de Vitest: deja generado/nucleo.a al día antes de las pruebas. */
export default async function () {
  await construirNucleo();
}
