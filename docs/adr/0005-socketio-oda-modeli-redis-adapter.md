# ADR-0005: Socket.io oda modeli + best-effort Redis adapter

**Durum:** Kabul edildi

## Bağlam

İki farklı gerçek zamanlı ihtiyaç var: (1) bir kullanıcıya özel bildirim
ulaştırmak, (2) bir doktorun sayfasını izleyen herkese (rolden bağımsız,
hasta da olabilir) müsaitlik değişikliğini anında göstermek. Ayrıca
notification-service birden fazla örnekle (horizontal scale) çalışırsa,
bir kullanıcının socket bağlantısı hangi örnekteyse olay da o örnekten
yayınlanmak zorunda — bunu çözmek için bir pub/sub katmanı gerekiyor.

## Karar

İki ayrı Socket.io oda türü: `user:<id>` (bildirim hedefi, yalnızca o
kullanıcı katılır) ve `doctor:<doctorId>` (sayfa izleyicileri — rolden
bağımsız herkes katılabilir). Birden fazla notification-service örneği
arasında olay paylaşımı için Redis adapter kullanılıyor, ama **best-effort**:
RabbitMQ bağlantısıyla aynı felsefeyle, Redis yoksa servis tek örnek modunda
sorunsuz çalışmaya devam ediyor (Redis zorunlu bir bağımlılık değil).
`slot.updated` olayında istemci, kısmi state güncellemesi yapmak yerine
doktor detayını baştan çekiyor.

## Sonuçlar

**Artı:**
- Bildirim ve müsaitlik izleme birbirinden tamamen ayrı, basit iki oda
  türüyle modellendi; yetkilendirme sadece `user:<id>`'de gerekiyor
  (kendi odasına katılmak).
- Redis olmadan da (geliştirme ortamında, ya da Redis geçici olarak
  erişilemezken) sistem tek örnek olarak çalışmaya devam ediyor — sert bir
  bağımlılık yok.
- `slot.updated` üzerine tam yeniden çekim, kısmi/ince taneli state
  güncellemesinden daha az karmaşık ve her zaman doğru sonuç veriyor (az
  sayıda müsaitlik kaydı için performans farkı önemsiz).

**Eksi:**
- Redis olmadan birden fazla notification-service örneği çalıştırılırsa,
  bir örnekteki bağlantı diğer örnekte üretilen olayı kaçırır — Redis
  adapter, çoklu örnek senaryosunda artık opsiyonel değil, zorunlu.
- `doctor:<doctorId>` odasına rolden bağımsız herkesin katılabilmesi,
  müsaitlik bilgisinin (zaten genel olan) biraz daha geniş yayılması
  anlamına geliyor — hassas bir veri değil, kabul edilebilir bulundu.
