# Mimari Karar Kayıtları (ADR)

Bu klasör, Randevia'nın geliştirilmesi sırasında alınan, gerçek bir alternatifi
olan ve geriye dönüp "neden böyle yapılmıştı?" diye sorulabilecek mimari
kararları kayda geçirir. Küçük/yerel kodlama tercihleri burada değil, ilgili
kodun yanındaki yorumlarda ya da [README](../../README.md)'nin "Tasarım
Kararları" bölümünde yer alır — ADR'ler yalnızca birden fazla servisi,
veri modelini veya güvenlik sınırını etkileyen kararlar içindir.

Format, [Michael Nygard'ın ADR şablonu](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)'nın
sadeleştirilmiş hâlidir: **Bağlam**, **Karar**, **Sonuçlar** (artı/eksi).
Bir karar sonradan değişirse eski ADR silinmez, durumu "Üzerine yazıldı: ADR-00XX"
olarak güncellenir ve yeni bir ADR eklenir — böylece neden değiştirildiği de
tarihte kalır.

| # | Başlık | Durum |
|---|---|---|
| [0001](0001-database-per-service.md) | Database-per-service | Kabul edildi |
| [0002](0002-api-gateway-tek-giris-noktasi.md) | API Gateway: tek giriş noktası (REST + WebSocket) | Kabul edildi |
| [0003](0003-event-driven-transactional-outbox.md) | Olay güdümlü iletişim + transactional outbox | Kabul edildi |
| [0004](0004-token-saklama-ve-rotasyon.md) | Access token bellekte, opak refresh token rotasyonu | Kabul edildi |
| [0005](0005-socketio-oda-modeli-redis-adapter.md) | Socket.io oda modeli + best-effort Redis adapter | Kabul edildi |
| [0006](0006-doktor-adi-denormalizasyonu.md) | Doktor adının appointment-service'e denormalize edilmesi | Kabul edildi |
| [0007](0007-gozlemlenebilirlik-otel-prometheus-grafana.md) | Gözlemlenebilirlik: OpenTelemetry + Prometheus + Grafana | Kabul edildi |
| [0008](0008-servis-bazli-rate-limit-env.md) | Servis bazlı rate limit: sabit değer yerine ortam değişkeni | Kabul edildi |
