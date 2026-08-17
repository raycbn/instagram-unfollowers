const CACHE_NAME = "instagram-unfollowers-v3";

const FILES_TO_CACHE = [
    "./",
    "./index.html",
    "./style.css",
    "./manifest.json",
    "./app.js?v=3"
];


/*
========================================
INSTALAR
========================================
*/

self.addEventListener("install", event => {

    event.waitUntil(

        caches.open(CACHE_NAME)
            .then(cache => {

                return cache.addAll(
                    FILES_TO_CACHE
                );

            })

    );

    /*
    Activa inmediatamente
    la nueva versión.
    */

    self.skipWaiting();

});


/*
========================================
ACTIVAR
========================================
*/

self.addEventListener("activate", event => {

    event.waitUntil(

        caches.keys()
            .then(cacheNames => {

                return Promise.all(

                    cacheNames
                        .filter(
                            cacheName =>
                                cacheName !== CACHE_NAME
                        )
                        .map(
                            cacheName =>
                                caches.delete(cacheName)
                        )

                );

            })

    );

    /*
    Toma control inmediatamente
    de las páginas abiertas.
    */

    self.clients.claim();

});


/*
========================================
PETICIONES
========================================
*/

self.addEventListener("fetch", event => {

    /*
    Para app.js queremos siempre
    comprobar primero la red.

    Esto evita quedarnos con
    una versión antigua.
    */

    if (
        event.request.url.includes(
            "/app.js"
        )
    ) {

        event.respondWith(

            fetch(event.request)
                .then(response => {

                    return response;

                })
                .catch(() => {

                    return caches.match(
                        event.request
                    );

                })

        );

        return;
    }


    /*
    Para el resto:

    Cache primero.
    */

    event.respondWith(

        caches.match(event.request)
            .then(cachedResponse => {

                if (cachedResponse) {

                    return cachedResponse;

                }

                return fetch(event.request);

            })

    );

});
