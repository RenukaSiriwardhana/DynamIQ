// public/sw.js
self.addEventListener('install', (e) => {
    console.log('[Service Worker] Installed');
});

self.addEventListener('fetch', (e) => {
    // මේක අනිවාර්යයි Install බොත්තම එන්න.
});