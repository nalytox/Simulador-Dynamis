/**
 * Ganchos para las pruebas de punta a punta: en desarrollo (vite dev) quedan en window.__pruebas;
 * en la app publicada no existen.
 */
export function registrarPrueba(nombre: string, valor: unknown): void {
  if (!import.meta.env.DEV) return;
  const ventana = window as unknown as { __pruebas?: Record<string, unknown> };
  ventana.__pruebas ??= {};
  ventana.__pruebas[nombre] = valor;
}
