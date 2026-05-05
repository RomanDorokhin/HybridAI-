/*! coi-serviceworker v0.1.7 | MIT License | https://github.com/gzuidhof/coi-serviceworker */
if (typeof window === "undefined") {
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

  self.addEventListener("fetch", (event) => {
    if (event.request.cache === "only-if-cached" && event.request.mode !== "same-origin") {
      return;
    }

    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.status === 0) {
          return response;
        }

        const newHeaders = new Headers(response.headers);
        newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
        newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      })
    );
  });
} else {
  (() => {
    const script = document.currentScript;
    const reloaded = new URL(window.location.href).searchParams.get("coi");
    if (!reloaded && window.crossOriginIsolated === false) {
      const url = new URL(window.location.href);
      url.searchParams.set("coi", "1");
      window.location.replace(url.href);
    }
    if (script) {
      const swUrl = script.src;
      navigator.serviceWorker.register(swUrl).then((registration) => {
        registration.addEventListener("updatefound", () => {
          location.reload();
        });
      });
    }
  })();
}
