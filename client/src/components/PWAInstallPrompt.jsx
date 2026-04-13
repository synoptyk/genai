import React from 'react';
import { Download, Smartphone, X } from 'lucide-react';

const DISMISS_KEY = 'genai360_pwa_prompt_dismissed_until';
const DISMISS_MS = 12 * 60 * 60 * 1000; // 12 horas

const isAndroid = () => /android/i.test(navigator.userAgent || '');
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = React.useState(null);
  const [showBanner, setShowBanner] = React.useState(false);

  React.useEffect(() => {
    if (!isAndroid() || isStandalone()) return;

    const dismissedUntil = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedUntil > Date.now()) return;

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    const handleInstalled = () => {
      setShowBanner(false);
      setDeferredPrompt(null);
      localStorage.removeItem(DISMISS_KEY);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } catch (_) {
      // no-op
    }
    setDeferredPrompt(null);
    setShowBanner(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS));
    setShowBanner(false);
  };

  if (!showBanner || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[92vw] max-w-md">
      <div className="rounded-2xl border border-indigo-300 bg-white shadow-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
            <Smartphone size={18} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-slate-900">Instala GENAI360</p>
            <p className="text-xs text-slate-600 mt-1">
              Acceso rapido desde tu pantalla de inicio y mejor experiencia como app.
            </p>

            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={handleInstall}
                className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 flex items-center gap-1.5"
              >
                <Download size={13} /> Instalar GENAI360
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="px-3 py-2 rounded-xl border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50"
              >
                Ahora no
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Cerrar"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
