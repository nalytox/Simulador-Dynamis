/** El evento de Chrome y Edge que permite ofrecer "Instalar" desde la página. */
interface EventoInstalar extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * "Instalar en este computador": avisa con una función cuando el navegador permite
 * instalar la app, y con null cuando ya no (se instaló). La función dice si se instaló.
 */
export function escucharInstalacion(ventana: Window, alPoder: (instalar: (() => Promise<boolean>) | null) => void): void {
  ventana.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    const evento = e as EventoInstalar;
    alPoder(async () => {
      await evento.prompt();
      const { outcome } = await evento.userChoice;
      // El aviso se puede mostrar una sola vez por evento: aceptado o no, el botón ya no sirve.
      alPoder(null);
      return outcome === 'accepted';
    });
  });
  ventana.addEventListener('appinstalled', () => alPoder(null));
}
