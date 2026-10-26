/**
 * Los perfiles de la clase: al abrir el simulador cada estudiante elige quién es, sin contraseña, y
 * su trabajo se guarda aparte del de los demás. El perfil elegido vale para la pestaña (sessionStorage):
 * recargar no vuelve a preguntar, abrir el simulador de nuevo sí.
 */
export interface Perfil { id: string; nombre: string }

export const PERFILES: readonly Perfil[] = ['Marco', 'Maite', 'Juan', 'Antonio', 'Agustin', 'Javier', 'Emilia']
  .map(nombre => ({ id: nombre.toLowerCase(), nombre }));

export const CLAVE_PERFIL = 'dynamis.perfil';

export function perfilDeSesion(sesion: Pick<Storage, 'getItem'>): Perfil | null {
  const id = sesion.getItem(CLAVE_PERFIL);
  return PERFILES.find(p => p.id === id) ?? null;
}

export function recordarPerfil(sesion: Pick<Storage, 'setItem'>, perfil: Perfil): void {
  sesion.setItem(CLAVE_PERFIL, perfil.id);
}

export function olvidarPerfil(sesion: Pick<Storage, 'removeItem'>): void {
  sesion.removeItem(CLAVE_PERFIL);
}

/** La base de IndexedDB del autoguardado de cada perfil. */
export const baseDeDatosDe = (p: Perfil) => `simulador-dynamis-${p.id}`;

/** La marca de "recorrido de la primera visita visto", una por perfil. */
export const claveRecorridoDe = (p: Perfil) => `dynamis.recorrido.${p.id}`;
