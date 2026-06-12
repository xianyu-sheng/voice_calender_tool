// Service Worker — 离线缓存核心资源
const CACHE_NAME = 'voice-calendar-v2';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
];

// 安装：预缓存
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // 某些资源可能不存在，忽略错误
      });
    })
  );
  self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      );
    })
  );
  self.clients.claim();
});

// 请求：缓存优先策略（静态资源），网络优先（API）
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API 请求走网络，不缓存
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 静态资源：缓存优先，网络兜底
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
      return cached || fetchPromise;
    })
  );
});
