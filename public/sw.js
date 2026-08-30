// Service Worker cơ bản cho BizTask
// Giúp ứng dụng được nhận diện là PWA "có thể cài đặt" (Installable)
// Điều này rất quan trọng để iOS/Android cho phép hiển thị Badge trên icon

const CACHE_NAME = 'biztask-cache-v1';
const urlsToCache = [
  '/',
  '/index.html'
];

self.addEventListener('install', (event) => {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  // Chiến lược Network First: Luôn ưu tiên lấy dữ liệu mới nhất
  // Nếu mất mạng thì mới dùng cache (để app không bị trắng trang)
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});