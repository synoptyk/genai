const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(
      /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
    )
);

export function registerPWA() {
  if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;

  const swUrl = `${process.env.PUBLIC_URL}/sw.js`;

  window.addEventListener('load', () => {
    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register(swUrl);

        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              if (registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
              }
            }
          });
        });

        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        });
      } catch (_) {
        // SW registration fail should not break app startup.
      }
    };

    if (isLocalhost) {
      fetch(swUrl)
        .then((response) => {
          const contentType = response.headers.get('content-type');
          if (response.status === 404 || (contentType && contentType.indexOf('javascript') === -1)) {
            navigator.serviceWorker.ready.then((registration) => registration.unregister());
          } else {
            register();
          }
        })
        .catch(() => register());
    } else {
      register();
    }
  });
}
