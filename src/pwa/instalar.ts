/** El evento de Chrome y Edge que permite ofrecer "Instalar" desde la página. */
interface EventoInstalar extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * "Instalar en este computador" (spec §16): avisa con una función cuando el navegador permite
 * instalar la app, y con null cuando ya no (se instaló). La función dice si se instaló.
 */
export function escucharInstalacion(ventana: Window, alPoder: (instalar: (() => Promise<boolean>) | null) => void): void {
  ventana.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    const evento = e as EventoInstalar;
    alPoder(async () => {
      await evento.prompt();
      const { outcome } = await evento.userChoice;
      if (outcome !== 'accepted') return false;
      alPoder(null);
      return true;
    });
  });
  ventana.addEventListener('appinstalled', () => alPoder(null));
}
