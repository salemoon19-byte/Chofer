// ── Chofer Particular — Service Worker ──────────────────────────────────────
// Versión del caché: cambia este número para forzar actualización
const CACHE_VERSION = 'chofer-v1';

// Archivos que se guardan en caché al instalar
const ARCHIVOS_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  // Fuentes de Google (se cachean en la primera visita con internet)
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap'
];

// ── INSTALL: guarda archivos en caché ────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      // Intentamos cachear todo; si algún archivo externo falla, no bloquea
      return Promise.allSettled(
        ARCHIVOS_CACHE.map(url =>
          cache.add(url).catch(() => {
            console.log('[SW] No se pudo cachear:', url);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpia cachés viejos ───────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: sirve desde caché, con fallback a red ─────────────────────────────
// Estrategia: Cache First para assets propios, Network First para el resto
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Solo manejamos GET
  if (event.request.method !== 'GET') return;

  // Para el HTML principal: Network First (siempre intenta actualizar)
  if (url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Guarda la versión nueva en caché
          const copia = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, copia));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Para todo lo demás: Cache First (sin internet funciona igual)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      // No está en caché: busca en red y guarda para la próxima vez
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200) return response;
        const copia = response.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(event.request, copia));
        return response;
      }).catch(() => {
        // Sin red y sin caché: retorna respuesta vacía para no romper la app
        return new Response('', { status: 408, statusText: 'Sin conexión' });
      });
    })
  );
});

// ── BACKGROUND SYNC: por si se pierde conexión guardando datos ───────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-viajes') {
    // Reservado para futura sincronización con servidor
    console.log('[SW] Background sync ejecutado');
  }
});
