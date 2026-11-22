# ADR-0002: API Gateway — tek giriş noktası (REST + WebSocket)

**Durum:** Kabul edildi

## Bağlam

Üç bağımsız servis ve bir de gerçek zamanlı Socket.io katmanı var. İstemci
(web arayüzü) her birine doğrudan bağlanabilir (servis keşfi istemcide) ya da
tek bir giriş noktasından geçebilir.

## Karar

Tüm istemci trafiği — hem REST hem WebSocket — `api-gateway`'den geçer.
Servisler ve veritabanları yalnızca iç Docker ağında, dışarıya kapalı.
Gateway; yönlendirme, `helmet`, CORS, rate limiting, `X-Request-Id`
üretimi/taşınması, 502/504 çevirisi ve `/socket.io` trafiğinin
`http-proxy-middleware`'in `ws: true` + `upgrade` event'iyle
notification-service'e proxy'lenmesini üstleniyor.

## Sonuçlar

**Artı:**
- Güvenlik, rate limiting, CORS gibi kesitsel kaygılar tek yerde; her
  servisin kendi kopyasını doğru tutması gerekmiyor (yine de her servis
  savunma derinliği için kendi rate limitini de taşıyor, bkz. ADR-0008).
- İstemci yalnızca bir adresi (ve bir origin'i, CORS için) bilmek zorunda;
  servis sayısı/adresleri değişebilir.
- `X-Request-Id` tek yerden üretilip tüm servislere taşınıyor; dağıtık izleme
  (bkz. ADR-0007) ve log korelasyonu bu sayede mümkün.

**Eksi:**
- Gateway tek hata noktası (single point of failure) — ama zaten tüm
  servisler de kendi veritabanlarıyla tek nokta, bu mimarinin genel riski.
- Gateway'den geçen her istek aynı kaynak IP'den (gateway container'ı)
  servislere ulaşıyor; bu, servislerin kendi IP bazlı rate limitlerini
  anlamsızlaştırabiliyor — k6 yük testinde fark edilen ve ADR-0008'de
  çözülen durum tam olarak bu.
- WebSocket upgrade'in proxy üzerinden doğru çalıştığından ayrıca emin
  olmak gerekiyor (gerçek bir el sıkışma + mesaj testiyle doğrulandı,
  bkz. README "Testler ve Sonuçlar").
