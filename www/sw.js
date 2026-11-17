// Deixa o app abrir sem internet. Rede primeiro: arquivo novo publicado chega na próxima abertura;
// sem rede, usa a cópia guardada. As chamadas à OpenAI não passam por aqui.
const CACHE = "neru-calorias-v6";
const ARQUIVOS = [
  "./", "index.html", "style.css", "version.js", "app.js", "base.js", "store.js", "metas.js", "ia.js",
  "treino.js", "tela-treino.js", "extras.js", "nativo.js", "tabela.js", "alimentos.js",
  "corpo.js", "tela-equipe.js", "cardapio.js", "nutri.js", "tela-nutri.js",
  "plano-alimentar.js", "tela-plano.js", "personal.js", "tela-personal.js",
  "ia-local.js", "tela-ia-ajustes.js", "equipe-ia.js", "equipe.js", "tela-relatorio.js", "lembretes.js",
  "manifest.webmanifest", "fonte.woff2", "icon.svg", "icon-192.png", "icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
  );
});
