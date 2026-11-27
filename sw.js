// Cache per usare l'app anche senza rete in palestra.
const CACHE = 'palestra-v33';
const SHELL = ['./', 'index.html', 'css/style.css', 'css/fonts.css', 'css/rivista.css', 'fonts/Fraunces-normal.woff2', 'fonts/Fraunces-italic.woff2', 'fonts/PublicSans-normal.woff2', 'js/app.js', 'js/figure.js', 'js/figure3.js', 'js/exercises.js', 'js/exercises_extra.js', 'js/bodymap.js', 'js/stats.js', 'js/charts.js', 'js/editor.js', 'js/scheda-import.js', 'js/calc.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
// rete prima (così diario e codice si aggiornano), cache se offline o se la rete non risponde entro 3 secondi
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // no-cache: chiede sempre al server se il file è cambiato (niente copie vecchie della cache HTTP)
  const net = fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  });
  const cached = () => caches.match(e.request, { ignoreSearch: true });
  const slow = new Promise((ok) => setTimeout(ok, 3000)).then(cached);
  e.respondWith(Promise.race([net.catch(cached), slow.then((r) => r || net)]).then((r) => r || net));
  e.waitUntil(net.catch(() => {}));
});
