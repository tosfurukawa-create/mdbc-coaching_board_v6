// ===================================================
//  Service Worker - 作戦ボード v6
//  - 完全オフライン動作
//  - Cache First 戦略（高速起動、自動更新）
// ===================================================

const CACHE_VERSION = 'v6.0.0';
const CACHE_NAME = 'sakusen-board-' + CACHE_VERSION;

// プリキャッシュするリソース（アプリの全構成ファイル）
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './logo.jpg',
  './court.jpg',
  './ball.jpg'
];

// インストール時：必要リソースをプリキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())  // 即座に有効化
  );
});

// アクティベート時：古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())  // 既存のタブも制御下に
  );
});

// fetch：Cache First 戦略
// - 同一オリジン: キャッシュ優先、なければネットワーク→キャッシュへ追加
// - 外部API (GAS等): ネットワーク優先、失敗時はキャッシュ
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // POST/PUT/DELETE等はキャッシュしない（GAS APIへの保存等）
  if (event.request.method !== 'GET') return;

  // 外部オリジン（GAS API 等）: ネットワーク優先
  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 同一オリジン: キャッシュ優先
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          // 取得成功時はキャッシュに追加
          if (response.ok) {
            const respClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, respClone));
          }
          return response;
        });
      })
      .catch(() => caches.match('./index.html'))  // フォールバック
  );
});

// メッセージ：手動更新トリガー
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
