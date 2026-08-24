/* 가계부 PWA 서비스워커
 *
 * HTML은 항상 네트워크를 먼저 봅니다(network-first). 그래야 새로 배포한 화면이
 * 바로 반영됩니다. 네트워크가 없을 때만 캐시된 화면을 씁니다.
 * 아이콘·매니페스트처럼 잘 바뀌지 않는 파일만 캐시를 먼저 씁니다.
 * API(POST, 외부 오리진)는 캐시하지 않습니다.
 */
const CACHE  = 'gb-v5';
const SHELL  = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(SHELL); })
      .catch(function () { /* 일부 실패해도 설치는 진행 */ })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (ks) {
        return Promise.all(ks.filter(function (k) { return k !== CACHE; })
                             .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (e) {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

function isHtml(req) {
  return req.mode === 'navigate' ||
         (req.headers.get('accept') || '').indexOf('text/html') >= 0;
}

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;                       // API POST 통과
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;             // 외부 요청 통과

  if (isHtml(req)) {
    // 화면은 네트워크 우선 — 새 배포가 즉시 반영됩니다
    e.respondWith(
      fetch(req).then(function (res) {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('./index.html').then(function (hit) {
          return hit || new Response('오프라인입니다.', {
            status: 503, headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
        });
      })
    );
    return;
  }

  // 그 외 정적 자원은 캐시 우선
  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      });
    })
  );
});
