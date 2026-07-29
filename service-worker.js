'use strict';

const CACHE_PREFIX = 'starfishlarp';
const CACHE_VERSION = '2026-07-29-w3';
const APP_SHELL_CACHE = `${CACHE_PREFIX}-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}-runtime-${CACHE_VERSION}`;
const MAX_RUNTIME_ENTRIES = 80;

const APP_SHELL = [
    './',
    './index.html',
    './offline.html',
    './榮譽牆.html',
    './新增玩本記錄.html',
    './7人/津門遺雲.html',
    './7人/津門遺雲.mp3',
    './manifest.webmanifest',
    './index.css?v=20260716',
    './honor-form.css?v=20260729-nomood',
    './scripts.js?v=20260728-tags',
    './scripts-data.js?v=20260728-tags2',
    './hero.js?v=20260702a',
    './vendor/three.min.js',
    './pwa.js?v=20260727',
    './play-record-config.js?v=20260729-w3',
    './play-record.js?v=20260729-nomood',
    './points.js?v=20260729-w3',
    './pwa/favicon-32.png',
    './pwa/apple-touch-icon.png',
    './pwa/icon-192.png',
    './pwa/icon-512.png',
    './pwa/icon-maskable-512.png'
];

self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(APP_SHELL_CACHE).then(function (cache) {
            return cache.addAll(APP_SHELL);
        }).then(function () {
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (key) {
                if (key.startsWith(CACHE_PREFIX + '-') && key !== APP_SHELL_CACHE && key !== RUNTIME_CACHE) {
                    return caches.delete(key);
                }
                return Promise.resolve(false);
            }));
        }).then(function () {
            return self.clients.claim();
        })
    );
});

async function trimRuntimeCache(cache) {
    const requests = await cache.keys();
    while (requests.length > MAX_RUNTIME_ENTRIES) {
        await cache.delete(requests.shift());
    }
}

async function cacheResponse(request, response) {
    if (!response || !response.ok || response.type === 'opaque') return;
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put(request, response.clone());
    await trimRuntimeCache(cache);
}

async function networkFirstNavigation(request) {
    try {
        const response = await fetch(request);
        await cacheResponse(request, response);
        return response;
    } catch (error) {
        const cachedPage = await caches.match(request);
        return cachedPage || caches.match('./offline.html');
    }
}

function staleWhileRevalidate(event) {
    const request = event.request;
    const network = fetch(request).then(async function (response) {
        await cacheResponse(request, response);
        return response;
    }).catch(function () {
        return null;
    });

    event.waitUntil(network.then(function () { return undefined; }));

    // 不忽略 query string：?v= 版號是全站的快取失效機制，忽略會讓使用者拿到舊檔
    return caches.match(request).then(function (cached) {
        if (cached) return cached;
        return network.then(function (response) {
            return response || Response.error();
        });
    });
}

self.addEventListener('fetch', function (event) {
    const request = event.request;
    if (request.method !== 'GET' || request.headers.has('range')) return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (request.mode === 'navigate') {
        event.respondWith(networkFirstNavigation(request));
        return;
    }

    if (['style', 'script', 'worker', 'font', 'image'].includes(request.destination)) {
        event.respondWith(staleWhileRevalidate(event));
    }
});
